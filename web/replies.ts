// Quick replies for the Pane dock: which pills to offer, in which order.
// Pure — no React, no fetch. `web/pane.tsx` renders them and decides what a tap does.
import { offeredKeys } from '../shared/blocked.ts';
import type { Explain } from '../shared/types.ts';

export interface Pill {
  /** `key` sends its keys at once; `text` fills the composer for review. */
  kind: 'key' | 'text';
  /** What the pill prints. */
  label: string;
  /** The accessible name, because a glyph alone does not read. */
  aria: string;
  /** Key pills: the herdr key names to send. */
  keys?: string[];
  /** Key pills: the key glyph printed after the label. */
  glyph?: string;
  /** Text pills the Hub drafted, marked with ✦. */
  generated?: boolean;
}

/** The key bar's own spelling, so a pill and a key cap name the same key. */
const GLYPH: Record<string, string> = { enter: '↵', esc: 'esc', tab: 'tab', up: '↑', down: '↓' };

/** Static text pills per Agent. `pane.agent` is the Mux's own word: `claude`, `pi`, `codex`. */
const STATIC: { match: (agent: string) => boolean; texts: string[] }[] = [
  {
    match: (a) => a.includes('claude'),
    texts: ['Continue', 'Run the tests', 'Commit and push', 'Explain the diff', 'Stop here'],
  },
  { match: (a) => a === 'pi', texts: ['Continue', 'Run the tests', 'Show me the plan'] },
];

const staticTexts = (agent?: string): string[] =>
  STATIC.find((s) => s.match((agent ?? '').toLowerCase()))?.texts ?? ['Continue'];

const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, '').replace(/[│┃|]/g, ' ');

/**
 * Does the prompt show a numbered list? `shared/blocked.ts` only asks whether the first
 * option means yes, so the count lives here: two or more `1.`-style options is a list you
 * move through with the arrows, whatever the agent calls them.
 */
export const isNumberedList = (detection: string): boolean =>
  plain(detection).split(/\r?\n/).filter((l) => /^\s*[❯>»*]?\s*[1-9][.)]\s+\S/.test(l)).length >= 2;

/**
 * The dock's pill row: key pills first, then the Hub's drafts, then the static set.
 * Smart replies are the client's choice, so `suggestions` are dropped when `smart` is off.
 */
export function quickReplies(o: {
  agent?: string;
  explain?: Explain | null;
  suggestions?: string[];
  smart: boolean;
}): Pill[] {
  const pills: Pill[] = [];

  if (o.explain) {
    for (const k of offeredKeys(o.explain)) {
      pills.push({ kind: 'key', label: k.label, aria: `${k.label}, ${k.key}`, keys: [k.key], glyph: GLYPH[k.key] ?? k.key });
    }
    if (isNumberedList(o.explain.detection)) {
      pills.push({ kind: 'key', label: '↑', aria: 'up', keys: ['up'] });
      pills.push({ kind: 'key', label: '↓', aria: 'down', keys: ['down'] });
    }
  }

  const texts = [
    ...(o.smart ? (o.suggestions ?? []).slice(0, 3).map((t) => [t, true] as const) : []),
    ...staticTexts(o.agent).map((t) => [t, false] as const),
  ];
  const seen = new Set<string>();
  for (const [label, generated] of texts) {
    const text = label.trim();
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    pills.push({ kind: 'text', label: text, aria: `${text}, fills the reply box`, generated });
  }

  return pills;
}
