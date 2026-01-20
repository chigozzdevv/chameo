import { Collection } from "mongodb";
import { getDb } from "@/config";

export interface AnalyticsEvent {
  campaignId: string;
  eventType:
    | "view"
    | "link-click"
    | "claim-attempt"
    | "claim-success"
    | "claim-failure"
    | "vote";
  identityHash?: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface CampaignAnalytics {
  campaignId: string;
  views: number;
  claimAttempts: number;
  claimSuccesses: number;
  claimFailures: number;
  votes: number;
  lastUpdated: number;
}

export function analyticsEventsCollection(): Collection<AnalyticsEvent> {
  return getDb().collection<AnalyticsEvent>("analytics_events");
}

export function campaignAnalyticsCollection(): Collection<CampaignAnalytics> {
  return getDb().collection<CampaignAnalytics>("campaign_analytics");
}

export async function createAnalyticsIndexes(): Promise<void> {
  await analyticsEventsCollection().createIndex({ campaignId: 1, timestamp: -1 });
  await analyticsEventsCollection().createIndex({ eventType: 1 });
  await campaignAnalyticsCollection().createIndex({ campaignId: 1 }, { unique: true });
}
