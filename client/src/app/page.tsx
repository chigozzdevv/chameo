import BackgroundGlow from "@/components/background-glow";
import FundingFlowCard from "@/components/funding-flow-card";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import Compliance from "@/components/sections/compliance";
import Cta from "@/components/sections/cta";
import Hero from "@/components/sections/hero";
import HowItWorks from "@/components/sections/how-it-works";
import PrivacyWhy from "@/components/sections/privacy-why";
import PrivacyStack from "@/components/sections/privacy-stack";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <section className="relative isolate overflow-hidden">
        <BackgroundGlow />
        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-10">
          <SiteHeader />
          <Hero />
          <FundingFlowCard />
        </div>
      </section>
      <section className="relative overflow-hidden bg-neutral-50 py-24 before:absolute before:inset-0 before:z-0 before:bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_40%,#f8fafc_100%),radial-gradient(120%_120%_at_0%_100%,rgba(255,140,126,0.5)_0%,transparent_60%),radial-gradient(120%_120%_at_50%_100%,rgba(255,210,140,0.55)_0%,transparent_65%),radial-gradient(120%_120%_at_100%_45%,rgba(120,190,255,0.55)_0%,transparent_60%),radial-gradient(120%_120%_at_70%_5%,rgba(235,240,255,0.9)_0%,transparent_55%)] before:opacity-100 after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-32 after:bg-gradient-to-b after:from-white/95 after:via-white/60 after:to-transparent">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[58rem] -translate-x-1/2 rounded-full bg-white/80 blur-[140px]" />
        <div className="pointer-events-none absolute -bottom-32 left-1/2 h-80 w-[58rem] -translate-x-1/2 rounded-full bg-white/90 blur-[160px]" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div className="space-y-16 md:space-y-20">
            <PrivacyWhy />
            <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            <PrivacyStack />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent via-white/70 to-white/100" />
      </section>
      <section className="relative overflow-hidden bg-white py-24 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-24 before:bg-gradient-to-b before:from-white/90 before:via-white/50 before:to-transparent">
        <div className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-amber-100/60 blur-[120px]" />
        <div className="absolute -right-32 bottom-10 h-72 w-72 rounded-full bg-sky-100/70 blur-[130px]" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <HowItWorks />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent via-white/70 to-white/100" />
      </section>
      <section className="relative overflow-hidden bg-neutral-50 py-24 before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_50%,#f8fafc_100%),radial-gradient(120%_120%_at_10%_10%,rgba(255,240,225,0.55)_0%,transparent_55%),radial-gradient(120%_120%_at_95%_85%,rgba(195,220,255,0.45)_0%,transparent_60%)] before:opacity-90 after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-24 after:bg-gradient-to-b after:from-white/95 after:via-white/60 after:to-transparent">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-white/80 blur-[140px]" />
        <div className="pointer-events-none absolute -bottom-32 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-white/90 blur-[150px]" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <Compliance />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent via-white/70 to-white/100" />
      </section>
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#fef2e7_0%,#eff7ff_55%,#f6f0ff_100%)] py-24 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-24 before:bg-gradient-to-b before:from-white/90 before:via-white/50 before:to-transparent">
        <div className="mx-auto max-w-6xl px-6">
          <Cta />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent via-white/70 to-white/100" />
      </section>
      <section className="border-t border-slate-200 bg-neutral-100">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <SiteFooter />
        </div>
      </section>
    </main>
  );
}
