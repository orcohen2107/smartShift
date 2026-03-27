'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { getSupabaseBrowser } from '@/lib/db/supabaseBrowser';
import { Navbar } from '@/components/Navbar';
import { AssignmentsProvider } from '@/features/assignments/contexts/AssignmentsContext';
import { ConstraintsProvider } from '@/features/constraints/contexts/ConstraintsContext';
import { ProfileProvider, useProfile } from '@/features/profile/contexts/ProfileContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function GuestRedirect({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const profile = useProfile();

  useEffect(() => {
    if (profile?.role === 'guest' && pathname !== '/dashboard') {
      router.replace('/dashboard');
    }
  }, [profile?.role, pathname, router]);

  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabaseBrowser();
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
          router.replace('/login');
          return;
        }
        setChecking(false);
      } catch (err) {
        console.error('[DashboardLayout] auth check failed', err);
        router.replace('/login');
      }
    };

    void run();
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-100 dark:bg-zinc-950">
        <Logo width={200} height={64} className="h-14 w-auto object-contain" />
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            טוען...
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProfileProvider>
      <AssignmentsProvider>
        <ConstraintsProvider>
          <div className="min-h-screen overflow-x-hidden bg-zinc-100 dark:bg-gradient-to-b dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/50">
            <Navbar />
            <GuestRedirect>
              <main className="mx-auto max-w-5xl min-w-0 px-3 py-3 sm:px-4 sm:py-4">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </GuestRedirect>
          </div>
        </ConstraintsProvider>
      </AssignmentsProvider>
    </ProfileProvider>
  );
}
