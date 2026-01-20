import { env } from "@/config";
import { logger } from "@/shared";
import { campaignsCollection } from "@/modules/campaign";
import { checkAndTriggerDispute } from "@/modules/campaign";
import { resolveDisputeAsServer } from "./voting.service";

let scheduler: NodeJS.Timeout | null = null;

async function runDisputeCycle(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  const candidates = await campaignsCollection()
    .find({ type: "escrow", status: "active", winnersDeadline: { $lte: now } })
    .toArray();

  for (const campaign of candidates) {
    if (campaign.selectedWinners && campaign.selectedWinners.length > 0) continue;
    try {
      await checkAndTriggerDispute(campaign.id);
    } catch (error) {
      logger.error("Failed to open dispute", { campaignId: campaign.id, error: String(error) });
    }
  }

  const disputes = await campaignsCollection().find({ type: "escrow", status: "dispute" }).toArray();

  for (const campaign of disputes) {
    if (campaign.voteResults) continue;
    const disputeEndsAt =
      campaign.disputeEndsAt ??
      (campaign.winnersDeadline ? campaign.winnersDeadline + env.voting.disputeWindowSeconds : null);

    if (!disputeEndsAt || now < disputeEndsAt) continue;

    try {
      await resolveDisputeAsServer(campaign.id, { force: true });
    } catch (error) {
      logger.error("Failed to resolve dispute", { campaignId: campaign.id, error: String(error) });
    }
  }
}

export function startDisputeScheduler(): void {
  if (scheduler) return;

  const intervalMs = env.voting.schedulerIntervalMs;
  const run = () => {
    void runDisputeCycle();
  };

  scheduler = setInterval(run, intervalMs);
  run();
  logger.info("Dispute scheduler started", { intervalMs });
}
