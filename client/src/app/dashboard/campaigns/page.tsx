"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createCampaign,
  listCampaigns,
  uploadCampaignImage,
  type CampaignSummary,
  type CampaignTheme,
} from "@/lib/campaign";

const filters = ["All", "Payout", "Escrow"];

const themeDefaults: CampaignTheme = {
  primary: "#0f172a",
  secondary: "#94a3b8",
  background: "#f8fafc",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("All");
  const [status, setStatus] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "payout",
    authMethod: "email",
    payoutAmount: "",
    maxClaims: "",
    expiresAt: "",
    winnersDeadline: "",
    recipients: "",
    refundAddress: "",
  });
  const [theme, setTheme] = useState<CampaignTheme>(themeDefaults);
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    listCampaigns()
      .then((items) => {
        if (isMounted) setCampaigns(items);
      })
      .catch(() => {
        if (isMounted) setCampaigns([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (imageFile) {
      const objectUrl = URL.createObjectURL(imageFile);
      setPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setPreview(imageUrl || null);
  }, [imageFile, imageUrl]);

  const filteredCampaigns = useMemo(() => {
    if (filter === "All") return campaigns;
    const type = filter.toLowerCase();
    return campaigns.filter((campaign) => campaign.type === type);
  }, [campaigns, filter]);

  const parseRecipients = () =>
    form.recipients
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);

  const recipientsList = useMemo(() => parseRecipients(), [form.recipients]);

  const validateBasics = () => {
    if (!form.name.trim()) {
      setStatus("Campaign name is required.");
      return false;
    }
    if (!form.payoutAmount || Number.isNaN(Number(form.payoutAmount))) {
      setStatus("Payout amount is required.");
      return false;
    }
    if (!form.maxClaims || Number.isNaN(Number(form.maxClaims))) {
      setStatus("Max claims is required.");
      return false;
    }
    if (!form.expiresAt) {
      setStatus("Expiration date is required.");
      return false;
    }
    const recipients = parseRecipients();
    if (!recipients.length) {
      setStatus("Add at least one recipient.");
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (!validateBasics()) return;
    setStatus(null);
    setStep(2);
  };

  const handleClose = () => {
    setShowCreate(false);
    setStep(1);
    setStatus(null);
  };

  const handleCreateCampaign = async () => {
    if (!validateBasics()) return;
    const recipients = parseRecipients();

    setLoading(true);
    setStatus(null);
    try {
      const expiresAt = Math.floor(new Date(form.expiresAt).getTime() / 1000);
      const winnersDeadline =
        form.type === "escrow" && form.winnersDeadline
          ? Math.floor(new Date(form.winnersDeadline).getTime() / 1000)
          : undefined;

      const result = await createCampaign({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type: form.type as "payout" | "escrow",
        authMethod: form.authMethod as "email" | "twitter" | "discord" | "github" | "telegram",
        payoutAmount: Number(form.payoutAmount),
        maxClaims: Number(form.maxClaims),
        expiresAt,
        winnersDeadline,
        recipients,
        requireCompliance: true,
        refundAddress: form.refundAddress.trim() || undefined,
        theme,
      });

      if (imageFile || imageUrl) {
        await uploadCampaignImage(result.campaignId, { file: imageFile, imageUrl });
      }

      const updated = await listCampaigns();
      setCampaigns(updated);
      setStatus(`Campaign created. Funding address: ${result.fundingAddress}`);
      setShowCreate(false);
      setStep(1);
      setForm({
        name: "",
        description: "",
        type: "payout",
        authMethod: "email",
        payoutAmount: "",
        maxClaims: "",
        expiresAt: "",
        winnersDeadline: "",
        recipients: "",
        refundAddress: "",
      });
      setImageFile(null);
      setImageUrl("");
      setTheme(themeDefaults);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Campaign creation failed.");
    } finally {
      setLoading(false);
    }
  };

  const previewTitle = form.name.trim() || "Campaign preview";
  const previewDescription =
    form.description.trim() || "Add a short description for claimants.";
  const previewPrimary = theme.primary || themeDefaults.primary;
  const previewSecondary = theme.secondary || themeDefaults.secondary;
  const previewBackground = theme.background || themeDefaults.background;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.1)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Campaigns
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              All campaigns
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
              setStep(1);
              setStatus(null);
            }}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
          >
            New campaign
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {filters.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setFilter(label)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                filter === label
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/90 px-5 py-8 text-sm text-slate-500">
            Loading campaigns…
          </div>
        ) : filteredCampaigns.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="rounded-2xl border border-slate-200 bg-white/90 px-5 py-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {campaign.type}
                    </p>
                    <h3 className="mt-2 text-base font-semibold text-slate-900">
                      {campaign.name}
                    </h3>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {campaign.status}
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  ID: {campaign.id}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white/90 px-5 py-8 text-sm text-slate-500">
            No campaigns yet. Create a private payout or escrow to get started.
          </div>
        )}
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-[0_30px_70px_rgba(15,23,42,0.18)] backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  New campaign
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">
                  Create a private payout or escrow
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { id: 1, label: "Basics" },
                { id: 2, label: "Branding" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => (item.id === 1 ? setStep(1) : handleNextStep())}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                    step === item.id
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {item.id}. {item.label}
                </button>
              ))}
            </div>

            {step === 1 ? (
              <div className="mt-6 space-y-4">
                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Campaign name
                  <input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Description
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="min-h-[88px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Type
                    <select
                      value={form.type}
                      onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                      <option value="payout">Payout</option>
                      <option value="escrow">Escrow</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Auth method
                    <select
                      value={form.authMethod}
                      onChange={(event) => setForm((prev) => ({ ...prev, authMethod: event.target.value }))}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                      <option value="email">Email</option>
                      <option value="twitter">X (Twitter)</option>
                      <option value="telegram">Telegram</option>
                      <option value="discord">Discord</option>
                      <option value="github">GitHub</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Payout amount
                    <input
                      value={form.payoutAmount}
                      onChange={(event) => setForm((prev) => ({ ...prev, payoutAmount: event.target.value }))}
                      type="number"
                      min="0"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Max claims
                    <input
                      value={form.maxClaims}
                      onChange={(event) => setForm((prev) => ({ ...prev, maxClaims: event.target.value }))}
                      type="number"
                      min="1"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                    />
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Expires at
                    <input
                      value={form.expiresAt}
                      onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                      type="datetime-local"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                    />
                  </label>
                  {form.type === "escrow" ? (
                    <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Winners deadline
                      <input
                        value={form.winnersDeadline}
                        onChange={(event) => setForm((prev) => ({ ...prev, winnersDeadline: event.target.value }))}
                        type="datetime-local"
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                  ) : null}
                </div>
                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Eligible recipients
                  <textarea
                    value={form.recipients}
                    onChange={(event) => setForm((prev) => ({ ...prev, recipients: event.target.value }))}
                    placeholder="email@domain.com\n@handle"
                    className="min-h-[120px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <span>{recipientsList.length} recipients parsed</span>
                  {form.recipients ? (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, recipients: "" }))}
                      className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
                    >
                      Clear list
                    </button>
                  ) : null}
                </div>
                {recipientsList.length ? (
                  <div className="flex flex-wrap gap-2">
                    {recipientsList.slice(0, 6).map((recipient) => (
                      <span
                        key={recipient}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                      >
                        {recipient}
                      </span>
                    ))}
                    {recipientsList.length > 6 ? (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                        +{recipientsList.length - 6} more
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <input
                  value={form.refundAddress}
                  onChange={(event) => setForm((prev) => ({ ...prev, refundAddress: event.target.value }))}
                  placeholder="Refund address (optional)"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </div>
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Branding
                    </p>
                    <div className="mt-3 grid gap-3 text-sm">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                        className="text-xs text-slate-500"
                      />
                      <input
                        value={imageUrl}
                        onChange={(event) => setImageUrl(event.target.value)}
                        placeholder="or paste image URL"
                        className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700"
                      />
                      {preview && (
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={preview} alt="Campaign preview" className="h-36 w-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Theme colors
                    </p>
                    <div className="mt-3 grid gap-3">
                      {[
                        { key: "primary", label: "Primary" },
                        { key: "secondary", label: "Secondary" },
                        { key: "background", label: "Background" },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
                        >
                          {item.label}
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={theme[item.key as keyof CampaignTheme] || ""}
                              onChange={(event) =>
                                setTheme((prev) => ({
                                  ...prev,
                                  [item.key]: event.target.value,
                                }))
                              }
                              className="h-9 w-10 rounded-lg border border-slate-200 bg-white"
                            />
                            <input
                              value={theme[item.key as keyof CampaignTheme] || ""}
                              onChange={(event) =>
                                setTheme((prev) => ({
                                  ...prev,
                                  [item.key]: event.target.value,
                                }))
                              }
                              className="w-28 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Campaign preview
                  </p>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt="Preview artwork" className="h-36 w-full object-cover" />
                    ) : (
                      <div
                        className="h-36 w-full"
                        style={{
                          background: `linear-gradient(120deg, ${previewPrimary} 0%, ${previewSecondary} 100%)`,
                        }}
                      />
                    )}
                    <div className="space-y-3 px-4 py-4" style={{ background: previewBackground }}>
                      <div>
                        <p
                          className="text-xs font-semibold uppercase tracking-[0.2em]"
                          style={{ color: previewSecondary }}
                        >
                          {form.type === "escrow" ? "Escrow campaign" : "Direct payout"}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold" style={{ color: previewPrimary }}>
                          {previewTitle}
                        </h3>
                        <p className="mt-2 text-sm" style={{ color: previewSecondary }}>
                          {previewDescription}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: previewSecondary }}>
                        <span>{form.payoutAmount || "0"} USDC per claim</span>
                        <span>·</span>
                        <span>{form.maxClaims || "0"} recipients</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {status && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-xs font-semibold text-slate-600">
                {status}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              {step === 1 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
                >
                  Next step
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateCampaign}
                    disabled={loading}
                    className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Create campaign
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
