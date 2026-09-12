import type { Action, Affordance, Span } from './types.ts';

export interface AffordanceProfile {
  hints?: RegExp[];
  statusItems?: { pattern: RegExp; action: Action }[];
}

export function herdrKey(name: string): string {
  const key = name.toLowerCase().replaceAll('-', '+');
  const aliases: Record<string, string> = {
    '↑': 'up', '↓': 'down', '←': 'left', '→': 'right', escape: 'esc', return: 'enter',
  };
  return aliases[key] ?? key;
}

const generic: { pattern: RegExp; action: (match: RegExpExecArray) => Action; label: (match: RegExpExecArray) => string; range?: (match: RegExpExecArray) => [number, number] }[] = [
  {
    pattern: /<([a-z0-9]+(?:-[a-z0-9]+)?)>\s*([A-Za-z][\w /-]*?)(?=\s{2,}|<|$)/g,
    action: m => ({ keys: [herdrKey(m[1]!)] }), label: m => m[2]!.trim(),
  },
  {
    pattern: /F(\d{1,2})([A-Z][A-Za-z +-]*?)(?=F\d{1,2}[A-Z]|\s{2,}|$)/g,
    action: m => ({ keys: [`f${m[1]}`] }), label: m => m[2]!.trim(),
  },
  {
    pattern: /\[([a-z0-9]+(?:[-+][a-z0-9]+)?)\]\s*([A-Za-z][\w /-]*?)(?=\s{2,}|\[|$)/gi,
    action: m => ({ keys: [herdrKey(m[1]!)] }), label: m => m[2]!.trim(),
  },
  {
    pattern: /\b(esc|enter|tab|space|shift\+tab|ctrl\+[a-z]|[↑↓←→]|[a-z]|\d) to ([a-z][a-z ]{1,24}?)(?=[,.)·]|\s{2,}|$)/gi,
    action: m => ({ keys: [herdrKey(m[1]!)] }), label: m => m[2]!.trim(),
  },
];

export function findAffordances(lines: Span[][], profile: AffordanceProfile): Affordance[] {
  // ponytail: terminal columns are UTF-16 code-unit indexes; upgrade to wcwidth if wide glyph taps need exact ranges.
  const textLines = lines.map(line => line.map(span => span.text).join(''));
  const found: Affordance[] = [];
  const add = (row: number, colStart: number, colEnd: number, label: string, action: Action) => {
    if (colEnd <= colStart || found.some(item => item.row === row && colStart < item.colEnd && colEnd > item.colStart)) return;
    found.push({ row, colStart, colEnd, label, action });
  };

  const options = textLines.map((text, row) => ({ text, row, match: /^[│┃|]?\s*(❯|>)?\s*(\d+)\.\s(.*)$/.exec(text) })).filter(item => item.match);
  const cursors = options.filter(item => item.match![1] === '❯');
  if (cursors.length === 1) {
    const cur = options.indexOf(cursors[0]!);
    options.forEach((item, index) => {
      const start = /^[│┃|]?\s*/.exec(item.text)![0]!.length;
      const withoutFrame = item.text.replace(/\s*[│┃|]\s*$/, '');
      const end = withoutFrame.trimEnd().length;
      const label = item.match![3]!.replace(/\s*[│┃|]\s*$/, '').trim();
      add(item.row, start, end, label, { keys: Array(Math.abs(index - cur)).fill(index > cur ? 'down' : 'up') });
    });
  }

  for (let row = 0; row < textLines.length; row++) {
    const text = textLines[row]!;
    if (!text) continue;
    for (const item of profile.statusItems ?? []) {
      const pattern = new RegExp(item.pattern.source, item.pattern.flags.includes('g') ? item.pattern.flags : `${item.pattern.flags}g`);
      for (const match of text.matchAll(pattern)) add(row, match.index, match.index + match[0].length, match[0], item.action);
    }
    for (const item of generic) for (const match of text.matchAll(item.pattern)) {
      add(row, match.index, match.index + match[0].length, item.label(match), item.action(match));
    }
    // Profile Hint convention: capture group 1 is the key and group 2 is its label.
    for (const hint of profile.hints ?? []) {
      const pattern = new RegExp(hint.source, hint.flags.includes('g') ? hint.flags : `${hint.flags}g`);
      for (const match of text.matchAll(pattern)) if (match[1] && match[2]) add(row, match.index, match.index + match[0].length, match[2].trim(), { keys: [herdrKey(match[1])] });
    }
    for (const match of text.matchAll(/https?:\/\/\S+/g)) {
      const value = match[0].replace(/[).,]+$/, '');
      add(row, match.index, match.index + value.length, value, { copy: value });
    }
    for (const match of text.matchAll(/(?:^|\s)((?:~|\/)[\w./-]{3,})/g)) {
      const value = match[1]!; const start = match.index + match[0].indexOf(value);
      add(row, start, start + value.length, value, { copy: value });
    }
  }
  return found;
}
