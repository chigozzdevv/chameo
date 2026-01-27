"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOut },
  },
};

export default function Hero() {
  const router = useRouter();
  const handleCreate = () => {
    router.push(isAuthenticated() ? "/dashboard" : "/auth");
  };

  return (
    <motion.section
      className="mx-auto mt-20 max-w-3xl text-center"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.h1
        variants={item}
        className="mt-6 font-display text-4xl font-semibold text-slate-900 md:text-6xl"
      >
        Compliant private <span className="block">payouts</span>
      </motion.h1>
      <motion.p
        variants={item}
        className="mt-6 text-base text-slate-600 md:text-lg"
      >
        Privately pay anyone by email or social handle (X, Telegram, Discord)
        without revealing wallets to each other—on-chain links stay broken. Run
        direct payouts or escrowed campaigns.
      </motion.p>
      <motion.div variants={item} className="mt-8 flex justify-center">
        <button
          onClick={handleCreate}
          className="group inline-flex items-center gap-3 rounded-full bg-black px-6 py-3 text-sm font-medium text-white shadow-glow transition hover:bg-neutral-900"
        >
          create private payout
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] text-black transition group-hover:translate-x-0.5">
            →
          </span>
        </button>
      </motion.div>
    </motion.section>
  );
}
