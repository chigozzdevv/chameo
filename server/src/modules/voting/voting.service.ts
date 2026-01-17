import { BadRequestError, NotFoundError } from "@/shared";
import { getCampaignDoc, campaignsCollection, type CampaignDoc } from "@/modules/campaign";
import * as inco from "@/lib/inco";
import { buildMerkleRoot, getMerkleProof } from "@/lib/zk";
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
  if (state.isActive) {
    return { refundHost: null, equalDistribution: null, total: state.totalVotes, revealed: false };
  }

  const decrypted = await inco.decryptVoteTotals(campaignId);
  if (!decrypted) {
    return { refundHost: null, equalDistribution: null, total: state.totalVotes, revealed: false };
  }

  return {
    refundHost: decrypted.refundHost,
    equalDistribution: decrypted.equalDistribution,
    total: state.totalVotes,
    revealed: true,
  };
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

export async function resolveDispute(campaignId: string): Promise<void> {
  const campaign = await getCampaignDoc(campaignId);
  if (!campaign) throw new NotFoundError("Campaign not found");
  if (campaign.status !== "dispute") throw new BadRequestError("Not in dispute");

  const state = await inco.getVotingPoolState(campaignId);
  if (!state) throw new BadRequestError("Voting pool not found");

  if (state.totalVotes < campaign.eligibleHashes.length * 0.5) {
    throw new BadRequestError("Insufficient votes");
  }

  await inco.closeVoting(campaignId);
  const totals = await inco.decryptVoteTotals(campaignId);
  if (!totals) throw new BadRequestError("Unable to decrypt vote totals");

  await campaignsCollection().updateOne(
    { id: campaignId },
    {
      $set: {
        status: "closed",
        votingClosedAt: Date.now(),
        disputeOutcome:
          totals.refundHost === totals.equalDistribution
            ? "tie"
            : totals.refundHost > totals.equalDistribution
              ? "refund-host"
              : "equal-distribution",
        voteResults: {
          refundHost: totals.refundHost,
          equalDistribution: totals.equalDistribution,
          total: state.totalVotes,
          resolvedAt: Date.now(),
        },
      },
    }
  );
}

export async function checkDisputeTimeout(campaignId: string): Promise<void> {
  const campaign = await getCampaignDoc(campaignId);
  if (!campaign) return;
  if (campaign.status !== "active") return;
  if (campaign.type !== "escrow") return;
  if (!campaign.winnersDeadline) return;

  const now = Date.now() / 1000;
  if (now > campaign.winnersDeadline && (!campaign.selectedWinners || campaign.selectedWinners.length === 0)) {
    await initializeVotingForCampaign(campaignId);
    await campaignsCollection().updateOne({ id: campaignId }, { $set: { status: "dispute" } });
  }
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

  return { signature };
}
