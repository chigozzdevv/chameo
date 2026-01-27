"use client";

import { motion } from "framer-motion";

const stack = [
  {
    name: "Privacy Cash",
    description: "Breaks on-chain links between funding, campaigns, and claims.",
    accent: "from-amber-400/80 via-orange-300/70 to-rose-300/60",
  },
  {
    name: "Inco Lightning",
    description: "Keeps dispute voting and analytics encrypted on-chain.",
    accent: "from-sky-300/70 via-blue-300/60 to-indigo-300/60",
  },
  {
    name: "Aztec Noir",
    description: "Proves eligibility without exposing voter identities.",
    accent: "from-emerald-300/70 via-teal-300/60 to-cyan-300/60",
  },
  {
    name: "Range",
    description: "Enforces compliance checks before claims are released.",
    accent: "from-slate-300/70 via-stone-300/60 to-neutral-300/60",
  },
];

export default function PrivacyStack() {
  return (
    <motion.section
      id="privacy-stack"
      className="mx-auto max-w-5xl"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.18 } },
      }}
    >
      <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div
          className="relative"
          variants={{
            hidden: { opacity: 0, y: 22 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
            },
          }}
        >
          <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-white/70 via-white/20 to-slate-200/50 blur-2xl" />
          <motion.div
            className="relative grid gap-4"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.12 } },
            }}
          >
            {stack.map((item, index) => (
              <motion.div
                key={item.name}
                className={`relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur ${
                  index === 1
                    ? "lg:translate-x-6"
                    : index === 2
                      ? "lg:-translate-x-4"
                      : index === 3
                        ? "lg:translate-x-3"
                        : ""
                }`}
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  show: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                  },
                }}
              >
                <div
                  className={`absolute -left-8 top-0 h-24 w-24 rounded-full bg-gradient-to-br ${item.accent} blur-2xl`}
                />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                    {item.name
                      .split(" ")
                      .map((word) => word[0])
                      .join("")}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {item.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 22 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
            },
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            The privacy stack
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 md:text-4xl">
            Privacy requires more than one layer.
          </h2>
          <p className="mt-4 text-sm text-slate-600 md:text-base">
            Chameo composes privacy primitives so hosts can fund, vote, and
            release claims without exposing their entire on-chain footprint.
          </p>
          <p className="mt-6 text-sm text-slate-600 md:text-base">
            Each layer covers a different privacy surface so no single point of
            exposure can leak your funding trail, votes, or claimant identities.
          </p>
        </motion.div>
      </div>
    </motion.section>
  );
}
