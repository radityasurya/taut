import type { Explain } from '../shared/types.ts';
import { Ansi } from './pane.tsx';

/** A permission prompt always answers to enter/esc, even when herdr names no hint keys. */
const PRESETS = [
  { key: 'enter', label: 'Yes' },
  { key: 'esc', label: 'No' },
];

const BOX = /[─-╿▀-▟]/g;

const plain = (line: string) => line.replace(/\x1b\[[0-9;]*m/g, '');

/**
 * The detection as prose: strip the agent's own box frame, drop the empty rows, keep the
 * ANSI so the excerpt reads in the agent's own colours.
 */
const content = (detection: string) =>
  detection
    .split(/\r?\n/)
    .map((l) => l.replace(BOX, '').trim())
    .filter((l) => plain(l).trim());

/**
 * What herdr saw, and the keys it says the prompt takes. The first key is the primary
 * action. Sending is the caller's job: this card never talks to the Hub.
 */
export function Blocked({ explain, onKeys }: { explain: Explain; onKeys: (keys: string[]) => void }) {
  const offered = explain.ruleId.includes('permission') ? [...explain.hintKeys, ...PRESETS] : explain.hintKeys;
  const keys = offered.filter((k, i) => offered.findIndex((o) => o.key === k.key) === i);
  const [head = 'Blocked', ...rest] = content(explain.detection);
  const title = plain(head).trim();

  return (
    <section
      role="region"
      aria-label="Blocked"
      className="mx-3 mb-2.5 flex flex-col gap-2.5 rounded-card border border-border bg-elevated px-3.5 py-3 shadow-elevated"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate text-[13px] font-semibold">{title}</h2>
        <span className="shrink-0 font-mono text-[11px] text-muted">{explain.ruleId}</span>
      </div>

      {rest.length > 0 && (
        <pre className="overflow-hidden font-mono text-caption text-ellipsis whitespace-pre-wrap text-muted">
          <Ansi text={rest.slice(0, 2).join('\n')} />
        </pre>
      )}

      <div className="flex gap-2">
        {keys.map((k, i) => (
          <button
            key={k.key}
            type="button"
            onClick={() => onKeys([k.key])}
            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-chip text-[14px] ${
              i === 0 ? 'bg-accent font-semibold text-bg' : 'border border-border bg-bg font-medium text-fg active:bg-surface'
            }`}
          >
            {k.label}
            <span className={`font-mono text-[11px] ${i === 0 ? 'opacity-70' : 'text-muted'}`}>{k.key}</span>
          </button>
        ))}
        {(['up', 'down'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-label={k}
            onClick={() => onKeys([k])}
            className="flex size-10 shrink-0 items-center justify-center rounded-chip border border-border bg-bg font-mono text-[14px] active:bg-surface"
          >
            {k === 'up' ? '↑' : '↓'}
          </button>
        ))}
      </div>
    </section>
  );
}
