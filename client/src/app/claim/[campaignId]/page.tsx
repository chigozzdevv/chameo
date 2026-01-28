import { Suspense } from "react";
import ClaimPageClient from "./claim-page-client";

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 px-6 py-16 text-slate-600">
          Loading claim…
        </div>
      }
    >
      <ClaimPageClient />
    </Suspense>
  );
}
