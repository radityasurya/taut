import { useEffect, useState } from 'react';
import type { ScreenEvent, ScreenMode, State } from '../shared/types.ts';
import { Home } from './home.tsx';
import { PaneScreen } from './pane.tsx';
import { Settings } from './settings.tsx';

// ---- theme ----

export const THEMES = ['system', 'light', 'dark', 'latte', 'frappe', 'macchiato', 'mocha'] as const;
export type Theme = (typeof THEMES)[number];

const dark = matchMedia('(prefers-color-scheme: dark)');

export function getTheme(): Theme {
  const t = localStorage.getItem('taut.theme') as Theme | null;
  return t && THEMES.includes(t) ? t : 'system';
}

export function setTheme(theme: Theme) {
  localStorage.setItem('taut.theme', theme);
  applyTheme(theme);
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme === 'system' ? (dark.matches ? 'dark' : 'light') : theme;
}

applyTheme(getTheme());
dark.addEventListener('change', () => applyTheme(getTheme()));

// ---- events ----

/** One EventSource for the whole app. It reopens when the watched Pane or mode changes. */
export function useEvents(paneKey?: string, mode?: ScreenMode) {
  const [state, setState] = useState<State | null>(null);
  const [screen, setScreen] = useState<ScreenEvent | null>(null);
  const [connected, setConnected] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => setScreen(null), [paneKey, mode]);

  useEffect(() => {
    const url = paneKey
      ? `/api/events?pane=${encodeURIComponent(paneKey)}&mode=${mode ?? 'visible'}`
      : '/api/events';
    const es = new EventSource(url);
    let retry: ReturnType<typeof setTimeout>;
    const on = <T,>(name: string, set: (v: T) => void) =>
      es.addEventListener(name, (e) => {
        setConnected(true);
        set(JSON.parse((e as MessageEvent<string>).data) as T);
      });
    on<State>('state', setState);
    on<ScreenEvent>('screen', setScreen);
    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      // The browser only retries a dropped stream. An HTTP error (Hub restarting) closes
      // the EventSource for good, so reopen it ourselves.
      if (es.readyState === EventSource.CLOSED) retry = setTimeout(() => setAttempt((a) => a + 1), 2000);
    };
    return () => {
      clearTimeout(retry);
      es.close();
    };
  }, [paneKey, mode, attempt]);

  return { state, screen, connected };
}

// ---- router ----

function useRoute() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || '/');
  useEffect(() => {
    const on = () => setRoute(location.hash.slice(1) || '/');
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function App() {
  const route = useRoute();
  const paneKey = route.startsWith('/pane/') ? decodeURIComponent(route.slice('/pane/'.length)) : undefined;
  const [mode, setMode] = useState<ScreenMode>('visible');
  useEffect(() => setMode('visible'), [paneKey]);

  const { state, screen, connected } = useEvents(paneKey, paneKey ? mode : undefined);

  return (
    <>
      {!connected && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-warn"
          title="Reconnecting"
        >
          <span className="sr-only">Reconnecting</span>
        </div>
      )}
      {paneKey ? (
        <PaneScreen paneKey={paneKey} state={state} screen={screen} mode={mode} onMode={setMode} />
      ) : route === '/settings' ? (
        <Settings />
      ) : (
        <Home state={state} />
      )}
    </>
  );
}

/** POST helper. The browser sets Origin for us, which is what the Hub checks. */
export function post(paneKey: string, path: 'input' | 'seen', body: unknown) {
  return fetch(`/api/panes/${encodeURIComponent(paneKey)}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {}); // ponytail: the SSE reconnect indicator is the only error surface in phase 1
}
