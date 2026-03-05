"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/db/supabaseBrowser";
import { apiFetch } from "@/lib/api/apiFetch";
import { useTheme } from "@/components/ThemeProvider";
import type { Profile } from "@/lib/utils/interfaces";

const links = [
  { href: "/dashboard", label: "דשבורד" },
  { href: "/constraints", label: "אילוצים" },
  { href: "/assignments", label: "שיבוצים" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    apiFetch<{ profile: Profile }>("/api/profile/me")
      .then((data) => setProfile(data.profile))
      .catch(() => setProfile(null));
  }, []);

  async function handleLogout() {
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signOut();
    if (error && error.code !== "session_not_found") {
      console.error("logout error", error);
    }
    router.replace("/login");
  }

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold tracking-wide text-zinc-700 dark:text-zinc-300">
            SmartShift
          </span>
          <nav className="flex items-center gap-2 text-sm">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 transition ${
                    active
                      ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {profile?.full_name && (
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              שלום, {profile.full_name}
            </span>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title={theme === "dark" ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            onClick={handleLogout}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            יציאה
          </button>
        </div>
      </div>
    </header>
  );
}
