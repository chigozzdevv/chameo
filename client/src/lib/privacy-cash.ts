import type { VersionedTransaction } from "@solana/web3.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { WasmFactory, type LightWasm } from "@lightprotocol/hasher.rs";
import {
  deposit,
  withdraw,
  getUtxos,
  getBalanceFromUtxos,
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

const SIGN_MESSAGE = "Privacy Money account sign in";
const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com";
const KEY_BASE_PATH = "/privacy-cash/transaction2";

function getStorage(): Storage {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("Local storage is unavailable.");
  }
  return window.localStorage;
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
    transactionSigner: async (tx) => wallet.signTransaction(tx),
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
