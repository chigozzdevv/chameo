import { decrypt } from "@inco/solana-sdk/attested-decrypt";
import type { PublicKey } from "@solana/web3.js";

export type WalletAdapter = {
  publicKey: PublicKey;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
};

export type AnalyticsHandles = {
  pageViewsHandle: string;
  linkClicksHandle: string;
  claimStartsHandle: string;
  claimSuccessesHandle: string;
  claimFailuresHandle: string;
  votesHandle: string;
};

export async function decryptAnalytics(
  handles: AnalyticsHandles,
  wallet: WalletAdapter
): Promise<{
  pageViews: number;
  linkClicks: number;
  claimStarts: number;
  claimSuccesses: number;
  claimFailures: number;
  votes: number;
}> {
  const result = await decrypt(
    [
      handles.pageViewsHandle,
      handles.linkClicksHandle,
      handles.claimStartsHandle,
      handles.claimSuccessesHandle,
      handles.claimFailuresHandle,
      handles.votesHandle,
    ],
    {
      address: wallet.publicKey,
      signMessage: wallet.signMessage,
    }
  );

  return {
    pageViews: parseInt(result.plaintexts[0] || "0", 10),
    linkClicks: parseInt(result.plaintexts[1] || "0", 10),
    claimStarts: parseInt(result.plaintexts[2] || "0", 10),
    claimSuccesses: parseInt(result.plaintexts[3] || "0", 10),
    claimFailures: parseInt(result.plaintexts[4] || "0", 10),
    votes: parseInt(result.plaintexts[5] || "0", 10),
  };
}
