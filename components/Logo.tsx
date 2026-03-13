'use client';

import Image from 'next/image';
import { useTheme } from '@/components/ThemeProvider';

type LogoProps = {
  className?: string;
  width?: number;
  height?: number;
  /** כשמוגדר, מתעלם מ-theme ומשתמש בגרסה זו (למשל דפי login/signup תמיד dark) */
  forceDark?: boolean;
};

export function Logo({
  className = '',
  width = 180,
  height = 56,
  forceDark = false,
}: LogoProps) {
  const { theme } = useTheme();
  const isDark = forceDark || theme === 'dark';
  const src = isDark ? '/new_logo_dark.png' : '/new_logo.png';

  return (
    <Image
      src={src}
      alt="SmartShift"
      width={width}
      height={height}
      className={`bg-transparent ${className}`.trim()}
      priority
    />
  );
}
