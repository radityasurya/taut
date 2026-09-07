import { useState } from 'react';
import { getTheme, setTheme, THEMES } from './app.tsx';

const LABELS: Record<string, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
  latte: 'Catppuccin Latte',
  frappe: 'Catppuccin Frappé',
  macchiato: 'Catppuccin Macchiato',
  mocha: 'Catppuccin Mocha',
};

// ponytail: hosts, push, trusted user in phases 3/5.
export function Settings() {
  const [theme, choose] = useState(getTheme);

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <header className="sticky top-0 z-10 flex min-h-14 items-center gap-1 bg-bg px-1 pt-[env(safe-area-inset-top)]">
        <a href="#/" aria-label="All panes" className="flex size-11 shrink-0 items-center justify-center text-muted">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.5 5-7 7 7 7" />
          </svg>
        </a>
        <h1 className="text-[17px] font-semibold tracking-tight">Settings</h1>
      </header>

      <h2 className="label-caps mt-4 px-4 pb-1">Theme</h2>
      <ul>
        {THEMES.map((t) => (
          <li key={t} className="border-t border-border/60 first:border-0">
            <button
              type="button"
              aria-pressed={theme === t}
              onClick={() => {
                setTheme(t);
                choose(t);
              }}
              className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] active:bg-surface"
            >
              <span className="flex-1">{LABELS[t]}</span>
              {theme === t && (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7" />
                </svg>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
