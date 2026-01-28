import { Suspense } from "react";
import CampaignsClient from "./campaigns-client";

export default function CampaignsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 px-6 py-16 text-slate-600">
          Loading campaigns…
        </div>
      }
    >
      <CampaignsClient />
    </Suspense>
  );
}
