"use client";

import { motion } from "framer-motion";

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.16 },
  },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: easeOut },
  },
};

export default function Compliance() {
  return (
    <motion.section
      id="compliance"
      className="mx-auto max-w-5xl"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
    >
      <div className="mb-10 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <motion.div variants={item}>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Compliance
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 md:text-4xl">
            Range screening is enforced on every claim.
          </h2>
          <p className="mt-4 text-sm text-slate-600 md:text-base">
            Claims are blocked unless they pass sanctions checks and risk
            scoring. Compliance is mandatory so private payouts remain
            policy-ready without manual review.
          </p>
          <div className="mt-6 grid gap-3 text-sm text-slate-600">
            <div className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-900" />
              <span>Every claim is screened before release.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-900" />
              <span>Sanctions and risk checks are enforced by default.</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={item}
          className="relative rounded-[2.5rem] border border-white/70 bg-white/80 p-6 shadow-[0_30px_70px_rgba(15,23,42,0.12)] backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Screening checks
            </p>
          </div>
          <div className="mt-5 grid gap-3">
            {[
              {
                title: "Sanctions screening",
                detail: "OFAC-listed addresses are blocked automatically.",
              },
              {
                title: "Risk scoring",
                detail: "High-risk wallets (6+ score) are rejected.",
              },
              {
                title: "Issuer blacklists",
                detail: "Stablecoin issuer blacklists are enforced.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/70 bg-white/90 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {item.title}
                </p>
                <p className="mt-2 text-sm text-slate-700">{item.detail}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
