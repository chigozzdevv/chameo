import type { AnalyticsEvent } from "./analytics.model";
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
  let incoEventType: 0 | 1 | 2 | 3 | 4 | 5 | null = null;

  switch (event.eventType) {
    case "view":
      incoEventType = 0;
      break;
    case "link-click":
      incoEventType = 1;
      break;
    case "claim-attempt":
      incoEventType = 2;
      break;
    case "claim-success":
      incoEventType = 3;
      break;
    case "claim-failure":
      incoEventType = 4;
      break;
    case "vote":
      incoEventType = 5;
      break;
  }

  if (incoEventType !== null) {
    try {
      await inco.trackEventOnChain(event.campaignId, incoEventType);
    } catch (error) {
      console.error("Failed to track event on-chain:", error);
    }
  }
}

export async function getCampaignAnalytics(campaignId: string) {
  return (
    {
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
  return [];
}

export async function getAnalyticsHandles(campaignId: string): Promise<{
  pageViewsHandle: string;
  linkClicksHandle: string;
  claimStartsHandle: string;
  claimSuccessesHandle: string;
  claimFailuresHandle: string;
  votesHandle: string;
} | null> {
  return inco.getAnalyticsHandles(campaignId);
}

export async function grantAnalyticsAccess(
  campaignId: string,
  creatorPubkey: string
): Promise<{
  signature: string;
  handles: {
    pageViews: string;
    linkClicks: string;
    claimStarts: string;
    claimSuccesses: string;
    claimFailures: string;
    votes: string;
  };
}> {
  const result = await inco.grantAnalyticsAccess(campaignId, new PublicKey(creatorPubkey));
  return {
    signature: result.signature,
    handles: {
      pageViews: result.handles.pageViewsHandle.toString(),
      linkClicks: result.handles.linkClicksHandle.toString(),
      claimStarts: result.handles.claimStartsHandle.toString(),
      claimSuccesses: result.handles.claimSuccessesHandle.toString(),
      claimFailures: result.handles.claimFailuresHandle.toString(),
      votes: result.handles.votesHandle.toString(),
    },
  };
}
