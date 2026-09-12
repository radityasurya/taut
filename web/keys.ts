/** Herdr key names, with the label shown on the cap. Ordered by real use. */
export const AGENT_KEYS: [name: string, label: string][] = [
  ['esc', 'esc'], ['up', '↑'], ['down', '↓'], ['tab', 'tab'],
  ['shift+tab', 'shift+tab'], ['enter', 'enter'], ['ctrl+c', 'ctrl+c'],
];

export const SHELL_KEYS: [name: string, label: string][] = [
  ['esc', 'esc'], ['tab', 'tab'], ['up', '↑'], ['down', '↓'],
  ['left', '←'], ['right', '→'], ['enter', 'enter'], ['ctrl+c', 'ctrl+c'],
  ['ctrl+d', 'ctrl+d'], ['ctrl+l', 'ctrl+l'], ['ctrl+r', 'ctrl+r'],
];

/**
 * The keys the dock shows without expanding, next to the keys toggle: the three a hand
 * reaches for most. Names only — the cap's label still comes from the preset above.
 */
export const INLINE_KEYS: Record<'agent' | 'shell', string[]> = {
  agent: ['esc', 'up', 'down', 'enter'],
  shell: ['esc', 'tab', 'enter'],
};
