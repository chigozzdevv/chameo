import type { ReactNode } from "react";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import DashboardSidebar from "@/components/dashboard/dashboard-sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(255,210,195,0.45)_0%,transparent_55%),radial-gradient(120%_120%_at_100%_0%,rgba(185,220,255,0.5)_0%,transparent_55%),radial-gradient(120%_120%_at_50%_100%,rgba(255,235,200,0.55)_0%,transparent_60%)]" />
      <div className="relative min-h-screen">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-6 lg:max-w-none lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-0 lg:px-0 lg:py-0">
          <div className="lg:hidden">
            <DashboardSidebar />
          </div>
          <div className="hidden w-72 border-r border-white/60 bg-white/60 backdrop-blur lg:row-span-2 lg:flex">
            <div className="h-full w-full px-6 py-10">
              <DashboardSidebar />
            </div>
          </div>
          <div className="lg:col-start-2 lg:row-start-1 lg:border-b lg:border-white/60 lg:bg-white/40 lg:px-10 lg:py-6 lg:backdrop-blur">
            <DashboardHeader />
          </div>
          <div className="lg:col-start-2 lg:row-start-2 lg:px-10 lg:py-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
