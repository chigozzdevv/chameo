"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

type VerifyResponse = {
  success: boolean;
  token: string;
  identityHash: string;
  campaignId: string;
};

const storageKey = (campaignId: string) => `claim:${campaignId}`;

export default function ClaimCallbackClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Verifying your identity...");
  const query = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(query);
    const state = params.get("state");
    if (!state) {
      setStatus("Missing state. Please restart verification.");
      return;
    }

    const code = params.get("code");
    const authData = Object.fromEntries(params.entries());
    const hasTelegramPayload = Boolean(authData.hash && authData.id);

    apiFetch<VerifyResponse>("/api/claim/verify/social/callback", {
      method: "POST",
      body: JSON.stringify({
        state,
        code: code || undefined,
        authData: hasTelegramPayload ? authData : undefined,
      }),
    })
      .then((res) => {
        const payload = { token: res.token, identityHash: res.identityHash };
        window.localStorage.setItem(storageKey(res.campaignId), JSON.stringify(payload));
        window.location.replace(`/claim/${res.campaignId}`);
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "Verification failed. Please try again.");
      });
  }, [query]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
        <h1 className="text-xl font-semibold text-slate-900">Verifying</h1>
        <p className="mt-3 text-sm text-slate-600">{status}</p>
      </div>
    </main>
  );
}
