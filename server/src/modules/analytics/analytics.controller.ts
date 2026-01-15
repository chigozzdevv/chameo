import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware } from "@/modules/auth";
import { ForbiddenError, NotFoundError } from "@/shared";
import { getCampaignDoc } from "@/modules/campaign";
import * as analyticsService from "./analytics.service";

const router = Router();

router.get("/:campaignId", authMiddleware, async (req: Request<{ campaignId: string }>, res: Response, next: NextFunction) => {
  try {
    const campaign = await getCampaignDoc(req.params.campaignId);
    if (!campaign) throw new NotFoundError("Campaign not found");
    if (campaign.userId !== req.user!.userId) throw new ForbiddenError();

    const analytics = await analyticsService.getCampaignAnalytics(req.params.campaignId);
    res.json({ success: true, analytics });
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

export default router;
