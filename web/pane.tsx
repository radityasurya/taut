import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { parseAnsi } from '../shared/ansi.ts';
import type { Explain, InputBody, ScreenEvent, SeenBody, Span, State, StatePane, Status } from '../shared/types.ts';
import { haptic, navigate, opensWith, post } from './app.tsx';
import { Blocked } from './blocked.tsx';
import { Dot, markSeen, statusText } from './home.tsx';
import { Attach, Back, Down, Mic, More, Plus, Send, Speaker, Switch2 } from './icons.tsx';
import { ConfirmCloseSheet, MenuSheet, NewTabSheet, RenameSheet } from './sheets.tsx';
import { SwitchDrawer } from './switch.tsx';
import { AGENT_KEYS, SHELL_KEYS } from './keys.ts';

const color = (c: number | string | undefined) => (typeof c === 'number' ? `var(--ansi-${c})` : c);

/** The one ANSI-span style function. blocked.tsx renders the detection with it too. */
export function spanStyle(s: Span): CSSProperties {
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

/** Styled ANSI text. Shared by the grid and the blocked card's detection excerpt. */
export function Ansi({ text }: { text: string }) {
  return (
    <>
      {parseAnsi(text).map((spans, i) => (
        <Fragment key={i}>
          {spans.map((s, j) => (
            <span key={j} style={spanStyle(s)}>
              {s.text}
            </span>
          ))}
          {'\n'}
        </Fragment>
      ))}
    </>
  );
}

const ROLL: Status[] = ['blocked', 'working', 'done', 'idle', 'unknown'];
const rollUp = (panes: StatePane[]): Status => ROLL.find((s) => panes.some((p) => p.status === s)) ?? 'unknown';

/** The Pane a Tab reopens to, so switching back lands where you left. */
const lastPane = new Map<string, string>();

const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, '');

/** "Wider than the viewport" is a fade, not a scrollbar. */
const FADE = 'linear-gradient(to right,#000 calc(100% - 24px),transparent)';

/** The last block the agent printed, for read-aloud. */
function lastBlock(text?: string): string {
  if (!text) return '';
  const blocks = plain(text)
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks.at(-1) ?? '';
}

interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

export function PaneScreen({ paneKey, state, screen }: { paneKey: string; state: State | null; screen: ScreenEvent | null }) {
  const pane = state?.panes.find((p) => p.key === paneKey);
  const ws = state?.workspaces.find((w) => w.muxKey === pane?.muxKey && w.id === pane?.workspaceId);
  const host = state?.hosts.find((h) => h.id === state.muxes.find((m) => m.key === pane?.muxKey)?.hostId);
  const lines = useMemo(() => (screen ? parseAnsi(screen.text) : []), [screen]);

  const [wrap, setWrap] = useState(false);
  // Fit is on unless the user turned it off: the scale is min(1, …), so a grid that already
  // fits is left alone and a wide one never scrolls sideways.
  const [fit, setFitState] = useState(() => localStorage.getItem('taut.fit') !== 'off');
  const setFit = (v: boolean) => { localStorage.setItem('taut.fit', v ? 'on' : 'off'); setFitState(v); };
  const [scale, setScale] = useState(1);
  const [fade, setFade] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [explain, setExplain] = useState<Explain | null>(null);
  const [showSwitch, setShowSwitch] = useState(() => opensWith('switch'));
  const [showMore, setShowMore] = useState(() => opensWith('more'));
  const [showNewTab, setShowNewTab] = useState(() => opensWith('newtab'));
  const [rename, setRename] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  // Keep the view pinned to the bottom unless the user scrolled up.
  const box = useRef<HTMLDivElement>(null);
  const pre = useRef<HTMLPreElement>(null);
  const pinned = useRef(true);

  const measure = () => {
    const el = box.current;
    if (!el) return;
    setFade(el.scrollWidth > el.clientWidth + 1 && el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = box.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
    else if (lines.length) setFresh(true);
    measure();
  }, [lines]);

  // Window width feeds the Fit scale, so a rotation or a desktop resize re-fits the grid.
  const [viewportW, setViewportW] = useState(() => innerWidth);
  useEffect(() => {
    const onResize = () => { setViewportW(innerWidth); measure(); };
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const el = pre.current;
    if (!el || !el.parentElement) return setScale(1);
    // The scroller carries the grid's left padding, so the room the `<pre>` actually has is
    // narrower than the scroller. Measuring against `clientWidth` alone left Fit on and the
    // last column still cut off.
    const room = el.parentElement.clientWidth - parseFloat(getComputedStyle(el.parentElement).paddingLeft || '0');
    setScale(fit ? Math.min(1, room / el.scrollWidth) : 1);
    measure();
  }, [fit, wrap, lines, viewportW]);

  // Mark Seen once the screen settles: Seen is taut's own flag, never written to the Mux.
  useEffect(() => {
    if (!screen) return;
    markSeen(paneKey, screen.revision);
    const t = setTimeout(() => void post(paneKey, 'seen', { revision: screen.revision } satisfies SeenBody), 1000);
    return () => clearTimeout(t);
  }, [paneKey, screen?.revision]);

  useEffect(() => {
    if (pane) lastPane.set(`${pane.muxKey}/${pane.tabId}`, pane.key);
  }, [pane?.key]);

  // The blocked card outlives the status by 150 ms, so it fades instead of vanishing.
  useEffect(() => {
    if (pane?.status === 'blocked') {
      fetch(`/api/panes/${encodeURIComponent(paneKey)}/explain`)
        .then((r) => r.json() as Promise<Explain | null>)
        .then(setExplain)
        .catch(() => {});
      return;
    }
    if (!explain) return;
    const t = setTimeout(() => setExplain(null), 150);
    return () => clearTimeout(t);
  }, [paneKey, pane?.status, pane?.revision]);

  const tabs = useMemo(() => {
    if (!state || !pane) return [];
    const mine = state.panes.filter((p) => p.muxKey === pane.muxKey && p.workspaceId === pane.workspaceId);
    const listed = state.tabs.filter((t) => t.muxKey === pane.muxKey && t.workspaceId === pane.workspaceId);
    const ids = listed.length ? listed.map((t) => [t.id, t.label] as const) : [...new Set(mine.map((p) => p.tabId))].map((id) => [id, ''] as const);
    return ids.map(([id, label]) => {
      const panes = mine.filter((p) => p.tabId === id);
      return { id, label: label || panes[0]?.title || id, panes, status: rollUp(panes) };
    });
  }, [state, pane?.muxKey, pane?.workspaceId]);

  // One underline that slides, rather than a border that jumps: measured from the selected
  // tab, so a relabelled or newly created Tab moves it without a second source of truth.
  const strip = useRef<HTMLDivElement>(null);
  const [underline, setUnderline] = useState({ x: 0, w: 0 });
  useLayoutEffect(() => {
    const on = strip.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    setUnderline(on ? { x: on.offsetLeft, w: on.offsetWidth } : { x: 0, w: 0 });
  }, [tabs, pane?.tabId, viewportW]);

  const openTab = (id: string) => {
    const tab = tabs.find((t) => t.id === id);
    const next = lastPane.get(`${pane?.muxKey}/${id}`) ?? tab?.panes[0]?.key;
    if (!next || next === paneKey) return;
    haptic();
    navigate(`#/pane/${encodeURIComponent(next)}`);
  };

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
    haptic();
    void post(paneKey, 'input', { text, keys: ['enter'] } satisfies InputBody);
    setText('');
    input.current?.focus();
  };

  const keys = (names: string[]) => {
    haptic();
    void post(paneKey, 'input', { keys: names } satisfies InputBody);
  };

  const speak = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (synth.speaking) return synth.cancel();
    synth.speak(new SpeechSynthesisUtterance(lastBlock(screen?.text)));
  };

  // Touch, not pointer: the moment a horizontal drag starts, Chromium hands the gesture to
  // the nearest scroller and fires `pointercancel`, so `pointerup` never arrives on a phone.
  // `touchend` always does. The strip's own scroll position guards the ambiguous case —
  // with more Tabs than fit, dragging scrolls the strip and must not also switch Tab.
  const swipe = useRef({ x: 0, scroll: 0 });
  const rec = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const dictate = () => {
    if (rec.current) {
      rec.current.stop();
      return;
    }
    const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = false;
    r.interimResults = false;
    // Dictation lands in the field for review; it never sends. See docs/DECISIONS.md.
    r.onresult = (e) => setText((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}${e.results[0]?.[0]?.transcript ?? ''}`);
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    rec.current = r;
    setListening(true);
    r.start();
  };

  if (state && !pane) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-3 px-4 pt-[calc(env(safe-area-inset-top)+4rem)] lg:max-w-4xl">
        <p className="text-body">Pane closed</p>
        <a href="#/" className="text-body text-accent">
          ‹ All panes
        </a>
      </div>
    );
  }

  const agent = pane?.agent;
  const status = pane?.status ?? 'unknown';
  // No engine, no button: Send stays in place, disabled, rather than a mic that does nothing.
  const canDictate = 'webkitSpeechRecognition' in window;
  const active = tabs.find((t) => t.id === pane?.tabId);
  const grid = pane?.cols && pane.rows ? `${pane.cols}×${pane.rows}` : 'fit';

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col pt-[env(safe-area-inset-top)] lg:max-w-4xl">
      <header className="flex h-11 shrink-0 items-center gap-1 pr-2 pl-1">
        <a href="#/" aria-label="All panes" className="flex size-11 shrink-0 items-center justify-center text-accent">
          <Back />
        </a>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-title tracking-tight">{pane?.title ?? '…'}</h1>
          <button
            type="button"
            onClick={() => setShowSwitch(true)}
            aria-label="Switch Pane"
            className="flex min-w-0 items-center gap-1.5 text-caption text-muted"
          >
            <Dot status={status} />
            <span aria-live="polite" className={statusText[status]}>
              {status}
            </span>
            <span className="truncate">
              · {agent ?? 'shell'} · {ws?.label}
            </span>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden className="shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          aria-label="Switch Pane"
          onClick={() => setShowSwitch(true)}
          className="flex h-11 w-10 shrink-0 items-center justify-center text-muted"
        >
          <Switch2 />
        </button>
        {agent && (
          <button
            type="button"
            aria-label="Read aloud"
            onClick={speak}
            className="flex h-11 w-10 shrink-0 items-center justify-center text-muted"
          >
            <Speaker />
          </button>
        )}
        <button
          type="button"
          aria-label="More"
          onClick={() => setShowMore(true)}
          className="flex h-11 w-10 shrink-0 items-center justify-center text-muted"
        >
          <More />
        </button>
      </header>

      {/* Tab strip, browser-tab position. Swipe here, never on the grid. */}
      <div
        className="flex shrink-0 items-center pt-0.5 pr-3 pb-2 pl-2"
        onTouchStart={(e) => {
          swipe.current = { x: e.touches[0]?.clientX ?? 0, scroll: strip.current?.scrollLeft ?? 0 };
        }}
        onTouchEnd={(e) => {
          const dx = (e.changedTouches[0]?.clientX ?? 0) - swipe.current.x;
          const scrolled = Math.abs((strip.current?.scrollLeft ?? 0) - swipe.current.scroll) > 4;
          if (scrolled || Math.abs(dx) < 40 || !active) return;
          const i = tabs.indexOf(active) + (dx < 0 ? 1 : -1);
          if (tabs[i]) openTab(tabs[i].id);
        }}
      >
        <div ref={strip} role="tablist" aria-label="Tabs" className="hscroll relative mx-1 flex flex-1 items-end gap-0.5 border-b border-border">
          {tabs.map((t) => {
            const on = t.id === pane?.tabId;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => openTab(t.id)}
                className={`press flex shrink-0 items-center gap-1.5 px-2.5 pt-2 pb-3 text-[13px] whitespace-nowrap ${
                  on ? 'font-semibold text-fg' : 'font-medium text-muted'
                }`}
              >
                <Dot status={t.status} seen={t.status === 'idle' || t.status === 'unknown'} size={6} />
                {t.label}
                {t.panes.length > 1 && <span className="ml-0.5 font-mono text-[10px] text-muted">{t.panes.length}</span>}
              </button>
            );
          })}
          <span
            aria-hidden
            data-testid="tab-underline"
            className="absolute bottom-[-1px] left-0 h-0.5 bg-accent transition-[transform,width] duration-200 ease-out motion-reduce:transition-none"
            style={{ width: underline.w, transform: `translateX(${underline.x}px)` }}
          />
        </div>
        <button
          type="button"
          aria-label="New Tab"
          onClick={() => setShowNewTab(true)}
          className="mr-1.5 flex size-9 shrink-0 items-center justify-center text-accent"
        >
          <Plus />
        </button>
        <button
          type="button"
          aria-pressed={fit}
          onClick={() => setFit(!fit)}
          className={`press shrink-0 rounded-chip border px-2.5 py-[5px] font-mono text-[11px] ${
            fit ? 'border-accent bg-accent font-semibold text-bg' : 'border-border text-muted'
          }`}
        >
          {grid}
          {fit && ' · fit'}
        </button>
      </div>

      {active && active.panes.length > 1 && (
        <div role="group" aria-label="Panes in this Tab" className="hscroll flex shrink-0 gap-1.5 px-3 pb-2">
          {active.panes.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-current={p.key === paneKey ? 'true' : undefined}
              onClick={() => {
                haptic();
                navigate(`#/pane/${encodeURIComponent(p.key)}`);
              }}
              className={`press flex shrink-0 items-center gap-1.5 rounded-chip px-2.5 py-1 text-[12px] ${
                p.key === paneKey ? 'bg-surface font-medium text-fg' : 'text-muted'
              }`}
            >
              <Dot status={p.status} size={6} seen={p.key !== paneKey} />
              {p.agent ?? 'shell'}
            </button>
          ))}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          ref={box}
          onScroll={(e) => {
            const el = e.currentTarget;
            pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            if (pinned.current) setFresh(false);
            measure();
          }}
          className="h-full overflow-auto pt-1 pb-2 pl-4"
          style={
            fade
              ? {
                  maskImage: FADE,
                  WebkitMaskImage: FADE,
                }
              : undefined
          }
        >
          <pre
            ref={pre}
            className={`w-max min-w-full font-mono text-caption ${wrap ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}
            style={scale < 1 ? { transform: `scale(${scale})`, transformOrigin: 'top left' } : undefined}
          >
            {lines.map((spans, i) => (
              <Fragment key={i}>
                {spans.map((sp, j) => (
                  <span key={j} style={spanStyle(sp)}>
                    {sp.text}
                  </span>
                ))}
                {'\n'}
              </Fragment>
            ))}
          </pre>
        </div>
        {fresh && (
          <button
            type="button"
            onClick={() => {
              const el = box.current;
              if (el) el.scrollTop = el.scrollHeight;
              pinned.current = true;
              setFresh(false);
            }}
            className="absolute inset-x-0 bottom-2 mx-auto flex w-max items-center gap-1.5 rounded-chip bg-elevated px-3 py-1.5 text-caption font-medium text-fg shadow-elevated"
          >
            <Down />
            New output
          </button>
        )}
      </div>

      {explain && (
        <div className={`transition-opacity duration-150 ${status === 'blocked' ? 'opacity-100' : 'opacity-0'}`}>
          <Blocked explain={explain} onKeys={keys} />
        </div>
      )}

      <div className="flex shrink-0 flex-col gap-2.5 rounded-t-drawer bg-elevated pt-3 pb-[max(env(safe-area-inset-bottom),12px)] shadow-[0_-8px_24px_rgb(0_0_0/0.25)]">
        <div className="hscroll flex gap-2 px-4">
          {(agent ? AGENT_KEYS : SHELL_KEYS).map(([name, label]) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              onClick={() => keys([name])}
              className={`press flex h-9 shrink-0 items-center justify-center rounded-chip border border-border bg-bg px-3 font-mono text-caption active:bg-surface ${
                name === 'ctrl+c' ? 'text-danger' : 'text-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {agent && (
          <div className="flex flex-col gap-1.5 px-4">
            <div aria-hidden className="flex items-center gap-1.5 text-caption text-muted">
              <span className="text-accent">✻</span> {agent}
            </div>
            <div className="flex items-end gap-2 rounded-composer border border-border bg-bg py-1 pr-1.5 pl-3.5">
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
                aria-label={`Reply to ${agent}`}
                placeholder={`Reply to ${agent[0]!.toUpperCase()}${agent.slice(1)}…`}
                className="max-h-24 min-h-9 flex-1 resize-none self-center bg-transparent py-2 text-body leading-5 placeholder:text-muted focus:outline-none"
              />
              {text.trim() || !canDictate ? (
                <button
                  type="button"
                  onClick={send}
                  disabled={!text.trim()}
                  aria-label="Send"
                  className={`press flex size-9 shrink-0 items-center justify-center rounded-chip ${
                    text.trim() ? 'bg-accent text-bg' : 'bg-surface text-muted'
                  }`}
                >
                  <Send />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={dictate}
                  aria-label="Dictate"
                  aria-pressed={listening}
                  className={`press flex size-9 shrink-0 items-center justify-center ${listening ? 'text-accent' : 'text-muted'}`}
                >
                  <Mic />
                </button>
              )}
              <button
                type="button"
                aria-label="Attach"
                className="flex size-9 shrink-0 items-center justify-center text-muted"
              >
                <Attach />
              </button>
            </div>
          </div>
        )}
      </div>

      <SwitchDrawer open={showSwitch} onClose={() => setShowSwitch(false)} state={state} currentKey={paneKey} onPick={haptic} />
      <MenuSheet
        open={showMore}
        title={pane?.title ?? 'Pane'}
        onClose={() => setShowMore(false)}
        items={[
          { label: wrap ? 'Wrap: on' : 'Wrap: off', onClick: () => setWrap(!wrap) },
          { label: 'Rename', onClick: () => setRename(true) },
          { label: 'Close Pane', danger: true, onClick: () => setConfirmClose(true) },
          { label: 'Resize to phone', hint: 'v2', disabled: true },
        ]}
      />
      <NewTabSheet
        open={showNewTab}
        onClose={() => setShowNewTab(false)}
        cwd={ws?.cwd}
        where={
          <>
            in <span className="text-fg">{ws?.label}</span> · {host?.label}
          </>
        }
        onSubmit={noop}
      />
      <RenameSheet open={rename} kind="Pane" current={pane?.title ?? ''} onClose={() => setRename(false)} onSubmit={noop} />
      <ConfirmCloseSheet open={confirmClose} title={pane?.title ?? ''} onClose={() => setConfirmClose(false)} onConfirm={noop} />
    </div>
  );
}

// ponytail: rename, close and tab creation reach herdr in phase 7; the live Mux is
// read-only today, so these drawers close and change nothing.
const noop = () => {};
