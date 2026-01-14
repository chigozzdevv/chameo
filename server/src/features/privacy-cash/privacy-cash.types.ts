import BN from "bn.js";
export interface WalletDoc {
  campaignId: string;
  publicKey: string;
  secretKey: string;
  encryptionKey: string;
  utxoPrivateKey: string;
  createdAt: number;
}
export interface Utxo {
  amount: BN;
  blinding: BN;
  index: number;
  mintAddress: string;
  keypair: UtxoKeypair;
}
export interface UtxoKeypair {
  privkey: BN;
  pubkey: BN;
}
export interface ProofResult {
  proofA: number[];
  proofB: number[];
  proofC: number[];
  root: number[];
  publicAmount: number[];
  extDataHash: number[];
  inputNullifiers: number[][];
  outputCommitments: number[][];
}
export interface WithdrawResult {
  signature: string;
  amount: number;
  fee: number;
  recipient: string;
}
