import { Suspense } from "react";
import AnalyticsClient from "./analytics-client";

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 px-6 py-16 text-slate-600">
          Loading analytics…
        </div>
      }
    >
      <AnalyticsClient />
    </Suspense>
  );
}
