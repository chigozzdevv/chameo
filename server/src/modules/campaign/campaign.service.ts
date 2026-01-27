import { PublicKey } from "@solana/web3.js";
import { connection, env } from "@/config";
import { generateId, hashIdentity, NotFoundError, ForbiddenError, BadRequestError } from "@/shared";
import {
  campaignsCollection,
  type CampaignDoc,
  type CreateCampaignInput,
  type CampaignPublic,
  type UpdateCampaignInput,
  type CampaignEditable,
} from "./campaign.model";
import { buildMerkleRoot } from "@/lib/zk";
import * as inco from "@/lib/inco";
import {
  createCampaignWallet,
  getCampaignPrivateBalance,
  getCampaignWalletPublicKey,
  depositToCampaign,
  withdrawFromCampaign,
} from "./wallet.service";
import { getWithdrawEstimate } from "@/lib/privacy-cash";
import { initializeAnalyticsForCampaign } from "@/modules/analytics";

const NULLIFIER_ACCOUNT_SIZE = 9;
const NULLIFIER_ACCOUNT_COUNT = 2;
const AUTO_DEPOSIT_TX_FEE_LAMPORTS = 5_000;
let cachedDepositBufferLamports: number | null = null;

async function getAutoDepositBufferLamports(): Promise<number> {
  if (cachedDepositBufferLamports !== null) return cachedDepositBufferLamports;
  const rent = await connection.getMinimumBalanceForRentExemption(NULLIFIER_ACCOUNT_SIZE);
  cachedDepositBufferLamports = rent * NULLIFIER_ACCOUNT_COUNT + AUTO_DEPOSIT_TX_FEE_LAMPORTS;
  return cachedDepositBufferLamports;
}

export async function getTotalRequiredLamports(campaign: CampaignDoc): Promise<number> {
  const baseRequired = campaign.payoutAmount * campaign.maxClaims;
  try {
    const estimate = await getWithdrawEstimate(campaign.payoutAmount);
    return estimate.requestedLamports * campaign.maxClaims;
  } catch {
    return baseRequired;
  }
}

export async function createCampaign(
  userId: string,
  orgSlug: string,
  input: CreateCampaignInput
): Promise<{ campaign: CampaignPublic; fundingAddress: string; identityHashes: string[]; totalRequired: number }> {
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

  const totalRequired = await getTotalRequiredLamports(doc);
  return { campaign: toPublic(doc), fundingAddress, identityHashes, totalRequired };
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

function assertEditableCampaign(doc: CampaignDoc, userId: string): void {
  if (doc.userId !== userId) throw new ForbiddenError("Not authorized");
  if (doc.funded || doc.status !== "pending-funding") {
    throw new BadRequestError("Only pending campaigns can be edited");
  }
}

export async function getCampaignForEdit(
  id: string,
  userId: string
): Promise<{ campaign: CampaignEditable; fundingAddress: string; totalRequired: number }> {
  const col = campaignsCollection();
  const doc = await col.findOne({ id });
  if (!doc) throw new NotFoundError("Campaign not found");
  assertEditableCampaign(doc, userId);

  const fundingAddress = await getCampaignWalletPublicKey(id);
  const totalRequired = await getTotalRequiredLamports(doc);
  return { campaign: toEditable(doc), fundingAddress, totalRequired };
}

export async function updateCampaign(
  id: string,
  userId: string,
  input: UpdateCampaignInput
): Promise<{ campaign: CampaignEditable; fundingAddress: string; totalRequired: number }> {
  const col = campaignsCollection();
  const doc = await col.findOne({ id });
  if (!doc) throw new NotFoundError("Campaign not found");
  assertEditableCampaign(doc, userId);

  const update: Partial<CampaignDoc> = {};

  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (name.length < 2) throw new BadRequestError("Campaign name required");
    update.name = name;
  }

  if (typeof input.description === "string") {
    const description = input.description.trim();
    update.description = description || undefined;
  }

  if (typeof input.payoutAmount === "number") {
    if (!input.payoutAmount || input.payoutAmount <= 0) throw new BadRequestError("Invalid payoutAmount");
    update.payoutAmount = input.payoutAmount;
  }

  if (typeof input.maxClaims === "number") {
    if (!input.maxClaims || input.maxClaims <= 0) throw new BadRequestError("Invalid maxClaims");
    if (doc.claimCount > input.maxClaims) throw new BadRequestError("maxClaims less than existing claims");
    update.maxClaims = input.maxClaims;
  }

  if (typeof input.expiresAt === "number") {
    if (input.expiresAt <= Date.now() / 1000) throw new BadRequestError("Invalid expiresAt");
    update.expiresAt = input.expiresAt;
    if (doc.type === "escrow" && input.winnersDeadline === undefined && doc.winnersDeadline) {
      if (doc.winnersDeadline >= input.expiresAt) {
        throw new BadRequestError("winnersDeadline must be before expiresAt");
      }
    }
  }

  if (input.winnersDeadline !== undefined) {
    if (doc.type === "escrow") {
      if (input.winnersDeadline === null) {
        update.winnersDeadline = undefined;
      } else if (typeof input.winnersDeadline === "number") {
        const expiresAt = typeof update.expiresAt === "number" ? update.expiresAt : doc.expiresAt;
        if (!input.winnersDeadline || input.winnersDeadline >= expiresAt) {
          throw new BadRequestError("winnersDeadline must be before expiresAt");
        }
        update.winnersDeadline = input.winnersDeadline;
      }
    } else {
      update.winnersDeadline = undefined;
    }
  }

  if (input.refundAddress !== undefined) {
    if (!input.refundAddress) {
      update.refundAddress = undefined;
    } else {
      update.refundAddress = input.refundAddress;
    }
  }

  if (input.theme !== undefined) {
    update.theme = input.theme;
  }

  if (Object.keys(update).length > 0) {
    await col.updateOne({ id }, { $set: update });
  }

  const updated = await col.findOne({ id });
  if (!updated) throw new NotFoundError("Campaign not found");

  const fundingAddress = await getCampaignWalletPublicKey(id);
  const totalRequired = await getTotalRequiredLamports(updated);
  return { campaign: toEditable(updated), fundingAddress, totalRequired };
}

export async function replaceRecipients(
  id: string,
  userId: string,
  recipients: string[]
): Promise<{ total: number }> {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new BadRequestError("recipients required");
  }
  const col = campaignsCollection();
  const doc = await col.findOne({ id });

  if (!doc) throw new NotFoundError("Campaign not found");
  assertEditableCampaign(doc, userId);

  const identityHashes = recipients.map((r: string) => hashIdentity(doc.authMethod, r).toString("hex"));
  const unique = Array.from(new Set(identityHashes));
  const eligibilityRoot = (await buildMerkleRoot(unique, env.zk.merkleDepth)).toString("hex");

  await col.updateOne(
    { id },
    {
      $set: {
        eligibleHashes: unique,
        eligibilityRoot,
        claimCount: 0,
      },
    }
  );

  return { total: unique.length };
}

export async function deleteCampaign(id: string, userId: string): Promise<void> {
  const col = campaignsCollection();
  const doc = await col.findOne({ id });

  if (!doc) throw new NotFoundError("Campaign not found");
  if (doc.userId !== userId) throw new ForbiddenError("Not authorized");
  if (doc.status === "active") {
    throw new BadRequestError("Active campaigns must be closed before deletion");
  }
  if (doc.status !== "pending-funding" && doc.status !== "closed") {
    throw new BadRequestError("Only pending or closed campaigns can be deleted");
  }
  if (doc.fundedAmount > 0) {
    throw new BadRequestError("Campaign still has funds; close and reclaim first");
  }

  await col.deleteOne({ id });
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
  warnings: string[];
  onChainFresh: boolean;
  privacyFresh: boolean;
}> {
  const col = campaignsCollection();
  const doc = await col.findOne({ id });
  if (!doc) throw new NotFoundError("Campaign not found");

  const totalRequired = await getTotalRequiredLamports(doc);
  const campaignWallet = await getCampaignWalletPublicKey(id);
  let onChainBalance = 0;
  let pcBalance = 0;
  const warnings: string[] = [];
  let onChainFresh = true;
  let privacyFresh = true;

  try {
    onChainBalance = await connection.getBalance(new PublicKey(campaignWallet));
  } catch (error) {
    onChainFresh = false;
    warnings.push(
      error instanceof Error ? `On-chain balance check failed: ${error.message}` : "On-chain balance check failed"
    );
  }

  try {
    pcBalance = await getCampaignPrivateBalance(id);
  } catch (error) {
    privacyFresh = false;
    pcBalance = doc.fundedAmount || 0;
    warnings.push(
      error instanceof Error
        ? `Privacy Cash balance check failed: ${error.message}`
        : "Privacy Cash balance check failed"
    );
  }

  // Auto-deposit if funds are on-chain but not in Privacy Cash
  if (pcBalance < totalRequired && onChainFresh && privacyFresh) {
    if (onChainBalance > 0) {
      try {
        let depositBuffer = 0;
        try {
          depositBuffer = await getAutoDepositBufferLamports();
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Auto-deposit rent check failed: ${error.message}`
              : "Auto-deposit rent check failed"
          );
        }

        const depositAmount = Math.max(0, onChainBalance - depositBuffer);
        if (depositAmount <= 0) {
          warnings.push(
            "Auto-deposit skipped: on-chain balance does not cover rent/fees for deposit. Top up the campaign wallet."
          );
        } else {
          const { signature } = await depositToCampaign(id, depositAmount);
          try {
            pcBalance = await getCampaignPrivateBalance(id);
          } catch (error) {
            privacyFresh = false;
            warnings.push(
              error instanceof Error
                ? `Privacy Cash balance check failed after deposit: ${error.message}`
                : "Privacy Cash balance check failed after deposit"
            );
          }
          try {
            onChainBalance = await connection.getBalance(new PublicKey(campaignWallet));
          } catch (error) {
            onChainFresh = false;
            warnings.push(
              error instanceof Error
                ? `On-chain balance check failed after deposit: ${error.message}`
                : "On-chain balance check failed after deposit"
            );
          }
          const funded = privacyFresh ? pcBalance >= totalRequired : false;
          if (funded !== doc.funded || (funded && doc.status === "pending-funding")) {
            const update: Partial<CampaignDoc> = { funded, fundedAmount: pcBalance };
            if (funded && doc.status === "pending-funding") update.status = "active";
            await col.updateOne({ id }, { $set: update });
          }
          return {
            balance: pcBalance,
            totalRequired,
            funded,
            depositTx: signature,
            onChainBalance,
            campaignWallet,
            warnings,
            onChainFresh,
            privacyFresh,
          };
        }
      } catch (error) {
        warnings.push(error instanceof Error ? `Auto-deposit failed: ${error.message}` : "Auto-deposit failed");
      }
    }
  }

  const funded = privacyFresh ? pcBalance >= totalRequired : false;
  if (funded !== doc.funded || (funded && doc.status === "pending-funding")) {
    const update: Partial<CampaignDoc> = { funded, fundedAmount: pcBalance };
    if (funded && doc.status === "pending-funding") update.status = "active";
    await col.updateOne({ id }, { $set: update });
  }

  return {
    balance: pcBalance,
    totalRequired,
    funded,
    onChainBalance,
    campaignWallet,
    warnings,
    onChainFresh,
    privacyFresh,
  };
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
  assertEditableCampaign(doc, userId);
  if (doc.authMethod !== authMethod) throw new BadRequestError("Invalid authMethod");

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

function toEditable(doc: CampaignDoc): CampaignEditable {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description,
    imageUrl: doc.imageUrl,
    type: doc.type,
    authMethod: doc.authMethod,
    payoutAmount: doc.payoutAmount,
    maxClaims: doc.maxClaims,
    expiresAt: doc.expiresAt,
    winnersDeadline: doc.winnersDeadline,
    participantCount: doc.eligibleHashes.length,
    funded: doc.funded,
    status: doc.status,
    refundAddress: doc.refundAddress,
    theme: doc.theme,
  };
}
