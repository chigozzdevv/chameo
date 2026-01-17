import { Router, Request, Response, NextFunction } from "express";
import { BadRequestError } from "@/shared";
import * as votingService from "./voting.service";

const router = Router();

router.get("/:campaignId/info", async (req: Request<{ campaignId: string }>, res: Response, next: NextFunction) => {
  try {
    const info = await votingService.getVotingInfo(req.params.campaignId);
    if (!info) {
      res.json({ success: true, initialized: false });
      return;
    }
    res.json({ success: true, initialized: true, ...info });
  } catch (error) {
    next(error);
  }
});

router.get("/:campaignId/results", async (req: Request<{ campaignId: string }>, res: Response, next: NextFunction) => {
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

router.get("/:campaignId/zk-config", async (req: Request<{ campaignId: string }>, res: Response, next: NextFunction) => {
  try {
    const config = await votingService.getZkConfig(req.params.campaignId);
    res.json({ success: true, ...config });
  } catch (error) {
    next(error);
  }
});

router.post("/:campaignId/zk-inputs", async (req: Request<{ campaignId: string }>, res: Response, next: NextFunction) => {
  try {
    const { identityHash } = req.body;
    if (!identityHash) throw new BadRequestError("identityHash required");
    const inputs = await votingService.getZkInputs(req.params.campaignId, identityHash);
    res.json({ success: true, ...inputs });
  } catch (error) {
    next(error);
  }
});

router.post("/:campaignId/zk-cast", async (req: Request<{ campaignId: string }>, res: Response, next: NextFunction) => {
  try {
    const { proof, publicWitness, nullifier, ciphertext } = req.body;
    if (!proof || !publicWitness || !nullifier || !ciphertext) {
      throw new BadRequestError("proof, publicWitness, nullifier, ciphertext required");
    }
    const result = await votingService.castZkVote({
      campaignId: req.params.campaignId,
      proof,
      publicWitness,
      nullifier,
      ciphertext,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
