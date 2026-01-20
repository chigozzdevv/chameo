"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { z } from "zod";
import { login, signup, setAuthSession, isAuthenticated } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signupSchema = z.object({
  orgName: z.string().min(2, "Organization name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type Mode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState({
    orgName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const parsed = loginSchema.safeParse({
          email: form.email,
          password: form.password,
        });
        if (!parsed.success) {
          throw new Error(parsed.error.issues[0]?.message || "Invalid input");
        }
        const result = await login(form.email, form.password);
        setAuthSession(result);
        router.push("/dashboard");
      } else {
        const parsed = signupSchema.safeParse({
          orgName: form.orgName,
          email: form.email,
          password: form.password,
        });
        if (!parsed.success) {
          throw new Error(parsed.error.issues[0]?.message || "Invalid input");
        }
        const result = await signup(form.email, form.password, form.orgName);
        setAuthSession(result);
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-50">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_55%,#f8fafc_100%),radial-gradient(120%_120%_at_0%_100%,rgba(255,140,126,0.45)_0%,transparent_60%),radial-gradient(120%_120%_at_60%_110%,rgba(255,210,140,0.5)_0%,transparent_65%),radial-gradient(120%_120%_at_100%_40%,rgba(120,190,255,0.5)_0%,transparent_60%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-16">
        <div className="relative w-full max-w-lg">
          <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-white/70 via-white/10 to-slate-200/60 blur-2xl" />
          <div className="relative rounded-[2.5rem] border border-white/70 bg-white/90 p-8 shadow-[0_30px_70px_rgba(15,23,42,0.16)] backdrop-blur">
            <div className="relative mb-6 flex w-full items-center justify-center">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-sm text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Back to home"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="relative h-16 w-64"
              >
                <Image
                  src="/chameo-logo.png"
                  alt="Chameo"
                  fill
                  className="object-contain"
                  sizes="256px"
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  {mode === "login" ? "Welcome back" : "Create account"}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {mode === "login"
                    ? "Sign in to your workspace."
                    : "Start a new private campaign."}
                </p>
              </div>
              <div className="flex items-center rounded-full border border-slate-200 bg-white/90 p-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                {(["login", "signup"] as Mode[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`rounded-full px-4 py-2 transition ${
                      mode === value
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
              {mode === "signup" ? (
                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Organization
                  <input
                    value={form.orgName}
                    onChange={(event) =>
                      updateField("orgName", event.target.value)
                    }
                    className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                    placeholder="Chameo Labs"
                  />
                </label>
              ) : null}
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Email
                <input
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                  placeholder="founder@chameo.cash"
                  type="email"
                />
              </label>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Password
                <input
                  value={form.password}
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                  className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm font-normal text-slate-900 focus:border-slate-400 focus:outline-none"
                  placeholder="••••••••"
                  type="password"
                />
              </label>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="group inline-flex items-center justify-center gap-3 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading
                  ? "Processing..."
                  : mode === "login"
                    ? "Sign in"
                    : "Create account"}
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] text-slate-900 transition group-hover:translate-x-0.5">
                  →
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
