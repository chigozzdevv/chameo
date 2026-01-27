"use client";

import { motion } from "framer-motion";

const flows = [
  {
    title: "Payout flow",
    summary: "Immediate claims once a campaign is funded.",
    tags: ["Privacy Cash", "Range", "Private claims"],
    steps: [
      {
        title: "Add eligible recipients",
        detail:
          "Hosts upload emails or social handles. Identities are hashed into the eligibility list.",
      },
      {
        title: "Shield host funds",
        detail:
          "Host deposits into Privacy Cash, then withdraws to the campaign wallet.",
      },
      {
        title: "Campaign re-shields",
        detail:
          "Campaign wallet deposits into Privacy Cash to prepare private claims.",
      },
      {
        title: "Claim + compliance",
        detail:
          "Claimants verify eligibility, pass Range checks, then withdraw privately.",
      },
    ],
  },
  {
    title: "Escrow flow",
    summary: "Locked pools with private dispute resolution.",
    tags: ["Privacy Cash", "Noir ZK", "Inco voting"],
    steps: [
      {
        title: "Set escrow + deadline",
        detail:
          "Create an escrow campaign, add participants, and set a winners deadline.",
      },
      {
        title: "Shield and fund",
        detail:
          "Host shields funds and withdraws to the campaign wallet without linkability.",
      },
      {
        title: "Pick winners or dispute",
        detail:
          "If winners are missed, Noir proofs gate on-chain anonymous dispute votes.",
      },
      {
        title: "Encrypted outcome",
        detail:
          "Inco keep votes confidential until the outcome is revealed.",
      },
    ],
  },
];

export default function HowItWorks() {
  return (
    <motion.section
      id="how-it-works"
      className="mx-auto max-w-5xl"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.16 } },
      }}
    >
      <div className="mx-auto mb-10 h-px w-full max-w-5xl bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <motion.div
        className="mx-auto max-w-3xl text-center"
        variants={{
          hidden: { opacity: 0, y: 20 },
          show: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
          },
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          How it works
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900 md:text-4xl">
          Two flows, one privacy guarantee.
        </h2>
        <p className="mt-4 text-sm text-slate-600 md:text-base">
          Payouts and escrow campaigns both shield the funding trail, keep
          eligibility off-wallet, and avoid direct wallet links.
        </p>
      </motion.div>

      <motion.div
        className="mt-12 grid gap-6 lg:grid-cols-2"
        variants={{
          hidden: { opacity: 0, y: 18 },
          show: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
          },
        }}
      >
        {flows.map((flow) => (
          <motion.div
            key={flow.title}
            className="relative rounded-[2.5rem] border border-white/70 bg-white/85 p-6 shadow-[0_30px_70px_rgba(15,23,42,0.12)] backdrop-blur"
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
              },
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  {flow.title}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {flow.summary}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {flow.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-slate-200 bg-white/90 px-3 py-1"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {flow.steps.map((step, index) => (
                <div
                  key={step.title}
                  className="flex items-start gap-4 rounded-2xl border border-white/70 bg-white/80 p-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {step.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  );
}
