"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { System } from "@/lib/utils/interfaces";

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [systemId, setSystemId] = useState<string>("");
  const [isReserves, setIsReserves] = useState(false);
  const [systems, setSystems] = useState<System[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/systems")
      .then((r) => r.json())
      .then((data) => {
        const list = data.systems ?? [];
        setSystems(list);
        if (list.length > 0 && !systemId) {
          setSystemId(list[0]!.id);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch systems once on mount, set default
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          system_id: systemId || undefined,
          is_reserves: isReserves,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? "Signup failed");
      }

      // אחרי הרשמה מוצלחת – מעבר לדף ההתחברות
      const params = new URLSearchParams();
      params.set("registered", "1");
      if (data.requiresEmailConfirmation) {
        params.set("confirm", "1");
      }
      router.replace(`/login?${params.toString()}`);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Signup failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] items-center justify-center overflow-x-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-black px-3 py-6 sm:px-4 sm:py-8">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 shadow-2xl backdrop-blur-xl sm:rounded-3xl">
        <div className="pointer-events-none absolute -left-32 top-[-80px] hidden h-72 w-72 rounded-full bg-gradient-to-br from-emerald-400/40 via-sky-400/30 to-violet-500/30 blur-3xl md:block" />
        <div className="relative flex flex-col md:flex-row-reverse">
          {/* טור טופס הרשמה */}
          <div className="w-full p-5 sm:p-6 md:w-1/2 md:p-10 lg:p-12">
            <div className="mb-8">
              <h1 className="mb-2 text-2xl font-semibold text-zinc-50 lg:text-3xl">
                יצירת משתמש חדש
              </h1>
              <p className="text-sm text-zinc-400">
                פתח חשבון כדי להתחיל לנהל אילוצים ושיבוצים עבור הצוות שלך.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    שם פרטי <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-zinc-700/70 bg-zinc-900/60 px-3 py-2.5 text-base text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 sm:text-sm [&::-ms-clear]:hidden"
                    placeholder="שם פרטי"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    שם משפחה <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-zinc-700/70 bg-zinc-900/60 px-3 py-2.5 text-base text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 sm:text-sm [&::-ms-clear]:hidden"
                    placeholder="שם משפחה"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  אימייל <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-zinc-700/70 bg-zinc-900/60 px-3 py-2.5 text-base text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 sm:text-sm [&::-ms-clear]:hidden"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  סיסמה <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-zinc-700/70 bg-zinc-900/60 px-3 py-2.5 text-base text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 sm:text-sm [&::-ms-clear]:hidden"
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  מערכת <span className="text-red-400">*</span>
                </label>
                <select
                  value={systemId}
                  onChange={(e) => setSystemId(e.target.value)}
                  className="min-h-[44px] cursor-pointer w-full rounded-xl border border-zinc-700/70 bg-zinc-900/60 px-3 py-2.5 text-base text-zinc-50 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 sm:text-sm"
                >
                  {systems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_reserves"
                  checked={isReserves}
                  onChange={(e) => setIsReserves(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-400/40"
                />
                <label htmlFor="is_reserves" className="cursor-pointer text-sm text-zinc-300">
                  איש מילואים              
                </label>
              </div>

              {error && (
                <p className="text-sm text-red-400" role="alert">
                  {error}
                </p>
              )}
              {info && !error && (
                <p className="text-sm text-emerald-300" role="status">
                  {info}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-medium text-emerald-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {loading ? "יוצר משתמש..." : "הרשמה"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-zinc-400">
              כבר יש לך משתמש?{" "}
              <a
                href="/login"
                className="font-medium text-emerald-300 hover:text-emerald-200"
              >
                להתחברות
              </a>
            </p>
          </div>

          {/* טור צד ויזואלי / טקסטואלי */}
          <div className="hidden w-1/2 flex-col justify-between border-l border-zinc-800/70 bg-gradient-to-br from-zinc-900/80 via-zinc-900/40 to-black/60 p-8 md:flex lg:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
                התחלה מהירה לצוותים
              </p>
              <h2 className="mt-3 text-xl font-semibold text-zinc-50 lg:text-2xl">
                הגדרה מהירה של צוות המשמרות
              </h2>
              <p className="mt-3 text-sm text-zinc-400">
                המשתמש הראשון שיירשם יסומן אוטומטית כמנהל ויוכל לנהל שיבוצים,
                אילוצים ומשמרות לכל הצוות.
              </p>
            </div>

            <div className="mt-6 space-y-2 text-xs text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-semibold text-emerald-300">
                  1
                </span>
                <span>יוצרים משתמש חדש למנהל הראשון.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-semibold text-emerald-300">
                  2
                </span>
                <span>מזמינים כוננים נוספים להירשם ולהצטרף לצוות.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-semibold text-emerald-300">
                  3
                </span>
                <span>מתחילים להזין אילוצים ולבנות שיבוצים חכמים.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

