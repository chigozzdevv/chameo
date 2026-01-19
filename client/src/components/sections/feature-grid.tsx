const features = [
  {
    title: "Encrypted dispute voting",
    text: "Inco Lightning keeps vote totals encrypted until the relayer decrypts outcomes.",
    accent: "from-slate-900 to-slate-700",
  },
  {
    title: "Eligibility without wallet leaks",
    text: "Aztec Noir proofs and nullifiers validate voters without exposing identities.",
    accent: "from-amber-500 to-orange-500",
  },
  {
    title: "Unlinkable payouts",
    text: "Privacy Cash relays deposits and withdrawals to break wallet linkage.",
    accent: "from-sky-500 to-blue-600",
  },
];

export default function FeatureGrid() {
  return (
    <section id="privacy" className="mx-auto max-w-5xl">
      <div className="grid gap-6 md:grid-cols-3">
        {features.map((feature) => {
          return (
            <div
              key={feature.title}
              className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur"
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.accent} text-white`}
              >
                <span className="h-3 w-3 rounded-full bg-white" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm text-slate-600">{feature.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
