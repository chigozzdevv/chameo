import { BadRequestError, NotFoundError, logger } from "@/shared";
import { getCampaignDoc, campaignsCollection, type CampaignDoc, getCampaignPrivateBalance, withdrawFromCampaign } from "@/modules/campaign";
import { trackEvent } from "@/modules/analytics";
import * as inco from "@/lib/inco";
import { buildMerkleRoot, getMerkleProof, buildVoteProof } from "@/lib/zk";
import { env } from "@/config";
import { PublicKey } from "@solana/web3.js";

function decodeHex(value: string, label: string): Buffer {
  if (!value || value.length % 2 !== 0) throw new BadRequestError(`${label} must be hex`);
  return Buffer.from(value, "hex");
}

function decodeBase64(value: string, label: string): Buffer {
  if (!value) throw new BadRequestError(`${label} required`);
  return Buffer.from(value, "base64");
}

async function ensureEligibilityRoot(campaign: CampaignDoc): Promise<Buffer> {
  const root = await buildMerkleRoot(campaign.eligibleHashes, env.zk.merkleDepth);
  const rootHex = root.toString("hex");
  if (campaign.eligibilityRoot !== rootHex) {
    await campaignsCollection().updateOne({ id: campaign.id }, { $set: { eligibilityRoot: rootHex } });
  }
  return root;
}

function resolveOutcome(refundHost: number, equalDistribution: number): "refund-host" | "equal-distribution" | "tie" {
  if (refundHost > equalDistribution) return "refund-host";
  if (equalDistribution > refundHost) return "equal-distribution";
  return "tie";
}

async function resolveDisputeInternal(
  campaignId: string,
  allowedAddress: PublicKey,
  options?: { force?: boolean }
): Promise<void> {
  const campaign = await getCampaignDoc(campaignId);
  if (!campaign) throw new NotFoundError("Campaign not found");
  if (campaign.status !== "dispute") throw new BadRequestError("Not in dispute");

  const state = await inco.getVotingPoolState(campaignId);
  if (!state) throw new BadRequestError("Voting pool not found");

  if (!options?.force && state.totalVotes < campaign.eligibleHashes.length * 0.5) {
    throw new BadRequestError("Insufficient votes");
  }

  try {
    await inco.closeVoting(campaignId, allowedAddress);
  } catch (error: any) {
    if (!String(error?.message || error).includes("VotingNotActive")) {
      throw error;
    }
  }

  const totals = await inco.decryptVoteTotals(campaignId);
  if (!totals) throw new BadRequestError("Unable to decrypt vote totals");

  const outcome = resolveOutcome(totals.refundHost, totals.equalDistribution);
  const resolvedAt = Date.now();
  const update: Partial<CampaignDoc> = {
    status: outcome === "equal-distribution" ? "winners-announced" : "closed",
    votingClosedAt: resolvedAt,
    disputeOutcome: outcome,
    voteResults: {
      refundHost: totals.refundHost,
      equalDistribution: totals.equalDistribution,
      total: state.totalVotes,
      resolvedAt,
    },
  };

  if (outcome === "equal-distribution") {
    update.selectedWinners = campaign.eligibleHashes;
  }

  if ((outcome === "refund-host" || outcome === "tie") && campaign.refundAddress) {
    try {
      const balance = await getCampaignPrivateBalance(campaignId);
      if (balance > 0) {
        await withdrawFromCampaign(campaignId, balance, campaign.refundAddress);
        update.fundedAmount = 0;
        update.funded = false;
      }
    } catch (error) {
      logger.error("Failed to refund host after dispute", { campaignId, error: String(error) });
    }
  }

  await campaignsCollection().updateOne({ id: campaignId }, { $set: update });
}

export async function getVoteResults(campaignId: string): Promise<{
  refundHost: number | null;
  equalDistribution: number | null;
  total: number;
  revealed: boolean;
}> {
  const campaign = await getCampaignDoc(campaignId);
  if (campaign?.voteResults) {
    return {
      refundHost: campaign.voteResults.refundHost,
      equalDistribution: campaign.voteResults.equalDistribution,
      total: campaign.voteResults.total,
      revealed: true,
    };
  }

  const state = await inco.getVotingPoolState(campaignId);
  if (!state) {
    return { refundHost: null, equalDistribution: null, total: 0, revealed: false };
  }
  return { refundHost: null, equalDistribution: null, total: state.totalVotes, revealed: false };
}

export async function initializeVotingForCampaign(campaignId: string): Promise<void> {
  const campaign = await getCampaignDoc(campaignId);
  if (!campaign) throw new NotFoundError("Campaign not found");
  if (!env.zk.verifierProgramId) throw new BadRequestError("ZK verifier not configured");
  const eligibilityRoot = await ensureEligibilityRoot(campaign);
  const zkVerifierProgram = new PublicKey(env.zk.verifierProgramId);

  try {
    await inco.initializeVotingPool(campaignId, eligibilityRoot, zkVerifierProgram);
  } catch (error: any) {
    if (!error.message?.includes("already in use")) {
      throw error;
    }
  }
}

export async function resolveDispute(campaignId: string, _creatorPubkey?: string): Promise<void> {
  const allowedAddress = inco.getServerPublicKey();
  await resolveDisputeInternal(campaignId, allowedAddress);
}

export async function resolveDisputeAsServer(
  campaignId: string,
  options?: { force?: boolean }
): Promise<void> {
  const allowedAddress = inco.getServerPublicKey();
  await resolveDisputeInternal(campaignId, allowedAddress, options);
}

export async function getVotingInfo(campaignId: string): Promise<{
  totalVotes: number;
  isActive: boolean;
  votingPoolPda: string;
} | null> {
  const state = await inco.getVotingPoolState(campaignId);
  if (!state) return null;

  const [votingPool] = inco.findVotingPoolPda(campaignId);
  return {
    totalVotes: state.totalVotes,
    isActive: state.isActive,
    votingPoolPda: votingPool.toBase58(),
  };
}

export async function getZkConfig(campaignId: string): Promise<{
  merkleRoot: string;
  merkleDepth: number;
  ciphertextLength: number;
  proofLength: number;
  publicWitnessLength: number;
  verifierProgramId: string;
}> {
  const campaign = await getCampaignDoc(campaignId);
  if (!campaign) throw new NotFoundError("Campaign not found");
  if (!env.zk.verifierProgramId) throw new BadRequestError("ZK verifier not configured");

  const eligibilityRoot = await ensureEligibilityRoot(campaign);
  return {
    merkleRoot: eligibilityRoot.toString("hex"),
    merkleDepth: env.zk.merkleDepth,
    ciphertextLength: env.zk.ciphertextLength,
    proofLength: env.zk.proofLength,
    publicWitnessLength: env.zk.publicWitnessLength,
    verifierProgramId: env.zk.verifierProgramId,
  };
}

export async function getZkInputs(
  campaignId: string,
  identityHash: string
): Promise<{
  merkleRoot: string;
  leaf: string;
  siblings: string[];
  pathBits: number[];
  index: number;
}> {
  const campaign = await getCampaignDoc(campaignId);
  if (!campaign) throw new NotFoundError("Campaign not found");

  let proof;
  try {
    proof = await getMerkleProof(campaign.eligibleHashes, identityHash, env.zk.merkleDepth);
  } catch (error: any) {
    throw new BadRequestError(error?.message || "Invalid merkle proof request");
  }
  const rootHex = proof.root.toString("hex");
  if (!campaign.eligibilityRoot || campaign.eligibilityRoot !== rootHex) {
    await campaignsCollection().updateOne({ id: campaignId }, { $set: { eligibilityRoot: rootHex } });
  }

  return {
    merkleRoot: rootHex,
    leaf: proof.leaf.toString("hex"),
    siblings: proof.siblings.map((sibling) => sibling.toString("hex")),
    pathBits: proof.pathBits,
    index: proof.index,
  };
}

export async function castZkVote(params: {
  campaignId: string;
  proof: string;
  publicWitness: string;
  nullifier: string;
  ciphertext: string;
}): Promise<{ signature: string }> {
  const { campaignId, proof, publicWitness, nullifier, ciphertext } = params;

  const campaign = await getCampaignDoc(campaignId);
  if (!campaign) throw new NotFoundError("Campaign not found");
  if (campaign.status !== "dispute") throw new BadRequestError("Campaign not in dispute");

  const proofBuf = decodeBase64(proof, "proof");
  const witnessBuf = decodeBase64(publicWitness, "publicWitness");
  const nullifierBuf = decodeHex(nullifier, "nullifier");
  const ciphertextBuf = decodeHex(ciphertext, "ciphertext");

  if (proofBuf.length !== env.zk.proofLength) {
    throw new BadRequestError("Invalid proof length");
  }
  if (witnessBuf.length !== env.zk.publicWitnessLength) {
    throw new BadRequestError("Invalid public witness length");
  }
  if (nullifierBuf.length !== 32) {
    throw new BadRequestError("Nullifier must be 32 bytes");
  }
  if (ciphertextBuf.length !== env.zk.ciphertextLength) {
    throw new BadRequestError("Invalid ciphertext length");
  }

  const signature = await inco.castVoteZk({
    campaignId,
    nullifier: nullifierBuf,
    proof: proofBuf,
    publicWitness: witnessBuf,
    encryptedVote: ciphertextBuf,
  });

  await trackEvent({ campaignId, eventType: "vote" });

  return { signature };
}

export async function proveZkVote(params: {
  campaignId: string;
  identityHash: string;
  ciphertext: string;
}): Promise<{ proof: string; publicWitness: string; nullifier: string }> {
  const { campaignId, identityHash, ciphertext } = params;
  const campaign = await getCampaignDoc(campaignId);
  if (!campaign) throw new NotFoundError("Campaign not found");
  if (campaign.status !== "dispute") throw new BadRequestError("Campaign not in dispute");

  const identityBuf = decodeHex(identityHash, "identityHash");
  if (identityBuf.length !== 32) {
    throw new BadRequestError("identityHash must be 32 bytes");
  }

  const ciphertextBuf = decodeHex(ciphertext, "ciphertext");
  if (ciphertextBuf.length !== env.zk.ciphertextLength) {
    throw new BadRequestError("Invalid ciphertext length");
  }

  return buildVoteProof({
    leafHexes: campaign.eligibleHashes,
    identityHash,
    ciphertextHex: ciphertext,
    merkleDepth: env.zk.merkleDepth,
  });
}
