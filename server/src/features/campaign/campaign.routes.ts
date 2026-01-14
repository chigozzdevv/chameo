import { Router } from "express";
import { isValidAuthMethod } from "@/utils";
import * as campaignService from "./campaign.service";
import { sendBatchNotifications } from "@/features/claim/claim.notification";
const router = Router();
router.post("/", async (req, res) => {
  try {
    const { hostIdentifier, authMethod, payoutAmount, maxClaims, expiresAt, recipients, requireCompliance } = req.body;
    if (!hostIdentifier) return res.status(400).json({ error: "hostIdentifier required" });
    if (!isValidAuthMethod(authMethod)) return res.status(400).json({ error: "Invalid authMethod" });
    if (!payoutAmount || payoutAmount <= 0) return res.status(400).json({ error: "Invalid payoutAmount" });
    if (!maxClaims || maxClaims <= 0) return res.status(400).json({ error: "Invalid maxClaims" });
    if (!expiresAt || expiresAt <= Date.now() / 1000) return res.status(400).json({ error: "Invalid expiresAt" });
    if (!Array.isArray(recipients) || recipients.length === 0) return res.status(400).json({ error: "recipients required" });
    const result = await campaignService.createCampaign({
      hostIdentifier,
      authMethod,
      payoutAmount,
      maxClaims,
      expiresAt,
      recipients,
      requireCompliance,
    });
    res.json({
      success: true,
      campaignId: result.campaign.id,
      fundingAddress: result.fundingAddress,
      totalRequired: payoutAmount * maxClaims,
      identityHashes: result.identityHashes,
    });
  } catch (error) {
    console.error("Create campaign error:", error);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});
router.get("/:id", async (req, res) => {
  try {
    const campaign = await campaignService.getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json({ success: true, campaign });
  } catch (error) {
    console.error("Get campaign error:", error);
    res.status(500).json({ error: "Failed to get campaign" });
  }
});
router.get("/:id/funding-address", async (req, res) => {
  try {
    const campaign = await campaignService.getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    const doc = await campaignService.getCampaignDoc(req.params.id);
    res.json({
      success: true,
      fundingAddress: doc!.fundingAddress,
      totalRequired: campaign.payoutAmount * campaign.maxClaims,
    });
  } catch (error) {
    console.error("Get funding address error:", error);
    res.status(500).json({ error: "Failed to get funding address" });
  }
});
router.post("/:id/check-funding", async (req, res) => {
  try {
    const result = await campaignService.checkFunding(req.params.id);
    res.json({ success: true, ...result });
  } catch (error: any) {
    const status = error.message === "Campaign not found" ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});
router.post("/:id/notify", async (req, res) => {
  try {
    const campaign = await campaignService.getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (!campaign.funded) return res.status(400).json({ error: "Campaign not funded" });
    const { recipients, authMethod, baseUrl, campaignName, useMagicLinks } = req.body;
    if (!Array.isArray(recipients) || recipients.length === 0) return res.status(400).json({ error: "recipients required" });
    if (!["email", "phone"].includes(authMethod)) return res.status(400).json({ error: "Invalid authMethod for notifications" });
    if (!baseUrl) return res.status(400).json({ error: "baseUrl required" });
    const result = await sendBatchNotifications(recipients, authMethod, req.params.id, campaignName || "Chameo Payout", baseUrl, useMagicLinks || false);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Notify error:", error);
    res.status(500).json({ error: "Failed to send notifications" });
  }
});
export default router;
