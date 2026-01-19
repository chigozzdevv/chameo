export default function BackgroundGlow() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_45%,#f8fafc_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_100%,rgba(255,140,126,0.55)_0%,transparent_60%),radial-gradient(120%_120%_at_50%_100%,rgba(255,210,140,0.5)_0%,transparent_65%),radial-gradient(120%_120%_at_100%_45%,rgba(120,190,255,0.6)_0%,transparent_60%),radial-gradient(120%_120%_at_70%_5%,rgba(235,240,255,0.8)_0%,transparent_55%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/80 via-white/30 to-transparent" />
      <div className="absolute bottom-[-20%] left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-white/70 blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] h-80 w-80 rounded-full bg-rose-200/50 blur-[120px]" />
      <div className="absolute right-[-12%] top-12 h-80 w-80 rounded-full bg-sky-200/60 blur-[120px]" />
    </div>
  );
}
