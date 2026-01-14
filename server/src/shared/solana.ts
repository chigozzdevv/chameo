import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "@/config";
export const connection = new Connection(config.solana.rpcUrl, "confirmed");
export async function getAccountBalance(address: string): Promise<number> {
  const pubkey = new PublicKey(address);
  return connection.getBalance(pubkey);
}
export async function accountExists(address: string): Promise<boolean> {
  const pubkey = new PublicKey(address);
  const info = await connection.getAccountInfo(pubkey);
  return info !== null;
}
