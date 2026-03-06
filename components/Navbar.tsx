"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/db/supabaseBrowser";
import { useTheme } from "@/components/ThemeProvider";
import { useProfile } from "@/contexts/ProfileContext";
import { Role } from "@/lib/utils/enums";

const baseLinks = [
  { href: "/dashboard", label: "דשבורד" },
  { href: "/constraints", label: "אילוצים" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const profile = useProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signOut();
    if (error && error.code !== "session_not_found") {
      console.error("logout error", error);
    }
    router.replace("/login");
  }, [router]);

  const managerLinks = useMemo(
    () =>
      profile?.role === Role.Manager
        ? [
            { href: "/assignments", label: "שיבוצים" },
            { href: "/settings", label: "הגדרות" },
          ]
        : [],
    [profile?.role],
  );

  const allLinks = useMemo(
    () => [...baseLinks, ...managerLinks],
    [managerLinks],
  );

  const linkClass = useCallback(
    (href: string) => {
      const active = pathname === href;
      return `block rounded-md px-3 py-2.5 text-sm transition min-h-[44px] flex items-center ${
        active
          ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`;
    },
    [pathname],
  );

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
          <span className="shrink-0 text-sm font-semibold tracking-wide text-zinc-700 dark:text-zinc-300">
            SmartShift
          </span>
          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {allLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={linkClass(link.href)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {profile?.full_name && (
            <span className="hidden truncate text-xs text-zinc-600 dark:text-zinc-400 sm:inline max-w-[120px]">
              שלום, {profile.full_name}
            </span>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title={theme === "dark" ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="hidden rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:block min-h-[36px]"
          >
            יציאה
          </button>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 md:hidden"
            aria-label={mobileMenuOpen ? "סגור תפריט" : "פתח תפריט"}
          >
            {mobileMenuOpen ? (
              <span className="text-lg">✕</span>
            ) : (
              <span className="text-lg">☰</span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden
        />
      )}
      <div
        className={`fixed top-0 right-0 z-50 w-[min(280px,85vw)] max-h-[100dvh] overflow-y-auto border-r border-zinc-200 bg-white shadow-xl transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-950 md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ insetBlock: 0 }}
      >
        <div className="flex flex-col gap-1 p-4 pt-14">
          {profile?.full_name && (
            <p className="mb-2 px-3 text-xs text-zinc-500 dark:text-zinc-400">
              שלום, {profile.full_name}
            </p>
          )}
          {allLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={linkClass(link.href)}
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              void handleLogout();
            }}
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-right text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 min-h-[44px]"
          >
            יציאה
          </button>
        </div>
      </div>
    </header>
  );
}
