import { Suspense } from "react";
import ClaimCallbackClient from "./claim-callback-client";

export default function ClaimCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
          <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
            <h1 className="text-xl font-semibold text-slate-900">Verifying</h1>
            <p className="mt-3 text-sm text-slate-600">Preparing verification…</p>
          </div>
        </main>
      }
    >
      <ClaimCallbackClient />
    </Suspense>
  );
}
