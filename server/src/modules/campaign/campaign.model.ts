import { Collection } from "mongodb";
import { getDb } from "@/config";

export type AuthMethod = "email" | "phone" | "twitter" | "discord" | "github";

export interface CampaignDoc {
  id: string;
  userId: string;
  orgSlug: string;
  name: string;
  authMethod: AuthMethod;
  payoutAmount: number;
  maxClaims: number;
  claimCount: number;
  expiresAt: number;
  funded: boolean;
  fundedAmount: number;
  requireCompliance: boolean;
  eligibleHashes: string[];
  status: "active" | "closed";
  createdAt: number;
}

export interface CreateCampaignInput {
  name: string;
  authMethod: AuthMethod;
  payoutAmount: number;
  maxClaims: number;
  expiresAt: number;
  recipients: string[];
  requireCompliance?: boolean;
}

export interface CampaignPublic {
  id: string;
  name: string;
  orgSlug: string;
  authMethod: AuthMethod;
  payoutAmount: number;
  maxClaims: number;
  claimCount: number;
  expiresAt: number;
  funded: boolean;
  fundedAmount: number;
  requireCompliance: boolean;
  status: "active" | "closed";
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
