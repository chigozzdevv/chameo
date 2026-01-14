import { col } from "@/shared";
import { hashIdentity, generateId } from "@/utils";
import { createWallet, getBalance, deposit, getWallet } from "@/features/privacy-cash";
import { connection } from "@/shared";
import type { CampaignDoc, CreateCampaignInput, CampaignPublic } from "./campaign.types";
export async function createCampaign(input: CreateCampaignInput): Promise<{ campaign: CampaignPublic; fundingAddress: string; identityHashes: string[] }> {
  const id = generateId();
  const hostHash = hashIdentity(input.authMethod, input.hostIdentifier).toString("hex");
  const { publicKey } = await createWallet(id);
  const identityHashes = input.recipients.map((r) => hashIdentity(input.authMethod, r).toString("hex"));
  const doc: CampaignDoc = {
    id,
    hostHash,
    authMethod: input.authMethod,
    payoutAmount: input.payoutAmount,
    maxClaims: input.maxClaims,
    claimCount: 0,
    expiresAt: input.expiresAt,
    fundingAddress: publicKey,
    funded: false,
    fundedAmount: 0,
    requireCompliance: input.requireCompliance || false,
    eligibleHashes: identityHashes,
    createdAt: Date.now(),
  };
  await col<CampaignDoc>("campaigns").insertOne(doc);
  return {
    campaign: toPublic(doc),
    fundingAddress: publicKey,
    identityHashes,
  };
}
export async function getCampaign(id: string): Promise<CampaignPublic | null> {
  const doc = await col<CampaignDoc>("campaigns").findOne({ id });
  return doc ? toPublic(doc) : null;
}
export async function getCampaignDoc(id: string): Promise<CampaignDoc | null> {
  return col<CampaignDoc>("campaigns").findOne({ id });
}
export async function checkFunding(id: string): Promise<{ balance: number; totalRequired: number; funded: boolean; depositTx?: string }> {
  const doc = await col<CampaignDoc>("campaigns").findOne({ id });
  if (!doc) throw new Error("Campaign not found");
  const totalRequired = doc.payoutAmount * doc.maxClaims;
  let pcBalance = await getBalance(id);
  if (pcBalance < totalRequired) {
    const wallet = await getWallet(id);
    if (wallet) {
      const { PublicKey } = await import("@solana/web3.js");
      const onChainBalance = await connection.getBalance(new PublicKey(wallet.publicKey));
      if (onChainBalance > 0) {
        const { signature } = await deposit(id, onChainBalance);
        pcBalance = await getBalance(id);
        const funded = pcBalance >= totalRequired;
        if (funded && !doc.funded) {
          await col<CampaignDoc>("campaigns").updateOne({ id }, { $set: { funded: true, fundedAmount: pcBalance } });
        }
        return { balance: pcBalance, totalRequired, funded, depositTx: signature };
      }
    }
  }
  const funded = pcBalance >= totalRequired;
  if (funded && !doc.funded) {
    await col<CampaignDoc>("campaigns").updateOne({ id }, { $set: { funded: true, fundedAmount: pcBalance } });
  }
  return { balance: pcBalance, totalRequired, funded };
}
export async function isEligible(campaignId: string, identityHash: string): Promise<boolean> {
  const doc = await col<CampaignDoc>("campaigns").findOne({ id: campaignId });
  return doc?.eligibleHashes.includes(identityHash) || false;
}
export async function incrementClaimCount(id: string): Promise<void> {
  await col<CampaignDoc>("campaigns").updateOne({ id }, { $inc: { claimCount: 1 } });
}
export async function deductFunds(id: string, amount: number): Promise<void> {
  await col<CampaignDoc>("campaigns").updateOne({ id }, { $inc: { fundedAmount: -amount } });
}
function toPublic(doc: CampaignDoc): CampaignPublic {
  return {
    id: doc.id,
    authMethod: doc.authMethod,
    payoutAmount: doc.payoutAmount,
    maxClaims: doc.maxClaims,
    claimCount: doc.claimCount,
    expiresAt: doc.expiresAt,
    funded: doc.funded,
    fundedAmount: doc.fundedAmount,
    requireCompliance: doc.requireCompliance,
  };
}
