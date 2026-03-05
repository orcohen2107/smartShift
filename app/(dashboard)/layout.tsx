"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/db/supabaseBrowser";
import { Navbar } from "@/components/Navbar";
import { AssignmentsProvider } from "@/contexts/AssignmentsContext";
import { ConstraintsProvider } from "@/contexts/ConstraintsContext";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabaseBrowser();
        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          router.replace("/login");
          return;
        }
        setChecking(false);
      } catch {
        router.replace("/login");
      }
    };

    void run();
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        טוען...
      </div>
    );
  }

  return (
    <AssignmentsProvider>
      <ConstraintsProvider>
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
          <Navbar />
          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </div>
      </ConstraintsProvider>
    </AssignmentsProvider>
  );
}

