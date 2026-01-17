import { Router, Request } from "express";
import { isValidEmail, isValidPublicKey, hashIdentity, generateToken, BadRequestError, rateLimit } from "@/shared";
import { authProviders } from "@/lib/auth-providers";
import { verificationTokensCollection } from "./claim.model";
import { verifyMagicLink, validateVerificationToken } from "./verification.service";
import { processClaim, getClaimStatus } from "./claim.service";

const router = Router();

router.post("/verify/magic-link", async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) throw new BadRequestError("token required");

    const result = await verifyMagicLink(token);
    if (!result.valid) throw new BadRequestError(result.error!);

    res.json({ success: true, token: result.token, identityHash: result.identityHash, campaignId: result.campaignId });
  } catch (error) {
    next(error);
  }
});

router.get("/verify/social/:provider/url", async (req, res, next) => {
  try {
    const { provider } = req.params;
    const { campaignId, redirectUri } = req.query;

    if (["email", "phone"].includes(provider)) throw new BadRequestError("Use OTP for email/phone");

    const handler = authProviders[provider];
    if (!handler) throw new BadRequestError("Invalid provider");
    if (!campaignId || !redirectUri) throw new BadRequestError("campaignId and redirectUri required");

    const url = handler.getAuthUrl(campaignId as string, redirectUri as string);
    res.json({ success: true, url });
  } catch (error) {
    next(error);
  }
});

router.post("/verify/social/:provider/callback", async (req, res, next) => {
  try {
    const { provider } = req.params;
    const { code, state: campaignId } = req.body;

    if (["email", "phone"].includes(provider)) throw new BadRequestError("Use OTP for email/phone");

    const handler = authProviders[provider];
    if (!handler) throw new BadRequestError("Invalid provider");
    if (!code || !campaignId) throw new BadRequestError("code and campaignId required");

    const result = await handler.verify(code);
    if (!result.valid) throw new BadRequestError(result.error!);

    const identityHash = hashIdentity(provider, result.identifier!).toString("hex");
    const token = generateToken();

    await verificationTokensCollection().insertOne({
      token,
      identityHash,
      campaignId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    res.json({ success: true, token, identityHash });
  } catch (error) {
    next(error);
  }
});

router.post("/process", async (req, res, next) => {
  try {
    const { campaignId, token, walletAddress } = req.body;
    if (!campaignId) throw new BadRequestError("campaignId required");
    if (!token) throw new BadRequestError("token required");
    if (!walletAddress || !isValidPublicKey(walletAddress)) throw new BadRequestError("Invalid walletAddress");

    const result = await processClaim(campaignId, token, walletAddress);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.get("/status/:campaignId/:identityHash", async (req, res, next) => {
  try {
    const { campaignId, identityHash } = req.params;
    const token = req.query.token;
    if (!token || typeof token !== "string") throw new BadRequestError("token required");

    const tokenResult = await validateVerificationToken(token, campaignId);
    if (!tokenResult.valid || !tokenResult.identityHash) {
      throw new BadRequestError(tokenResult.error || "Invalid or expired token");
    }
    if (tokenResult.identityHash !== identityHash) {
      throw new BadRequestError("Invalid identityHash");
    }

    const result = await getClaimStatus(campaignId, tokenResult.identityHash);
    res.json({ success: true, claimed: result.claimed });
  } catch (error) {
    next(error);
  }
});

export default router;
