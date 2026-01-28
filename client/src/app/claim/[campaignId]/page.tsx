"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { buildZkProof, castVoteZk } from "@/lib/voting";
import { encryptValue } from "@inco/solana-sdk/encryption";

type Campaign = {
  id: string;
  name: string;
  description?: string;
  type: "payout" | "escrow";
  authMethod: "email" | "twitter" | "telegram" | "discord" | "github";
  payoutAmount: number;
  maxClaims: number;
  claimCount: number;
  funded?: boolean;
  status: string;
  expiresAt: number;
  winnersDeadline?: number;
  imageUrl?: string;
};

type VerificationState = {
  token: string;
  identityHash: string;
};

const storageKey = (campaignId: string) => `claim:${campaignId}`;

export default function ClaimPage() {
  const params = useParams<{ campaignId: string }>();
  const searchParams = useSearchParams();
  const campaignId = params.campaignId;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [verification, setVerification] = useState<VerificationState | null>(null);
  const [email, setEmail] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [claimResult, setClaimResult] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<"idle" | "claimed">("idle");
  const [voteChoice, setVoteChoice] = useState<"refund-host" | "equal-distribution">("refund-host");
  const [voteStatus, setVoteStatus] = useState<string | null>(null);
  const [voteSignature, setVoteSignature] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const authLabel = useMemo(() => {
    if (!campaign) return "";
    if (campaign.authMethod === "twitter") return "X (Twitter)";
    return campaign.authMethod.charAt(0).toUpperCase() + campaign.authMethod.slice(1);
  }, [campaign]);

  const formatSol = (lamports: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 9,
    }).format(lamports / 1e9);

  const claimLockedReason = useMemo(() => {
    if (!campaign) return null;
    if (!campaign.funded) return "Funding in progress.";
    if (campaign.status === "closed") return "Campaign closed.";
    if (campaign.type === "escrow" && campaign.status !== "winners-announced") {
      return campaign.status === "dispute"
        ? "Dispute in progress."
        : "Winners have not been announced yet.";
    }
    return null;
  }, [campaign]);

  const explorerUrl = useMemo(() => {
    if (!claimResult) return null;
    return `https://solscan.io/tx/${claimResult}`;
  }, [claimResult]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<{ success: boolean; campaign: Campaign }>(`/api/campaign/${campaignId}`)
      .then((res) => {
        if (!active) return;
        setCampaign(res.campaign);
      })
      .catch((error) => {
        if (!active) return;
        setStatus(error instanceof Error ? error.message : "Unable to load campaign");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [campaignId]);

  useEffect(() => {
    if (!campaign) return;
    const stored = window.localStorage.getItem(storageKey(campaignId));
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as VerificationState;
      if (parsed?.token && parsed?.identityHash) {
        setVerification(parsed);
      }
    } catch {
      window.localStorage.removeItem(storageKey(campaignId));
    }
  }, [campaign, campaignId]);

  useEffect(() => {
    if (!campaign) return;
    const tokenParam = searchParams.get("token");
    const codeParam = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const telegramHash = searchParams.get("hash");
    if (tokenParam) {
      apiFetch<{
        success: boolean;
        token: string;
        identityHash: string;
        campaignId: string;
      }>("/api/claim/verify/magic-link", {
        method: "POST",
        body: JSON.stringify({ token: tokenParam }),
      })
        .then((res) => {
          const payload = { token: res.token, identityHash: res.identityHash };
          setVerification(payload);
          window.localStorage.setItem(storageKey(campaignId), JSON.stringify(payload));
          window.history.replaceState({}, "", `/claim/${campaignId}`);
        })
        .catch((error) => {
          setStatus(error instanceof Error ? error.message : "Link verification failed");
        });
      return;
    }
    if (campaign.authMethod === "telegram" && telegramHash) {
      if (!stateParam) {
        setStatus("Verification failed: missing state.");
        return;
      }
      const authData = Object.fromEntries(searchParams.entries());
      apiFetch<{ success: boolean; token: string; identityHash: string }>(
        `/api/claim/verify/social/telegram/callback`,
        {
          method: "POST",
          body: JSON.stringify({
            state: stateParam,
            authData,
          }),
        }
      )
        .then((res) => {
          const payload = { token: res.token, identityHash: res.identityHash };
          setVerification(payload);
          window.localStorage.setItem(storageKey(campaignId), JSON.stringify(payload));
          window.history.replaceState({}, "", `/claim/${campaignId}`);
        })
        .catch((error) => {
          setStatus(error instanceof Error ? error.message : "Verification failed");
        });
      return;
    }
    if (codeParam && campaign.authMethod !== "email") {
      if (!stateParam) {
        setStatus("Verification failed: missing state.");
        return;
      }
      apiFetch<{ success: boolean; token: string; identityHash: string }>(
        `/api/claim/verify/social/${campaign.authMethod}/callback`,
        {
          method: "POST",
          body: JSON.stringify({ code: codeParam, state: stateParam }),
        }
      )
        .then((res) => {
          const payload = { token: res.token, identityHash: res.identityHash };
          setVerification(payload);
          window.localStorage.setItem(storageKey(campaignId), JSON.stringify(payload));
          window.history.replaceState({}, "", `/claim/${campaignId}`);
        })
        .catch((error) => {
          setStatus(error instanceof Error ? error.message : "Verification failed");
        });
    }
  }, [campaign, campaignId, searchParams]);

  useEffect(() => {
    if (!verification?.identityHash) return;
    apiFetch<{ success: boolean; claimed: boolean }>(
      `/api/claim/status/${campaignId}/${verification.identityHash}?token=${verification.token}`
    )
      .then((res) => {
        setClaimStatus(res.claimed ? "claimed" : "idle");
      })
      .catch(() => {
        setClaimStatus("idle");
      });
  }, [campaignId, verification]);

  const requestEmailClaim = async () => {
    setProcessing(true);
    setStatus(null);
    try {
      const response = await apiFetch<{ success: boolean; message: string }>(
        `/api/claim/request/${campaignId}`,
        {
          method: "POST",
          body: JSON.stringify({ email }),
        }
      );
      setStatus(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed");
    } finally {
      setProcessing(false);
    }
  };

  const startSocialAuth = async () => {
    if (!campaign) return;
    setProcessing(true);
    setStatus(null);
    try {
      const redirectUri = `${window.location.origin}/claim/callback`;
      const response = await apiFetch<{ success: boolean; url: string }>(
        `/api/claim/verify/social/${campaign.authMethod}/url?campaignId=${campaignId}&redirectUri=${encodeURIComponent(
          redirectUri
        )}`
      );
      window.location.href = response.url;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start verification");
      setProcessing(false);
    }
  };

  const submitClaim = async () => {
    if (!verification) return;
    setProcessing(true);
    setStatus(null);
    setClaimResult(null);
    try {
      const response = await apiFetch<{ success: boolean; signature: string; amount: number }>(
        "/api/claim/process",
        {
          method: "POST",
          body: JSON.stringify({
            campaignId,
            token: verification.token,
            walletAddress,
          }),
        }
      );
      setClaimResult(response.signature);
      setClaimStatus("claimed");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Claim failed");
    } finally {
      setProcessing(false);
    }
  };

  const submitVote = async () => {
    if (!verification) return;
    setProcessing(true);
    setVoteStatus(null);
    setVoteSignature(null);
    try {
      const voteValue = voteChoice === "refund-host" ? 0n : 1n;
      const encrypted = await encryptValue(voteValue);
      const ciphertext = encrypted.startsWith("0x") ? encrypted.slice(2) : encrypted;
      const proof = await buildZkProof({
        campaignId,
        identityHash: verification.identityHash,
        ciphertext,
      });
      const cast = await castVoteZk({
        campaignId,
        proof: proof.proof,
        publicWitness: proof.publicWitness,
        nullifier: proof.nullifier,
        ciphertext,
      });
      setVoteSignature(cast.signature);
      setVoteStatus("Vote submitted.");
    } catch (error) {
      setVoteStatus(error instanceof Error ? error.message : "Vote failed");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-16 text-slate-600">
        Loading campaign…
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-16 text-slate-600">
        Campaign not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(255,210,195,0.45)_0%,transparent_55%),radial-gradient(120%_120%_at_100%_0%,rgba(185,220,255,0.5)_0%,transparent_55%),radial-gradient(120%_120%_at_50%_100%,rgba(255,235,200,0.55)_0%,transparent_60%)]" />
        <div className="relative mx-auto flex max-w-4xl flex-col gap-8 px-6 py-16">
          <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-[0_20px_45px_rgba(15,23,42,0.1)] backdrop-blur">
            {campaign.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={campaign.imageUrl} alt={campaign.name} className="h-48 w-full object-cover" />
            ) : null}
            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                {campaign.type === "escrow" ? "Escrow campaign" : "Private payout"}
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-slate-900">{campaign.name}</h1>
              <p className="mt-3 text-sm text-slate-600">
                {campaign.description || "Claim your payout securely without exposing wallets."}
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <span>{formatSol(campaign.payoutAmount)} SOL per claim</span>
                <span>·</span>
                <span>
                  {campaign.claimCount}/{campaign.maxClaims} claimed
                </span>
              </div>
            </div>
          </section>

          {!campaign.funded ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Funding is still in progress. Claims will unlock once the campaign is funded.
            </div>
          ) : null}

          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.1)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                01 · Verify eligibility
              </p>
              <h2 className="mt-3 text-lg font-semibold text-slate-900">
                {campaign.authMethod === "email"
                  ? "Verify with your email"
                  : `Verify with ${authLabel}`}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Eligibility uses the handle or email provided by the campaign creator.
              </p>

              {verification ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Eligibility verified.
                  <span className="ml-2 text-xs font-semibold text-emerald-700">
                    ID {verification.identityHash.slice(0, 10)}…
                  </span>
                </div>
              ) : campaign.authMethod === "email" ? (
                <div className="mt-6 grid gap-3">
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@email.com"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={requestEmailClaim}
                    disabled={processing || !email}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Send claim link
                  </button>
                </div>
              ) : (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={startSocialAuth}
                    disabled={processing}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Connect {authLabel}
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.1)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                02 · Claim payout
              </p>
              <h2 className="mt-3 text-lg font-semibold text-slate-900">
                Enter your wallet address
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Compliance screening runs automatically before release.
              </p>
              {verification ? (
                <div className="mt-6 grid gap-3">
                  <input
                    value={walletAddress}
                    onChange={(event) => setWalletAddress(event.target.value)}
                    placeholder="Solana wallet address"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={submitClaim}
                    disabled={
                      processing ||
                      claimStatus === "claimed" ||
                      campaign.status === "closed" ||
                      !campaign.funded ||
                      (campaign.type === "escrow" && campaign.status !== "winners-announced")
                    }
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {claimStatus === "claimed" ? "Already claimed" : "Claim payout"}
                  </button>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-xs font-semibold text-slate-500">
                  Verify eligibility to unlock wallet input.
                </div>
              )}
              {claimLockedReason ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-xs font-semibold text-slate-500">
                  {claimLockedReason}
                </div>
              ) : null}
              {claimResult ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
                  <div>Claim submitted.</div>
                  {explorerUrl ? (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold text-emerald-800"
                    >
                      View on Solscan ↗
                    </a>
                  ) : null}
                  <div className="mt-2 break-all text-[11px] text-emerald-800/80">{claimResult}</div>
                </div>
              ) : null}
            </div>
          </section>

          {campaign.status === "dispute" ? (
            <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.1)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Dispute voting
              </p>
              <h2 className="mt-3 text-lg font-semibold text-slate-900">
                Submit your encrypted vote
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Votes are encrypted with Inco and validated by a Noir proof.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  { id: "refund-host", label: "Refund host" },
                  { id: "equal-distribution", label: "Equal distribution" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setVoteChoice(option.id as "refund-host" | "equal-distribution")}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      voteChoice === option.id
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={submitVote}
                disabled={processing || !verification}
                className="mt-5 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Cast encrypted vote
              </button>
              {voteStatus ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-600">
                  {voteStatus}
                </div>
              ) : null}
              {voteSignature ? (
                <div className="mt-3 text-xs font-semibold text-slate-500">
                  Signature: {voteSignature}
                </div>
              ) : null}
            </section>
          ) : null}

          {status ? (
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-600">
              {status}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
