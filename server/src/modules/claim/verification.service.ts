import { generateToken, hashIdentity } from "@/shared";
import { magicLinksCollection, verificationTokensCollection } from "./claim.model";

const MAGIC_LINK_EXPIRY_MS = 24 * 60 * 60 * 1000;
const TOKEN_EXPIRY_MS = 30 * 60 * 1000;

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
