import type { Explain } from '../shared/types.ts';
import { Ansi } from './pane.tsx';

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
// Actions live in the quick-reply pills under the card; the card only says what is asked.
export function Blocked({ explain }: { explain: Explain }) {
  const [head = 'Blocked', ...rest] = content(explain.detection);
  const title = plain(head).trim();

  return (
    <section
      role="region"
      aria-label="Blocked"
      className="rise mx-3 mb-2.5 flex flex-col gap-2.5 rounded-card border border-border bg-elevated px-3.5 py-3 shadow-elevated lg:mx-auto lg:w-full lg:max-w-4xl"
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

    </section>
  );
}
