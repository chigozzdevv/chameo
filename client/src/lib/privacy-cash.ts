import type { VersionedTransaction } from "@solana/web3.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { WasmFactory, type LightWasm } from "@lightprotocol/hasher.rs";
import {
  deposit,
  withdraw,
  getUtxos,
  getBalanceFromUtxos,
  getConfig,
  EncryptionService,
} from "privacycash/utils";

export type WalletProvider = {
  publicKey: PublicKey;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
};

export type PrivacyCashContext = {
  connection: Connection;
  lightWasm: LightWasm;
  encryptionService: EncryptionService;
};

export type WithdrawEstimate = {
  requestedLamports: number;
  feeLamports: number;
  netLamports: number;
  feeRate: number;
  rentFeeLamports: number;
};

export type DepositEstimate = {
  netLamports: number;
  feeLamports: number;
  feeRate: number;
  depositLamports: number;
};

const SIGN_MESSAGE = "Privacy Money account sign in";
const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com";
const KEY_BASE_PATH = "/privacy-cash/transaction2";
const NULLIFIER_ACCOUNT_SIZE = 9;
const NULLIFIER_ACCOUNT_COUNT = 2;
const DEFAULT_TX_FEE_LAMPORTS = 5_000;

function getStorage(): Storage {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("Local storage is unavailable.");
  }
  return window.localStorage;
}

function normalizeFeeRate(rate: number): number {
  if (!Number.isFinite(rate) || rate < 0) return 0;
  return rate > 1 ? rate / 10000 : rate;
}

export async function initPrivacyCashContext(
  wallet: WalletProvider,
  rpcUrl?: string
): Promise<PrivacyCashContext> {
  const message = new TextEncoder().encode(SIGN_MESSAGE);
  const signature = await wallet.signMessage(message);
  const encryptionService = new EncryptionService();
  encryptionService.deriveEncryptionKeyFromSignature(signature);
  const connection = new Connection(rpcUrl || DEFAULT_RPC_URL, "confirmed");
  const lightWasm = await WasmFactory.getInstance();
  return { connection, encryptionService, lightWasm };
}

export async function getPrivacyCashBalance(
  context: PrivacyCashContext,
  wallet: WalletProvider
): Promise<number> {
  const utxos = await getUtxos({
    publicKey: wallet.publicKey,
    connection: context.connection,
    encryptionService: context.encryptionService,
    storage: getStorage(),
  });
  const balance = getBalanceFromUtxos(utxos);
  return balance.lamports;
}

export async function depositToPrivacyCash(
  context: PrivacyCashContext,
  wallet: WalletProvider,
  lamports: number
): Promise<string> {
  const result = await deposit({
    lightWasm: context.lightWasm,
    storage: getStorage(),
    keyBasePath: KEY_BASE_PATH,
    publicKey: wallet.publicKey,
    connection: context.connection,
    amount_in_lamports: lamports,
    encryptionService: context.encryptionService,
    transactionSigner: async (tx: VersionedTransaction) => wallet.signTransaction(tx),
  });
  return result.tx;
}

export async function withdrawToAddress(
  context: PrivacyCashContext,
  wallet: WalletProvider,
  recipient: string,
  lamports: number
): Promise<{ tx: string; amount: number; fee: number; isPartial: boolean }> {
  const result = await withdraw({
    recipient: new PublicKey(recipient),
    lightWasm: context.lightWasm,
    storage: getStorage(),
    publicKey: wallet.publicKey,
    connection: context.connection,
    amount_in_lamports: lamports,
    encryptionService: context.encryptionService,
    keyBasePath: KEY_BASE_PATH,
  });
  return {
    tx: result.tx,
    amount: result.amount_in_lamports,
    fee: result.fee_in_lamports,
    isPartial: result.isPartial,
  };
}

export async function getWithdrawEstimate(targetLamports: number): Promise<WithdrawEstimate> {
  const feeRate = normalizeFeeRate(Number(await getConfig("withdraw_fee_rate")));
  const rentFeeSol = Number(await getConfig("withdraw_rent_fee"));
  const rentFeeLamports = Math.round(rentFeeSol * 1e9);
  const target = Math.max(0, Math.floor(targetLamports));
  if (target <= 0 || feeRate >= 1) {
    return {
      requestedLamports: target,
      feeLamports: 0,
      netLamports: target,
      feeRate,
      rentFeeLamports,
    };
  }
  const requestedLamports = Math.ceil((target + rentFeeLamports) / (1 - feeRate));
  const feeLamports = Math.floor(requestedLamports * feeRate + rentFeeLamports);
  const netLamports = Math.max(0, requestedLamports - feeLamports);
  return { requestedLamports, feeLamports, netLamports, feeRate, rentFeeLamports };
}

export async function getDepositEstimate(netLamports: number): Promise<DepositEstimate> {
  const feeRate = normalizeFeeRate(Number(await getConfig("deposit_fee_rate")));
  const target = Math.max(0, Math.floor(netLamports));
  if (!Number.isFinite(feeRate) || feeRate <= 0 || feeRate >= 1 || target <= 0) {
    return {
      netLamports: target,
      feeLamports: 0,
      feeRate,
      depositLamports: target,
    };
  }
  const depositLamports = Math.ceil(target / (1 - feeRate));
  const feeLamports = Math.max(0, depositLamports - target);
  return { netLamports: target, feeLamports, feeRate, depositLamports };
}

export async function getDepositRentBufferLamports(rpcUrl?: string): Promise<number> {
  const connection = new Connection(rpcUrl || DEFAULT_RPC_URL, "confirmed");
  const rent = await connection.getMinimumBalanceForRentExemption(NULLIFIER_ACCOUNT_SIZE);
  return rent * NULLIFIER_ACCOUNT_COUNT + DEFAULT_TX_FEE_LAMPORTS;
}
