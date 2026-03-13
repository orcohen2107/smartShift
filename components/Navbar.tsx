'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChartBarIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/20/solid';
import { getSupabaseBrowser } from '@/lib/db/supabaseBrowser';
import { useTheme } from '@/components/ThemeProvider';
import { useProfile } from '@/contexts/ProfileContext';
import { canManage } from '@/lib/utils/enums';

const baseLinks = [
  { href: '/dashboard', label: 'דאשבורד', icon: ChartBarIcon },
  { href: '/constraints', label: 'אילוצים', icon: CalendarDaysIcon },
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
    if (error && error.code !== 'session_not_found') {
      console.error('logout error', error);
    }
    router.replace('/login');
  }, [router]);

  const allLinks = useMemo(() => {
    if (!profile) return baseLinks;
    if (profile.role === 'guest')
      return [{ href: '/dashboard', label: 'דאשבורד', icon: ChartBarIcon }];
    if (canManage(profile.role)) {
      return [
        ...baseLinks,
        {
          href: '/assignments',
          label: 'שיבוצים',
          icon: ClipboardDocumentListIcon,
        },
        { href: '/settings', label: 'הגדרות', icon: Cog6ToothIcon },
      ];
    }
    return baseLinks;
  }, [profile]);

  const linkClass = useCallback(
    (href: string) => {
      const active = pathname === href;
      return `flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-emerald-950'
          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50'
      }`;
    },
    [pathname]
  );

  const NavLink = ({ link }: { link: (typeof allLinks)[0] }) => {
    const Icon = link.icon;
    return (
      <Link href={link.href} className={linkClass(link.href)}>
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
        <span>{link.label}</span>
      </Link>
    );
  };

  return (
    <header className="border-b border-zinc-200/80 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-6">
          <span className="shrink-0 text-base font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
            SmartShift
          </span>
          <nav className="hidden items-center gap-1 md:flex">
            {allLinks.map((link) => (
              <NavLink key={link.href} link={link} />
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {profile?.full_name && (
            <span className="hidden max-w-[120px] truncate text-xs font-medium text-zinc-300 sm:inline dark:text-zinc-400">
              שלום, {profile.full_name}
            </span>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            title={theme === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
          >
            {theme === 'dark' ? (
              <SunIcon className="h-4 w-4" aria-hidden />
            ) : (
              <MoonIcon className="h-4 w-4" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="hidden min-h-[36px] items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 sm:flex dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" aria-hidden />
            יציאה
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 md:hidden dark:border-zinc-700"
            aria-label={mobileMenuOpen ? 'סגור תפריט' : 'פתח תפריט'}
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="h-5 w-5" aria-hidden />
            ) : (
              <Bars3Icon className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden
        />
      )}
      <div
        className={`fixed top-0 right-0 z-50 max-h-[100dvh] w-[min(280px,85vw)] overflow-y-auto border-l border-zinc-200 bg-white shadow-xl transition-transform duration-200 md:hidden dark:border-zinc-800 dark:bg-zinc-950 ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ insetBlock: 0 }}
      >
        <div className="flex flex-col gap-1 p-4 pt-14">
          {profile?.full_name && (
            <p className="mb-2 px-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              שלום, {profile.full_name}
            </p>
          )}
          {allLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={linkClass(link.href)}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
                <span>{link.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              void handleLogout();
            }}
            className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" aria-hidden />
            יציאה
          </button>
        </div>
      </div>
    </header>
  );
}
