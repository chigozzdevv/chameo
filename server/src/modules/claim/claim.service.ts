import { withdraw, getWithdrawEstimate } from "@/lib/privacy-cash";
import { BadRequestError, ConflictError } from "@/shared";
import { trackEvent } from "@/modules/analytics";
import { claimsCollection } from "./claim.model";
import {
  getCampaignDoc,
  isEligible,
  incrementClaimCount,
  deductFunds,
  getCampaignWalletKeys,
  getCampaignPrivateBalance,
} from "@/modules/campaign";
import { checkWalletCompliance, type ComplianceCheckResult } from "@/modules/compliance";
import { validateVerificationToken, consumeVerificationToken } from "./verification.service";

export interface ClaimResult {
  signature: string;
  amount: number;
  compliance: ComplianceCheckResult | null;
}

function sanitizeCompliance(result: ComplianceCheckResult): ComplianceCheckResult {
  return {
    ...result,
    assessment: {
      ...result.assessment,
      address: "",
      flags: [],
    },
  };
}

export async function processClaim(campaignId: string, token: string, walletAddress: string): Promise<ClaimResult> {
  const tokenResult = await validateVerificationToken(token, campaignId);
  if (!tokenResult.valid) throw new BadRequestError(tokenResult.error || "Invalid token");

  const identityHash = tokenResult.identityHash!;

  const existingClaim = await claimsCollection().findOne({ campaignId, identityHash });
  if (existingClaim && existingClaim.signature) {
    return {
      signature: existingClaim.signature,
      amount: existingClaim.amount,
      compliance: existingClaim.compliance,
    };
  }

  const campaign = await getCampaignDoc(campaignId);

  if (!campaign) throw new BadRequestError("Campaign not found");
  if (campaign.status === "closed") throw new BadRequestError("Campaign closed");
  if (!campaign.funded) throw new BadRequestError("Campaign not funded");
  if (campaign.expiresAt < Date.now() / 1000) throw new BadRequestError("Campaign expired");
  if (campaign.claimCount >= campaign.maxClaims) throw new BadRequestError("All claims exhausted");
  if (!(await isEligible(campaignId, identityHash))) throw new BadRequestError("Not eligible for this campaign");

  if (campaign.type === "escrow") {
    if (campaign.status !== "winners-announced") throw new BadRequestError("Winners not announced yet");
    if (!campaign.selectedWinners?.includes(identityHash)) throw new BadRequestError("Not selected as winner");
  }

  const insertResult = await claimsCollection().updateOne(
    { campaignId, identityHash },
    {
      $setOnInsert: {
        campaignId,
        identityHash,
        amount: campaign.payoutAmount,
        signature: "",
        compliance: null,
        claimedAt: Date.now(),
      },
    },
    { upsert: true }
  );

  if (insertResult.matchedCount > 0) {
    throw new ConflictError("Already claimed");
  }

  let compliance: ComplianceCheckResult | null = null;

  let failureTracked = false;

  try {
    // Compliance screening is mandatory for every claim.
    const complianceResult = await checkWalletCompliance(walletAddress);
    const sanitizedCompliance = sanitizeCompliance(complianceResult);
    compliance = sanitizedCompliance;
    if (!complianceResult.isCompliant) {
      await claimsCollection().deleteOne({ campaignId, identityHash });
      await trackEvent({ campaignId, eventType: "claim-failure", identityHash, metadata: { reason: "compliance" } });
      failureTracked = true;
      throw new BadRequestError(complianceResult.blockedReason || "Wallet failed compliance check");
    }

    await trackEvent({ campaignId, eventType: "claim-attempt", identityHash });

    const keys = await getCampaignWalletKeys(campaignId);
    const estimate = await getWithdrawEstimate(campaign.payoutAmount);
    if (estimate.netLamports < campaign.payoutAmount) {
      throw new BadRequestError("Unable to cover claim amount with current relayer fees");
    }
    const currentBalance = await getCampaignPrivateBalance(campaignId);
    if (currentBalance < estimate.requestedLamports) {
      throw new BadRequestError("Campaign balance too low to cover relayer fees");
    }

    const result = await withdraw(keys, estimate.requestedLamports, walletAddress);

    await claimsCollection().updateOne(
      { campaignId, identityHash },
      { $set: { signature: result.signature, compliance }, $unset: { walletAddress: "" } }
    );

    await incrementClaimCount(campaignId);
    await deductFunds(campaignId, campaign.payoutAmount);
    await consumeVerificationToken(token);

    await trackEvent({ campaignId, eventType: "claim-success", identityHash });

    return { signature: result.signature, amount: campaign.payoutAmount, compliance };
  } catch (error) {
    await claimsCollection().deleteOne({ campaignId, identityHash, signature: "" });
    if (!failureTracked) {
      await trackEvent({ campaignId, eventType: "claim-failure", identityHash, metadata: { error: String(error) } });
    }
    throw error;
  }
}

export async function getClaimStatus(campaignId: string, identityHash: string): Promise<{ claimed: boolean }> {
  const claim = await claimsCollection().findOne({ campaignId, identityHash });
  return { claimed: !!claim && !!claim.signature };
}
