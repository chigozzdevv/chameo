import { Router, Request } from "express";
import { isValidEmail, isValidPhone, isValidPublicKey, hashIdentity, generateToken, BadRequestError, rateLimit } from "@/shared";
import { authProviders } from "@/lib/auth-providers";
import { verificationTokensCollection } from "./claim.model";
import { sendEmailOtp, verifyOtp, verifyMagicLink } from "./verification.service";
import { processClaim, getClaimStatus } from "./claim.service";

const router = Router();

const otpRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  keyGenerator: (req: Request) => (req.body?.email || req.body?.phone || req.ip || "unknown") as string,
});

router.post("/verify/email", otpRateLimit, async (req, res, next) => {
  try {
    const { email, campaignId } = req.body;
    if (!email || !isValidEmail(email)) throw new BadRequestError("Invalid email");
    if (!campaignId) throw new BadRequestError("campaignId required");

    const success = await sendEmailOtp(email, campaignId);
    res.json({ success });
  } catch (error) {
    next(error);
  }
});

router.post("/verify/otp", async (req, res, next) => {
  try {
    const { authMethod, identifier, campaignId, code } = req.body;
    if (authMethod !== "email") throw new BadRequestError("Invalid authMethod");
    if (!identifier) throw new BadRequestError("identifier required");
    if (!campaignId) throw new BadRequestError("campaignId required");
    if (!code || code.length !== 6) throw new BadRequestError("Invalid code");

    const result = await verifyOtp(authMethod, identifier, campaignId, code);
    if (!result.valid) throw new BadRequestError(result.error!);

    const identityHash = hashIdentity(authMethod, identifier).toString("hex");
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
    const result = await getClaimStatus(campaignId, identityHash);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
