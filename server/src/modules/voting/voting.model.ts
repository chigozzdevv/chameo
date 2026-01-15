import { Collection } from "mongodb";
import { getDb } from "@/config";

export type VoteAction = "refund-host" | "equal-distribution";

export interface VoteDoc {
  campaignId: string;
  identityHash: string;
  action: VoteAction;
  votedAt: number;
}

export function votesCollection(): Collection<VoteDoc> {
  return getDb().collection<VoteDoc>("votes");
}

export async function createVoteIndexes(): Promise<void> {
  const col = votesCollection();
  await col.createIndex({ campaignId: 1, identityHash: 1 }, { unique: true });
  await col.createIndex({ campaignId: 1 });
}
