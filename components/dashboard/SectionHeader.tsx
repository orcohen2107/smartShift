'use client';

import type { ReactNode } from 'react';

type SectionHeaderProps = {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
};

export function SectionHeader({ icon, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-0">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        {icon && (
          <span className="text-zinc-500 dark:text-zinc-400" aria-hidden>
            {icon}
          </span>
        )}
        {title}
      </h2>
      {subtitle && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}
