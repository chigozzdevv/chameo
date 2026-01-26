import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { decrypt } from "@inco/solana-sdk/attested-decrypt";
import { apiFetch } from "@/lib/api";

const PROGRAM_ID = new PublicKey(
  "GvoS27ShvsjMoWumJnHnuLbCZpHSS8k36uJFzuctvQtU",
);
const INCO_LIGHTNING_ID = new PublicKey(
  "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj",
);
const RPC_URL = "https://api.devnet.solana.com";

export interface WalletAdapter {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

function getCampaignIdBytes(campaignId: string): number[] {
  // PDA seeds are fixed-width; zero-pad or truncate to 32 bytes.
  const hash = new Uint8Array(32);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(campaignId);
  hash.set(bytes.slice(0, Math.min(bytes.length, 32)));
  return Array.from(hash);
}

function findVotingPoolPda(campaignId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode("voting_pool"),
      new Uint8Array(getCampaignIdBytes(campaignId)),
    ],
    PROGRAM_ID,
  );
}

export async function getVotingInfo(campaignId: string): Promise<{
  initialized: boolean;
  totalVotes?: number;
  isActive?: boolean;
}> {
  return apiFetch(`/api/voting/${campaignId}/info`);
}

export async function revealResults(
  wallet: WalletAdapter,
  campaignId: string,
): Promise<{ refundHost: number; equalDistribution: number }> {
  const connection = new Connection(RPC_URL, "confirmed");
  const idl = await fetch("/idl/chameo_privacy.json").then((r) => r.json());
  const provider = new AnchorProvider(connection, wallet as any, {
    commitment: "confirmed",
  });
  const program = new Program(idl, provider);

  const [votingPool] = findVotingPoolPda(campaignId);
  const state = await (program.account as any).votingPool.fetch(votingPool);

  const handles = [
    state.refundHostVotes.toString(),
    state.equalDistributionVotes.toString(),
  ];

  const result = await decrypt(handles, {
    address: wallet.publicKey,
    signMessage: wallet.signMessage,
  });

  return {
    refundHost: parseInt(result.plaintexts[0], 10),
    equalDistribution: parseInt(result.plaintexts[1], 10),
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
  return apiFetch(`/api/voting/${campaignId}/zk-config`);
}

export async function getZkInputs(
  campaignId: string,
  identityHash: string,
): Promise<{
  merkleRoot: string;
  leaf: string;
  siblings: string[];
  pathBits: number[];
  index: number;
}> {
  return apiFetch(`/api/voting/${campaignId}/zk-inputs`, {
    method: "POST",
    body: JSON.stringify({ identityHash }),
  });
}

export async function buildZkProof(params: {
  campaignId: string;
  identityHash: string;
  ciphertext: string;
}): Promise<{ proof: string; publicWitness: string; nullifier: string }> {
  return apiFetch(`/api/voting/${params.campaignId}/zk-prove`, {
    method: "POST",
    body: JSON.stringify({
      identityHash: params.identityHash,
      ciphertext: params.ciphertext,
    }),
  });
}

export async function castVoteZk(params: {
  campaignId: string;
  proof: string;
  publicWitness: string;
  nullifier: string;
  ciphertext: string;
}): Promise<{ signature: string }> {
  return apiFetch(`/api/voting/${params.campaignId}/zk-cast`, {
    method: "POST",
    body: JSON.stringify({
      proof: params.proof,
      publicWitness: params.publicWitness,
      nullifier: params.nullifier,
      ciphertext: params.ciphertext,
    }),
  });
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}
