import { PublicKey } from "@solana/web3.js";
import { connection } from "@/config";
import { generateId, hashIdentity, NotFoundError, ForbiddenError } from "@/shared";
import { campaignsCollection, type CampaignDoc, type CreateCampaignInput, type CampaignPublic } from "./campaign.model";
import { createCampaignWallet, getCampaignPrivateBalance, getCampaignWalletPublicKey, depositToCampaign } from "./wallet.service";

export async function createCampaign(
  userId: string,
  orgSlug: string,
  input: CreateCampaignInput
): Promise<{ campaign: CampaignPublic; fundingAddress: string; identityHashes: string[] }> {
  const id = generateId();
  const fundingAddress = await createCampaignWallet(id);
  const identityHashes = input.recipients.map((r: string) => hashIdentity(input.authMethod, r).toString("hex"));

  const doc: CampaignDoc = {
    id,
    userId,
    orgSlug,
    name: input.name,
    authMethod: input.authMethod,
    payoutAmount: input.payoutAmount,
    maxClaims: input.maxClaims,
    claimCount: 0,
    expiresAt: input.expiresAt,
    funded: false,
    fundedAmount: 0,
    requireCompliance: input.requireCompliance || false,
    eligibleHashes: identityHashes,
    createdAt: Date.now(),
  };

  await campaignsCollection().insertOne(doc);
  return { campaign: toPublic(doc), fundingAddress, identityHashes };
}

export async function getCampaign(id: string): Promise<CampaignPublic | null> {
  const doc = await campaignsCollection().findOne({ id });
  return doc ? toPublic(doc) : null;
}

export async function getCampaignDoc(id: string): Promise<CampaignDoc | null> {
  return campaignsCollection().findOne({ id });
}

export async function getUserCampaigns(userId: string): Promise<CampaignPublic[]> {
  const docs = await campaignsCollection().find({ userId }).sort({ createdAt: -1 }).toArray();
  return docs.map(toPublic);
}

export async function checkFunding(id: string): Promise<{ balance: number; totalRequired: number; funded: boolean; depositTx?: string }> {
  const col = campaignsCollection();
  const doc = await col.findOne({ id });
  if (!doc) throw new NotFoundError("Campaign not found");

  const totalRequired = doc.payoutAmount * doc.maxClaims;
  let pcBalance = await getCampaignPrivateBalance(id);

  if (pcBalance < totalRequired) {
    const publicKey = await getCampaignWalletPublicKey(id);
    const onChainBalance = await connection.getBalance(new PublicKey(publicKey));

    if (onChainBalance > 0) {
      const { signature } = await depositToCampaign(id, onChainBalance);
      pcBalance = await getCampaignPrivateBalance(id);
      const funded = pcBalance >= totalRequired;

      if (funded && !doc.funded) {
        await col.updateOne({ id }, { $set: { funded: true, fundedAmount: pcBalance } });
      }
      return { balance: pcBalance, totalRequired, funded, depositTx: signature };
    }
  }

  const funded = pcBalance >= totalRequired;
  if (funded && !doc.funded) {
    await col.updateOne({ id }, { $set: { funded: true, fundedAmount: pcBalance } });
  }

  return { balance: pcBalance, totalRequired, funded };
}

export async function isEligible(campaignId: string, identityHash: string): Promise<boolean> {
  const doc = await campaignsCollection().findOne({ id: campaignId });
  return doc?.eligibleHashes.includes(identityHash) || false;
}

export async function incrementClaimCount(id: string): Promise<void> {
  await campaignsCollection().updateOne({ id }, { $inc: { claimCount: 1 } });
}

export async function deductFunds(id: string, amount: number): Promise<void> {
  await campaignsCollection().updateOne({ id }, { $inc: { fundedAmount: -amount } });
}

export async function addRecipients(id: string, userId: string, recipients: string[], authMethod: string): Promise<{ added: number }> {
  const col = campaignsCollection();
  const doc = await col.findOne({ id });

  if (!doc) throw new NotFoundError("Campaign not found");
  if (doc.userId !== userId) throw new ForbiddenError("Not authorized");

  const newHashes = recipients.map((r: string) => hashIdentity(authMethod, r).toString("hex"));
  const uniqueNew = newHashes.filter((h: string) => !doc.eligibleHashes.includes(h));

  if (uniqueNew.length > 0) {
    await col.updateOne({ id }, { $push: { eligibleHashes: { $each: uniqueNew } } });
  }

  return { added: uniqueNew.length };
}

function toPublic(doc: CampaignDoc): CampaignPublic {
  return {
    id: doc.id,
    name: doc.name,
    orgSlug: doc.orgSlug,
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
