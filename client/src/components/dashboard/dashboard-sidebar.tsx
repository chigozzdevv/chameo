"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Overview", href: "/dashboard" },
  { label: "Campaigns", href: "/dashboard/campaigns" },
  { label: "Claims", href: "/dashboard/claims" },
  { label: "Disputes", href: "/dashboard/disputes" },
  { label: "Analytics", href: "/dashboard/analytics" },
  { label: "Settings", href: "/dashboard/settings" },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="w-full">
      <div className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur lg:sticky lg:top-8 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative h-10 w-36">
            <Image
              src="/chameo-logo.png"
              alt="Chameo"
              fill
              className="object-contain"
              sizes="144px"
            />
          </div>
        </Link>

        <nav className="mt-8 grid gap-2 text-sm font-semibold">
          {navItems.map((item) => (
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
              <span>{item.label}</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  isActive(item.href) ? "bg-white" : "bg-slate-300"
                }`}
              />
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
