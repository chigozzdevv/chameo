import { analyticsEventsCollection, campaignAnalyticsCollection, type AnalyticsEvent } from "./analytics.model";

export async function trackEvent(event: Omit<AnalyticsEvent, "timestamp">): Promise<void> {
  await analyticsEventsCollection().insertOne({
    ...event,
    timestamp: Date.now(),
  });

  const updateFields: Record<string, number> = {};
  switch (event.eventType) {
    case "view":
      updateFields.views = 1;
      break;
    case "claim-attempt":
      updateFields.claimAttempts = 1;
      break;
    case "claim-success":
      updateFields.claimSuccesses = 1;
      break;
    case "claim-failure":
      updateFields.claimFailures = 1;
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
