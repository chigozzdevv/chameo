import { analyticsEventsCollection, campaignAnalyticsCollection, type AnalyticsEvent } from "./analytics.model";
import * as inco from "@/lib/inco";
import { PublicKey } from "@solana/web3.js";

export async function initializeAnalyticsForCampaign(campaignId: string): Promise<void> {
  try {
    await inco.initializeAnalytics(campaignId);
  } catch (error: any) {
    if (!error.message?.includes("already in use")) {
      throw error;
    }
  }
}

export async function trackEvent(event: Omit<AnalyticsEvent, "timestamp">): Promise<void> {
  await analyticsEventsCollection().insertOne({
    ...event,
    timestamp: Date.now(),
  });

  const updateFields: Record<string, number> = {};
  let incoEventType: 0 | 1 | 2 | null = null;

  switch (event.eventType) {
    case "view":
      updateFields.views = 1;
      incoEventType = 0;
      break;
    case "claim-attempt":
      updateFields.claimAttempts = 1;
      break;
    case "claim-success":
      updateFields.claimSuccesses = 1;
      incoEventType = 1;
      break;
    case "claim-failure":
      updateFields.claimFailures = 1;
      incoEventType = 2;
      break;
    case "vote":
      updateFields.votes = 1;
      break;
  }

  await campaignAnalyticsCollection().updateOne(
    { campaignId: event.campaignId },
    {
      $inc: updateFields,
      $set: { lastUpdated: Date.now() },
    },
    { upsert: true }
  );

  if (incoEventType !== null) {
    try {
      await inco.trackEventOnChain(event.campaignId, incoEventType);
    } catch (error) {
      console.error("Failed to track event on-chain:", error);
    }
  }
}

export async function getCampaignAnalytics(campaignId: string) {
  const analytics = await campaignAnalyticsCollection().findOne({ campaignId });
  return (
    analytics || {
      campaignId,
      views: 0,
      claimAttempts: 0,
      claimSuccesses: 0,
      claimFailures: 0,
      votes: 0,
      lastUpdated: Date.now(),
    }
  );
}

export async function getRecentEvents(campaignId: string, limit: number = 100) {
  return analyticsEventsCollection().find({ campaignId }).sort({ timestamp: -1 }).limit(limit).toArray();
}

export async function grantAnalyticsAccess(
  campaignId: string,
  creatorPubkey: string
): Promise<{
  signature: string;
  handles: { pageViews: string; linkClicks: string; claimStarts: string };
}> {
  const result = await inco.grantAnalyticsAccess(campaignId, new PublicKey(creatorPubkey));
  return {
    signature: result.signature,
    handles: {
      pageViews: result.handles.pageViewsHandle.toString(),
      linkClicks: result.handles.linkClicksHandle.toString(),
      claimStarts: result.handles.claimStartsHandle.toString(),
    },
  };
}
