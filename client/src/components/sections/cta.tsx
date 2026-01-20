"use client";

import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export default function Cta() {
  const router = useRouter();
  const handleCreate = () => {
    router.push(isAuthenticated() ? "/dashboard" : "/auth");
  };

  return (
    <section className="mx-auto max-w-5xl rounded-[2.5rem] bg-slate-900 px-8 py-12 text-white">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
          Get started
        </p>
        <h2 className="text-2xl font-semibold md:text-3xl">
          Create a private payout campaign.
        </h2>
        <button
          onClick={handleCreate}
          className="group inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900"
        >
          Create private payout
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] text-white transition group-hover:translate-x-0.5">
            →
          </span>
        </button>
      </div>
    </section>
  );
}
