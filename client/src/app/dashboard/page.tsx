"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listCampaigns, checkFunding, type FundingStatus, type CampaignSummary } from "@/lib/campaign";

type CampaignStats = {
  total: number;
  inProgress: number;
  closed: number;
  completionRate: number | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string>("");
  const [funding, setFunding] = useState<FundingStatus | null>(null);
  const [fundingLoading, setFundingLoading] = useState(false);
  const [fundingStatus, setFundingStatus] = useState<string | null>(null);
  const [copiedWallet, setCopiedWallet] = useState(false);

  const activeCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === activeCampaignId),
    [campaigns, activeCampaignId]
  );

  useEffect(() => {
    listCampaigns()
      .then((items) => {
        setCampaigns(items || []);
        if (items?.length) {
          setActiveCampaignId(items[0].id);
        } else {
          setActiveCampaignId("");
        }
      })
      .catch(() => {
        setCampaigns([]);
      });
  }, []);

  useEffect(() => {
    if (!activeCampaignId) {
      setFunding(null);
      return;
    }
    void refreshFunding();
  }, [activeCampaignId]);

  const formatSol = (lamports: number) => (lamports / 1e9).toFixed(2);
  const shortenAddress = (value: string) => `${value.slice(0, 4)}…${value.slice(-4)}`;

  const refreshFunding = async () => {
    if (!activeCampaignId) return;
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

  const stats: CampaignStats = useMemo(() => {
    const total = campaigns.length;
    const inProgress = campaigns.filter((campaign) => campaign.status !== "closed").length;
    const closed = campaigns.filter((campaign) => campaign.status === "closed").length;
    const totals = campaigns.reduce(
      (acc, campaign) => {
        acc.claims += campaign.claimCount || 0;
        acc.max += campaign.maxClaims || 0;
        return acc;
      },
      { claims: 0, max: 0 }
    );
    const completionRate = totals.max > 0 ? Math.round((totals.claims / totals.max) * 100) : null;
    return { total, inProgress, closed, completionRate };
  }, [campaigns]);

  const handleAnalyticsClick = () => {
    if (!activeCampaignId) {
      router.push("/dashboard/campaigns");
      return;
    }
    router.push(`/dashboard/analytics?campaignId=${activeCampaignId}`);
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
              Campaign summary
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Track campaign progress and completion at a glance.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            { label: "Total campaigns", value: stats.total },
            { label: "In progress", value: stats.inProgress },
            { label: "Closed", value: stats.closed },
            {
              label: "Completion rate",
              value: stats.completionRate === null ? "—" : `${stats.completionRate}%`,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                {stat.label}
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white/90 px-4 py-4 text-sm text-slate-600">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Encrypted analytics
            </p>
            <p className="mt-2 text-sm text-slate-600">
              View per-campaign analytics in the Analytics tab.
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
            <button
              type="button"
              onClick={handleAnalyticsClick}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              View analytics
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.1)] backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Campaigns
            </p>
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
              <span>No campaigns yet. Use the dropdown above to create one.</span>
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
                      Required (incl. fees) {funding ? formatSol(funding.totalRequired) : "—"} SOL
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
