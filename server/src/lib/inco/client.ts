import { PublicKey, Keypair, SystemProgram, ComputeBudgetProgram } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { devnetConnection, env } from "@/config";
import { encryptValue } from "@inco/solana-sdk/encryption";
import { decrypt } from "@inco/solana-sdk/attested-decrypt";
import nacl from "tweetnacl";

const PROGRAM_ID = new PublicKey(env.inco.programId || "GvoS27ShvsjMoWumJnHnuLbCZpHSS8k36uJFzuctvQtU");
const INCO_LIGHTNING_ID = new PublicKey("5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj");

let _program: Program | null = null;
let _serverKeypair: Keypair | null = null;

function getServerKeypair(): Keypair {
  if (!_serverKeypair) {
    if (!env.inco.serverPrivateKey) {
      throw new Error("INCO_SERVER_PRIVATE_KEY not configured");
    }
    _serverKeypair = Keypair.fromSecretKey(Buffer.from(env.inco.serverPrivateKey, "base64"));
  }
  return _serverKeypair;
}

export function getServerPublicKey(): PublicKey {
  return getServerKeypair().publicKey;
}

async function getProgram(): Promise<Program> {
  if (!_program) {
    // Anchor IDL is shared with contracts; load it lazily to keep startup light.
    const idl = require("../../../../contracts/target/idl/chameo_privacy.json");
    const wallet = new Wallet(getServerKeypair());
    const provider = new AnchorProvider(devnetConnection, wallet, { commitment: "confirmed" });
    _program = new Program(idl, provider);
  }
  return _program;
}

function parseHandle(value: any): bigint {
  // Anchor can return handles as BN, bigint, or nested objects depending on account shape.
  if (value?.toString) {
    const asString = value.toString();
    if (/^\d+$/.test(asString)) return BigInt(asString);
  }
  if (value && value._bn) return BigInt(value._bn.toString(10));
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (value && typeof value === "object" && value["0"]) {
    const nested = value["0"];
    if (nested?._bn) return BigInt(nested._bn.toString(10));
    if (nested?.toString) return BigInt(nested.toString());
  }
  return BigInt(0);
}

function parseBytes32(value: any): Buffer {
  if (!value) return Buffer.alloc(32, 0);
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (Array.isArray(value)) return Buffer.from(value);
  return Buffer.alloc(32, 0);
}

async function decryptHandles(handles: bigint[]): Promise<string[]> {
  const keypair = getServerKeypair();
  const result = await decrypt(
    handles.map((h) => h.toString()),
    {
      address: keypair.publicKey,
      signMessage: async (message: Uint8Array) => nacl.sign.detached(message, keypair.secretKey),
    }
  );
  return result.plaintexts;
}

export function getCampaignIdBytes(campaignId: string): number[] {
  // PDA seeds are fixed-width; zero-pad or truncate to 32 bytes.
  const hash = Buffer.alloc(32);
  const bytes = Buffer.from(campaignId, "utf-8");
  bytes.copy(hash, 0, 0, Math.min(bytes.length, 32));
  return Array.from(hash);
}

export function findVotingPoolPda(campaignId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("voting_pool"), Buffer.from(getCampaignIdBytes(campaignId))], PROGRAM_ID);
}

export function findNullifierPda(campaignId: string, nullifier: Uint8Array): [PublicKey, number] {
  if (nullifier.length !== 32) {
    throw new Error("Nullifier must be 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [Buffer.from("nullifier"), Buffer.from(getCampaignIdBytes(campaignId)), Buffer.from(nullifier)],
    PROGRAM_ID
  );
}

export function findAnalyticsPda(campaignId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("analytics"), Buffer.from(getCampaignIdBytes(campaignId))], PROGRAM_ID);
}

export function findAllowancePda(handle: bigint, allowedAddress: PublicKey): [PublicKey, number] {
  const handleBuffer = Buffer.alloc(16);
  let h = handle;
  for (let i = 0; i < 16; i++) {
    handleBuffer[i] = Number(h & BigInt(0xff));
    h = h >> BigInt(8);
  }
  // Handles are encoded as 128-bit little-endian for the Inco Lightning PDA seed.
  return PublicKey.findProgramAddressSync([handleBuffer, allowedAddress.toBuffer()], INCO_LIGHTNING_ID);
}

export async function initializeVotingPool(campaignId: string, eligibilityRoot: Buffer, zkVerifierProgram: PublicKey): Promise<string> {
  const program = await getProgram();
  const keypair = getServerKeypair();
  const campaignIdBytes = getCampaignIdBytes(campaignId);
  const [votingPool] = findVotingPoolPda(campaignId);

  const tx = await (program.methods as any)
    .initializeVotingPool(campaignIdBytes, Array.from(eligibilityRoot), zkVerifierProgram)
    .accounts({
      votingPool,
      authority: keypair.publicKey,
      incoLightningProgram: INCO_LIGHTNING_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

export async function setEligibilityRoot(campaignId: string, eligibilityRoot: Buffer): Promise<string> {
  const program = await getProgram();
  const keypair = getServerKeypair();
  const campaignIdBytes = getCampaignIdBytes(campaignId);
  const [votingPool] = findVotingPoolPda(campaignId);

  const tx = await (program.methods as any)
    .setEligibilityRoot(campaignIdBytes, Array.from(eligibilityRoot))
    .accounts({
      votingPool,
      authority: keypair.publicKey,
    })
    .rpc();

  return tx;
}

export async function castVoteZk(params: {
  campaignId: string;
  nullifier: Buffer;
  proof: Buffer;
  publicWitness: Buffer;
  encryptedVote: Buffer;
}): Promise<string> {
  const { campaignId, nullifier, proof, publicWitness, encryptedVote } = params;
  if (!env.zk.verifierProgramId) {
    throw new Error("ZK_VERIFIER_PROGRAM_ID not configured");
  }

  const program = await getProgram();
  const keypair = getServerKeypair();
  const campaignIdBytes = getCampaignIdBytes(campaignId);
  const [votingPool] = findVotingPoolPda(campaignId);
  const [nullifierPda] = findNullifierPda(campaignId, nullifier);
  const zkVerifierProgram = new PublicKey(env.zk.verifierProgramId);

  const tx = await (program.methods as any)
    .castVoteZk(campaignIdBytes, Array.from(nullifier), proof, publicWitness, encryptedVote)
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })])
    .accounts({
      nullifier: nullifierPda,
      votingPool,
      relayer: keypair.publicKey,
      zkVerifierProgram,
      incoLightningProgram: INCO_LIGHTNING_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

export async function closeVoting(campaignId: string, allowedAddress: PublicKey): Promise<string> {
  const program = await getProgram();
  const keypair = getServerKeypair();
  const campaignIdBytes = getCampaignIdBytes(campaignId);
  const [votingPool] = findVotingPoolPda(campaignId);

  const state = await getVotingPoolState(campaignId);
  if (!state) throw new Error("Voting pool not found");

  const [allowanceRefund] = findAllowancePda(state.refundHostVotesHandle, allowedAddress);
  const [allowanceEqual] = findAllowancePda(state.equalDistributionVotesHandle, allowedAddress);

  const tx = await (program.methods as any)
    .closeVoting(campaignIdBytes, allowedAddress)
    .accounts({
      votingPool,
      authority: keypair.publicKey,
      allowedAddress,
      allowanceRefund,
      allowanceEqual,
      incoLightningProgram: INCO_LIGHTNING_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

export async function initializeAnalytics(campaignId: string): Promise<string> {
  const program = await getProgram();
  const keypair = getServerKeypair();
  const campaignIdBytes = getCampaignIdBytes(campaignId);
  const [analytics] = findAnalyticsPda(campaignId);

  const tx = await (program.methods as any)
    .initializeAnalytics(campaignIdBytes)
    .accounts({
      analytics,
      authority: keypair.publicKey,
      incoLightningProgram: INCO_LIGHTNING_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

export async function trackEventOnChain(campaignId: string, eventType: 0 | 1 | 2 | 3 | 4 | 5): Promise<string> {
  const program = await getProgram();
  const keypair = getServerKeypair();
  const campaignIdBytes = getCampaignIdBytes(campaignId);
  const [analytics] = findAnalyticsPda(campaignId);

  const encryptedIncrement = await encryptValue(BigInt(1));
  const encryptedIncrementBuffer = Buffer.from(encryptedIncrement, "hex");

  const tx = await (program.methods as any)
    .trackEvent(campaignIdBytes, encryptedIncrementBuffer, eventType)
    .accounts({
      analytics,
      authority: keypair.publicKey,
      incoLightningProgram: INCO_LIGHTNING_ID,
    })
    .rpc();

  return tx;
}

export async function grantAnalyticsAccess(
  campaignId: string,
  creatorPubkey: PublicKey
): Promise<{
  signature: string;
  handles: {
    pageViewsHandle: bigint;
    linkClicksHandle: bigint;
    claimStartsHandle: bigint;
    claimSuccessesHandle: bigint;
    claimFailuresHandle: bigint;
    votesHandle: bigint;
  };
}> {
  const program = await getProgram();
  const keypair = getServerKeypair();
  const campaignIdBytes = getCampaignIdBytes(campaignId);
  const [analytics] = findAnalyticsPda(campaignId);

  const state = await getAnalyticsState(campaignId);
  if (!state) throw new Error("Analytics not found");

  const [allowancePageViews] = findAllowancePda(state.pageViewsHandle, creatorPubkey);
  const [allowanceLinkClicks] = findAllowancePda(state.linkClicksHandle, creatorPubkey);
  const [allowanceClaimStarts] = findAllowancePda(state.claimStartsHandle, creatorPubkey);
  const [allowanceClaimSuccesses] = findAllowancePda(state.claimSuccessesHandle, creatorPubkey);
  const [allowanceClaimFailures] = findAllowancePda(state.claimFailuresHandle, creatorPubkey);
  const [allowanceVotes] = findAllowancePda(state.votesHandle, creatorPubkey);

  const tx = await (program.methods as any)
    .grantAnalyticsAccess(campaignIdBytes, creatorPubkey)
    .accounts({
      analytics,
      authority: keypair.publicKey,
      allowedAddress: creatorPubkey,
      allowancePageViews,
      allowanceLinkClicks,
      allowanceClaimStarts,
      allowanceClaimSuccesses,
      allowanceClaimFailures,
      allowanceVotes,
      incoLightningProgram: INCO_LIGHTNING_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { signature: tx, handles: state };
}

export async function getAnalyticsHandles(campaignId: string): Promise<{
  pageViewsHandle: string;
  linkClicksHandle: string;
  claimStartsHandle: string;
  claimSuccessesHandle: string;
  claimFailuresHandle: string;
  votesHandle: string;
} | null> {
  const state = await getAnalyticsState(campaignId);
  if (!state) return null;

  return {
    pageViewsHandle: state.pageViewsHandle.toString(),
    linkClicksHandle: state.linkClicksHandle.toString(),
    claimStartsHandle: state.claimStartsHandle.toString(),
    claimSuccessesHandle: state.claimSuccessesHandle.toString(),
    claimFailuresHandle: state.claimFailuresHandle.toString(),
    votesHandle: state.votesHandle.toString(),
  };
}

export async function getAnalyticsState(campaignId: string): Promise<{
  pageViewsHandle: bigint;
  linkClicksHandle: bigint;
  claimStartsHandle: bigint;
  claimSuccessesHandle: bigint;
  claimFailuresHandle: bigint;
  votesHandle: bigint;
} | null> {
  const program = await getProgram();
  const [analytics] = findAnalyticsPda(campaignId);

  try {
    const state = await (program.account as any).analytics.fetch(analytics);
    return {
      pageViewsHandle: parseHandle(state.pageViews),
      linkClicksHandle: parseHandle(state.linkClicks),
      claimStartsHandle: parseHandle(state.claimStarts),
      claimSuccessesHandle: parseHandle(state.claimSuccesses),
      claimFailuresHandle: parseHandle(state.claimFailures),
      votesHandle: parseHandle(state.votes),
    };
  } catch {
    return null;
  }
}

export async function getVotingPoolState(campaignId: string): Promise<{
  totalVotes: number;
  isActive: boolean;
  refundHostVotesHandle: bigint;
  equalDistributionVotesHandle: bigint;
  authority: PublicKey;
  eligibilityRoot: Buffer;
  zkVerifierProgram: PublicKey;
} | null> {
  const program = await getProgram();
  const [votingPool] = findVotingPoolPda(campaignId);

  try {
    const state = await (program.account as any).votingPool.fetch(votingPool);
    return {
      totalVotes: state.totalVotes.toNumber(),
      isActive: state.isActive,
      refundHostVotesHandle: parseHandle(state.refundHostVotes),
      equalDistributionVotesHandle: parseHandle(state.equalDistributionVotes),
      authority: state.authority,
      eligibilityRoot: parseBytes32(state.eligibilityRoot),
      zkVerifierProgram: state.zkVerifierProgram,
    };
  } catch {
    return null;
  }
}

export async function decryptVoteTotals(campaignId: string): Promise<{ refundHost: number; equalDistribution: number } | null> {
  const state = await getVotingPoolState(campaignId);
  if (!state) return null;
  try {
    const plaintexts = await decryptHandles([state.refundHostVotesHandle, state.equalDistributionVotesHandle]);
    return {
      refundHost: parseInt(plaintexts[0], 10),
      equalDistribution: parseInt(plaintexts[1], 10),
    };
  } catch {
    return null;
  }
}
