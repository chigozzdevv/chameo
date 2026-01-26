import BN from "bn.js";
import * as crypto from "crypto";
import { keccak256 } from "@ethersproject/keccak256";
import { sha256 } from "@ethersproject/sha2";
import nacl from "tweetnacl";
import { Keypair, PublicKey } from "@solana/web3.js";
import type { LightWasm } from "@lightprotocol/hasher.rs";
import type { Utxo, UtxoKeypair, WalletKeys } from "./types";
import { FIELD_SIZE, SOL_MINT, ENCRYPTION_VERSION } from "./constants";

export function deriveWalletKeys(keypair: Keypair): WalletKeys {
  const message = Buffer.from("Privacy Money account sign in");
  const signature = nacl.sign.detached(message, keypair.secretKey);
  const encryptionKeyV1 = Buffer.from(signature.slice(0, 31));
  const encryptionKeyV2 = Buffer.from(keccak256(Buffer.from(signature)).slice(2), "hex");
  const utxoPrivateKeyV1 = "0x" + crypto.createHash("sha256").update(encryptionKeyV1).digest("hex");
  const utxoPrivateKeyV2 = "0x" + Buffer.from(keccak256(encryptionKeyV2).slice(2), "hex").toString("hex");
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: Buffer.from(keypair.secretKey).toString("base64"),
    encryptionKey: encryptionKeyV2.toString("base64"),
    encryptionKeyV1: encryptionKeyV1.toString("base64"),
    utxoPrivateKey: utxoPrivateKeyV2,
    utxoPrivateKeyV1,
  };
}

export function createUtxoKeypair(privateKey: string, wasm: LightWasm): UtxoKeypair {
  const privkey = new BN((BigInt(privateKey) % BigInt(FIELD_SIZE.toString())).toString());
  const pubkey = new BN(wasm.poseidonHashString([privkey.toString()]));
  return { privkey, pubkey };
}

export function createUtxo(
  wasm: LightWasm,
  keypair: UtxoKeypair,
  amount: BN = new BN(0),
  index: number = 0,
  mintAddress: string = SOL_MINT
): Utxo {
  return { amount, blinding: new BN(crypto.randomInt(1e9)), index, mintAddress, keypair };
}

export function getMintField(mintAddress: string): string {
  if (mintAddress === SOL_MINT) return mintAddress;
  const bytes = Buffer.from(new PublicKey(mintAddress).toBytes());
  return new BN(bytes.slice(0, 31), "be").toString();
}

export function getCommitment(utxo: Utxo, wasm: LightWasm): string {
  return wasm.poseidonHashString([
    utxo.amount.toString(),
    utxo.keypair.pubkey.toString(),
    utxo.blinding.toString(),
    getMintField(utxo.mintAddress),
  ]);
}

export function getNullifier(utxo: Utxo, wasm: LightWasm): string {
  const commitment = getCommitment(utxo, wasm);
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

type EncryptionKeys = {
  v2: Buffer;
  v1?: Buffer;
};

type UtxoKeypairs = {
  v2: UtxoKeypair;
  v1?: UtxoKeypair;
};

function isV2Payload(data: Buffer): boolean {
  // V2 encryption is prefixed with a fixed 8-byte version marker.
  return data.length >= ENCRYPTION_VERSION.length && data.subarray(0, ENCRYPTION_VERSION.length).equals(ENCRYPTION_VERSION);
}

export function decryptUtxo(data: Buffer, keys: EncryptionKeys, keypairs: UtxoKeypairs): Utxo | null {
  try {
    const isV2 = isV2Payload(data);

    if (isV2) {
      const iv = data.subarray(8, 20);
      const authTag = data.subarray(20, 36);
      const encrypted = data.subarray(36);
      const decipher = crypto.createDecipheriv("aes-256-gcm", keys.v2, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
      const [amount, blinding, index, mintAddress] = decrypted.split("|");
      return { amount: new BN(amount), blinding: new BN(blinding), index: parseInt(index), mintAddress, keypair: keypairs.v2 };
    }

    // Fallback to V1 encryption for backward compatibility
    if (!keys.v1 || !keypairs.v1) return null;

    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const encrypted = data.subarray(32);
    const hmacKey = keys.v1.subarray(16, 31);
    const hmac = crypto.createHmac("sha256", hmacKey);
    hmac.update(iv);
    hmac.update(encrypted);
    const calculatedTag = hmac.digest().subarray(0, 16);
    if (!crypto.timingSafeEqual(authTag, calculatedTag)) return null;

    const key = keys.v1.subarray(0, 16);
    const decipher = crypto.createDecipheriv("aes-128-ctr", key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    const [amount, blinding, index, mintAddress] = decrypted.split("|");
    return { amount: new BN(amount), blinding: new BN(blinding), index: parseInt(index), mintAddress, keypair: keypairs.v1 };
  } catch {
    return null;
  }
}

// Manual Borsh-compatible serialization matching Privacy Cash SDK
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
    enc1Len,
    enc1,
    enc2Len,
    enc2,
    Buffer.from(fee.toArray("le", 8)),
    Buffer.from(feeRecipient.toBytes()),
    Buffer.from(mintAddress.toBytes()),
  ]);

  return Buffer.from(sha256(data).slice(2), "hex");
}
