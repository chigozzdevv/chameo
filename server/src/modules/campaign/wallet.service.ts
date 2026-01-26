import crypto from "crypto";
import { env } from "@/config";
import { generateWalletKeys, getPrivateBalance, deposit, withdraw, type WalletKeys } from "@/lib/privacy-cash";
import { NotFoundError } from "@/shared";
import { campaignsCollection } from "./campaign.model";

function encryptWalletKeys(keys: WalletKeys): string {
  const key = Buffer.from(env.wallet.encryptionKey, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(keys), "utf8"), cipher.final()]);
  return Buffer.concat([iv, encrypted]).toString("base64");
}

function decryptWalletKeys(encrypted: string): WalletKeys {
  const key = Buffer.from(env.wallet.encryptionKey, "hex");
  const data = Buffer.from(encrypted, "base64");
  const iv = data.subarray(0, 16);
  const encryptedData = data.subarray(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

export async function createCampaignWallet(campaignId: string): Promise<string> {
  const keys = generateWalletKeys();
  const encryptedKeys = encryptWalletKeys(keys);
  await campaignsCollection().updateOne({ id: campaignId }, { $set: { encryptedWalletKeys: encryptedKeys } });
  return keys.publicKey;
}

export async function getCampaignWalletKeys(campaignId: string): Promise<WalletKeys> {
  const campaign = await campaignsCollection().findOne({ id: campaignId });
  if (!campaign?.encryptedWalletKeys) throw new NotFoundError("Campaign wallet not found");
  return decryptWalletKeys(campaign.encryptedWalletKeys);
}

export async function getCampaignWalletPublicKey(campaignId: string): Promise<string> {
  const keys = await getCampaignWalletKeys(campaignId);
  return keys.publicKey;
}

export async function getCampaignPrivateBalance(campaignId: string): Promise<number> {
  const keys = await getCampaignWalletKeys(campaignId);
  return getPrivateBalance(keys);
}

export async function depositToCampaign(campaignId: string, amount: number): Promise<{ signature: string }> {
  const keys = await getCampaignWalletKeys(campaignId);
  return deposit(keys, amount);
}

export async function withdrawFromCampaign(
  campaignId: string,
  amount: number,
  recipient: string
): Promise<{ signature: string; amount: number; isPartial: boolean }> {
  const keys = await getCampaignWalletKeys(campaignId);
  return withdraw(keys, amount, recipient);
}
