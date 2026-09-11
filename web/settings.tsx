import { TopBar } from './header.tsx';
import { useEffect, useState } from 'react';
import { getTheme, setTheme, THEMES } from './app.tsx';
import type { Theme } from './app.tsx';
import { InstallHint, Toggle } from './hosts.tsx';
import { disablePush, enablePush, pushOn } from './push.ts';
import type { Settings as HubSettings, SuggestSettingBody } from '../shared/types.ts';

const LABELS: Record<Theme, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
  latte: 'Latte',
  frappe: 'Frappé',
  macchiato: 'Macchiato',
  mocha: 'Mocha',
};

/** Each chip carries its theme's own `--bg` as the swatch. System has no colour of its own. */
const SWATCH: Record<Theme, string | null> = {
  system: null,
  light: '#ffffff',
  dark: '#0e0e11',
  latte: '#eff1f5',
  frappe: '#303446',
  macchiato: '#24273a',
  mocha: '#1e1e2e',
};

const android = /Android/.test(navigator.userAgent);

export function Settings() {
  const [theme, choose] = useState(getTheme);
  const [prefs, setPrefs] = useState<HubSettings>({ suggest: { enabled: false } });
  const [haptics, setHaptics] = useState(() => localStorage.getItem('taut.haptics') !== 'off');
  // Push state is the browser's, not the Hub's: the intent in localStorage plus a live
  // permission. `/api/settings` has no push field to read.
  const [push, setPush] = useState(pushOn);
  const [pushNote, setPushNote] = useState('');
  // Smart replies live in two places: the Hub decides whether to draft at all, this phone
  // decides whether to show the drafts. On means both, and the switch writes both.
  const [smart, setSmart] = useState(() => localStorage.getItem('taut.smart') === 'on');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json() as Promise<HubSettings>)
      .then(setPrefs)
      .catch(() => {});
  }, []);

  const suggest = prefs.suggest ?? { enabled: false };
  const provider = suggest.provider && [suggest.provider, suggest.model].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto max-w-2xl pt-[env(safe-area-inset-top)] pb-28">
      <TopBar title="Settings" />

      <h2 className="label-caps px-4 pt-3.5 pb-2">Theme</h2>
      <div role="group" aria-label="Theme" className="hscroll flex gap-2 px-4 pb-1">
        {THEMES.map((t) => (
          <button
            key={t}
            type="button"
            // The strip is wider than the phone, so the current theme must not start off-screen.
            ref={(el) => {
              if (el && theme === t) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }}
            aria-pressed={theme === t}
            onClick={() => {
              setTheme(t);
              choose(t);
            }}
            className={`flex shrink-0 items-center gap-1.5 rounded-chip px-3 py-1.5 text-caption whitespace-nowrap ${
              theme === t ? 'bg-accent font-semibold text-bg' : 'bg-surface font-medium text-muted'
            }`}
          >
            {SWATCH[t] && (
              <span aria-hidden className="size-2.5 rounded-full border border-border" style={{ background: SWATCH[t]! }} />
            )}
            {LABELS[t]}
          </button>
        ))}
      </div>

      <h2 className="label-caps px-4 pt-6 pb-1">Notifications</h2>
      <Toggle
        label="Push when an agent is blocked"
        hint="Done shows as a badge only"
        checked={push}
        onChange={async (v) => {
          setPushNote('');
          setPush(v);
          if (!v) return void disablePush();
          const result = await enablePush();
          if (result.ok) return;
          setPush(false);
          setPushNote(result.message);
        }}
      />
      {pushNote && (
        <p role="status" className="px-4 pb-2 text-caption leading-relaxed text-muted">
          {pushNote}
        </p>
      )}
      <InstallHint />
      {android && (
        <>
          <div className="ml-4 border-t border-border/60" />
          <Toggle
            label="Haptics"
            hint="A short tap on send and on answering"
            checked={haptics}
            onChange={(v) => {
              setHaptics(v);
              localStorage.setItem('taut.haptics', v ? 'on' : 'off');
            }}
          />
        </>
      )}

      <h2 className="label-caps px-4 pt-6 pb-1">Replies</h2>
      <Toggle
        label="Smart replies"
        hint={provider || 'not configured · set TAUT_SUGGEST on the Hub'}
        checked={Boolean(provider) && suggest.enabled && smart}
        disabled={!provider}
        onChange={(v) => {
          setSmart(v);
          localStorage.setItem('taut.smart', v ? 'on' : 'off');
          setPrefs({ ...prefs, suggest: { ...suggest, enabled: v } });
          void fetch('/api/settings/suggest', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ enabled: v } satisfies SuggestSettingBody),
          }).catch(() => {});
        }}
      />
      {provider && (
        <p className="px-4 pb-2 text-caption leading-relaxed text-muted">
          When an agent blocks, the last lines of its Screen go to the provider, which drafts three replies.
          The key stays on the Hub.
        </p>
      )}

      <h2 className="label-caps px-4 pt-6 pb-1">Access</h2>
      <div className="flex min-h-12 items-center gap-3 px-4 py-2">
        <span className="flex-1 text-body">Trusted login</span>
        <span className="truncate font-mono text-caption text-muted">{prefs.trustedUser || 'not set'}</span>
      </div>
      <div className="ml-4 border-t border-border/60" />
      <div className="flex min-h-12 items-center gap-3 px-4 py-2">
        <span className="flex-1 text-body">Served by</span>
        <span className="truncate font-mono text-caption text-muted">{prefs.servedBy || location.host}</span>
      </div>
    </div>
  );
}
