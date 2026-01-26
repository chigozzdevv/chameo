import { Collection } from "mongodb";
import { getDb } from "@/config";

export type AuthMethod = "email" | "twitter" | "discord" | "github" | "telegram";
export type CampaignType = "payout" | "escrow";
export type CampaignStatus = "pending-funding" | "active" | "winners-announced" | "dispute" | "closed";

export interface CampaignTheme {
  primary?: string;
  secondary?: string;
  background?: string;
}

export interface CampaignDoc {
  id: string;
  userId: string;
  orgSlug: string;
  name: string;
  description?: string;
  imageUrl?: string;
  type: CampaignType;
  authMethod: AuthMethod;
  payoutAmount: number;
  maxClaims: number;
  claimCount: number;
  expiresAt: number;
  winnersDeadline?: number;
  funded: boolean;
  fundedAmount: number;
  requireCompliance: boolean;
  eligibleHashes: string[];
  eligibilityRoot?: string;
  theme?: CampaignTheme;
  selectedWinners?: string[];
  status: CampaignStatus;
  votingClosedAt?: number;
  disputeStartedAt?: number;
  disputeEndsAt?: number;
  refundAddress?: string;
  disputeOutcome?: "refund-host" | "equal-distribution" | "tie";
  voteResults?: {
    refundHost: number;
    equalDistribution: number;
    total: number;
    resolvedAt: number;
  };
  encryptedWalletKeys?: string;
  createdAt: number;
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  type: CampaignType;
  authMethod: AuthMethod;
  payoutAmount: number;
  maxClaims: number;
  expiresAt: number;
  winnersDeadline?: number;
  recipients: string[];
  refundAddress?: string;
  theme?: CampaignTheme;
  requireCompliance?: boolean;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  payoutAmount?: number;
  maxClaims?: number;
  expiresAt?: number;
  winnersDeadline?: number | null;
  refundAddress?: string | null;
  theme?: CampaignTheme;
}

export interface CampaignEditable {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  type: CampaignType;
  authMethod: AuthMethod;
  payoutAmount: number;
  maxClaims: number;
  expiresAt: number;
  winnersDeadline?: number;
  participantCount: number;
  funded: boolean;
  status: CampaignStatus;
  refundAddress?: string;
  theme?: CampaignTheme;
}

export interface CampaignPublic {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  orgSlug: string;
  type: CampaignType;
  authMethod: AuthMethod;
  payoutAmount: number;
  maxClaims: number;
  claimCount: number;
  expiresAt: number;
  winnersDeadline?: number;
  funded: boolean;
  fundedAmount: number;
  requireCompliance: boolean;
  participantCount: number;
  winnersCount?: number;
  theme?: CampaignTheme;
  status: CampaignStatus;
  votingClosedAt?: number;
  disputeStartedAt?: number;
  disputeEndsAt?: number;
  disputeOutcome?: "refund-host" | "equal-distribution" | "tie";
  voteResults?: {
    refundHost: number;
    equalDistribution: number;
    total: number;
    resolvedAt: number;
  };
}

export function campaignsCollection(): Collection<CampaignDoc> {
  return getDb().collection<CampaignDoc>("campaigns");
}

export async function createCampaignIndexes(): Promise<void> {
  const col = campaignsCollection();
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ userId: 1 });
  await col.createIndex({ expiresAt: 1 });
}
