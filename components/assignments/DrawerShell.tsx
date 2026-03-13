'use client';

import { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';

type DrawerShellProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

export function DrawerShell({
  isOpen,
  onClose,
  title,
  children,
}: DrawerShellProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const frame = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200"
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className={`fixed inset-y-0 start-0 z-50 w-full max-w-sm overflow-y-auto border-s border-zinc-200/80 bg-white shadow-2xl transition-transform duration-200 ease-out dark:border-zinc-800/80 dark:bg-zinc-900 ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95">
          <h2
            id="drawer-title"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="סגור"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </aside>
    </>
  );
}
