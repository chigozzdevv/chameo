import { vault } from "@/lib/vault";
import { generateWalletKeys, getPrivateBalance, deposit, withdraw, type WalletKeys } from "@/lib/privacy-cash";
import { NotFoundError } from "@/shared";

function vaultKey(campaignId: string): string {
  return `campaign-wallets/${campaignId}`;
}

export async function createCampaignWallet(campaignId: string): Promise<string> {
  const keys = generateWalletKeys();
  await vault.storeSecret(vaultKey(campaignId), keys as unknown as Record<string, string>);
  return keys.publicKey;
}

export async function getCampaignWalletKeys(campaignId: string): Promise<WalletKeys> {
  const keys = await vault.getSecret<Record<string, string>>(vaultKey(campaignId));
  if (!keys) throw new NotFoundError("Campaign wallet not found");
  return keys as unknown as WalletKeys;
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
): Promise<{ signature: string; amount: number }> {
  const keys = await getCampaignWalletKeys(campaignId);
  return withdraw(keys, amount, recipient);
}

export async function deleteCampaignWallet(campaignId: string): Promise<void> {
  await vault.deleteSecret(vaultKey(campaignId));
}
