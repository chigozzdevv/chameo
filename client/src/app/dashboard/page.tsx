export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <section className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-[2.5rem] border border-white/70 bg-white/80 p-10 shadow-[0_30px_70px_rgba(15,23,42,0.12)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Dashboard
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">
            Your campaigns will appear here.
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Connect this page to your campaign list and payouts when you are
            ready.
          </p>
        </div>
      </section>
    </main>
  );
}
