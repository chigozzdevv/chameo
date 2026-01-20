"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { decryptAnalytics, type AnalyticsHandles, type WalletAdapter } from "@/lib/analytics";
import { checkFunding, type FundingStatus } from "@/lib/campaign";

type CampaignSummary = {
  id: string;
  name: string;
  type: "payout" | "escrow";
  status: string;
};

type EncryptedAnalytics = {
  pageViews: number;
  linkClicks: number;
  claimStarts: number;
};

const fallbackMetrics: EncryptedAnalytics = {
  pageViews: 0,
  linkClicks: 0,
  claimStarts: 0,
};

export default function DashboardPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string>("");
  const [metrics, setMetrics] = useState<EncryptedAnalytics | null>(null);
  const [handles, setHandles] = useState<AnalyticsHandles | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [wallet, setWallet] = useState<WalletAdapter | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [funding, setFunding] = useState<FundingStatus | null>(null);
  const [fundingLoading, setFundingLoading] = useState(false);
  const [fundingStatus, setFundingStatus] = useState<string | null>(null);
  const [copiedWallet, setCopiedWallet] = useState(false);

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
        setCampaigns(res.campaigns || []);
        if (res.campaigns?.length) {
          setActiveCampaignId(res.campaigns[0].id);
        } else {
          setActiveCampaignId("__create__");
        }
      })
      .catch(() => {
        setCampaigns([]);
      });
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token || !activeCampaignId || activeCampaignId === "__create__") return;

    setLoadingMetrics(true);
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
      .finally(() => setLoadingMetrics(false));
  }, [activeCampaignId]);

  useEffect(() => {
    if (!activeCampaignId || activeCampaignId === "__create__") {
      setFunding(null);
      return;
    }
    void refreshFunding();
  }, [activeCampaignId]);

  const handleNewCampaign = () => {
    router.push("/dashboard/campaigns");
  };

  const formatSol = (lamports: number) => (lamports / 1e9).toFixed(2);
  const shortenAddress = (value: string) => `${value.slice(0, 4)}…${value.slice(-4)}`;

  const refreshFunding = async () => {
    if (!activeCampaignId || activeCampaignId === "__create__") return;
    setFundingLoading(true);
    setFundingStatus(null);
    try {
      const result = await checkFunding(activeCampaignId);
      setFunding(result);
    } catch (error) {
      setFunding(null);
      setFundingStatus(error instanceof Error ? error.message : "Unable to refresh funding.");
    } finally {
      setFundingLoading(false);
    }
  };

  const copyFundingAddress = async () => {
    if (!funding?.campaignWallet) return;
    try {
      await navigator.clipboard.writeText(funding.campaignWallet);
      setCopiedWallet(true);
      setTimeout(() => setCopiedWallet(false), 2000);
    } catch {
      setCopiedWallet(false);
    }
  };

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
    if (!token || !activeCampaignId || !wallet || !handles) return;
    setLoadingMetrics(true);
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
      setLoadingMetrics(false);
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
              Encrypted analytics
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              {activeCampaign ? activeCampaign.name : "Select a campaign"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Metrics are decrypted for the creator only.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={activeCampaignId}
              onChange={(event) => handleCampaignChange(event.target.value)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none"
            >
              {campaigns.length ? (
                <>
                  <option value="" disabled>
                    Choose campaign
                  </option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value="__create__">Create campaign</option>
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
                disabled={!handles}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Decrypt analytics
              </button>
            )}
          </div>
        </div>

        {walletError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {walletError}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { label: "Page views", value: displayMetrics.pageViews },
            { label: "Link clicks", value: displayMetrics.linkClicks },
            { label: "Claim starts", value: displayMetrics.claimStarts },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.1)] backdrop-blur"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                {stat.label}
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {loadingMetrics
                  ? "…"
                  : metrics
                    ? stat.value.toLocaleString()
                    : "Encrypted"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.1)] backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Campaigns
            </p>
            <button
              type="button"
              onClick={handleNewCampaign}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600"
            >
              New campaign
            </button>
          </div>
          {campaigns.length ? (
            <div className="mt-6 space-y-3">
              {campaigns.slice(0, 4).map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/90 px-4 py-4"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {campaign.type}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {campaign.name}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {campaign.status}
                  </span>
                </div>
              ))}
              <button
                type="button"
                onClick={() => router.push("/dashboard/campaigns")}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
              >
                View all campaigns
              </button>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-slate-200 bg-white/90 px-5 py-6 text-sm text-slate-500">
              <span>No campaigns yet. Create a private payout to get started.</span>
              <button
                type="button"
                onClick={handleNewCampaign}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Create campaign
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.1)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Funding status
            </p>
            {activeCampaign ? (
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/90 px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Campaign wallet
                  </span>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    {funding?.campaignWallet ? (
                      <>
                        <span>{shortenAddress(funding.campaignWallet)}</span>
                        <button
                          type="button"
                          onClick={copyFundingAddress}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                        >
                          {copiedWallet ? "Copied" : "Copy"}
                        </button>
                      </>
                    ) : (
                      <span>{fundingLoading ? "Loading…" : "Unavailable"}</span>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      On-chain balance
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {fundingLoading ? "…" : funding ? `${formatSol(funding.onChainBalance)} SOL` : "—"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Private pool balance
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {fundingLoading ? "…" : funding ? `${formatSol(funding.balance)} SOL` : "—"}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Required {funding ? formatSol(funding.totalRequired) : "—"} SOL
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    Withdraw via Privacy Cash to keep funding unlinkable.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={refreshFunding}
                      disabled={fundingLoading}
                      className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {fundingLoading ? "Checking…" : "Check funding"}
                    </button>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {funding ? (funding.funded ? "Funded" : "Awaiting funds") : "Unknown"}
                    </span>
                  </div>
                </div>
                {fundingStatus ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                    {fundingStatus}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/90 px-4 py-4 text-sm text-slate-500">
                Select a campaign to check funding status.
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.1)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Disputes
            </p>
            <div className="mt-4 rounded-2xl border border-slate-100 bg-white/90 px-4 py-4 text-sm text-slate-500">
              {activeCampaign
                ? "No disputes active for this campaign."
                : "Select a campaign to monitor disputes."}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
