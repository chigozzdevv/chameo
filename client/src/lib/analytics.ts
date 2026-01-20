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
};

export async function decryptAnalytics(
  handles: AnalyticsHandles,
  wallet: WalletAdapter
): Promise<{ pageViews: number; linkClicks: number; claimStarts: number }> {
  const result = await decrypt(
    [handles.pageViewsHandle, handles.linkClicksHandle, handles.claimStartsHandle],
    {
      address: wallet.publicKey,
      signMessage: wallet.signMessage,
    }
  );

  return {
    pageViews: parseInt(result.plaintexts[0] || "0", 10),
    linkClicks: parseInt(result.plaintexts[1] || "0", 10),
    claimStarts: parseInt(result.plaintexts[2] || "0", 10),
  };
}
