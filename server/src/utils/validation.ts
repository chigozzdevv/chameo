import { PublicKey } from "@solana/web3.js";
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
export function isValidPhone(phone: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(phone.replace(/\D/g, ""));
}
export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
export function isValidAuthMethod(method: string): method is "email" | "phone" | "twitter" | "discord" | "github" {
  return ["email", "phone", "twitter", "discord", "github"].includes(method);
}
