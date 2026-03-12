'use client';

import React from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';

export type DropdownItem = {
  value: string;
  label: React.ReactNode;
  /** אם מוגדר – הפריט הוא קישור */
  href?: string;
  /** אם מוגדר – נקרא בלחיצה (גם עם href) */
  onClick?: () => void;
  disabled?: boolean;
};

type DropdownProps = {
  /** רשימת פריטים */
  items: DropdownItem[];
  /** ערך נבחר (לבחירה אחת) – מציג את ה-label של הפריט על הכפתור */
  value?: string | null;
  /** נקרא כשנבחר פריט (value שלו) */
  onSelect?: (value: string) => void;
  /** טקסט כפתור כשאין בחירה (למשל "כל הלוחות") */
  placeholder?: string;
  /** טקסט/תוכן כפתור מותאם – אם מועבר, מתעלמים מ-value/placeholder */
  triggerLabel?: React.ReactNode;
  /** כיוון פתיחת הפאנל */
  align?: 'left' | 'right';
  /** מושבת את הכפתור */
  disabled?: boolean;
  /** מחלקות לכפתור */
  buttonClassName?: string;
  /** מחלקות לפאנל */
  panelClassName?: string;
  /** מחלקות ל-wrapper */
  className?: string;
};

export default function Dropdown({
  items,
  value,
  onSelect,
  placeholder = 'בחר…',
  triggerLabel,
  align = 'right',
  disabled = false,
  buttonClassName,
  panelClassName,
  className,
}: DropdownProps) {
  const selectedItem =
    value != null ? items.find((i) => i.value === value) : null;
  const displayLabel =
    triggerLabel !== undefined
      ? triggerLabel
      : selectedItem
        ? selectedItem.label
        : placeholder;

  const defaultButtonClass =
    'inline-flex w-full min-h-[44px] items-center justify-between gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50 dark:hover:bg-zinc-800';

  const handleSelect = (item: DropdownItem) => {
    if (item.disabled) return;
    item.onClick?.();
    onSelect?.(item.value);
  };

  return (
    <Menu as="div" className={`relative block w-full ${className ?? ''}`}>
      <MenuButton
        disabled={disabled}
        className={buttonClassName ?? defaultButtonClass}
      >
        <span className="min-w-0 truncate">{displayLabel}</span>
        <ChevronDownIcon
          aria-hidden
          className="h-4 w-4 shrink-0 text-zinc-400"
        />
      </MenuButton>

      <MenuItems
        className={`absolute z-30 mt-1 w-full origin-top rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${panelClassName ?? ''}`}
        style={{ maxHeight: '16rem', overflowY: 'auto' }}
      >
        <div className="py-1">
          {items.map((item) => {
            const isSelected = value === item.value;
            const itemClass =
              'flex w-full min-w-0 items-center rounded-lg px-3 py-1.5 text-left text-sm whitespace-nowrap overflow-hidden text-ellipsis data-[focus]:outline-none data-[focus]:ring-2 data-[focus]:ring-emerald-400/40 ' +
              (item.disabled
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer text-zinc-700 data-[focus]:bg-zinc-100 dark:text-zinc-300 dark:data-[focus]:bg-zinc-800') +
              (isSelected
                ? ' bg-emerald-50 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
                : '');

            const content = (
              <span className="min-w-0 truncate">{item.label}</span>
            );

            if (item.href != null && !item.disabled) {
              return (
                <MenuItem key={item.value} disabled={item.disabled}>
                  <a
                    href={item.href}
                    title={
                      typeof item.label === 'string' ? item.label : undefined
                    }
                    className={itemClass}
                    onClick={(e) => {
                      handleSelect(item);
                      if (item.href?.startsWith('#')) e.preventDefault();
                    }}
                  >
                    {content}
                  </a>
                </MenuItem>
              );
            }

            return (
              <MenuItem key={item.value} disabled={item.disabled}>
                <button
                  type="button"
                  title={
                    typeof item.label === 'string' ? item.label : undefined
                  }
                  className={`w-full ${itemClass}`}
                  onClick={() => handleSelect(item)}
                >
                  {content}
                </button>
              </MenuItem>
            );
          })}
        </div>
      </MenuItems>
    </Menu>
  );
}
