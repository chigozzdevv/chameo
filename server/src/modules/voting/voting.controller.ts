import { Router, Request, Response, NextFunction } from "express";
import { BadRequestError } from "@/shared";
import * as votingService from "./voting.service";

const router = Router();

router.post("/:campaignId/vote", async (req: Request<{ campaignId: string }>, res: Response, next: NextFunction) => {
  try {
    const { identity, action } = req.body;
    if (!identity) throw new BadRequestError("identity required");
    if (!["refund-host", "equal-distribution"].includes(action)) {
      throw new BadRequestError("Invalid action");
    }

    await votingService.castVote(req.params.campaignId, identity, action);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get("/:campaignId/votes", async (req: Request<{ campaignId: string }>, res: Response, next: NextFunction) => {
  try {
    const results = await votingService.getVoteResults(req.params.campaignId);
    res.json({ success: true, ...results });
  } catch (error) {
    next(error);
  }
});

router.post("/:campaignId/resolve", async (req: Request<{ campaignId: string }>, res: Response, next: NextFunction) => {
  try {
    await votingService.resolveDispute(req.params.campaignId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
