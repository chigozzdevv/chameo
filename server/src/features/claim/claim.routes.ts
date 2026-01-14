import { Router } from "express";
import { isValidEmail, isValidPhone, isValidPublicKey } from "@/utils";
import { hashIdentity } from "@/utils";
import { sendEmailOtp, sendPhoneOtp, verifyOtp, verifyMagicLink } from "./claim.verification";
import { processClaim, getClaimStatus } from "./claim.service";
import { socialHandlers } from "./handlers";
import { col } from "@/shared";
import type { VerificationTokenDoc } from "./claim.types";
import { generateToken } from "@/utils";
const router = Router();
router.post("/verify/email", async (req, res) => {
  try {
    const { email, campaignId } = req.body;
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: "Invalid email" });
    if (!campaignId) return res.status(400).json({ error: "campaignId required" });
    const success = await sendEmailOtp(email, campaignId);
    res.json({ success });
  } catch (error) {
    console.error("Email OTP error:", error);
    res.status(500).json({ error: "Failed to send verification email" });
  }
});
router.post("/verify/phone", async (req, res) => {
  try {
    const { phone, campaignId } = req.body;
    if (!phone || !isValidPhone(phone)) return res.status(400).json({ error: "Invalid phone" });
    if (!campaignId) return res.status(400).json({ error: "campaignId required" });
    const success = await sendPhoneOtp(phone, campaignId);
    res.json({ success });
  } catch (error) {
    console.error("Phone OTP error:", error);
    res.status(500).json({ error: "Failed to send verification SMS" });
  }
});
router.post("/verify/otp", async (req, res) => {
  try {
    const { authMethod, identifier, campaignId, code } = req.body;
    if (!["email", "phone"].includes(authMethod)) return res.status(400).json({ error: "Invalid authMethod" });
    if (!identifier) return res.status(400).json({ error: "identifier required" });
    if (!campaignId) return res.status(400).json({ error: "campaignId required" });
    if (!code || code.length !== 6) return res.status(400).json({ error: "Invalid code" });
    const result = await verifyOtp(authMethod, identifier, campaignId, code);
    if (!result.valid) return res.status(400).json({ error: result.error });
    res.json({ success: true, token: result.token, identityHash: result.identityHash });
  } catch (error) {
    console.error("OTP verify error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});
router.post("/verify/magic-link", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token required" });
    const result = await verifyMagicLink(token);
    if (!result.valid) return res.status(400).json({ error: result.error });
    res.json({ success: true, token: result.token, identityHash: result.identityHash, campaignId: result.campaignId });
  } catch (error) {
    console.error("Magic link error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});
router.get("/verify/social/:provider/url", async (req, res) => {
  try {
    const { provider } = req.params;
    const { campaignId, redirectUri } = req.query;
    const handler = socialHandlers[provider];
    if (!handler) return res.status(400).json({ error: "Invalid provider" });
    if (!campaignId || !redirectUri) return res.status(400).json({ error: "campaignId and redirectUri required" });
    const url = handler.getAuthUrl(campaignId as string, redirectUri as string);
    res.json({ success: true, url });
  } catch (error) {
    console.error("Social auth URL error:", error);
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});
router.post("/verify/social/:provider/callback", async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, state: campaignId } = req.body;
    const handler = socialHandlers[provider];
    if (!handler) return res.status(400).json({ error: "Invalid provider" });
    if (!code || !campaignId) return res.status(400).json({ error: "code and campaignId required" });
    const result = await handler.verify(code, campaignId);
    if (!result.valid) return res.status(400).json({ error: result.error });
    const identityHash = hashIdentity(provider, result.identifier!).toString("hex");
    const token = generateToken();
    await col<VerificationTokenDoc>("verificationTokens").insertOne({
      token,
      identityHash,
      campaignId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    res.json({ success: true, token, identityHash });
  } catch (error) {
    console.error("Social callback error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});
router.post("/process", async (req, res) => {
  try {
    const { campaignId, token, walletAddress } = req.body;
    if (!campaignId) return res.status(400).json({ error: "campaignId required" });
    if (!token) return res.status(400).json({ error: "token required" });
    if (!walletAddress || !isValidPublicKey(walletAddress)) return res.status(400).json({ error: "Invalid walletAddress" });
    const result = await processClaim(campaignId, token, walletAddress);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Claim error:", error);
    const clientErrors = ["not found", "not funded", "expired", "exhausted", "eligible", "claimed", "compliance", "token", "Invalid"];
    const isClientError = clientErrors.some((e) => error.message?.toLowerCase().includes(e.toLowerCase()));
    res.status(isClientError ? 400 : 500).json({ error: error.message || "Failed to process claim" });
  }
});
router.get("/status/:campaignId/:identityHash", async (req, res) => {
  try {
    const { campaignId, identityHash } = req.params;
    const result = await getClaimStatus(campaignId, identityHash);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Claim status error:", error);
    res.status(500).json({ error: "Failed to get claim status" });
  }
});
export default router;
