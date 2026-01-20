"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuthSession, getAuthUser, type AuthUser } from "@/lib/auth";

export default function DashboardHeader() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const orgLabel = useMemo(() => {
    if (!user?.orgSlug) return "Chameo";
    const label = user.orgSlug.replace(/[-_]/g, " ");
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [user?.orgSlug]);

  const initials = useMemo(() => {
    const value = user?.email || orgLabel;
    return value.slice(0, 2).toUpperCase();
  }, [orgLabel, user?.email]);

  useEffect(() => {
    setUser(getAuthUser());
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleLogout = () => {
    clearAuthSession();
    router.push("/auth");
  };

  return (
    <header className="relative z-40 rounded-[2rem] border border-white/70 bg-white/70 px-6 py-5 shadow-[0_25px_60px_rgba(15,23,42,0.12)] backdrop-blur lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
            Networks
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Privacy Cash · Mainnet
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              Inco Lightning · Devnet
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="rounded-full border border-slate-200 bg-white/90 px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm">
            {orgLabel}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/dashboard/campaigns?create=1"
            className="group inline-flex items-center gap-3 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Create private payout
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] text-slate-900 transition group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              aria-expanded={open}
              aria-haspopup="menu"
            >
              {initials}
            </button>
            {open && (
              <div className="absolute right-0 z-50 mt-3 w-56 rounded-2xl border border-white/60 bg-white/95 p-3 text-sm text-slate-700 shadow-[0_25px_60px_rgba(15,23,42,0.12)]">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Signed in as
                </div>
                <div className="px-2 py-2 text-sm font-semibold text-slate-900">
                  {user?.email || "creator@chameo.cash"}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
