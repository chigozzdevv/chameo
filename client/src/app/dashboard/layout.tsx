import type { ReactNode } from "react";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import DashboardSidebar from "@/components/dashboard/dashboard-sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 lg:h-screen lg:overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(255,210,195,0.45)_0%,transparent_55%),radial-gradient(120%_120%_at_100%_0%,rgba(185,220,255,0.5)_0%,transparent_55%),radial-gradient(120%_120%_at_50%_100%,rgba(255,235,200,0.55)_0%,transparent_60%)]" />
      <div className="relative min-h-screen lg:h-screen">
        <div className="mx-auto w-full max-w-6xl px-6 py-6 lg:max-w-none lg:px-0 lg:py-0">
          <div className="lg:hidden">
            <DashboardSidebar />
          </div>
          <div className="hidden border-r border-white/60 bg-white/60 backdrop-blur lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-72">
            <div className="h-full w-full px-6 py-10">
              <DashboardSidebar />
            </div>
          </div>
          <div className="relative z-40 lg:fixed lg:left-72 lg:right-0 lg:top-0 lg:border-b lg:border-white/60 lg:bg-white/40 lg:px-10 lg:py-6 lg:backdrop-blur">
            <DashboardHeader />
          </div>
          <div className="lg:h-screen lg:overflow-y-auto lg:pl-72 lg:pt-28">
            <div className="lg:px-10 lg:py-10">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
