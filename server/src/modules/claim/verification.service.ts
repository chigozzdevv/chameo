import { BadRequestError, generateToken, hashIdentity } from "@/shared";
import { sendEmail } from "@/lib/messaging";
import { getFrontendUrl, renderEmailTemplate } from "@/lib/messaging/template";
import { env } from "@/config";
import { magicLinksCollection, oauthStatesCollection, verificationTokensCollection } from "./claim.model";

const MAGIC_LINK_EXPIRY_MS = 24 * 60 * 60 * 1000;
const TOKEN_EXPIRY_MS = 30 * 60 * 1000;
const OAUTH_STATE_EXPIRY_MS = 10 * 60 * 1000;

export async function sendClaimEmail(email: string, campaignId: string, campaignName: string, payoutAmount: number): Promise<void> {
  const token = await createMagicLink("email", email, campaignId);
  const link = `${getFrontendUrl()}/claim/${campaignId}?token=${token}`;
  const amountInSol = (payoutAmount / 1e9).toFixed(4);

  const html = renderEmailTemplate({
    title: `Claim ${amountInSol} SOL`,
    preheader: `Claim ${amountInSol} SOL from ${campaignName}.`,
    body: `
      <p style="margin:0 0 12px;">You're eligible to claim <strong>${amountInSol} SOL</strong> from <strong>${campaignName}</strong>.</p>
      <p style="margin:0;">This link expires in 24 hours.</p>
    `,
    cta: { label: "Claim payout", url: link },
  });

  await sendEmail(email, `Claim ${amountInSol} SOL from ${campaignName}`, html, { from: env.resend.fromClaims });
}

export async function createMagicLink(method: string, identifier: string, campaignId: string): Promise<string> {
  const token = generateToken();
  const identityHash = hashIdentity(method, identifier).toString("hex");

  await magicLinksCollection().insertOne({
    token,
    authMethod: method,
    identityHash,
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

  const identityHash =
    doc.identityHash ||
    (doc.identifier ? hashIdentity(doc.authMethod, doc.identifier).toString("hex") : null);
  if (!identityHash) return { valid: false, error: "Invalid or expired link" };
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

export async function createOAuthState(params: {
  provider: string;
  campaignId: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<string> {
  const state = generateToken();
  await oauthStatesCollection().insertOne({
    state,
    provider: params.provider,
    campaignId: params.campaignId,
    redirectUri: params.redirectUri,
    codeVerifier: params.codeVerifier,
    createdAt: Date.now(),
    expiresAt: new Date(Date.now() + OAUTH_STATE_EXPIRY_MS),
  });
  return state;
}

export async function consumeOAuthState(state: string, provider: string): Promise<{
  campaignId: string;
  redirectUri: string;
  codeVerifier?: string;
}> {
  const doc = await oauthStatesCollection().findOneAndDelete({ state, provider });
  if (!doc) throw new BadRequestError("Invalid or expired state");
  if (doc.expiresAt < new Date()) {
    throw new BadRequestError("State expired");
  }
  return {
    campaignId: doc.campaignId,
    redirectUri: doc.redirectUri,
    codeVerifier: doc.codeVerifier,
  };
}

export async function consumeOAuthStateByState(state: string): Promise<{
  provider: string;
  campaignId: string;
  redirectUri: string;
  codeVerifier?: string;
}> {
  const doc = await oauthStatesCollection().findOneAndDelete({ state });
  if (!doc) throw new BadRequestError("Invalid or expired state");
  if (doc.expiresAt < new Date()) {
    throw new BadRequestError("State expired");
  }
  return {
    provider: doc.provider,
    campaignId: doc.campaignId,
    redirectUri: doc.redirectUri,
    codeVerifier: doc.codeVerifier,
  };
}
