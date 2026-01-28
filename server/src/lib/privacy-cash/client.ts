import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  TransactionMessage,
  ComputeBudgetProgram,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { WasmFactory, type LightWasm } from "@lightprotocol/hasher.rs";
import { utils as ffUtils } from "ffjavascript";
import BN from "bn.js";
import { env, connection } from "@/config";
import type { Utxo, UtxoKeypair, WalletKeys, WithdrawResult, DepositResult, RelayerConfig, WithdrawEstimate } from "./types";
import { MERKLE_TREE_DEPTH, SOL_MINT } from "./constants";
import {
  deriveWalletKeys,
  createUtxoKeypair,
  createUtxo,
  getCommitment,
  getNullifier,
  encryptUtxo,
  decryptUtxo,
  getExtDataHash,
} from "./crypto";
import { generateProof, serializeProof, calculatePublicAmount, findNullifierPDAs, getProgramPDAs } from "./prover";
import {
  fetchTreeState,
  fetchMerkleProof,
  fetchRelayerConfig,
  fetchEncryptedUtxos,
  fetchUtxoIndices,
  checkUtxoExists,
  submitWithdraw,
  submitDeposit,
} from "./relayer";

const PROGRAM_ID = new PublicKey(env.privacyCash.programId);
const FEE_RECIPIENT = new PublicKey(env.privacyCash.feeRecipient);
const ALT_ADDRESS = new PublicKey(env.privacyCash.altAddress);
const FETCH_BATCH_SIZE = 20000;
const MAX_CONFIRMATION_RETRIES = 15;
const CONFIRMATION_INTERVAL_MS = 2000;

export function generateWalletKeys(): WalletKeys {
  const keypair = Keypair.generate();
  return deriveWalletKeys(keypair);
}

export async function getPrivateBalance(keys: WalletKeys): Promise<number> {
  const wasm = await WasmFactory.getInstance();
  const encryptionKey = Buffer.from(keys.encryptionKey, "base64");
  const encryptionKeyV1 = keys.encryptionKeyV1 ? Buffer.from(keys.encryptionKeyV1, "base64") : undefined;
  const utxoKeypair = createUtxoKeypair(keys.utxoPrivateKey, wasm);
  const utxoKeypairV1 = keys.utxoPrivateKeyV1 ? createUtxoKeypair(keys.utxoPrivateKeyV1, wasm) : undefined;
  const utxos = await fetchUnspentUtxos(encryptionKey, utxoKeypair, wasm, encryptionKeyV1, utxoKeypairV1);
  return utxos.reduce((sum, u) => sum + u.amount.toNumber(), 0);
}

export async function withdraw(keys: WalletKeys, requestedAmount: number, recipient: string): Promise<WithdrawResult> {
  const wasm = await WasmFactory.getInstance();
  const encryptionKey = Buffer.from(keys.encryptionKey, "base64");
  const encryptionKeyV1 = keys.encryptionKeyV1 ? Buffer.from(keys.encryptionKeyV1, "base64") : undefined;
  const utxoKeypair = createUtxoKeypair(keys.utxoPrivateKey, wasm);
  const utxoKeypairV1 = keys.utxoPrivateKeyV1 ? createUtxoKeypair(keys.utxoPrivateKeyV1, wasm) : undefined;
  const utxos = await fetchUnspentUtxos(encryptionKey, utxoKeypair, wasm, encryptionKeyV1, utxoKeypairV1);

  if (utxos.length === 0) throw new Error("No UTXOs available");

  utxos.sort((a, b) => b.amount.cmp(a.amount));

  const cfg = await fetchRelayerConfig();
  const { withdrawFeeRate, withdrawRentFee } = normalizeRelayerConfig(cfg);

  // Calculate fees: percentage + rent
  let fee = Math.floor(requestedAmount * withdrawFeeRate + LAMPORTS_PER_SOL * withdrawRentFee);
  let amount = Math.floor(requestedAmount - fee);
  let isPartial = false;

  const { root, nextIndex } = await fetchTreeState();
  const recipientPk = new PublicKey(recipient);

  // Use largest UTXOs as inputs, create dummy if only one UTXO
  const input1 = utxos[0];
  const input2 = utxos[1] || createUtxo(wasm, utxoKeypair);
  const inputs = [input1, input2];
  const totalInput = input1.amount.add(input2.amount).toNumber();

  if (totalInput <= 0) throw new Error("Insufficient balance for withdrawal after fees");
  if (totalInput < amount + fee) {
    isPartial = true;
    amount = totalInput - fee;
  }

  if (amount <= 0) throw new Error("Insufficient balance for withdrawal after fees");

  const change = input1.amount.add(input2.amount).sub(new BN(amount)).sub(new BN(fee));
  const outputs = [createUtxo(wasm, utxoKeypair, change, nextIndex), createUtxo(wasm, utxoKeypair, new BN(0), nextIndex + 1)];

  const proofs = await fetchInputProofs(inputs, wasm);
  const nullifiers = inputs.map((u) => getNullifier(u, wasm));
  const commitments = outputs.map((u) => getCommitment(u, wasm));

  const enc1 = encryptUtxo(outputs[0], encryptionKey);
  const enc2 = encryptUtxo(outputs[1], encryptionKey);

  const extAmount = -amount;
  const publicAmount = calculatePublicAmount(extAmount, fee);
  const extHash = getExtDataHash(recipientPk, new BN(extAmount), enc1, enc2, new BN(fee), FEE_RECIPIENT, new PublicKey(SOL_MINT));

  const proofInput = buildProofInput(root, inputs, outputs, nullifiers, commitments, proofs, publicAmount, extHash);
  const proof = await generateProof(proofInput);

  const pdas = findNullifierPDAs(proof.inputNullifiers);
  const accounts = getProgramPDAs();
  const serialized = serializeProof(proof, extAmount, fee, enc1, enc2);

  const params = {
    serializedProof: serialized.toString("base64"),
    treeAccount: accounts.tree.toString(),
    nullifier0PDA: pdas.n0.toString(),
    nullifier1PDA: pdas.n1.toString(),
    nullifier2PDA: pdas.n2.toString(),
    nullifier3PDA: pdas.n3.toString(),
    treeTokenAccount: accounts.token.toString(),
    globalConfigAccount: accounts.global.toString(),
    recipient,
    feeRecipientAccount: FEE_RECIPIENT.toString(),
    extAmount,
    encryptedOutput1: enc1.toString("base64"),
    encryptedOutput2: enc2.toString("base64"),
    fee,
    lookupTableAddress: ALT_ADDRESS.toString(),
    senderAddress: keys.publicKey,
  };

  const result = await submitWithdraw(params);
  await waitForConfirmation(enc1.toString("hex"));

  return { signature: result.signature, amount, fee, recipient, isPartial };
}

export async function getWithdrawEstimate(targetLamports: number): Promise<WithdrawEstimate> {
  const cfg = await fetchRelayerConfig();
  const { withdrawFeeRate, withdrawRentFee } = normalizeRelayerConfig(cfg);
  const rentFeeLamports = Math.round(withdrawRentFee * LAMPORTS_PER_SOL);
  const target = Math.max(0, Math.floor(targetLamports));

  if (target <= 0 || withdrawFeeRate >= 1) {
    return {
      requestedLamports: target,
      feeLamports: 0,
      netLamports: target,
      feeRate: withdrawFeeRate,
      rentFeeLamports,
    };
  }

  const requestedLamports = Math.ceil((target + rentFeeLamports) / (1 - withdrawFeeRate));
  const feeLamports = Math.floor(requestedLamports * withdrawFeeRate + rentFeeLamports);
  const netLamports = Math.max(0, requestedLamports - feeLamports);

  return { requestedLamports, feeLamports, netLamports, feeRate: withdrawFeeRate, rentFeeLamports };
}

export async function deposit(keys: WalletKeys, amount: number): Promise<DepositResult> {
  const keypair = Keypair.fromSecretKey(Buffer.from(keys.secretKey, "base64"));
  const wasm = await WasmFactory.getInstance();
  const encryptionKey = Buffer.from(keys.encryptionKey, "base64");
  const encryptionKeyV1 = keys.encryptionKeyV1 ? Buffer.from(keys.encryptionKeyV1, "base64") : undefined;
  const utxoKeypair = createUtxoKeypair(keys.utxoPrivateKey, wasm);
  const utxoKeypairV1 = keys.utxoPrivateKeyV1 ? createUtxoKeypair(keys.utxoPrivateKeyV1, wasm) : undefined;

  const onChainBalance = await connection.getBalance(keypair.publicKey);
  if (onChainBalance < amount) throw new Error(`Insufficient on-chain balance: ${onChainBalance} < ${amount}`);

  const cfg = await fetchRelayerConfig();
  const { depositFeeRate } = normalizeRelayerConfig(cfg);
  const fee = Math.floor(amount * depositFeeRate);

  if (fee > 0 && amount <= fee) {
    throw new Error("Deposit amount too low after fees");
  }

  const accounts = getProgramPDAs();
  const depositLimit = await fetchDepositLimit(connection, accounts.tree);

  if (depositLimit && new BN(amount).gt(depositLimit)) {
    throw new Error(`Deposit exceeds limit: ${amount} > ${depositLimit.toString()}`);
  }

  const existingUtxos = await fetchUnspentUtxos(encryptionKey, utxoKeypair, wasm, encryptionKeyV1, utxoKeypairV1);
  const { root, nextIndex } = await fetchTreeState();

  const input1 = existingUtxos[0] || createUtxo(wasm, utxoKeypair);
  const input2 = existingUtxos[1] || createUtxo(wasm, utxoKeypair);
  const inputs = [input1, input2];

  const existingTotal = input1.amount.add(input2.amount);
  // Fee is taken from the deposited amount, so outputs reflect the net value.
  const outputAmount = existingTotal.add(new BN(amount)).sub(new BN(fee));
  const outputs = [createUtxo(wasm, utxoKeypair, outputAmount, nextIndex), createUtxo(wasm, utxoKeypair, new BN(0), nextIndex + 1)];

  const proofs = await fetchInputProofs(inputs, wasm);
  const nullifiers = inputs.map((u) => getNullifier(u, wasm));
  const commitments = outputs.map((u) => getCommitment(u, wasm));

  const enc1 = encryptUtxo(outputs[0], encryptionKey);
  const enc2 = encryptUtxo(outputs[1], encryptionKey);

  const extAmount = amount;
  const publicAmount = calculatePublicAmount(extAmount, fee);
  const recipientPlaceholder = new PublicKey("AWexibGxNFKTa1b5R5MN4PJr9HWnWRwf8EW9g8cLx3dM");
  const extHash = getExtDataHash(recipientPlaceholder, new BN(extAmount), enc1, enc2, new BN(fee), FEE_RECIPIENT, new PublicKey(SOL_MINT));

  const proofInput = buildProofInput(root, inputs, outputs, nullifiers, commitments, proofs, publicAmount, extHash);
  const proof = await generateProof(proofInput);

  const pdas = findNullifierPDAs(proof.inputNullifiers);
  const serialized = serializeProof(proof, extAmount, fee, enc1, enc2);

  const depositIx = new TransactionInstruction({
    keys: [
      { pubkey: accounts.tree, isSigner: false, isWritable: true },
      { pubkey: pdas.n0, isSigner: false, isWritable: true },
      { pubkey: pdas.n1, isSigner: false, isWritable: true },
      { pubkey: pdas.n2, isSigner: false, isWritable: false },
      { pubkey: pdas.n3, isSigner: false, isWritable: false },
      { pubkey: accounts.token, isSigner: false, isWritable: true },
      { pubkey: accounts.global, isSigner: false, isWritable: false },
      { pubkey: recipientPlaceholder, isSigner: false, isWritable: true },
      { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
      { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: serialized,
  });

  const computeIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 });
  const { blockhash } = await connection.getLatestBlockhash();
  const altAccount = await connection.getAddressLookupTable(ALT_ADDRESS);

  if (!altAccount.value) throw new Error("ALT not found");

  const message = new TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: blockhash,
    instructions: [computeIx, depositIx],
  }).compileToV0Message([altAccount.value]);

  const tx = new VersionedTransaction(message);
  tx.sign([keypair]);

  const result = await submitDeposit(Buffer.from(tx.serialize()).toString("base64"), keypair.publicKey.toString());
  await waitForConfirmation(enc1.toString("hex"));

  return { signature: result.signature };
}

async function fetchUnspentUtxos(
  encryptionKey: Buffer,
  keypair: UtxoKeypair,
  wasm: LightWasm,
  encryptionKeyV1?: Buffer,
  keypairV1?: UtxoKeypair
): Promise<Utxo[]> {
  const decryptedUtxos: { utxo: Utxo; encryptedOutput: string }[] = [];
  let offset = 0;

  // Fetch all encrypted UTXOs from relayer
  while (true) {
    const data = await fetchEncryptedUtxos(offset, offset + FETCH_BATCH_SIZE);

    for (const enc of data.encrypted_outputs || []) {
      const utxo = decryptUtxo(
        Buffer.from(enc, "hex"),
        { v2: encryptionKey, v1: encryptionKeyV1 },
        { v2: keypair, v1: keypairV1 }
      );
      if (utxo && utxo.amount.toNumber() > 0) {
        decryptedUtxos.push({ utxo, encryptedOutput: enc });
      }
    }

    if (!data.hasMore) break;
    offset += data.encrypted_outputs?.length || 0;
  }

  if (decryptedUtxos.length === 0) return [];

  // Sync UTXO indices from relayer
  const indices = await fetchUtxoIndices(decryptedUtxos.map((d) => d.encryptedOutput));
  for (let i = 0; i < decryptedUtxos.length; i++) {
    if (typeof indices[i] === "number") {
      decryptedUtxos[i].utxo.index = indices[i];
    }
  }

  // Filter out spent UTXOs by checking nullifier PDAs
  const unspent: Utxo[] = [];
  const pdaChecks: PublicKey[] = [];

  for (const { utxo } of decryptedUtxos) {
    const nullifier = getNullifier(utxo, wasm);
    const bytes = Buffer.from((Array.from(ffUtils.leInt2Buff(ffUtils.unstringifyBigInts(nullifier), 32)) as number[]).reverse());
    const [pda0] = PublicKey.findProgramAddressSync([Buffer.from("nullifier0"), bytes], PROGRAM_ID);
    const [pda1] = PublicKey.findProgramAddressSync([Buffer.from("nullifier1"), bytes], PROGRAM_ID);
    pdaChecks.push(pda0, pda1);
  }

  const accounts = await connection.getMultipleAccountsInfo(pdaChecks);

  for (let i = 0; i < decryptedUtxos.length; i++) {
    const pda0Exists = accounts[i * 2] !== null;
    const pda1Exists = accounts[i * 2 + 1] !== null;
    if (!pda0Exists && !pda1Exists) {
      unspent.push(decryptedUtxos[i].utxo);
    }
  }

  return unspent;
}

async function fetchInputProofs(inputs: Utxo[], wasm: LightWasm): Promise<{ pathElements: string[] }[]> {
  return Promise.all(
    inputs.map(async (u) => {
      if (u.amount.eq(new BN(0))) {
        return { pathElements: Array(MERKLE_TREE_DEPTH).fill("0") };
      }
      const commitment = getCommitment(u, wasm);
      return fetchMerkleProof(commitment);
    })
  );
}

function buildProofInput(
  root: string,
  inputs: Utxo[],
  outputs: Utxo[],
  nullifiers: string[],
  commitments: string[],
  proofs: { pathElements: string[] }[],
  publicAmount: BN,
  extHash: Uint8Array
): Record<string, unknown> {
  return {
    root,
    inputNullifier: nullifiers,
    outputCommitment: commitments,
    publicAmount: publicAmount.toString(),
    extDataHash: extHash,
    inAmount: inputs.map((x) => x.amount.toString()),
    inPrivateKey: inputs.map((x) => x.keypair.privkey.toString()),
    inBlinding: inputs.map((x) => x.blinding.toString()),
    inPathIndices: inputs.map((x) => x.index),
    inPathElements: proofs.map((p) => p.pathElements),
    outAmount: outputs.map((x) => x.amount.toString()),
    outBlinding: outputs.map((x) => x.blinding.toString()),
    outPubkey: outputs.map((x) => x.keypair.pubkey.toString()),
    mintAddress: SOL_MINT,
  };
}

function normalizeFeeRate(rate: number, label: string): number {
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error(`Invalid ${label}: ${rate}`);
  }
  return rate > 1 ? rate / 10000 : rate;
}

function normalizeRelayerConfig(cfg: RelayerConfig): {
  depositFeeRate: number;
  withdrawFeeRate: number;
  withdrawRentFee: number;
} {
  const depositFeeRate = normalizeFeeRate(cfg.deposit_fee_rate, "deposit fee rate");
  const withdrawFeeRate = normalizeFeeRate(cfg.withdraw_fee_rate, "withdraw fee rate");
  if (!Number.isFinite(cfg.withdraw_rent_fee) || cfg.withdraw_rent_fee < 0) {
    throw new Error(`Invalid withdraw rent fee: ${cfg.withdraw_rent_fee}`);
  }
  return { depositFeeRate, withdrawFeeRate, withdrawRentFee: cfg.withdraw_rent_fee };
}

async function fetchDepositLimit(connection: Connection, treeAccount: PublicKey): Promise<BN | null> {
  const info = await connection.getAccountInfo(treeAccount);
  if (!info || info.data.length < 4128) return null;
  // Tree account layout stores max_deposit_amount at bytes 4120..4128 (little-endian u64).
  return new BN(info.data.slice(4120, 4128), "le");
}

async function waitForConfirmation(encryptedOutputHex: string): Promise<void> {
  for (let i = 0; i < MAX_CONFIRMATION_RETRIES; i++) {
    await new Promise((r) => setTimeout(r, CONFIRMATION_INTERVAL_MS));
    const exists = await checkUtxoExists(encryptedOutputHex);
    if (exists) return;
  }
  throw new Error("Transaction confirmation timeout");
}
