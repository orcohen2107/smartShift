'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/db/supabaseBrowser';
import { Navbar } from '@/components/Navbar';
import { AssignmentsProvider } from '@/contexts/AssignmentsContext';
import { ConstraintsProvider } from '@/contexts/ConstraintsContext';
import { ProfileProvider, useProfile } from '@/contexts/ProfileContext';

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
        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          router.replace('/login');
          return;
        }
        setChecking(false);
      } catch {
        router.replace('/login');
      }
    };

    void run();
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
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
          <div className="min-h-screen overflow-x-hidden bg-zinc-100 dark:bg-zinc-950">
            <Navbar />
            <GuestRedirect>
              <main className="mx-auto max-w-5xl min-w-0 px-3 py-4 sm:px-4 sm:py-6">
                {children}
              </main>
            </GuestRedirect>
          </div>
        </ConstraintsProvider>
      </AssignmentsProvider>
    </ProfileProvider>
  );
}
