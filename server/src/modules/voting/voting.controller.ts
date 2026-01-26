import { Request, Response, NextFunction } from "express";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/shared";
import { getCampaignDoc } from "@/modules/campaign";
import * as votingService from "./voting.service";

export async function handleGetInfo(
  req: Request<{ campaignId: string }>,
  res: Response,
  next: NextFunction
) {
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
}

export async function handleGetResults(
  req: Request<{ campaignId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const results = await votingService.getVoteResults(req.params.campaignId);
    res.json({ success: true, ...results });
  } catch (error) {
    next(error);
  }
}

export async function handleResolve(
  req: Request<{ campaignId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const campaign = await getCampaignDoc(req.params.campaignId);
    if (!campaign) throw new NotFoundError("Campaign not found");
    if (campaign.userId !== req.user!.userId) throw new ForbiddenError();

    await votingService.resolveDispute(req.params.campaignId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function handleGetZkConfig(
  req: Request<{ campaignId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const config = await votingService.getZkConfig(req.params.campaignId);
    res.json({ success: true, ...config });
  } catch (error) {
    next(error);
  }
}

export async function handleGetZkInputs(
  req: Request<{ campaignId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { identityHash } = req.body;
    if (!identityHash) throw new BadRequestError("identityHash required");
    const inputs = await votingService.getZkInputs(req.params.campaignId, identityHash);
    res.json({ success: true, ...inputs });
  } catch (error) {
    next(error);
  }
}

export async function handleZkProve(
  req: Request<{ campaignId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { identityHash, ciphertext } = req.body;
    if (!identityHash || !ciphertext) {
      throw new BadRequestError("identityHash and ciphertext required");
    }
    const result = await votingService.proveZkVote({
      campaignId: req.params.campaignId,
      identityHash,
      ciphertext,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function handleZkCast(
  req: Request<{ campaignId: string }>,
  res: Response,
  next: NextFunction
) {
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
}
