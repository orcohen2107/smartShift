"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/db/supabaseBrowser";

const links = [
  { href: "/constraints", label: "Constraints" },
  { href: "/assignments", label: "Assignments" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
            smartshift
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
                      ? "bg-zinc-900 text-zinc-50"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-md border px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

