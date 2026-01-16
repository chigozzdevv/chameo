import { PublicKey } from "@solana/web3.js";

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export function isValidAuthMethod(method: string): method is "email" | "twitter" | "discord" | "github" | "telegram" {
  return ["email", "twitter", "discord", "github", "telegram"].includes(method);
}
