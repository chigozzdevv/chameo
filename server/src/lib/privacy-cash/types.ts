import BN from "bn.js";

export interface UtxoKeypair {
  privkey: BN;
  pubkey: BN;
}

export interface Utxo {
  amount: BN;
  blinding: BN;
  index: number;
  mintAddress: string;
  keypair: UtxoKeypair;
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

export interface MerkleProof {
  pathElements: string[];
  pathIndices: number[];
}

export interface TreeState {
  root: string;
  nextIndex: number;
}

export interface RelayerConfig {
  withdraw_fee_rate: number;
  withdraw_rent_fee: number;
  deposit_fee_rate: number;
}

export interface WithdrawResult {
  signature: string;
  amount: number;
  fee: number;
  recipient: string;
  isPartial: boolean;
}

export interface WithdrawEstimate {
  requestedLamports: number;
  feeLamports: number;
  netLamports: number;
  feeRate: number;
  rentFeeLamports: number;
}

export interface DepositResult {
  signature: string;
}

export interface WalletKeys {
  publicKey: string;
  secretKey: string;
  encryptionKey: string;
  encryptionKeyV1: string;
  utxoPrivateKey: string;
  utxoPrivateKeyV1: string;
}
