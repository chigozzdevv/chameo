"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: easeOut },
  },
};

type Mode = "payout" | "escrow";

const campaignDetails: Record<Mode, { label: string; value: string; hint?: string }[]> = {
  payout: [
    {
      label: "Campaign name",
      value: "Creator Payout Sprint",
    },
    {
      label: "Recipients",
      value: "128 handles imported",
      hint: "Email, X, Telegram, Discord",
    },
    {
      label: "Eligibility proof",
      value: "Noir proof required",
      hint: "Nullifier prevents re-votes",
    },
  ],
  escrow: [
    {
      label: "Campaign name",
      value: "Hackathon Escrow Fund",
    },
    {
      label: "Recipients",
      value: "128 handles imported",
      hint: "Email, X, Telegram, Discord",
    },
    {
      label: "Eligibility proof",
      value: "Noir proof required",
      hint: "Nullifier prevents re-votes",
    },
  ],
};

const modeConfig: Record<
  Mode,
  {
    title: string;
    description: string;
    fields: { label: string; value: string; hint?: string }[];
    steps: string[];
  }
> = {
  payout: {
    title: "Payout mode",
    description:
      "Release funds immediately after approvals, with relayed payouts keeping wallets unlinkable.",
    fields: [
      { label: "Payout amount", value: "$200 USDC", hint: "Per claimant" },
      { label: "Max claims", value: "120", hint: "Auto-capped" },
      { label: "Claim deadline", value: "Dec 31, 2026" },
    ],
    steps: [
      "Host deposits → Privacy Cash",
      "Campaign funds arrive",
      "Relayer batches payouts",
      "Claimant withdraws via relayer",
    ],
  },
  escrow: {
    title: "Escrow mode",
    description:
      "Lock funds in a private pool until winners are chosen, then release over a timed window.",
    fields: [
      { label: "Escrow target", value: "$48,200 USDC" },
      { label: "Winners deadline", value: "Oct 30, 2026" },
      { label: "Claim deadline", value: "Nov 2, 2026" },
    ],
    steps: [
      "Host deposits → Privacy Cash",
      "Escrow locks to campaign",
      "Winners selected privately",
      "Claimant withdraws via relayer",
    ],
  },
};

export default function FundingFlowCard() {
  const [mode, setMode] = useState<Mode>("payout");
  const modeData = modeConfig[mode];

  return (
    <motion.section
      id="flows"
      className="relative mx-auto mt-16 flex max-w-5xl flex-col items-center"
      variants={cardVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
    >
      <div className="absolute inset-x-0 top-20 -z-10 h-72 rounded-[3rem] bg-white/50 blur-3xl" />
      <div className="relative w-full max-w-4xl">
        <div className="absolute -left-6 top-10 hidden h-full w-full rounded-[2.75rem] border border-white/40 bg-white/40 shadow-glow md:block" />
        <div className="absolute -right-6 bottom-6 hidden h-full w-full rounded-[2.75rem] border border-white/40 bg-white/40 shadow-glow md:block" />
        <div className="relative rounded-[2.75rem] border border-white/70 bg-white/70 p-8 shadow-glow backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Image
              src="/chameo-logo.png"
              alt="Chameo"
              width={320}
              height={96}
              className="h-20 w-auto object-contain"
              priority
            />
            <div className="flex items-center rounded-full border border-slate-200 bg-white/80 p-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              {(["payout", "escrow"] as Mode[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`rounded-full px-4 py-2 transition ${
                    mode === value
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  aria-pressed={mode === value}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-100 bg-white/85 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Campaign details
              </p>
              <div className="mt-4 grid gap-4">
                {campaignDetails[mode].map((item) => (
                  <Field key={item.label} {...item} />
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white/85 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Mode settings
              </p>
              <div className="mt-4 grid gap-4">
                {modeData.fields.map((item) => (
                  <Field key={item.label} {...item} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/80 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
