'use client';

export const THEME_KEY = 'smartshift-theme';

export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){var k='${THEME_KEY}';var t=localStorage.getItem(k);if(t==='light'){document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');}})();`,
      }}
    />
  );
}
