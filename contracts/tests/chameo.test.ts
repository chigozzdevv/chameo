import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from "@solana/web3.js";
import { execFile } from "child_process";
import { promisify } from "util";
import nacl from "tweetnacl";
import { encryptValue } from "@inco/solana-sdk/encryption";
import { decrypt } from "@inco/solana-sdk/attested-decrypt";
import { WasmFactory } from "@lightprotocol/hasher.rs";
import BN from "bn.js";
import assert from "assert";
import { readFileSync, writeFileSync, existsSync } from "fs";
import os from "os";
import path from "path";
import { createHash } from "crypto";

const idlPath = path.resolve("target/idl/chameo_privacy.json");
const idl = JSON.parse(readFileSync(idlPath, "utf-8"));

const PROGRAM_ID = new PublicKey("GvoS27ShvsjMoWumJnHnuLbCZpHSS8k36uJFzuctvQtU");
const INCO_LIGHTNING_ID = new PublicKey("5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj");
const ZK_VERIFIER_PROGRAM_ID = new PublicKey(
  process.env.ZK_VERIFIER_PROGRAM_ID || "7n63xmE82LCYQkshU1QErzygTRuRXPnoG3U2AozKzT68"
);
const RPC_URL = process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";
const ZK_MERKLE_DEPTH = 16;
const ZK_CHUNK_SIZE = 16;
const ZK_CIRCUIT_DIR = path.resolve(process.cwd(), "../zk/noir/vote_eligibility");
const ZK_TARGET_DIR = path.join(ZK_CIRCUIT_DIR, "target");
const execFileAsync = promisify(execFile);
let poseidonHasherPromise: Promise<any> | null = null;

function getCampaignIdBytes(campaignId: string): number[] {
  const hash = Buffer.alloc(32);
  const bytes = Buffer.from(campaignId, "utf-8");
  bytes.copy(hash, 0, 0, Math.min(bytes.length, 32));
  return Array.from(hash);
}

function findVotingPoolPda(campaignId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("voting_pool"), Buffer.from(getCampaignIdBytes(campaignId))],
    PROGRAM_ID
  );
}

function findAnalyticsPda(campaignId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("analytics"), Buffer.from(getCampaignIdBytes(campaignId))],
    PROGRAM_ID
  );
}

function findNullifierPda(campaignId: string, nullifier: Uint8Array): [PublicKey, number] {
  if (nullifier.length !== 32) {
    throw new Error("Nullifier must be 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [Buffer.from("nullifier"), Buffer.from(getCampaignIdBytes(campaignId)), Buffer.from(nullifier)],
    PROGRAM_ID
  );
}

function findAllowancePda(handle: bigint, allowedAddress: PublicKey): [PublicKey, number] {
  const handleBuffer = Buffer.alloc(16);
  let h = handle;
  for (let i = 0; i < 16; i++) {
    handleBuffer[i] = Number(h & BigInt(0xff));
    h = h >> BigInt(8);
  }
  return PublicKey.findProgramAddressSync(
    [handleBuffer, allowedAddress.toBuffer()],
    INCO_LIGHTNING_ID
  );
}

async function getPoseidonHasher(): Promise<any> {
  if (!poseidonHasherPromise) {
    poseidonHasherPromise = WasmFactory.getInstance();
  }
  return poseidonHasherPromise;
}

function chunkBytes(bytes: Buffer, chunkSize: number): Buffer[] {
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = Buffer.alloc(chunkSize);
    bytes.copy(chunk, 0, offset, Math.min(offset + chunkSize, bytes.length));
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    chunks.push(Buffer.alloc(chunkSize));
  }
  return chunks;
}

async function poseidonHashFields(fields: BN[]): Promise<Buffer> {
  const hasher = await getPoseidonHasher();
  const out = hasher.poseidonHash(fields);
  return Buffer.from(out);
}

async function poseidonHashBytes(bytes: Buffer): Promise<Buffer> {
  const chunks = chunkBytes(bytes, ZK_CHUNK_SIZE);
  const fields = chunks.map((chunk) => new BN(chunk));
  return poseidonHashFields(fields);
}

async function hashIdentityLeaf(identity: Buffer): Promise<Buffer> {
  const fields = chunkBytes(identity, ZK_CHUNK_SIZE).slice(0, 2).map((chunk) => new BN(chunk));
  while (fields.length < 2) {
    fields.push(new BN(0));
  }
  return poseidonHashFields(fields);
}

async function buildZeroNodes(depth: number): Promise<Buffer[]> {
  const zeros: Buffer[] = [Buffer.alloc(32, 0)];
  for (let i = 0; i < depth; i += 1) {
    const next = await poseidonHashFields([new BN(zeros[i]), new BN(zeros[i])]);
    zeros.push(next);
  }
  return zeros;
}

async function buildSingleLeafProof(leafHash: Buffer, depth: number): Promise<{
  root: Buffer;
  siblings: Buffer[];
  pathBits: number[];
}> {
  const zeros = await buildZeroNodes(depth);
  const siblings: Buffer[] = [];
  const pathBits: number[] = [];
  let current = leafHash;

  for (let i = 0; i < depth; i += 1) {
    const sibling = zeros[i];
    siblings.push(sibling);
    pathBits.push(0);
    current = await poseidonHashFields([new BN(current), new BN(sibling)]);
  }

  return { root: current, siblings, pathBits };
}

function bufferToArrayString(buf: Buffer): string {
  return `[${Array.from(buf).join(", ")}]`;
}

function bufferToFieldString(buf: Buffer): string {
  return new BN(buf).toString(10);
}

function resolveBin(name: string, fallbackPaths: string[]): string {
  for (const candidate of fallbackPaths) {
    if (existsSync(candidate)) return candidate;
  }
  return name;
}

async function ensureZkArtifacts(nargoBin: string, sunspotBin: string): Promise<void> {
  if (!existsSync(ZK_CIRCUIT_DIR)) {
    throw new Error(`ZK circuit directory not found: ${ZK_CIRCUIT_DIR}`);
  }

  const jsonPath = path.join(ZK_TARGET_DIR, "vote_eligibility.json");
  const ccsPath = path.join(ZK_TARGET_DIR, "vote_eligibility.ccs");
  const pkPath = path.join(ZK_TARGET_DIR, "vote_eligibility.pk");

  if (!existsSync(jsonPath)) {
    await execFileAsync(nargoBin, ["compile"], { cwd: ZK_CIRCUIT_DIR });
  }
  if (!existsSync(ccsPath)) {
    await execFileAsync(sunspotBin, ["compile", jsonPath], { cwd: ZK_CIRCUIT_DIR });
  }
  if (!existsSync(pkPath)) {
    await execFileAsync(sunspotBin, ["setup", ccsPath], { cwd: ZK_CIRCUIT_DIR });
  }
}

function extractHandle(anchorHandle: any): bigint {
  if (anchorHandle && anchorHandle._bn) {
    return BigInt(anchorHandle._bn.toString(10));
  }
  if (typeof anchorHandle === "object" && anchorHandle["0"]) {
    const nested = anchorHandle["0"];
    if (nested && nested._bn) return BigInt(nested._bn.toString(10));
    if (nested && nested.toString && nested.constructor?.name === "BN") {
      return BigInt(nested.toString(10));
    }
  }
  if (anchorHandle instanceof Uint8Array || Array.isArray(anchorHandle)) {
    const buffer = Buffer.from(anchorHandle);
    let result = BigInt(0);
    for (let i = buffer.length - 1; i >= 0; i--) {
      result = result * BigInt(256) + BigInt(buffer[i]);
    }
    return result;
  }
  if (typeof anchorHandle === "number" || typeof anchorHandle === "bigint") {
    return BigInt(anchorHandle);
  }
  return BigInt(0);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function decryptHandlesWithRetry(
  handles: bigint[],
  wallet: Keypair,
  attempts: number = 5
): Promise<string[]> {
  const handleStrings = handles.map((h) => h.toString());
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await decrypt(handleStrings, {
        address: wallet.publicKey,
        signMessage: async (message: Uint8Array) => nacl.sign.detached(message, wallet.secretKey),
      });
      return result.plaintexts;
    } catch (error) {
      if (i === attempts - 1) throw error;
      await sleep(2000);
    }
  }
  throw new Error("decrypt failed");
}

describe("chameo-privacy integration", () => {
  const connection = new Connection(RPC_URL, "confirmed");
  const walletPath = process.env.ANCHOR_WALLET || path.join(os.homedir(), ".config/solana/id.json");
  const wallet = new anchor.Wallet(
    Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(walletPath, "utf-8"))))
  );
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = new Program({ ...(idl as anchor.Idl), address: PROGRAM_ID.toBase58() }, provider);
  const walletKeypair = (provider.wallet as any).payer as Keypair;

  const campaignId = `test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const campaignIdBytes = getCampaignIdBytes(campaignId);
  const [votingPool] = findVotingPoolPda(campaignId);
  const [analytics] = findAnalyticsPda(campaignId);
  const eligibilityRoot = Buffer.alloc(32, 0);

  let voterA: Keypair;

  function deriveKeypair(tag: string): Keypair {
    const seed = createHash("sha256")
      .update(Buffer.from(walletKeypair.secretKey))
      .update(tag)
      .digest();
    return Keypair.fromSeed(seed);
  }

  function formatSol(lamports: number): string {
    return (lamports / LAMPORTS_PER_SOL).toFixed(4);
  }

  async function requireBalance(label: string, pubkey: PublicKey, minLamports: number): Promise<void> {
    const balance = await connection.getBalance(pubkey);
    if (balance >= minLamports) return;
    const needed = minLamports - balance;
    throw new Error(`${label} ${pubkey.toBase58()} needs ${formatSol(needed)} SOL (min ${formatSol(minLamports)} SOL)`);
  }

  before(async () => {
    voterA = deriveKeypair("chameo-test-voter-a");

    console.log("Test wallet:", walletKeypair.publicKey.toBase58());
    console.log("Voter A:", voterA.publicKey.toBase58());

    await requireBalance("Test wallet", walletKeypair.publicKey, 2 * LAMPORTS_PER_SOL);
  });

  it("initializes voting pool and analytics", async () => {
    await program.methods
      .initializeVotingPool(campaignIdBytes, Array.from(eligibilityRoot), ZK_VERIFIER_PROGRAM_ID)
      .accounts({
        votingPool,
        authority: walletKeypair.publicKey,
        incoLightningProgram: INCO_LIGHTNING_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .initializeAnalytics(campaignIdBytes)
      .accounts({
        analytics,
        authority: walletKeypair.publicKey,
        incoLightningProgram: INCO_LIGHTNING_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const votingState = await (program.account as any).votingPool.fetch(votingPool);
    assert.strictEqual(votingState.isActive, true);
    assert.strictEqual(votingState.totalVotes.toNumber(), 0);

    const analyticsState = await (program.account as any).analytics.fetch(analytics);
    assert.ok(analyticsState.authority.equals(walletKeypair.publicKey));
  });

  it("exposes expected IDL structure", () => {
    const grant = (idl as any).instructions.find((ix: any) => ix.name === "grant_analytics_access");
    assert.ok(grant, "grant_analytics_access not found");
    const accountNames = grant.accounts.map((account: any) => account.name);
    assert.deepStrictEqual(accountNames, [
      "analytics",
      "authority",
      "allowed_address",
      "allowance_page_views",
      "allowance_link_clicks",
      "allowance_claim_starts",
      "inco_lightning_program",
      "system_program",
    ]);

    const accountTypes = (idl as any).accounts.map((account: any) => account.name);
    assert.ok(accountTypes.includes("VotingPool"));
    assert.ok(accountTypes.includes("Nullifier"));

    const castVoteZk = (idl as any).instructions.find((ix: any) => ix.name === "cast_vote_zk");
    assert.ok(castVoteZk, "cast_vote_zk not found");
    const castVoteZkAccounts = castVoteZk.accounts.map((account: any) => account.name);
    assert.deepStrictEqual(castVoteZkAccounts, [
      "nullifier",
      "voting_pool",
      "relayer",
      "zk_verifier_program",
      "inco_lightning_program",
      "system_program",
    ]);
  });

  it("casts ZK vote via relayer without exposing voter", async () => {
    const nargoBin = resolveBin("nargo", [path.join(os.homedir(), ".nargo/bin/nargo")]);
    const sunspotBin = resolveBin("sunspot", [path.join(os.homedir(), ".local/bin/sunspot")]);
    await ensureZkArtifacts(nargoBin, sunspotBin);

    const zkCampaignId = `zk-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const zkCampaignIdBytes = getCampaignIdBytes(zkCampaignId);
    const [zkVotingPool] = findVotingPoolPda(zkCampaignId);

    const identityHash = createHash("sha256").update(`zk-identity-${zkCampaignId}`).digest();
    const secret = createHash("sha256").update(`zk-secret-${zkCampaignId}`).digest();

    const encryptedVote = await encryptValue(BigInt(1));
    const ciphertext = Buffer.from(encryptedVote, "hex");
    assert.strictEqual(ciphertext.length, 114);

    const leafHash = await hashIdentityLeaf(identityHash);
    const { root, siblings, pathBits } = await buildSingleLeafProof(leafHash, ZK_MERKLE_DEPTH);

    await program.methods
      .initializeVotingPool(zkCampaignIdBytes, Array.from(root), ZK_VERIFIER_PROGRAM_ID)
      .accounts({
        votingPool: zkVotingPool,
        authority: walletKeypair.publicKey,
        incoLightningProgram: INCO_LIGHTNING_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const nullifier = await poseidonHashBytes(secret);
    const commitment = await poseidonHashBytes(ciphertext);

    const proverToml = [
      `leaf = ${bufferToArrayString(identityHash)}`,
      "",
      `siblings = [`,
      siblings.map((sibling) => `  ${bufferToArrayString(sibling)}`).join(",\n"),
      `]`,
      "",
      `path_bits = [${pathBits.join(", ")}]`,
      "",
      `secret = ${bufferToArrayString(secret)}`,
      "",
      `ciphertext = ${bufferToArrayString(ciphertext)}`,
      "",
      `merkle_root = "${bufferToFieldString(root)}"`,
      `nullifier = "${bufferToFieldString(nullifier)}"`,
      `commitment = "${bufferToFieldString(commitment)}"`,
      "",
    ].join("\n");

    writeFileSync(path.join(ZK_CIRCUIT_DIR, "Prover.toml"), proverToml);

    await execFileAsync(nargoBin, ["execute"], { cwd: ZK_CIRCUIT_DIR });

    const jsonPath = path.join(ZK_TARGET_DIR, "vote_eligibility.json");
    const witnessPath = path.join(ZK_TARGET_DIR, "vote_eligibility.gz");
    const ccsPath = path.join(ZK_TARGET_DIR, "vote_eligibility.ccs");
    const pkPath = path.join(ZK_TARGET_DIR, "vote_eligibility.pk");

    await execFileAsync(sunspotBin, ["prove", jsonPath, witnessPath, ccsPath, pkPath], { cwd: ZK_CIRCUIT_DIR });

    const proof = readFileSync(path.join(ZK_TARGET_DIR, "vote_eligibility.proof"));
    const publicWitness = readFileSync(path.join(ZK_TARGET_DIR, "vote_eligibility.pw"));

    assert.strictEqual(proof.length, 388);
    assert.strictEqual(publicWitness.length, 108);

    const [nullifierPda] = findNullifierPda(zkCampaignId, nullifier);

    const signature = await program.methods
      .castVoteZk(zkCampaignIdBytes, Array.from(nullifier), proof, publicWitness, ciphertext)
      .accounts({
        nullifier: nullifierPda,
        votingPool: zkVotingPool,
        relayer: walletKeypair.publicKey,
        zkVerifierProgram: ZK_VERIFIER_PROGRAM_ID,
        incoLightningProgram: INCO_LIGHTNING_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
      .rpc();

    await connection.confirmTransaction(signature, "confirmed");
    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    assert.ok(tx, "transaction not found");

    // Ensure the relayer is the only signer and the voter key is absent.
    const message = tx.transaction.message as any;
    const rawKeys = message.getAccountKeys
      ? message.getAccountKeys().staticAccountKeys
      : message.accountKeys;
    const accountKeys = rawKeys.map((key: PublicKey | string) =>
      typeof key === "string" ? key : key.toBase58()
    );
    const signerKeys = accountKeys.filter((_, index) => tx.transaction.message.isAccountSigner(index));

    assert.ok(accountKeys.includes(ZK_VERIFIER_PROGRAM_ID.toBase58()));
    assert.ok(!accountKeys.includes(voterA.publicKey.toBase58()));
    assert.deepStrictEqual(signerKeys, [walletKeypair.publicKey.toBase58()]);

    const state = await (program.account as any).votingPool.fetch(zkVotingPool);
    assert.strictEqual(state.totalVotes.toNumber(), 1);

    const refundHandle = extractHandle(state.refundHostVotes);
    const equalHandle = extractHandle(state.equalDistributionVotes);
    const [allowanceRefund] = findAllowancePda(refundHandle, walletKeypair.publicKey);
    const [allowanceEqual] = findAllowancePda(equalHandle, walletKeypair.publicKey);

    await program.methods
      .closeVoting(zkCampaignIdBytes, walletKeypair.publicKey)
      .accounts({
        votingPool: zkVotingPool,
        authority: walletKeypair.publicKey,
        allowedAddress: walletKeypair.publicKey,
        allowanceRefund,
        allowanceEqual,
        incoLightningProgram: INCO_LIGHTNING_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const closed = await (program.account as any).votingPool.fetch(zkVotingPool);
    assert.strictEqual(closed.isActive, false);

    await sleep(2000);
    const plaintexts = await decryptHandlesWithRetry([refundHandle, equalHandle], walletKeypair);
    assert.strictEqual(parseInt(plaintexts[0], 10), 0);
    assert.strictEqual(parseInt(plaintexts[1], 10), 1);
  });

  it("tracks analytics, grants access, and decrypts totals", async () => {
    const encryptedIncrement = await encryptValue(BigInt(1));
    const incrementBuffer = Buffer.from(encryptedIncrement, "hex");

    await program.methods
      .trackEvent(campaignIdBytes, incrementBuffer, 0)
      .accounts({
        analytics,
        authority: walletKeypair.publicKey,
        incoLightningProgram: INCO_LIGHTNING_ID,
      })
      .rpc();

    await program.methods
      .trackEvent(campaignIdBytes, incrementBuffer, 1)
      .accounts({
        analytics,
        authority: walletKeypair.publicKey,
        incoLightningProgram: INCO_LIGHTNING_ID,
      })
      .rpc();

    await program.methods
      .trackEvent(campaignIdBytes, incrementBuffer, 2)
      .accounts({
        analytics,
        authority: walletKeypair.publicKey,
        incoLightningProgram: INCO_LIGHTNING_ID,
      })
      .rpc();

    const state = await (program.account as any).analytics.fetch(analytics);
    const pageViewsHandle = extractHandle(state.pageViews);
    const linkClicksHandle = extractHandle(state.linkClicks);
    const claimStartsHandle = extractHandle(state.claimStarts);

    const [allowancePageViews] = findAllowancePda(pageViewsHandle, walletKeypair.publicKey);
    const [allowanceLinkClicks] = findAllowancePda(linkClicksHandle, walletKeypair.publicKey);
    const [allowanceClaimStarts] = findAllowancePda(claimStartsHandle, walletKeypair.publicKey);

    await program.methods
      .grantAnalyticsAccess(campaignIdBytes, walletKeypair.publicKey)
      .accounts({
        analytics,
        authority: walletKeypair.publicKey,
        allowedAddress: walletKeypair.publicKey,
        allowancePageViews,
        allowanceLinkClicks,
        allowanceClaimStarts,
        incoLightningProgram: INCO_LIGHTNING_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await sleep(2000);
    const plaintexts = await decryptHandlesWithRetry(
      [pageViewsHandle, linkClicksHandle, claimStartsHandle],
      walletKeypair
    );
    assert.strictEqual(parseInt(plaintexts[0], 10), 1);
    assert.strictEqual(parseInt(plaintexts[1], 10), 1);
    assert.strictEqual(parseInt(plaintexts[2], 10), 1);
  });
});
