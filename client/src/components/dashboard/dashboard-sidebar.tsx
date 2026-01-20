"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  FolderOpen,
  FileText,
  Gavel,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { clearAuthSession } from "@/lib/auth";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutGrid },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: FolderOpen },
  { label: "Claims", href: "/dashboard/claims", icon: FileText },
  { label: "Disputes", href: "/dashboard/disputes", icon: Gavel },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const handleLogout = () => {
    clearAuthSession();
    router.push("/auth");
  };

  return (
    <aside className="w-full">
      <div className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur lg:sticky lg:top-8 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative h-14 w-48">
            <Image
              src="/chameo-logo.png"
              alt="Chameo"
              fill
              className="object-contain"
              sizes="192px"
            />
          </div>
        </Link>

        <nav className="mt-8 grid gap-2 text-sm font-semibold">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`flex items-center justify-between rounded-2xl px-4 py-3 transition ${
                isActive(item.href)
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </span>
              <span
                className={`h-2 w-2 rounded-full ${
                  isActive(item.href) ? "bg-white" : "bg-slate-300"
                }`}
              />
            </Link>
            );
          })}
        </nav>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
