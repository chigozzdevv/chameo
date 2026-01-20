export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.1)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          Settings
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">
          Workspace
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Organization name
            <input
              defaultValue="Chameo Labs"
              className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
            />
          </label>
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Organization slug
            <input
              defaultValue="chameo"
              className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
            />
          </label>
        </div>
      </section>

    </div>
  );
}
