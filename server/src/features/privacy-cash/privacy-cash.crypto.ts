import BN from "bn.js";
import * as crypto from "crypto";
import { keccak256 } from "@ethersproject/keccak256";
import { sha256 } from "@ethersproject/sha2";
import nacl from "tweetnacl";
import { Keypair, PublicKey } from "@solana/web3.js";
import type { LightWasm } from "@lightprotocol/hasher.rs";
import type { Utxo, UtxoKeypair } from "./privacy-cash.types";
import { FIELD_SIZE, SOL_MINT } from "./privacy-cash.constants";
const ENCRYPTION_VERSION = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02]);
export function deriveKeys(keypair: Keypair): { encryptionKey: Buffer; utxoPrivateKey: string } {
  const message = Buffer.from("Privacy Money account sign in");
  const signature = nacl.sign.detached(message, keypair.secretKey);
  const encryptionKey = Buffer.from(keccak256(Buffer.from(signature)).slice(2), "hex");
  const utxoPrivateKey = "0x" + Buffer.from(keccak256(encryptionKey).slice(2), "hex").toString("hex");
  return { encryptionKey, utxoPrivateKey };
}
export function createUtxoKeypair(privateKey: string, wasm: LightWasm): UtxoKeypair {
  const privkey = new BN((BigInt(privateKey) % BigInt(FIELD_SIZE.toString())).toString());
  const pubkey = new BN(wasm.poseidonHashString([privkey.toString()]));
  return { privkey, pubkey };
}
export function createUtxo(wasm: LightWasm, keypair: UtxoKeypair, amount: BN = new BN(0), index: number = 0): Utxo {
  return {
    amount,
    blinding: new BN(crypto.randomInt(1e9)),
    index,
    mintAddress: SOL_MINT,
    keypair,
  };
}
export function getMintField(mintAddress: string): string {
  if (mintAddress === SOL_MINT) return mintAddress;
  const bytes = Buffer.from(new PublicKey(mintAddress).toBytes());
  return new BN(bytes.slice(0, 31), "be").toString();
}
export async function getCommitment(utxo: Utxo, wasm: LightWasm): Promise<string> {
  return wasm.poseidonHashString([
    utxo.amount.toString(),
    utxo.keypair.pubkey.toString(),
    utxo.blinding.toString(),
    getMintField(utxo.mintAddress),
  ]);
}
export async function getNullifier(utxo: Utxo, wasm: LightWasm): Promise<string> {
  const commitment = await getCommitment(utxo, wasm);
  const sig = wasm.poseidonHashString([utxo.keypair.privkey.toString(), commitment, utxo.index.toString()]);
  return wasm.poseidonHashString([commitment, utxo.index.toString(), sig]);
}
export function encryptUtxo(utxo: Utxo, encryptionKey: Buffer): Buffer {
  const data = `${utxo.amount}|${utxo.blinding}|${utxo.index}|${utxo.mintAddress}`;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  return Buffer.concat([ENCRYPTION_VERSION, iv, cipher.getAuthTag(), encrypted]);
}
export function decryptUtxo(data: Buffer, encryptionKey: Buffer, keypair: UtxoKeypair): Utxo | null {
  try {
    const iv = data.slice(8, 20);
    const authTag = data.slice(20, 36);
    const encrypted = data.slice(36);
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    const [amount, blinding, index, mintAddress] = decrypted.split("|");
    return { amount: new BN(amount), blinding: new BN(blinding), index: parseInt(index), mintAddress, keypair };
  } catch {
    return null;
  }
}
export function getExtDataHash(
  recipient: PublicKey,
  extAmount: BN,
  enc1: Buffer,
  enc2: Buffer,
  fee: BN,
  feeRecipient: PublicKey,
  mintAddress: PublicKey
): Uint8Array {
  const enc1Len = Buffer.alloc(4);
  enc1Len.writeUInt32LE(enc1.length);
  const enc2Len = Buffer.alloc(4);
  enc2Len.writeUInt32LE(enc2.length);
  const data = Buffer.concat([
    Buffer.from(recipient.toBytes()),
    Buffer.from(extAmount.toTwos(64).toArray("le", 8)),
    enc1Len, enc1,
    enc2Len, enc2,
    Buffer.from(fee.toArray("le", 8)),
    Buffer.from(feeRecipient.toBytes()),
    Buffer.from(mintAddress.toBytes()),
  ]);
  return Buffer.from(sha256(data).slice(2), "hex");
}
