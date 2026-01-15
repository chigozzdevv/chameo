import { Collection } from "mongodb";
import { getDb } from "@/config";
import type { ComplianceCheckResult } from "@/modules/compliance";

export interface ClaimDoc {
  campaignId: string;
  identityHash: string;
  walletAddress: string;
  amount: number;
  signature: string;
  compliance: ComplianceCheckResult | null;
  claimedAt: number;
}

export interface OtpDoc {
  key: string;
  code: string;
  attempts: number;
  expiresAt: Date;
}

export interface MagicLinkDoc {
  token: string;
  authMethod: string;
  identifier: string;
  campaignId: string;
  expiresAt: Date;
}

export interface VerificationTokenDoc {
  token: string;
  identityHash: string;
  campaignId: string;
  expiresAt: Date;
}

export function claimsCollection(): Collection<ClaimDoc> {
  return getDb().collection<ClaimDoc>("claims");
}

export function otpsCollection(): Collection<OtpDoc> {
  return getDb().collection<OtpDoc>("otps");
}

export function magicLinksCollection(): Collection<MagicLinkDoc> {
  return getDb().collection<MagicLinkDoc>("magicLinks");
}

export function verificationTokensCollection(): Collection<VerificationTokenDoc> {
  return getDb().collection<VerificationTokenDoc>("verificationTokens");
}

export async function createClaimIndexes(): Promise<void> {
  await claimsCollection().createIndex({ campaignId: 1, identityHash: 1 }, { unique: true });
  await otpsCollection().createIndex({ key: 1 }, { unique: true });
  await otpsCollection().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await magicLinksCollection().createIndex({ token: 1 }, { unique: true });
  await magicLinksCollection().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await verificationTokensCollection().createIndex({ token: 1 }, { unique: true });
  await verificationTokensCollection().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
