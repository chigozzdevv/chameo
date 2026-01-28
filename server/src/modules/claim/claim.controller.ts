import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { isValidPublicKey, hashIdentity, BadRequestError } from "@/shared";
import { authProviders } from "@/lib/auth-providers";
import {
  verifyMagicLink,
  validateVerificationToken,
  createOAuthState,
  consumeOAuthState,
  consumeOAuthStateByState,
  createVerificationToken,
} from "./verification.service";
import { processClaim, getClaimStatus } from "./claim.service";
import { trackEvent } from "@/modules/analytics";

function base64UrlEncode(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function generateCodeVerifier(): string {
  return base64UrlEncode(crypto.randomBytes(32));
}

function createCodeChallenge(verifier: string): string {
  const digest = crypto.createHash("sha256").update(verifier).digest();
  return base64UrlEncode(digest);
}

export async function handleVerifyMagicLink(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.body;
    if (!token) throw new BadRequestError("token required");

    const result = await verifyMagicLink(token);
    if (!result.valid) throw new BadRequestError(result.error!);

    if (result.campaignId) {
      await trackEvent({
        campaignId: result.campaignId,
        eventType: "link-click",
        identityHash: result.identityHash,
      });
    }

    res.json({ success: true, token: result.token, identityHash: result.identityHash, campaignId: result.campaignId });
  } catch (error) {
    next(error);
  }
}

export async function handleSocialUrl(req: Request<{ provider: string }>, res: Response, next: NextFunction) {
  try {
    const { provider } = req.params;
    const { campaignId, redirectUri } = req.query;

    if (["email", "phone"].includes(provider)) throw new BadRequestError("Use OTP for email/phone");

    const handler = authProviders[provider];
    if (!handler) throw new BadRequestError("Invalid provider");
    if (!campaignId || !redirectUri) throw new BadRequestError("campaignId and redirectUri required");

    const codeVerifier = provider === "twitter" ? generateCodeVerifier() : undefined;
    const state = await createOAuthState({
      provider,
      campaignId: String(campaignId),
      redirectUri: String(redirectUri),
      codeVerifier,
    });
    const codeChallenge = codeVerifier ? createCodeChallenge(codeVerifier) : undefined;
    const url = handler.getAuthUrl({
      campaignId: String(campaignId),
      redirectUri: String(redirectUri),
      state,
      codeChallenge,
    });
    res.json({ success: true, url });
  } catch (error) {
    next(error);
  }
}

export async function handleSocialCallback(req: Request<{ provider: string }>, res: Response, next: NextFunction) {
  try {
    const { provider } = req.params;
    const { code, state, authData } = req.body;

    if (["email", "phone"].includes(provider)) throw new BadRequestError("Use OTP for email/phone");

    const handler = authProviders[provider];
    if (!handler) throw new BadRequestError("Invalid provider");
    if (!state) throw new BadRequestError("state required");
    if (provider !== "telegram" && !code) throw new BadRequestError("code required");

    const oauthState = await consumeOAuthState(state, provider);
    const result = await handler.verify({
      code,
      redirectUri: oauthState.redirectUri,
      codeVerifier: oauthState.codeVerifier,
      authData,
    });
    if (!result.valid) throw new BadRequestError(result.error!);

    const identityHash = hashIdentity(provider, result.identifier!).toString("hex");
    const token = await createVerificationToken(identityHash, oauthState.campaignId);

    await trackEvent({ campaignId: oauthState.campaignId, eventType: "link-click", identityHash });

    res.json({ success: true, token, identityHash });
  } catch (error) {
    next(error);
  }
}

export async function handleSocialCallbackByState(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, state, authData } = req.body;
    if (!state) throw new BadRequestError("state required");

    const oauthState = await consumeOAuthStateByState(state);
    const handler = authProviders[oauthState.provider];
    if (!handler) throw new BadRequestError("Invalid provider");
    if (oauthState.provider !== "telegram" && !code) throw new BadRequestError("code required");

    const result = await handler.verify({
      code,
      redirectUri: oauthState.redirectUri,
      codeVerifier: oauthState.codeVerifier,
      authData,
    });
    if (!result.valid) throw new BadRequestError(result.error!);

    const identityHash = hashIdentity(oauthState.provider, result.identifier!).toString("hex");
    const token = await createVerificationToken(identityHash, oauthState.campaignId);

    await trackEvent({ campaignId: oauthState.campaignId, eventType: "link-click", identityHash });

    res.json({ success: true, token, identityHash, campaignId: oauthState.campaignId });
  } catch (error) {
    next(error);
  }
}

export async function handleProcessClaim(req: Request, res: Response, next: NextFunction) {
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
}

export async function handleClaimStatus(
  req: Request<{ campaignId: string; identityHash: string }>,
  res: Response,
  next: NextFunction
) {
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
}
