import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware } from "@/modules/auth";
import { ForbiddenError, NotFoundError, BadRequestError, isValidPublicKey } from "@/shared";
import { getCampaignDoc } from "@/modules/campaign";
import * as analyticsService from "./analytics.service";

const router = Router();

router.get("/:campaignId", authMiddleware, async (req: Request<{ campaignId: string }>, res: Response, next: NextFunction) => {
  try {
    const campaign = await getCampaignDoc(req.params.campaignId);
    if (!campaign) throw new NotFoundError("Campaign not found");
    if (campaign.userId !== req.user!.userId) throw new ForbiddenError();

    const handles = await analyticsService.getAnalyticsHandles(req.params.campaignId);
    res.json({
      success: true,
      handles: handles || {
        pageViewsHandle: "0",
        linkClicksHandle: "0",
        claimStartsHandle: "0",
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:campaignId/events", authMiddleware, async (req: Request<{ campaignId: string }>, res: Response, next: NextFunction) => {
  try {
    const campaign = await getCampaignDoc(req.params.campaignId);
    if (!campaign) throw new NotFoundError("Campaign not found");
    if (campaign.userId !== req.user!.userId) throw new ForbiddenError();

    const events = await analyticsService.getRecentEvents(req.params.campaignId);
    res.json({ success: true, events });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/:campaignId/handles",
  authMiddleware,
  async (req: Request<{ campaignId: string }>, res: Response, next: NextFunction) => {
    try {
      const campaign = await getCampaignDoc(req.params.campaignId);
      if (!campaign) throw new NotFoundError("Campaign not found");
      if (campaign.userId !== req.user!.userId) throw new ForbiddenError();

      const handles = await analyticsService.getAnalyticsHandles(req.params.campaignId);
      res.json({
        success: true,
        available: !!handles,
        handles: handles || {
          pageViewsHandle: "0",
          linkClicksHandle: "0",
          claimStartsHandle: "0",
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:campaignId/grant-access",
  authMiddleware,
  async (req: Request<{ campaignId: string }>, res: Response, next: NextFunction) => {
    try {
      const { creatorPubkey } = req.body;
      if (!creatorPubkey || !isValidPublicKey(creatorPubkey)) throw new BadRequestError("Invalid creatorPubkey");

      const campaign = await getCampaignDoc(req.params.campaignId);
      if (!campaign) throw new NotFoundError("Campaign not found");
      if (campaign.userId !== req.user!.userId) throw new ForbiddenError();

      const result = await analyticsService.grantAnalyticsAccess(req.params.campaignId, creatorPubkey);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
