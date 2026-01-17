import { Connection } from "@solana/web3.js";
import { env } from "./env";

export const mainnetConnection = new Connection(env.solana.rpcUrl, "confirmed");
export const devnetConnection = new Connection(env.solana.devnetRpcUrl, "confirmed");
export const connection = mainnetConnection;
