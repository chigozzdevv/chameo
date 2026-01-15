import { BadRequestError, NotFoundError } from "@/shared";
import { votesCollection, type VoteAction } from "./voting.model";
import { getCampaignDoc, campaignsCollection } from "@/modules/campaign";
import { hashIdentity } from "@/modules/claim/verification.service";

export async function castVote(campaignId: string, identity: string, action: VoteAction): Promise<void> {
  const campaign = await getCampaignDoc(campaignId);
  if (!campaign) throw new NotFoundError("Campaign not found");
  if (campaign.status !== "dispute") throw new BadRequestError("Campaign not in dispute");

  const identityHash = hashIdentity(identity, campaign.authMethod);
  if (!campaign.eligibleHashes.includes(identityHash)) {
    throw new BadRequestError("Not eligible to vote");
  }

  await votesCollection().updateOne({ campaignId, identityHash }, { $set: { action, votedAt: Date.now() } }, { upsert: true });
}

export async function getVoteResults(campaignId: string): Promise<{ refundHost: number; equalDistribution: number; total: number }> {
  const votes = await votesCollection().find({ campaignId }).toArray();
  const refundHost = votes.filter((v) => v.action === "refund-host").length;
  const equalDistribution = votes.filter((v) => v.action === "equal-distribution").length;
  return { refundHost, equalDistribution, total: votes.length };
}

export async function resolveDispute(campaignId: string): Promise<void> {
  const campaign = await getCampaignDoc(campaignId);
  if (!campaign) throw new NotFoundError("Campaign not found");
  if (campaign.status !== "dispute") throw new BadRequestError("Not in dispute");

  const results = await getVoteResults(campaignId);

  // Require 50% participation to resolve
  if (results.total < campaign.eligibleHashes.length * 0.5) {
    throw new BadRequestError("Insufficient votes");
  }

  // Refund host if majority votes for it, otherwise distribute equally
  if (results.refundHost > results.equalDistribution) {
    await campaignsCollection().updateOne({ id: campaignId }, { $set: { status: "closed" } });
  } else {
    await campaignsCollection().updateOne(
      { id: campaignId },
      { $set: { status: "winners-announced", selectedWinners: campaign.eligibleHashes } }
    );
  }
}

export async function checkDisputeTimeout(campaignId: string): Promise<void> {
  const campaign = await getCampaignDoc(campaignId);
  if (!campaign) return;
  if (campaign.status !== "active") return;
  if (campaign.type !== "escrow") return;
  if (!campaign.winnersDeadline) return;

  const now = Date.now() / 1000;
  if (now > campaign.winnersDeadline && (!campaign.selectedWinners || campaign.selectedWinners.length === 0)) {
    await campaignsCollection().updateOne({ id: campaignId }, { $set: { status: "dispute" } });
  }
}
