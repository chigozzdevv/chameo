import { Collection } from "mongodb";
import { getDb } from "@/config";

export type AuthMethod = "email" | "phone" | "twitter" | "discord" | "github" | "telegram";
export type CampaignType = "payout" | "escrow";
export type CampaignStatus = "active" | "winners-announced" | "dispute" | "closed";

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
  selectedWinners?: string[];
  status: CampaignStatus;
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
  requireCompliance?: boolean;
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
  status: CampaignStatus;
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
