import { Fragment } from 'react';
import type { CSSProperties } from 'react';
import { parseAnsi } from '../shared/ansi.ts';
import type { Explain, Span } from '../shared/types.ts';
import { Dot } from './home.tsx';

// ponytail: copied from web/pane.tsx, which does not export it. Phase 1 should export one
// copy (pane.tsx or a shared web/ansi helper) and delete this.
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

/** A permission prompt always answers to enter/esc, even when herdr names no hint keys. */
const PRESETS = [
  { key: 'enter', label: 'Yes' },
  { key: 'esc', label: 'No' },
];

/**
 * What herdr saw, and the keys it says the prompt takes. The first key is the primary
 * action. Sending is the caller's job: this card never talks to the Hub.
 */
export function Blocked({ explain, onKeys }: { explain: Explain; onKeys: (keys: string[]) => void }) {
  const offered = explain.ruleId.includes('permission') ? [...explain.hintKeys, ...PRESETS] : explain.hintKeys;
  const keys = offered.filter((k, i) => offered.findIndex((o) => o.key === k.key) === i);

  return (
    <section role="region" aria-label="Blocked" className="border-t border-border/60 px-3 py-2.5">
      {/* The region label already says Blocked, so this heading is decoration. */}
      <div aria-hidden className="flex items-center gap-1.5 pb-1.5">
        <Dot status="blocked" />
        <span className="label-caps">Blocked</span>
      </div>

      <div className="max-h-44 overflow-auto rounded-xl bg-surface px-3 py-2">
        <pre className="w-max min-w-full font-mono text-[12px] leading-[1.35] whitespace-pre">
          {parseAnsi(explain.detection).map((spans, i) => (
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

      {keys.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pt-2" style={{ scrollbarWidth: 'none' }}>
          {keys.map((k, i) => (
            <button
              key={k.key}
              type="button"
              onClick={() => onKeys([k.key])}
              className={`min-h-11 shrink-0 rounded-full px-4 text-[15px] ${
                i === 0 ? 'bg-accent font-medium text-bg' : 'bg-surface text-fg/80 active:bg-border'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
