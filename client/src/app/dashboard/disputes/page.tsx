"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listCampaigns, type CampaignSummary } from "@/lib/campaign";

export default function DisputesPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState("");
  const [loading, setLoading] = useState(false);

  const activeCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === activeCampaignId),
    [campaigns, activeCampaignId]
  );

  useEffect(() => {
    setLoading(true);
    listCampaigns()
      .then((items) => {
        setCampaigns(items);
        if (items.length) {
          setActiveCampaignId(items[0].id);
        } else {
          setActiveCampaignId("");
        }
      })
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

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
              Disputes
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              {activeCampaign ? activeCampaign.name : "Voting status"}
            </h2>
          </div>
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
        </div>
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white/90 px-5 py-8 text-sm text-slate-500">
          {loading ? "Loading disputes…" : "No disputes active."}
        </div>
      </section>
    </div>
  );
}
