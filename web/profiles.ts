import type { AffordanceProfile } from '../shared/affordances.ts';
import { AGENT_KEYS, INLINE_KEYS, SHELL_KEYS } from './keys.ts';

export interface Profile extends AffordanceProfile {
  mouse: boolean;
  keys: { inline: string[]; all: string[] };
  replies: string[];
}

const agentKeys = { inline: INLINE_KEYS.agent, all: AGENT_KEYS.map(([name]) => name) };
const shellKeys = { inline: INLINE_KEYS.shell, all: SHELL_KEYS.map(([name]) => name) };
const agent = (replies: string[], extra: Partial<Profile> = {}): Profile => ({ mouse: false, keys: agentKeys, replies, ...extra });
const tool = (mouse: boolean, keys = shellKeys): Profile => ({ mouse, keys, replies: ['Continue'] });

// The Herdr contract test proved herdr accepts these key names. htop and less both show a
// function-key footer, so their full key bar offers them too; the inline dock stays the
// short SHELL_KEYS set.
const FUNCTION_KEYS: [name: string, label: string][] = [
  ['f1', 'F1'], ['f2', 'F2'], ['f3', 'F3'], ['f4', 'F4'], ['f5', 'F5'],
  ['f6', 'F6'], ['f7', 'F7'], ['f8', 'F8'], ['f9', 'F9'], ['f10', 'F10'],
];
const functionKeys = { inline: INLINE_KEYS.shell, all: [...shellKeys.all, ...FUNCTION_KEYS.map(([name]) => name)] };

export const PROFILES: Record<string, Profile> = {
  claude: agent(['Continue', 'Run the tests', 'Commit and push', 'Explain the diff', 'Stop here'], { statusItems: [
    { pattern: /(\[)?\d+ (shells?|local agents?|idle agents?|monitors?)(\])?/g, action: { command: '/tasks' } },
    { pattern: /← \d+ agents?/g, action: { command: '/tasks' } },
    { pattern: /(auto mode on|plan mode on|accept edits on)/g, action: { keys: ['shift+tab'] } },
  ] }),
  pi: agent(['Continue', 'Run the tests', 'Show me the plan']),
  codex: agent(['Continue']),
  k9s: tool(true), htop: tool(true, functionKeys), btop: tool(true), lazygit: tool(true),
  nvim: tool(true), vim: tool(true), less: tool(true, functionKeys), generic: tool(false),
};

export function profileFor(pane: { agent?: string; command?: string } | undefined): Profile {
  const agentName = pane?.agent?.toLowerCase();
  if (agentName) {
    const key = Object.keys(PROFILES).find(name => agentName.includes(name));
    if (key) return PROFILES[key]!;
  }
  const command = pane?.command?.split('/').at(-1)?.toLowerCase();
  return command && PROFILES[command] || PROFILES.generic!;
}

export function mouseAllowed(paneKey: string, pane: { agent?: string; command?: string } | undefined): boolean {
  const override = localStorage.getItem(`tautan.mouse.${paneKey}`);
  return override === 'on' || override !== 'off' && profileFor(pane).mouse;
}

export function setMouseOverride(paneKey: string, value: 'on' | 'off' | null): void {
  const key = `tautan.mouse.${paneKey}`;
  if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
}
