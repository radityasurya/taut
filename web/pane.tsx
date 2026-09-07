import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { parseAnsi } from '../shared/ansi.ts';
import type { InputBody, ScreenEvent, ScreenMode, SeenBody, Span, State } from '../shared/types.ts';
import { post } from './app.tsx';
import { Dot } from './home.tsx';

/** herdr key names, with the label shown on the button. */
const KEYS: [name: string, label: string][] = [
  ['esc', 'esc'],
  ['tab', 'tab'],
  ['shift+tab', 'shift+tab'],
  ['up', '↑'],
  ['down', '↓'],
  ['left', '←'],
  ['right', '→'],
  ['enter', 'enter'],
  ['ctrl+c', 'ctrl+c'],
];

const color = (c: number | string | undefined) => (typeof c === 'number' ? `var(--ansi-${c})` : c);

function spanStyle(s: Span): CSSProperties {
  let fg = color(s.fg);
  let bg = color(s.bg);
  if (s.inverse) [fg, bg] = [bg ?? 'var(--bg)', fg ?? 'var(--fg)'];
  const lines = [s.underline && 'underline', s.strike && 'line-through'].filter(Boolean).join(' ');
  return {
    color: fg,
    background: bg,
    fontWeight: s.bold ? 600 : undefined,
    opacity: s.dim ? 0.6 : undefined,
    fontStyle: s.italic ? 'italic' : undefined,
    textDecoration: lines || undefined,
  };
}

export function PaneScreen({
  paneKey,
  state,
  screen,
  mode,
  onMode,
}: {
  paneKey: string;
  state: State | null;
  screen: ScreenEvent | null;
  mode: ScreenMode;
  onMode: (m: ScreenMode) => void;
}) {
  const pane = state?.panes.find((p) => p.key === paneKey);
  const lines = useMemo(() => (screen ? parseAnsi(screen.text) : []), [screen]);

  // Keep the view pinned to the bottom unless the user scrolled up.
  const box = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useEffect(() => {
    const el = box.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Mark Seen once the screen settles.
  useEffect(() => {
    if (!screen) return;
    const t = setTimeout(() => void post(paneKey, 'seen', { revision: screen.revision } satisfies SeenBody), 1000);
    return () => clearTimeout(t);
  }, [paneKey, screen?.revision]);

  const [text, setText] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`; // 4 rows at line-height 20 plus padding
  }, [text]);

  const send = () => {
    if (!text.trim()) return;
    void post(paneKey, 'input', { text, keys: ['enter'] } satisfies InputBody);
    setText('');
    input.current?.focus();
  };

  if (state && !pane) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-3 px-4 pt-[calc(env(safe-area-inset-top)+4rem)]">
        <p className="text-[15px]">Pane closed</p>
        <a href="#/" className="text-[15px] text-accent">
          ‹ All panes
        </a>
      </div>
    );
  }

  const wrap = (screen?.mode ?? mode) === 'recent';

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col">
      <header className="flex min-h-14 items-center gap-1 border-b border-border/60 bg-bg px-1 pt-[env(safe-area-inset-top)]">
        <a href="#/" aria-label="All panes" className="flex size-11 shrink-0 items-center justify-center text-muted">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.5 5-7 7 7 7" />
          </svg>
        </a>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium">{pane?.title ?? '…'}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            {pane && <Dot status={pane.status} />}
            <span aria-hidden>{pane?.status}</span>
          </div>
        </div>
        <div role="group" aria-label="Screen mode" className="mr-1 flex shrink-0 gap-0.5 rounded-full bg-surface p-0.5">
          {(['visible', 'recent'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => onMode(m)}
              className={`rounded-full px-2.5 py-1.5 text-xs ${mode === m ? 'bg-bg font-medium text-fg' : 'text-muted'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      <div
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="flex-1 overflow-auto px-3 py-2"
      >
        <pre
          className={`w-max min-w-full font-mono text-[12px] leading-[1.35] ${wrap ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}
        >
          {lines.map((spans, i) => (
            <Fragment key={i}>
              {spans.map((s, j) => (
                <span key={j} style={spanStyle(s)}>
                  {s.text}
                </span>
              ))}
              {'\n'}
            </Fragment>
          ))}
        </pre>
      </div>

      <div className="border-t border-border/60 bg-bg pb-[env(safe-area-inset-bottom)]">
        <div className="flex gap-1.5 overflow-x-auto px-3 pt-2" style={{ scrollbarWidth: 'none' }}>
          {KEYS.map(([name, label]) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              onClick={() => void post(paneKey, 'input', { keys: [name] } satisfies InputBody)}
              className="h-11 shrink-0 rounded-full bg-surface px-3.5 font-mono text-[13px] text-fg/80 active:bg-border"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2 px-3 py-2">
          <textarea
            ref={input}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            enterKeyHint="send"
            aria-label="Message"
            placeholder="Reply…"
            className="max-h-24 min-h-11 flex-1 resize-none rounded-2xl bg-surface px-3 py-2.5 text-[15px] leading-5 placeholder:text-muted"
          />
          <button
            type="button"
            onClick={send}
            disabled={!text.trim()}
            aria-label="Send"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-bg disabled:opacity-35"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0-6 6m6-6 6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
