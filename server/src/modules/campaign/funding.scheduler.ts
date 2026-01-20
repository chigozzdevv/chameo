import { env } from "@/config";
import { logger } from "@/shared";
import { campaignsCollection } from "./campaign.model";
import { checkFunding } from "./campaign.service";

let scheduler: NodeJS.Timeout | null = null;
const inFlight = new Set<string>();
const lastChecked = new Map<string, number>();

async function runFundingCycle(): Promise<void> {
  const now = Date.now();
  const candidates = await campaignsCollection()
    .find({ funded: false, status: { $ne: "closed" } })
    .toArray();

  for (const campaign of candidates) {
    if (inFlight.has(campaign.id)) continue;
    const last = lastChecked.get(campaign.id) || 0;
    if (now - last < env.funding.sweepCooldownMs) continue;

    inFlight.add(campaign.id);
    lastChecked.set(campaign.id, now);
    try {
      await checkFunding(campaign.id);
    } catch (error) {
      logger.error("Failed to sweep campaign funding", { campaignId: campaign.id, error: String(error) });
    } finally {
      inFlight.delete(campaign.id);
    }
  }
}

export function startFundingScheduler(): void {
  if (scheduler) return;
  const intervalMs = env.funding.sweepIntervalMs;
  scheduler = setInterval(() => {
    void runFundingCycle();
  }, intervalMs);
  void runFundingCycle();
  logger.info("Funding sweep scheduler started", { intervalMs });
}
