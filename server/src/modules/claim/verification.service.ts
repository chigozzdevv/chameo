import { generateOtp, generateToken, hashIdentity } from "@/shared";
import { sendEmail } from "@/lib/messaging";
import { otpsCollection, magicLinksCollection, verificationTokensCollection } from "./claim.model";

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

  await otpsCollection().updateOne(
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

export async function verifyOtp(
  method: string,
  identifier: string,
  campaignId: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const key = otpKey(method, identifier, campaignId);
  const col = otpsCollection();
  const doc = await col.findOne({ key });

  if (!doc) return { valid: false, error: "No verification code found" };
  if (doc.attempts >= MAX_OTP_ATTEMPTS) return { valid: false, error: "Too many attempts" };

  // Increment attempts before validation to prevent timing attacks
  await col.updateOne({ key }, { $inc: { attempts: 1 } });

  if (doc.code !== code) return { valid: false, error: "Invalid code" };

  await col.deleteOne({ key });
  return { valid: true };
}

export async function createMagicLink(method: string, identifier: string, campaignId: string): Promise<string> {
  const token = generateToken();

  await magicLinksCollection().insertOne({
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
  const doc = await magicLinksCollection().findOneAndDelete({ token });

  if (!doc) return { valid: false, error: "Invalid or expired link" };

  const identityHash = hashIdentity(doc.authMethod, doc.identifier).toString("hex");
  const verificationToken = await createVerificationToken(identityHash, doc.campaignId);

  return { valid: true, token: verificationToken, identityHash, campaignId: doc.campaignId };
}

export async function createVerificationToken(identityHash: string, campaignId: string): Promise<string> {
  const token = generateToken();

  await verificationTokensCollection().insertOne({
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
  const doc = await verificationTokensCollection().findOne({ token, campaignId });

  if (!doc) return { valid: false, error: "Invalid or expired token" };

  if (doc.expiresAt < new Date()) {
    await verificationTokensCollection().deleteOne({ token });
    return { valid: false, error: "Token expired" };
  }

  return { valid: true, identityHash: doc.identityHash };
}

export async function consumeVerificationToken(token: string): Promise<void> {
  await verificationTokensCollection().deleteOne({ token });
}
