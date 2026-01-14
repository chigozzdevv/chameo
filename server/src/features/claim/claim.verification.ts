import { col, sendEmail, sendSms } from "@/shared";
import { generateOtp, generateToken, hashIdentity } from "@/utils";
import type { OtpDoc, MagicLinkDoc, VerificationTokenDoc } from "./claim.types";
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAGIC_LINK_EXPIRY_MS = 24 * 60 * 60 * 1000;
const TOKEN_EXPIRY_MS = 30 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
function otpKey(method: string, identifier: string, campaignId: string): string {
  return `${method}:${identifier.toLowerCase()}:${campaignId}`;
}
export async function sendEmailOtp(email: string, campaignId: string): Promise<boolean> {
  const code = generateOtp();
  const key = otpKey("email", email, campaignId);
  await col<OtpDoc>("otps").updateOne(
    { key },
    { $set: { key, code, attempts: 0, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) } },
    { upsert: true }
  );
  return sendEmail(
    email,
    "Your Chameo Verification Code",
    `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`
  );
}
export async function sendPhoneOtp(phone: string, campaignId: string): Promise<boolean> {
  const code = generateOtp();
  const key = otpKey("phone", phone, campaignId);
  await col<OtpDoc>("otps").updateOne(
    { key },
    { $set: { key, code, attempts: 0, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) } },
    { upsert: true }
  );
  return sendSms(phone, `Your Chameo verification code is: ${code}`);
}
export async function verifyOtp(
  method: string,
  identifier: string,
  campaignId: string,
  code: string
): Promise<{ valid: boolean; token?: string; identityHash?: string; error?: string }> {
  const key = otpKey(method, identifier, campaignId);
  const doc = await col<OtpDoc>("otps").findOne({ key });
  if (!doc) return { valid: false, error: "No verification code found" };
  if (doc.attempts >= MAX_OTP_ATTEMPTS) return { valid: false, error: "Too many attempts" };
  await col<OtpDoc>("otps").updateOne({ key }, { $inc: { attempts: 1 } });
  if (doc.code !== code) return { valid: false, error: "Invalid code" };
  await col<OtpDoc>("otps").deleteOne({ key });
  const identityHash = hashIdentity(method, identifier).toString("hex");
  const token = await createVerificationToken(identityHash, campaignId);
  return { valid: true, token, identityHash };
}
export async function createMagicLink(method: string, identifier: string, campaignId: string): Promise<string> {
  const token = generateToken();
  await col<MagicLinkDoc>("magicLinks").insertOne({
    token,
    authMethod: method,
    identifier,
    campaignId,
    expiresAt: new Date(Date.now() + MAGIC_LINK_EXPIRY_MS),
  });
  return token;
}
export async function verifyMagicLink(
  token: string
): Promise<{ valid: boolean; token?: string; identityHash?: string; campaignId?: string; error?: string }> {
  const doc = await col<MagicLinkDoc>("magicLinks").findOneAndDelete({ token });
  if (!doc) return { valid: false, error: "Invalid or expired link" };
  const identityHash = hashIdentity(doc.authMethod, doc.identifier).toString("hex");
  const verificationToken = await createVerificationToken(identityHash, doc.campaignId);
  return { valid: true, token: verificationToken, identityHash, campaignId: doc.campaignId };
}
async function createVerificationToken(identityHash: string, campaignId: string): Promise<string> {
  const token = generateToken();
  await col<VerificationTokenDoc>("verificationTokens").insertOne({
    token,
    identityHash,
    campaignId,
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
  });
  return token;
}
export async function validateVerificationToken(
  token: string,
  campaignId: string
): Promise<{ valid: boolean; identityHash?: string; error?: string }> {
  const doc = await col<VerificationTokenDoc>("verificationTokens").findOne({ token, campaignId });
  if (!doc) return { valid: false, error: "Invalid or expired token" };
  if (doc.expiresAt < new Date()) {
    await col<VerificationTokenDoc>("verificationTokens").deleteOne({ token });
    return { valid: false, error: "Token expired" };
  }
  return { valid: true, identityHash: doc.identityHash };
}
export async function consumeVerificationToken(token: string): Promise<void> {
  await col<VerificationTokenDoc>("verificationTokens").deleteOne({ token });
}
