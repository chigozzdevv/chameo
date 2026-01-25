import { PublicKey } from "@solana/web3.js";
import { connection, env } from "@/config";
import { generateId, hashIdentity, NotFoundError, ForbiddenError, BadRequestError } from "@/shared";
import { campaignsCollection, type CampaignDoc, type CreateCampaignInput, type CampaignPublic } from "./campaign.model";
import { buildMerkleRoot } from "@/lib/zk";
import * as inco from "@/lib/inco";
import {
  createCampaignWallet,
  getCampaignPrivateBalance,
  getCampaignWalletPublicKey,
  depositToCampaign,
  withdrawFromCampaign,
} from "./wallet.service";
import { initializeAnalyticsForCampaign } from "@/modules/analytics";

export async function createCampaign(
  userId: string,
  orgSlug: string,
  input: CreateCampaignInput
): Promise<{ campaign: CampaignPublic; fundingAddress: string; identityHashes: string[] }> {
  const id = generateId();
  const identityHashes = input.recipients.map((r: string) => hashIdentity(input.authMethod, r).toString("hex"));
  const eligibilityRoot = (await buildMerkleRoot(identityHashes, env.zk.merkleDepth)).toString("hex");

  const doc: CampaignDoc = {
    id,
    userId,
    orgSlug,
    name: input.name,
    description: input.description,
    type: input.type || "payout",
    authMethod: input.authMethod,
    payoutAmount: input.payoutAmount,
    maxClaims: input.maxClaims,
    claimCount: 0,
    expiresAt: input.expiresAt,
    winnersDeadline: input.winnersDeadline,
    funded: false,
    fundedAmount: 0,
    requireCompliance: true,
    eligibleHashes: identityHashes,
    eligibilityRoot,
    theme: input.theme,
    selectedWinners: input.type === "escrow" ? [] : undefined,
    status: "pending-funding",
    refundAddress: input.refundAddress,
    createdAt: Date.now(),
  };

  await campaignsCollection().insertOne(doc);
  let fundingAddress: string;
  try {
    fundingAddress = await createCampaignWallet(id);
  } catch (error) {
    await campaignsCollection().deleteOne({ id });
    throw error;
  }

  try {
    await initializeAnalyticsForCampaign(id);
  } catch (error) {
    console.error("Failed to initialize on-chain analytics:", error);
  }

  return { campaign: toPublic(doc), fundingAddress, identityHashes };
}

export async function getCampaign(id: string): Promise<CampaignPublic | null> {
  const doc = await campaignsCollection().findOne({ id });
  return doc ? toPublic(doc) : null;
}

export async function getCampaignDoc(id: string): Promise<CampaignDoc | null> {
  return campaignsCollection().findOne({ id });
}

export async function getUserCampaigns(userId: string): Promise<CampaignPublic[]> {
  const docs = await campaignsCollection().find({ userId }).sort({ createdAt: -1 }).toArray();
  return docs.map(toPublic);
}

export async function checkFunding(
  id: string
): Promise<{
  balance: number;
  totalRequired: number;
  funded: boolean;
  depositTx?: string;
  onChainBalance: number;
  campaignWallet: string;
}> {
  const col = campaignsCollection();
  const doc = await col.findOne({ id });
  if (!doc) throw new NotFoundError("Campaign not found");

  const totalRequired = doc.payoutAmount * doc.maxClaims;
  const campaignWallet = await getCampaignWalletPublicKey(id);
  let onChainBalance = await connection.getBalance(new PublicKey(campaignWallet));
  let pcBalance = await getCampaignPrivateBalance(id);

  // Auto-deposit if funds are on-chain but not in Privacy Cash
  if (pcBalance < totalRequired) {
    if (onChainBalance > 0) {
      const { signature } = await depositToCampaign(id, onChainBalance);
      pcBalance = await getCampaignPrivateBalance(id);
      onChainBalance = await connection.getBalance(new PublicKey(campaignWallet));
      const funded = pcBalance >= totalRequired;

      if (funded && (!doc.funded || doc.status === "pending-funding")) {
        const update: Partial<CampaignDoc> = { funded: true, fundedAmount: pcBalance };
        if (doc.status === "pending-funding") update.status = "active";
        await col.updateOne({ id }, { $set: update });
      }
      return { balance: pcBalance, totalRequired, funded, depositTx: signature, onChainBalance, campaignWallet };
    }
  }

  const funded = pcBalance >= totalRequired;
  if (funded && (!doc.funded || doc.status === "pending-funding")) {
    const update: Partial<CampaignDoc> = { funded: true, fundedAmount: pcBalance };
    if (doc.status === "pending-funding") update.status = "active";
    await col.updateOne({ id }, { $set: update });
  }

  return { balance: pcBalance, totalRequired, funded, onChainBalance, campaignWallet };
}

export async function isEligible(campaignId: string, identityHash: string): Promise<boolean> {
  const doc = await campaignsCollection().findOne({ id: campaignId });
  return doc?.eligibleHashes.includes(identityHash) || false;
}

export async function incrementClaimCount(id: string): Promise<void> {
  await campaignsCollection().updateOne({ id }, { $inc: { claimCount: 1 } });
}

export async function deductFunds(id: string, amount: number): Promise<void> {
  await campaignsCollection().updateOne({ id }, { $inc: { fundedAmount: -amount } });
}

export async function addRecipients(id: string, userId: string, recipients: string[], authMethod: string): Promise<{ added: number }> {
  const col = campaignsCollection();
  const doc = await col.findOne({ id });

  if (!doc) throw new NotFoundError("Campaign not found");
  if (doc.userId !== userId) throw new ForbiddenError("Not authorized");

  const newHashes = recipients.map((r: string) => hashIdentity(authMethod, r).toString("hex"));
  const uniqueNew = newHashes.filter((h: string) => !doc.eligibleHashes.includes(h));

  if (uniqueNew.length > 0) {
    const updatedHashes = doc.eligibleHashes.concat(uniqueNew);
    const eligibilityRoot = (await buildMerkleRoot(updatedHashes, env.zk.merkleDepth)).toString("hex");
    await col.updateOne({ id }, { $set: { eligibleHashes: updatedHashes, eligibilityRoot } });

    if (doc.status === "dispute") {
      try {
        await inco.setEligibilityRoot(id, Buffer.from(eligibilityRoot, "hex"));
      } catch (error) {
        console.error("Failed to update on-chain eligibility root:", error);
      }
    }
  }

  return { added: uniqueNew.length };
}

export async function closeCampaign(
  id: string,
  userId: string,
  reclaimAddress: string
): Promise<{ reclaimedAmount: number; signature?: string }> {
  const col = campaignsCollection();
  const doc = await col.findOne({ id });

  if (!doc) throw new NotFoundError("Campaign not found");
  if (doc.userId !== userId) throw new ForbiddenError("Not authorized");
  const allowEarlyRefund = doc.disputeOutcome === "refund-host" || doc.disputeOutcome === "tie";
  if (doc.status === "closed" && !allowEarlyRefund) throw new BadRequestError("Campaign already closed");
  if (!allowEarlyRefund && doc.expiresAt > Date.now() / 1000) throw new BadRequestError("Campaign not yet expired");

  const balance = await getCampaignPrivateBalance(id);

  if (balance > 0) {
    const result = await withdrawFromCampaign(id, balance, reclaimAddress);
    await col.updateOne({ id }, { $set: { status: "closed", fundedAmount: 0 } });
    return { reclaimedAmount: result.amount, signature: result.signature };
  }

  await col.updateOne({ id }, { $set: { status: "closed" } });
  return { reclaimedAmount: 0 };
}

export async function selectWinners(id: string, userId: string, winners: string[]): Promise<{ winnersCount: number }> {
  const col = campaignsCollection();
  const doc = await col.findOne({ id });

  if (!doc) throw new NotFoundError("Campaign not found");
  if (doc.userId !== userId) throw new ForbiddenError("Not authorized");
  if (doc.type !== "escrow") throw new BadRequestError("Only escrow campaigns can select winners");
  if (doc.status !== "active") throw new BadRequestError("Campaign not active");
  if (!doc.winnersDeadline || Date.now() / 1000 > doc.winnersDeadline) {
    throw new BadRequestError("Winners deadline passed");
  }

  const winnerHashes = winners.map((w) => hashIdentity(doc.authMethod, w).toString("hex"));
  const invalidWinners = winnerHashes.filter((h) => !doc.eligibleHashes.includes(h));
  if (invalidWinners.length > 0) throw new BadRequestError("Some winners not eligible");

  await col.updateOne({ id }, { $set: { selectedWinners: winnerHashes, status: "winners-announced" } });

  return { winnersCount: winnerHashes.length };
}

export async function updateCampaignImage(id: string, userId: string, imageUrl: string): Promise<void> {
  const col = campaignsCollection();
  const doc = await col.findOne({ id });

  if (!doc) throw new NotFoundError("Campaign not found");
  if (doc.userId !== userId) throw new ForbiddenError("Not authorized");

  await col.updateOne({ id }, { $set: { imageUrl } });
}

export async function updateCampaignTheme(id: string, userId: string, theme: CampaignDoc["theme"]): Promise<void> {
  const col = campaignsCollection();
  const doc = await col.findOne({ id });

  if (!doc) throw new NotFoundError("Campaign not found");
  if (doc.userId !== userId) throw new ForbiddenError("Not authorized");

  await col.updateOne({ id }, { $set: { theme } });
}

export async function updateRefundAddress(id: string, userId: string, refundAddress: string): Promise<void> {
  const col = campaignsCollection();
  const doc = await col.findOne({ id });

  if (!doc) throw new NotFoundError("Campaign not found");
  if (doc.userId !== userId) throw new ForbiddenError("Not authorized");

  await col.updateOne({ id }, { $set: { refundAddress } });
}

export async function checkAndTriggerDispute(id: string): Promise<void> {
  const col = campaignsCollection();
  const doc = await col.findOne({ id });

  if (!doc) throw new NotFoundError("Campaign not found");
  if (doc.type !== "escrow") return;
  if (doc.status !== "active") return;
  if (!doc.winnersDeadline) return;

  const now = Math.floor(Date.now() / 1000);
  if (now <= doc.winnersDeadline) return;
  if (doc.selectedWinners && doc.selectedWinners.length > 0) return;
  if (!env.zk.verifierProgramId) throw new BadRequestError("ZK verifier not configured");

  const eligibilityRoot = await buildMerkleRoot(doc.eligibleHashes, env.zk.merkleDepth);
  const eligibilityRootHex = eligibilityRoot.toString("hex");
  const disputeStartedAt = now;
  const disputeEndsAt = now + env.voting.disputeWindowSeconds;
  const zkVerifierProgram = new PublicKey(env.zk.verifierProgramId);

  try {
    await inco.initializeVotingPool(id, eligibilityRoot, zkVerifierProgram);
  } catch (error: any) {
    if (!error.message?.includes("already in use")) {
      throw error;
    }
    await inco.setEligibilityRoot(id, eligibilityRoot);
  }

  await col.updateOne(
    { id },
    {
      $set: {
        status: "dispute",
        disputeStartedAt,
        disputeEndsAt,
        eligibilityRoot: eligibilityRootHex,
      },
    }
  );
}

function toPublic(doc: CampaignDoc): CampaignPublic {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description,
    imageUrl: doc.imageUrl,
    orgSlug: doc.orgSlug,
    type: doc.type,
    authMethod: doc.authMethod,
    payoutAmount: doc.payoutAmount,
    maxClaims: doc.maxClaims,
    claimCount: doc.claimCount,
    expiresAt: doc.expiresAt,
    winnersDeadline: doc.winnersDeadline,
    funded: doc.funded,
    fundedAmount: doc.fundedAmount,
    requireCompliance: doc.requireCompliance,
    participantCount: doc.eligibleHashes.length,
    winnersCount: doc.selectedWinners?.length,
    theme: doc.theme,
    status: doc.status,
    votingClosedAt: doc.votingClosedAt,
    disputeStartedAt: doc.disputeStartedAt,
    disputeEndsAt: doc.disputeEndsAt,
    disputeOutcome: doc.disputeOutcome,
    voteResults: doc.voteResults,
  };
}
