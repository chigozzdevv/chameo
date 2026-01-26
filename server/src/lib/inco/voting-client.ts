import { PublicKey, Connection, Transaction } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { decrypt } from "@inco/solana-sdk/attested-decrypt";

const PROGRAM_ID = new PublicKey("GvoS27ShvsjMoWumJnHnuLbCZpHSS8k36uJFzuctvQtU");
const INCO_LIGHTNING_ID = new PublicKey("5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj");

export function getCampaignIdBytes(campaignId: string): number[] {
  // PDA seeds are fixed-width; zero-pad or truncate to 32 bytes.
  const hash = Buffer.alloc(32);
  const bytes = Buffer.from(campaignId, "utf-8");
  bytes.copy(hash, 0, 0, Math.min(bytes.length, 32));
  return Array.from(hash);
}

export function findVotingPoolPda(campaignId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("voting_pool"), Buffer.from(getCampaignIdBytes(campaignId))], PROGRAM_ID);
}

export function findAllowancePda(handle: bigint, allowedAddress: PublicKey): [PublicKey, number] {
  const handleBuffer = Buffer.alloc(16);
  let h = handle;
  for (let i = 0; i < 16; i++) {
    handleBuffer[i] = Number(h & BigInt(0xff));
    h = h >> BigInt(8);
  }
  // Handles are encoded as 128-bit little-endian for the Inco Lightning PDA seed.
  return PublicKey.findProgramAddressSync([handleBuffer, allowedAddress.toBuffer()], INCO_LIGHTNING_ID);
}

export interface WalletAdapter {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

export async function getVotingPoolState(
  connection: Connection,
  campaignId: string
): Promise<{
  totalVotes: number;
  isActive: boolean;
  refundHostVotesHandle: bigint;
  equalDistributionVotesHandle: bigint;
} | null> {
  const idl = require("../../../contracts/target/idl/chameo_privacy.json");
  const provider = new AnchorProvider(connection, {} as any, { commitment: "confirmed" });
  const program = new Program(idl, provider);

  const [votingPool] = findVotingPoolPda(campaignId);

  try {
    const state = await (program.account as any).votingPool.fetch(votingPool);
    return {
      totalVotes: state.totalVotes.toNumber(),
      isActive: state.isActive,
      refundHostVotesHandle: BigInt(state.refundHostVotes.toString()),
      equalDistributionVotesHandle: BigInt(state.equalDistributionVotes.toString()),
    };
  } catch {
    return null;
  }
}

export async function revealVoteResults(
  connection: Connection,
  wallet: WalletAdapter,
  campaignId: string
): Promise<{ refundHost: number; equalDistribution: number }> {
  const state = await getVotingPoolState(connection, campaignId);
  if (!state) throw new Error("Voting pool not found");

  const handles = [state.refundHostVotesHandle.toString(), state.equalDistributionVotesHandle.toString()];

  const result = await decrypt(handles, {
    address: wallet.publicKey,
    signMessage: wallet.signMessage,
  });

  return {
    refundHost: parseInt(result.plaintexts[0], 10),
    equalDistribution: parseInt(result.plaintexts[1], 10),
  };
}
