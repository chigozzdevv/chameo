import { Router, Request, Response, NextFunction } from "express";
import { isValidAuthMethod, BadRequestError, ForbiddenError, NotFoundError } from "@/shared";
import { authMiddleware } from "@/modules/auth";
import { trackEvent } from "@/modules/analytics";
import * as campaignService from "./campaign.service";
import { getCampaignWalletPublicKey } from "./wallet.service";
import { sendBatchNotifications } from "@/modules/claim/notification.service";

const router = Router();

router.post("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, type, authMethod, payoutAmount, maxClaims, expiresAt, winnersDeadline, recipients, requireCompliance } =
      req.body;

    if (!name || name.length < 2) throw new BadRequestError("Campaign name required");
    if (!["payout", "escrow"].includes(type)) throw new BadRequestError("Invalid type");
    if (!isValidAuthMethod(authMethod)) throw new BadRequestError("Invalid authMethod");
    if (!payoutAmount || payoutAmount <= 0) throw new BadRequestError("Invalid payoutAmount");
    if (!maxClaims || maxClaims <= 0) throw new BadRequestError("Invalid maxClaims");
    if (!expiresAt || expiresAt <= Date.now() / 1000) throw new BadRequestError("Invalid expiresAt");
    if (type === "escrow" && (!winnersDeadline || winnersDeadline >= expiresAt)) {
      throw new BadRequestError("winnersDeadline must be before expiresAt");
    }
    if (!Array.isArray(recipients) || recipients.length === 0) throw new BadRequestError("recipients required");

    const result = await campaignService.createCampaign(req.user!.userId, req.user!.orgSlug, {
      name,
      description,
      type,
      authMethod,
      payoutAmount,
      maxClaims,
      expiresAt,
      winnersDeadline,
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

    await trackEvent({ campaignId: req.params.id, eventType: "view" });

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

router.post("/:id/close", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reclaimAddress } = req.body;
    if (!reclaimAddress) throw new BadRequestError("reclaimAddress required");

    const result = await campaignService.closeCampaign(id, req.user!.userId, reclaimAddress);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/select-winners", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const { winners } = req.body;
    if (!Array.isArray(winners) || winners.length === 0) throw new BadRequestError("winners required");

    const result = await campaignService.selectWinners(req.params.id, req.user!.userId, winners);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/upload-image", authMiddleware, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) throw new BadRequestError("imageUrl required");

    await campaignService.updateCampaignImage(req.params.id, req.user!.userId, imageUrl);
    res.json({ success: true, imageUrl });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/check-dispute", async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    await campaignService.checkAndTriggerDispute(req.params.id);
    const campaign = await campaignService.getCampaign(req.params.id);
    res.json({ success: true, status: campaign?.status });
  } catch (error) {
    next(error);
  }
});

export default router;
