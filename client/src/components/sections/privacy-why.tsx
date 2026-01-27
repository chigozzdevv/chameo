"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.16 },
  },
};
const item = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: easeOut },
  },
};

const highlights = [
  "Hosts add claimants or escrow participants by handle or email, never by wallet address.",
  "Noir ZK proofs keep voter identities hidden while proving eligibility.",
  "Privacy Cash breaks on-chain links between host, campaign, and claimant.",
  "Inco keeps dispute state and vote totals confidential until reveal.",
];

export default function PrivacyWhy() {
  return (
    <motion.section
      id="why-privacy"
      className="mx-auto max-w-5xl"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
    >
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div variants={item}>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Why privacy payout
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 md:text-4xl">
            Payouts should not expose your entire wallet.
          </h2>
          <p className="mt-4 text-sm text-slate-600 md:text-base">
            Once you pay someone on-chain, they can trace your balance, past
            transactions, and other counterparties. Chameo lets hosts add
            claimants or escrow participants by social handle or email, then
            recipients claim later with their own wallet, without exposing the
            funding source.
          </p>
          <div className="mt-6 space-y-3 text-sm text-slate-600">
            {highlights.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-900" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={item} className="relative">
          <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-amber-100/70 via-white/10 to-sky-100/70 blur-2xl" />
          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/80 p-3 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur">
            <Image
              src="/privacy-challenge.png"
              alt="Public crypto payments expose wallet history"
              width={560}
              height={720}
              className="h-full w-full rounded-[2rem] object-cover"
              sizes="(min-width: 1024px) 40vw, 100vw"
            />
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
