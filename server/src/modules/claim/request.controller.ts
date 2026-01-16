import { Router } from "express";
import { isValidEmail, BadRequestError } from "@/shared";
import { sendClaimEmail } from "./verification.service";
import { getCampaignDoc } from "@/modules/campaign";

const router = Router();

router.post("/request/:campaignId", async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const { email } = req.body;

    if (!email || !isValidEmail(email)) throw new BadRequestError("Invalid email");

    const campaign = await getCampaignDoc(campaignId);
    if (!campaign) throw new BadRequestError("Campaign not found");
    if (campaign.authMethod !== "email") throw new BadRequestError("This campaign uses social verification");

    await sendClaimEmail(email, campaignId, campaign.name, campaign.payoutAmount);
    res.json({ success: true, message: "Check your email for the claim link" });
  } catch (error) {
    next(error);
  }
});

export default router;
