import { Router, Request, Response, NextFunction } from "express";
import { isValidAuthMethod, BadRequestError, ForbiddenError, NotFoundError } from "@/shared";
import { authMiddleware } from "@/modules/auth";
import * as campaignService from "./campaign.service";
import { getCampaignWalletPublicKey } from "./wallet.service";
import { sendBatchNotifications } from "@/modules/claim/notification.service";

const router = Router();

router.post("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, authMethod, payoutAmount, maxClaims, expiresAt, recipients, requireCompliance } = req.body;

    if (!name || name.length < 2) throw new BadRequestError("Campaign name required");
    if (!isValidAuthMethod(authMethod)) throw new BadRequestError("Invalid authMethod");
    if (!payoutAmount || payoutAmount <= 0) throw new BadRequestError("Invalid payoutAmount");
    if (!maxClaims || maxClaims <= 0) throw new BadRequestError("Invalid maxClaims");
    if (!expiresAt || expiresAt <= Date.now() / 1000) throw new BadRequestError("Invalid expiresAt");
    if (!Array.isArray(recipients) || recipients.length === 0) throw new BadRequestError("recipients required");

    const result = await campaignService.createCampaign(req.user!.userId, req.user!.orgSlug, {
      name,
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
    next(error);
  }
});

router.get("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaigns = await campaignService.getUserCampaigns(req.user!.userId);
    res.json({ success: true, campaigns });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const campaign = await campaignService.getCampaign(req.params.id);
    if (!campaign) throw new NotFoundError("Campaign not found");
    res.json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/funding-address", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const doc = await campaignService.getCampaignDoc(id);
    if (!doc) throw new NotFoundError("Campaign not found");
    if (doc.userId !== req.user!.userId) throw new ForbiddenError();

    const fundingAddress = await getCampaignWalletPublicKey(id);
    res.json({
      success: true,
      fundingAddress,
      totalRequired: doc.payoutAmount * doc.maxClaims,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/check-funding", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const doc = await campaignService.getCampaignDoc(id);
    if (!doc) throw new NotFoundError("Campaign not found");
    if (doc.userId !== req.user!.userId) throw new ForbiddenError();

    const result = await campaignService.checkFunding(id);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/recipients", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const { recipients } = req.body;
    if (!Array.isArray(recipients) || recipients.length === 0) throw new BadRequestError("recipients required");

    const { id } = req.params;
    const doc = await campaignService.getCampaignDoc(id);
    if (!doc) throw new NotFoundError("Campaign not found");
    if (doc.userId !== req.user!.userId) throw new ForbiddenError();

    const result = await campaignService.addRecipients(id, req.user!.userId, recipients, doc.authMethod);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/notify", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const doc = await campaignService.getCampaignDoc(id);
    if (!doc) throw new NotFoundError("Campaign not found");
    if (doc.userId !== req.user!.userId) throw new ForbiddenError();
    if (!doc.funded) throw new BadRequestError("Campaign not funded");

    const { recipients, baseUrl, useMagicLinks } = req.body;
    if (!Array.isArray(recipients) || recipients.length === 0) throw new BadRequestError("recipients required");
    if (!["email", "phone"].includes(doc.authMethod)) throw new BadRequestError("Notifications only for email/phone campaigns");
    if (!baseUrl) throw new BadRequestError("baseUrl required");

    const result = await sendBatchNotifications(recipients, doc.authMethod, id, doc.name, baseUrl, useMagicLinks || false);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
