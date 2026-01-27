import { Request, Response, NextFunction } from "express";
import { env } from "@/config";
import { isValidAuthMethod, isValidPublicKey, BadRequestError, ForbiddenError, NotFoundError } from "@/shared";
import { trackEvent } from "@/modules/analytics";
import * as campaignService from "./campaign.service";
import { getCampaignWalletPublicKey } from "./wallet.service";
import { sendBatchNotifications } from "@/modules/claim/notification.service";
import type { CampaignTheme } from "./campaign.model";
import { uploadCampaignImage } from "@/lib/cloudinary";

const themeRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function validateTheme(theme?: CampaignTheme): CampaignTheme | undefined {
  if (!theme) return undefined;
  for (const [key, value] of Object.entries(theme)) {
    if (!value) continue;
    if (!themeRegex.test(value)) {
      throw new BadRequestError(`Invalid theme color: ${key}`);
    }
  }
  return theme;
}

export async function handleCreateCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const {
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
      refundAddress,
      theme,
    } = req.body;

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
    if (refundAddress && !isValidPublicKey(refundAddress)) {
      throw new BadRequestError("Invalid refundAddress");
    }
    const validatedTheme = validateTheme(theme);

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
      refundAddress,
      theme: validatedTheme,
    });

    res.json({
      success: true,
      campaignId: result.campaign.id,
      fundingAddress: result.fundingAddress,
      totalRequired: result.totalRequired,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleListCampaigns(req: Request, res: Response, next: NextFunction) {
  try {
    const campaigns = await campaignService.getUserCampaigns(req.user!.userId);
    res.json({ success: true, campaigns });
  } catch (error) {
    next(error);
  }
}

export async function handleGetCampaign(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const campaign = await campaignService.getCampaign(req.params.id);
    if (!campaign) throw new NotFoundError("Campaign not found");
    if (!campaign.funded) throw new NotFoundError("Campaign not live yet");

    await trackEvent({ campaignId: req.params.id, eventType: "view" });

    res.json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
}

export async function handleGetCampaignForEdit(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const result = await campaignService.getCampaignForEdit(req.params.id, req.user!.userId);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function handleGetFundingAddress(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const doc = await campaignService.getCampaignDoc(id);
    if (!doc) throw new NotFoundError("Campaign not found");
    if (doc.userId !== req.user!.userId) throw new ForbiddenError();

    const fundingAddress = await getCampaignWalletPublicKey(id);
    const totalRequired = await campaignService.getTotalRequiredLamports(doc);
    res.json({
      success: true,
      fundingAddress,
      totalRequired,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateCampaign(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const { name, description, payoutAmount, maxClaims, expiresAt, winnersDeadline, refundAddress, theme } = req.body;
    if (refundAddress && !isValidPublicKey(refundAddress)) {
      throw new BadRequestError("Invalid refundAddress");
    }
    const validatedTheme = theme ? validateTheme(theme) : undefined;
    const result = await campaignService.updateCampaign(req.params.id, req.user!.userId, {
      name,
      description,
      payoutAmount,
      maxClaims,
      expiresAt,
      winnersDeadline,
      refundAddress,
      theme: validatedTheme,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function handleDeleteCampaign(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    await campaignService.deleteCampaign(req.params.id, req.user!.userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function handleGetFundingConfig(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const doc = await campaignService.getCampaignDoc(id);
    if (!doc) throw new NotFoundError("Campaign not found");
    if (doc.userId !== req.user!.userId) throw new ForbiddenError();

    const campaignWallet = await getCampaignWalletPublicKey(id);
    res.json({
      success: true,
      campaignWallet,
      privacyCash: {
        programId: env.privacyCash.programId,
        relayerUrl: env.privacyCash.relayerUrl,
        feeRecipient: env.privacyCash.feeRecipient,
        altAddress: env.privacyCash.altAddress,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function handleCheckFunding(req: Request<{ id: string }>, res: Response, next: NextFunction) {
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
}

export async function handleAddRecipients(req: Request<{ id: string }>, res: Response, next: NextFunction) {
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
}

export async function handleReplaceRecipients(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const { recipients } = req.body;
    if (!Array.isArray(recipients) || recipients.length === 0) throw new BadRequestError("recipients required");

    const result = await campaignService.replaceRecipients(req.params.id, req.user!.userId, recipients);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function handleNotifyRecipients(req: Request<{ id: string }>, res: Response, next: NextFunction) {
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

    const result = await sendBatchNotifications(
      recipients,
      doc.authMethod,
      id,
      doc.name,
      doc.payoutAmount,
      baseUrl,
      useMagicLinks || false
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function handleCloseCampaign(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { reclaimAddress } = req.body;
    if (!reclaimAddress) throw new BadRequestError("reclaimAddress required");

    const result = await campaignService.closeCampaign(id, req.user!.userId, reclaimAddress);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function handleSelectWinners(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const { winners } = req.body;
    if (!Array.isArray(winners) || winners.length === 0) throw new BadRequestError("winners required");

    const result = await campaignService.selectWinners(req.params.id, req.user!.userId, winners);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function handleUploadImage(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const { imageUrl } = req.body;
    if (!req.file && !imageUrl) throw new BadRequestError("imageUrl or image file required");

    let finalUrl = imageUrl as string;
    if (req.file) {
      finalUrl = await uploadCampaignImage({
        campaignId: req.params.id,
        buffer: req.file.buffer,
        filename: req.file.originalname || "campaign",
      });
    }

    await campaignService.updateCampaignImage(req.params.id, req.user!.userId, finalUrl);
    res.json({ success: true, imageUrl: finalUrl });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateTheme(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const { theme } = req.body;
    const validatedTheme = validateTheme(theme);
    if (!validatedTheme) throw new BadRequestError("theme required");

    await campaignService.updateCampaignTheme(req.params.id, req.user!.userId, validatedTheme);
    res.json({ success: true, theme: validatedTheme });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateRefundAddress(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const { refundAddress } = req.body;
    if (!refundAddress) throw new BadRequestError("refundAddress required");
    if (!isValidPublicKey(refundAddress)) throw new BadRequestError("Invalid refundAddress");

    await campaignService.updateRefundAddress(req.params.id, req.user!.userId, refundAddress);
    res.json({ success: true, refundAddress });
  } catch (error) {
    next(error);
  }
}

export async function handleCheckDispute(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    await campaignService.checkAndTriggerDispute(req.params.id);
    const campaign = await campaignService.getCampaign(req.params.id);
    res.json({ success: true, status: campaign?.status });
  } catch (error) {
    next(error);
  }
}
