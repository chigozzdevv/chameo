import type { ComplianceCheckResult } from "@/features/compliance";
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
