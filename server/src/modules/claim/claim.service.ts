import { env } from "@/config";
import { withdraw, type WalletKeys } from "@/lib/privacy-cash";
import { BadRequestError, ConflictError } from "@/shared";
import { claimsCollection } from "./claim.model";
import { getCampaignDoc, isEligible, incrementClaimCount, deductFunds, getCampaignWalletKeys } from "@/modules/campaign";
import { checkWalletCompliance, type ComplianceCheckResult } from "@/modules/compliance";
import { validateVerificationToken, consumeVerificationToken } from "./verification.service";

export interface ClaimResult {
  signature: string;
  amount: number;
  compliance: ComplianceCheckResult | null;
}

export async function processClaim(campaignId: string, token: string, walletAddress: string): Promise<ClaimResult> {
  const tokenResult = await validateVerificationToken(token, campaignId);
  if (!tokenResult.valid) throw new BadRequestError(tokenResult.error || "Invalid token");

  const identityHash = tokenResult.identityHash!;
  const campaign = await getCampaignDoc(campaignId);

  if (!campaign) throw new BadRequestError("Campaign not found");
  if (!campaign.funded) throw new BadRequestError("Campaign not funded");
  if (campaign.expiresAt < Date.now() / 1000) throw new BadRequestError("Campaign expired");
  if (campaign.claimCount >= campaign.maxClaims) throw new BadRequestError("All claims exhausted");
  if (!(await isEligible(campaignId, identityHash))) throw new BadRequestError("Not eligible for this campaign");

  // Atomic check-and-insert to prevent race conditions
  const insertResult = await claimsCollection().updateOne(
    { campaignId, identityHash },
    {
      $setOnInsert: {
        campaignId,
        identityHash,
        walletAddress,
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

  try {
    if (campaign.requireCompliance && env.range.apiKey) {
      compliance = await checkWalletCompliance(walletAddress);
      if (!compliance.isCompliant) {
        await claimsCollection().deleteOne({ campaignId, identityHash });
        throw new BadRequestError(compliance.blockedReason || "Wallet failed compliance check");
      }
    }

    const keys = await getCampaignWalletKeys(campaignId);
    const result = await withdraw(keys, campaign.payoutAmount, walletAddress);

    await claimsCollection().updateOne(
      { campaignId, identityHash },
      { $set: { signature: result.signature, compliance } }
    );

    await incrementClaimCount(campaignId);
    await deductFunds(campaignId, campaign.payoutAmount);
    await consumeVerificationToken(token);

    return { signature: result.signature, amount: campaign.payoutAmount, compliance };
  } catch (error) {
    await claimsCollection().deleteOne({ campaignId, identityHash, signature: "" });
    throw error;
  }
}

export async function getClaimStatus(
  campaignId: string,
  identityHash: string
): Promise<{ claimed: boolean; claim?: any }> {
  const claim = await claimsCollection().findOne({ campaignId, identityHash });
  return { claimed: !!claim && !!claim.signature, claim: claim || undefined };
}
