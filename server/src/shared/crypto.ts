import crypto from "crypto";
import { env } from "@/config";

export function hashIdentity(method: string, identifier: string): Buffer {
  return crypto.createHash("sha256").update(`${env.identity.salt}:${method}:${identifier.toLowerCase()}`).digest();
}

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateId(): string {
  return crypto.randomBytes(16).toString("hex");
}
