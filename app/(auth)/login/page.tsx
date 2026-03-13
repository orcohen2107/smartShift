'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { getSupabaseBrowser } from '@/lib/db/supabaseBrowser';
import { apiFetch } from '@/lib/api/apiFetch';

type EnsureProfileResponse = {
  profile: {
    id: string;
    full_name: string | null;
    role: string;
  };
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered') === '1';
  const confirmEmail = searchParams.get('confirm') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // אם יש כבר session (למשל מלינק אימות מייל) – ensure והפניה ל-dashboard
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCheckingSession(false);
      if (!session) return;
      apiFetch<EnsureProfileResponse>('/api/profile/ensure', { method: 'POST' })
        .then(() => router.replace('/dashboard'))
        .catch(() => {
          /* session אולי לא תקף – נשארים בטופס */
        });
    });
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      // Ensure profile exists and has a role.
      await apiFetch<EnsureProfileResponse>('/api/profile/ensure', {
        method: 'POST',
      });

      router.replace('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-[100dvh] min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black">
        <Logo
          width={200}
          height={64}
          className="h-14 w-auto object-contain"
          forceDark
        />
        <p className="text-sm text-zinc-400">טוען...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] min-h-screen items-center justify-center overflow-x-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-black px-3 py-6 sm:px-4 sm:py-8">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 shadow-2xl backdrop-blur-xl sm:rounded-3xl">
        <div className="pointer-events-none absolute top-[-80px] -left-32 hidden h-72 w-72 rounded-full bg-gradient-to-br from-emerald-400/40 via-sky-400/30 to-violet-500/30 blur-3xl md:block" />
        <div className="relative flex flex-col md:flex-row-reverse">
          {/* טור טופס התחברות */}
          <div className="w-full p-4 sm:p-6 md:w-1/2 md:p-10 lg:p-12">
            <div className="mb-8">
              <Logo
                width={220}
                height={70}
                className="mb-6 h-16 w-auto object-contain sm:h-[4.5rem]"
                forceDark
              />
              <h1 className="mb-2 text-2xl font-semibold text-zinc-50 lg:text-3xl">
                ברוך הבא ל‑SmartShift
              </h1>
              <p className="text-sm text-zinc-400">
                התחבר כדי לעדכן אילוצים ולצפות בשיבוצים שלך.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  אימייל
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-zinc-700/70 bg-zinc-900/60 px-3 py-2.5 text-base text-zinc-50 transition outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 sm:text-sm [&::-ms-input-placeholder]:text-zinc-500"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  סיסמה
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-zinc-700/70 bg-zinc-900/60 px-3 py-2.5 text-base text-zinc-50 transition outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>

              {registered && !error && (
                <p className="text-sm text-emerald-300" role="status">
                  {confirmEmail
                    ? 'ההרשמה הושלמה. נא לאשר את המייל ואז להתחבר.'
                    : 'ההרשמה הושלמה. כעת תוכל להתחבר.'}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-400" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-medium text-emerald-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {loading ? 'מתחבר...' : 'התחברות'}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-zinc-400">
              עדיין אין לך משתמש?{' '}
              <a
                href="/signup"
                className="font-medium text-emerald-300 hover:text-emerald-200"
              >
                להרשמה
              </a>
            </p>
          </div>

          {/* טור צד ויזואלי / טקסטואלי */}
          <div className="hidden w-1/2 flex-col justify-between border-l border-zinc-800/70 bg-gradient-to-br from-zinc-900/80 via-zinc-900/40 to-black/60 p-8 md:flex lg:p-10">
            <div>
              <Logo
                width={180}
                height={56}
                className="mb-6 h-12 w-auto object-contain"
                forceDark
              />
              <p className="text-xs font-semibold tracking-[0.2em] text-emerald-300/80 uppercase">
                מערכת משמרות חכמה
              </p>
              <h2 className="mt-3 text-xl font-semibold text-zinc-50 lg:text-2xl">
                ראות מלאה על הצוות והאילוצים
              </h2>
              <p className="mt-3 text-sm text-zinc-400">
                ניהול קל של אילוצים, שיבוצים ומשמרות – במקום אחד פשוט, שנבנה
                מראש לעבודה חכמה עם AI.
              </p>
            </div>

            <div className="mt-6 space-y-2 text-xs text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-semibold text-emerald-300">
                  1
                </span>
                <span>סימון אילוצים אישיים לפי תאריך ומשמרת.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-semibold text-emerald-300">
                  2
                </span>
                <span>תמונה מלאה למנהל על הזמינות של הצוות.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-semibold text-emerald-300">
                  3
                </span>
                <span>בהמשך: הצעות שיבוץ אוטומטיות בעזרת AI.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black">
          <Logo
            width={200}
            height={64}
            className="h-14 w-auto object-contain"
            forceDark
          />
          <p className="text-sm text-zinc-400">טוען...</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
