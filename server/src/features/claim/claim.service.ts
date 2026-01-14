import { col } from "@/shared";
import { config } from "@/config";
import { getCampaignDoc, isEligible, incrementClaimCount, deductFunds } from "@/features/campaign";
import { withdraw } from "@/features/privacy-cash";
import { checkWalletCompliance, type ComplianceCheckResult } from "@/features/compliance";
import { validateVerificationToken, consumeVerificationToken } from "./claim.verification";
import type { ClaimDoc } from "./claim.types";
export interface ClaimResult {
  signature: string;
  amount: number;
  compliance: ComplianceCheckResult | null;
}
export async function processClaim(campaignId: string, token: string, walletAddress: string): Promise<ClaimResult> {
  const tokenResult = await validateVerificationToken(token, campaignId);
  if (!tokenResult.valid) throw new Error(tokenResult.error || "Invalid token");
  const identityHash = tokenResult.identityHash!;
  const campaign = await getCampaignDoc(campaignId);
  if (!campaign) throw new Error("Campaign not found");
  if (!campaign.funded) throw new Error("Campaign not funded");
  if (campaign.expiresAt < Date.now() / 1000) throw new Error("Campaign expired");
  if (campaign.claimCount >= campaign.maxClaims) throw new Error("All claims exhausted");
  if (!(await isEligible(campaignId, identityHash))) throw new Error("Not eligible for this campaign");
  const existingClaim = await col<ClaimDoc>("claims").findOne({ campaignId, identityHash });
  if (existingClaim) throw new Error("Already claimed");
  let compliance: ComplianceCheckResult | null = null;
  if (campaign.requireCompliance && config.range.apiKey) {
    compliance = await checkWalletCompliance(walletAddress);
    if (!compliance.isCompliant) {
      throw new Error(compliance.blockedReason || "Wallet failed compliance check");
    }
  }
  const result = await withdraw(campaignId, campaign.payoutAmount, walletAddress);
  await col<ClaimDoc>("claims").insertOne({
    campaignId,
    identityHash,
    walletAddress,
    amount: campaign.payoutAmount,
    signature: result.signature,
    compliance,
    claimedAt: Date.now(),
  });
  await incrementClaimCount(campaignId);
  await deductFunds(campaignId, campaign.payoutAmount);
  await consumeVerificationToken(token);
  return { signature: result.signature, amount: campaign.payoutAmount, compliance };
}
export async function getClaimStatus(campaignId: string, identityHash: string): Promise<{ claimed: boolean; claim?: ClaimDoc }> {
  const claim = await col<ClaimDoc>("claims").findOne({ campaignId, identityHash });
  return { claimed: !!claim, claim: claim || undefined };
}
