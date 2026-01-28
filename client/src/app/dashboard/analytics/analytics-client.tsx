"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { decryptAnalytics, type AnalyticsHandles, type WalletAdapter } from "@/lib/analytics";

type CampaignSummary = {
  id: string;
  name: string;
  type: "payout" | "escrow";
  status: string;
};

type DecryptedMetrics = {
  pageViews: number;
  linkClicks: number;
  claimStarts: number;
  claimSuccesses: number;
  claimFailures: number;
  votes: number;
};

const fallbackMetrics: DecryptedMetrics = {
  pageViews: 0,
  linkClicks: 0,
  claimStarts: 0,
  claimSuccesses: 0,
  claimFailures: 0,
  votes: 0,
};

export default function AnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string>("");
  const [handles, setHandles] = useState<AnalyticsHandles | null>(null);
  const [metrics, setMetrics] = useState<DecryptedMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [wallet, setWallet] = useState<WalletAdapter | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  const activeCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === activeCampaignId),
    [campaigns, activeCampaignId]
  );

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    apiFetch<{ success: boolean; campaigns: CampaignSummary[] }>(
      "/api/campaign",
      {},
      token
    )
      .then((res) => {
        const preferred = searchParams.get("campaignId");
        setCampaigns(res.campaigns || []);
        if (preferred && res.campaigns?.some((campaign) => campaign.id === preferred)) {
          setActiveCampaignId(preferred);
        } else if (res.campaigns?.length) {
          setActiveCampaignId(res.campaigns[0].id);
        } else {
          setActiveCampaignId("");
        }
      })
      .catch(() => {
        setCampaigns([]);
      });
  }, [searchParams]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token || !activeCampaignId) return;

    setLoading(true);
    apiFetch<{
      success: boolean;
      handles: AnalyticsHandles;
      available: boolean;
    }>(`/api/analytics/${activeCampaignId}/handles`, {}, token)
      .then((res) => {
        setHandles(res.available ? res.handles : null);
        setMetrics(null);
      })
      .catch(() => {
        setHandles(null);
        setMetrics(null);
      })
      .finally(() => setLoading(false));
  }, [activeCampaignId]);

  const displayMetrics = metrics || fallbackMetrics;

  const connectWallet = async () => {
    setWalletError(null);
    const provider = (window as typeof window & { solana?: any }).solana;
    if (!provider || !provider.connect || !provider.signMessage) {
      setWalletError("No wallet found. Install Phantom to continue.");
      return;
    }
    try {
      await provider.connect();
      setWallet({
        publicKey: provider.publicKey,
        signMessage: async (message: Uint8Array) => {
          const signed = await provider.signMessage(message);
          return signed?.signature || signed;
        },
      });
    } catch (error) {
      setWalletError("Wallet connection failed.");
    }
  };

  const decryptWithWallet = async () => {
    const token = getAuthToken();
    if (!token || !activeCampaignId || !wallet || !handles || decrypting) return;
    setLoading(true);
    setDecrypting(true);
    setWalletError(null);
    try {
      await apiFetch(
        `/api/analytics/${activeCampaignId}/grant-access`,
        {
          method: "POST",
          body: JSON.stringify({
            creatorPubkey: wallet.publicKey.toBase58(),
          }),
        },
        token
      );
      const result = await decryptAnalytics(handles, wallet);
      setMetrics(result);
    } catch (error) {
      setWalletError("Unable to decrypt analytics.");
    } finally {
      setDecrypting(false);
      setLoading(false);
    }
  };

  const handleCampaignChange = (value: string) => {
    if (value === "__create__") {
      router.push("/dashboard/campaigns");
      return;
    }
    setActiveCampaignId(value);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.1)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Analytics
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              {activeCampaign ? activeCampaign.name : "Encrypted metrics"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Metrics decrypt locally for the creator.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={activeCampaignId}
              onChange={(event) => handleCampaignChange(event.target.value)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none"
            >
              <option value="" disabled>
                Choose campaign
              </option>
              {campaigns.length ? (
                campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="" disabled>
                    No campaigns available
                  </option>
                  <option value="__create__">Create campaign</option>
                </>
              )}
            </select>
            {!wallet ? (
              <button
                onClick={connectWallet}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Connect wallet
              </button>
            ) : (
              <button
                onClick={decryptWithWallet}
                disabled={!handles || decrypting || loading}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {decrypting ? "Decrypting..." : "Decrypt analytics"}
              </button>
            )}
          </div>
        </div>

        {walletError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {walletError}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Page views", value: displayMetrics.pageViews },
            { label: "Link clicks", value: displayMetrics.linkClicks },
            { label: "Claim starts", value: displayMetrics.claimStarts },
            { label: "Claim successes", value: displayMetrics.claimSuccesses },
            { label: "Claim failures", value: displayMetrics.claimFailures },
            { label: "Votes", value: displayMetrics.votes },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {metric.label}
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {loading
                  ? "…"
                  : metrics
                    ? metric.value.toLocaleString()
                    : "Encrypted"}
              </p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
