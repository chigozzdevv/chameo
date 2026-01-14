import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { WasmFactory, type LightWasm } from "@lightprotocol/hasher.rs";
import { utils as ffUtils } from "ffjavascript";
import BN from "bn.js";
import { config } from "@/config";
import { col, connection } from "@/shared";
import type { WalletDoc, Utxo, WithdrawResult } from "./privacy-cash.types";
import { MERKLE_TREE_DEPTH, SOL_MINT } from "./privacy-cash.constants";
import {
  deriveKeys,
  createUtxoKeypair,
  createUtxo,
  getCommitment,
  getNullifier,
  encryptUtxo,
  decryptUtxo,
  getExtDataHash,
} from "./privacy-cash.crypto";
import {
  generateProof,
  serializeProof,
  calculatePublicAmount,
  findNullifierPDAs,
  getProgramPDAs,
} from "./privacy-cash.prover";
const RELAYER_URL = config.privacyCash.relayerUrl;
const PROGRAM_ID = new PublicKey(config.privacyCash.programId);
const FEE_RECIPIENT = new PublicKey(config.privacyCash.feeRecipient);
const ALT_ADDRESS = new PublicKey(config.privacyCash.altAddress);
export async function createWallet(campaignId: string): Promise<{ publicKey: string }> {
  const keypair = Keypair.generate();
  const { encryptionKey, utxoPrivateKey } = deriveKeys(keypair);
  await col<WalletDoc>("wallets").insertOne({
    campaignId,
    publicKey: keypair.publicKey.toBase58(),
    secretKey: Buffer.from(keypair.secretKey).toString("base64"),
    encryptionKey: encryptionKey.toString("base64"),
    utxoPrivateKey,
    createdAt: Date.now(),
  });
  return { publicKey: keypair.publicKey.toBase58() };
}
export async function getWallet(campaignId: string): Promise<WalletDoc | null> {
  return col<WalletDoc>("wallets").findOne({ campaignId });
}
export async function getBalance(campaignId: string): Promise<number> {
  const wallet = await getWallet(campaignId);
  if (!wallet) throw new Error("Wallet not found");
  const wasm = await WasmFactory.getInstance();
  const encryptionKey = Buffer.from(wallet.encryptionKey, "base64");
  const keypair = createUtxoKeypair(wallet.utxoPrivateKey, wasm);
  const utxos = await fetchUnspentUtxos(encryptionKey, keypair, wasm);
  return utxos.reduce((sum, u) => sum + u.amount.toNumber(), 0);
}
export async function withdraw(campaignId: string, amount: number, recipient: string): Promise<WithdrawResult> {
  const wallet = await getWallet(campaignId);
  if (!wallet) throw new Error("Wallet not found");
  const wasm = await WasmFactory.getInstance();
  const encryptionKey = Buffer.from(wallet.encryptionKey, "base64");
  const keypair = createUtxoKeypair(wallet.utxoPrivateKey, wasm);
  const utxos = await fetchUnspentUtxos(encryptionKey, keypair, wasm);
  if (utxos.length === 0) throw new Error("No UTXOs available");
  const cfg = await fetchRelayerConfig();
  const fee = Math.floor(amount * cfg.withdraw_fee_rate + LAMPORTS_PER_SOL * cfg.withdraw_rent_fee);
  const total = utxos.reduce((s, u) => s + u.amount.toNumber(), 0);
  if (total < amount + fee) throw new Error(`Insufficient balance: ${total} < ${amount + fee}`);
  const { root, nextIndex } = await fetchTreeState();
  const recipientPk = new PublicKey(recipient);
  const input1 = utxos[0];
  const input2 = utxos[1] || createUtxo(wasm, keypair);
  const inputs = [input1, input2];
  const change = input1.amount.add(input2.amount).sub(new BN(amount)).sub(new BN(fee));
  const outputs = [
    createUtxo(wasm, keypair, change, nextIndex),
    createUtxo(wasm, keypair, new BN(0), nextIndex + 1),
  ];
  const proofs = await Promise.all(
    inputs.map(async (u) => {
      if (u.amount.eq(new BN(0))) {
        return { pathElements: Array(MERKLE_TREE_DEPTH).fill("0"), pathIndices: Array(MERKLE_TREE_DEPTH).fill(0) };
      }
      const commitment = await getCommitment(u, wasm);
      const res = await fetch(`${RELAYER_URL}/merkle/proof/${commitment}`);
      if (!res.ok) throw new Error("Failed to fetch merkle proof");
      return res.json();
    })
  );
  const nullifiers = await Promise.all(inputs.map((u) => getNullifier(u, wasm)));
  const commitments = await Promise.all(outputs.map((u) => getCommitment(u, wasm)));
  const enc1 = encryptUtxo(outputs[0], encryptionKey);
  const enc2 = encryptUtxo(outputs[1], encryptionKey);
  const extAmount = -amount;
  const publicAmount = calculatePublicAmount(extAmount, fee);
  const extHash = getExtDataHash(recipientPk, new BN(extAmount), enc1, enc2, new BN(fee), FEE_RECIPIENT, new PublicKey(SOL_MINT));
  const proofInput = {
    root,
    inputNullifier: nullifiers,
    outputCommitment: commitments,
    publicAmount: publicAmount.toString(),
    extDataHash: extHash,
    inAmount: inputs.map((x) => x.amount.toString()),
    inPrivateKey: inputs.map((x) => x.keypair.privkey),
    inBlinding: inputs.map((x) => x.blinding.toString()),
    inPathIndices: inputs.map((x) => x.index),
    inPathElements: proofs.map((p: any) => p.pathElements),
    outAmount: outputs.map((x) => x.amount.toString()),
    outBlinding: outputs.map((x) => x.blinding.toString()),
    outPubkey: outputs.map((x) => x.keypair.pubkey),
    mintAddress: SOL_MINT,
  };
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
    senderAddress: wallet.publicKey,
  };
  const res = await fetch(`${RELAYER_URL}/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Withdraw failed: ${await res.text()}`);
  const result = (await res.json()) as { signature: string };
  return { signature: result.signature, amount, fee, recipient };
}
async function fetchUnspentUtxos(encryptionKey: Buffer, keypair: ReturnType<typeof createUtxoKeypair>, wasm: LightWasm): Promise<Utxo[]> {
  const utxos: Utxo[] = [];
  let offset = 0;
  while (true) {
    const res = await fetch(`${RELAYER_URL}/utxos/range?start=${offset}&end=${offset + 20000}`);
    if (!res.ok) throw new Error("Failed to fetch utxos");
    const data = (await res.json()) as { encrypted_outputs?: string[]; hasMore: boolean };
    for (const enc of data.encrypted_outputs || []) {
      const utxo = decryptUtxo(Buffer.from(enc, "hex"), encryptionKey, keypair);
      if (utxo && utxo.amount.toNumber() > 0) utxos.push(utxo);
    }
    if (!data.hasMore) break;
    offset += (data.encrypted_outputs || []).length;
  }
  const unspent: Utxo[] = [];
  for (const utxo of utxos) {
    const nullifier = await getNullifier(utxo, wasm);
    const bytes = Buffer.from((Array.from(ffUtils.leInt2Buff(ffUtils.unstringifyBigInts(nullifier), 32)) as number[]).reverse());
    const [pda0] = PublicKey.findProgramAddressSync([Buffer.from("nullifier0"), bytes], PROGRAM_ID);
    const [pda1] = PublicKey.findProgramAddressSync([Buffer.from("nullifier1"), bytes], PROGRAM_ID);
    const accounts = await connection.getMultipleAccountsInfo([pda0, pda1]);
    if (!accounts[0] && !accounts[1]) unspent.push(utxo);
  }
  return unspent;
}
export async function deposit(campaignId: string, amount: number): Promise<{ signature: string }> {
  const wallet = await getWallet(campaignId);
  if (!wallet) throw new Error("Wallet not found");
  const keypair = Keypair.fromSecretKey(Buffer.from(wallet.secretKey, "base64"));
  const wasm = await WasmFactory.getInstance();
  const encryptionKey = Buffer.from(wallet.encryptionKey, "base64");
  const utxoKeypair = createUtxoKeypair(wallet.utxoPrivateKey, wasm);
  const onChainBalance = await connection.getBalance(keypair.publicKey);
  if (onChainBalance < amount) {
    throw new Error(`Insufficient on-chain balance: ${onChainBalance} < ${amount}`);
  }
  const existingUtxos = await fetchUnspentUtxos(encryptionKey, utxoKeypair, wasm);
  const { root, nextIndex } = await fetchTreeState();
  const input1 = existingUtxos[0] || createUtxo(wasm, utxoKeypair);
  const input2 = existingUtxos[1] || createUtxo(wasm, utxoKeypair);
  const inputs = [input1, input2];
  const existingTotal = input1.amount.add(input2.amount);
  const outputAmount = existingTotal.add(new BN(amount));
  const outputs = [
    createUtxo(wasm, utxoKeypair, outputAmount, nextIndex),
    createUtxo(wasm, utxoKeypair, new BN(0), nextIndex + 1),
  ];
  const proofs = await Promise.all(
    inputs.map(async (u) => {
      if (u.amount.eq(new BN(0))) {
        return { pathElements: Array(MERKLE_TREE_DEPTH).fill("0") };
      }
      const commitment = await getCommitment(u, wasm);
      const res = await fetch(`${RELAYER_URL}/merkle/proof/${commitment}`);
      if (!res.ok) throw new Error("Failed to fetch merkle proof");
      return res.json();
    })
  );
  const nullifiers = await Promise.all(inputs.map((u) => getNullifier(u, wasm)));
  const commitments = await Promise.all(outputs.map((u) => getCommitment(u, wasm)));
  const enc1 = encryptUtxo(outputs[0], encryptionKey);
  const enc2 = encryptUtxo(outputs[1], encryptionKey);
  const extAmount = amount; 
  const publicAmount = calculatePublicAmount(extAmount, 0);
  const extHash = getExtDataHash(
    FEE_RECIPIENT, 
    new BN(extAmount),
    enc1,
    enc2,
    new BN(0),
    FEE_RECIPIENT,
    new PublicKey(SOL_MINT)
  );
  const proofInput = {
    root,
    inputNullifier: nullifiers,
    outputCommitment: commitments,
    publicAmount: publicAmount.toString(),
    extDataHash: extHash,
    inAmount: inputs.map((x) => x.amount.toString()),
    inPrivateKey: inputs.map((x) => x.keypair.privkey),
    inBlinding: inputs.map((x) => x.blinding.toString()),
    inPathIndices: inputs.map((x) => x.index),
    inPathElements: proofs.map((p: any) => p.pathElements),
    outAmount: outputs.map((x) => x.amount.toString()),
    outBlinding: outputs.map((x) => x.blinding.toString()),
    outPubkey: outputs.map((x) => x.keypair.pubkey),
    mintAddress: SOL_MINT,
  };
  const proof = await generateProof(proofInput);
  const serialized = serializeProof(proof, extAmount, 0, enc1, enc2);
  const { VersionedTransaction, TransactionMessage, ComputeBudgetProgram, TransactionInstruction, SystemProgram } = await import("@solana/web3.js");
  const pdas = findNullifierPDAs(proof.inputNullifiers);
  const accounts = getProgramPDAs();
  const depositIx = new TransactionInstruction({
    keys: [
      { pubkey: accounts.tree, isSigner: false, isWritable: true },
      { pubkey: pdas.n0, isSigner: false, isWritable: true },
      { pubkey: pdas.n1, isSigner: false, isWritable: true },
      { pubkey: pdas.n2, isSigner: false, isWritable: false },
      { pubkey: pdas.n3, isSigner: false, isWritable: false },
      { pubkey: accounts.token, isSigner: false, isWritable: true },
      { pubkey: accounts.global, isSigner: false, isWritable: false },
      { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
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
  const res = await fetch(`${RELAYER_URL}/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signedTransaction: Buffer.from(tx.serialize()).toString("base64"),
      senderAddress: keypair.publicKey.toString(),
    }),
  });
  if (!res.ok) throw new Error(`Deposit failed: ${await res.text()}`);
  const result = (await res.json()) as { signature: string };
  return { signature: result.signature };
}
async function fetchRelayerConfig(): Promise<{ withdraw_fee_rate: number; withdraw_rent_fee: number }> {
  const res = await fetch(`${RELAYER_URL}/config`);
  if (!res.ok) throw new Error("Failed to fetch relayer config");
  return res.json();
}
async function fetchTreeState(): Promise<{ root: string; nextIndex: number }> {
  const res = await fetch(`${RELAYER_URL}/merkle/root`);
  if (!res.ok) throw new Error("Failed to fetch tree state");
  return res.json();
}
