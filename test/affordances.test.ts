import { describe, expect, test } from 'bun:test';
import { parseAnsi } from '../shared/ansi.ts';
import { findAffordances, herdrKey } from '../shared/affordances.ts';
import { PROFILES } from '../web/profiles.ts';

describe('Screen affordances', () => {
  test('maps Claude option rows relative to the cursor', () => {
    const found = findAffordances(parseAnsi("❯ 1. Yes\n  2. Yes, and don't ask again\n  3. No"), PROFILES.claude!);
    expect(found.find(item => item.row === 0)?.action).toEqual({ keys: [] });
    expect(found.find(item => item.row === 2)).toMatchObject({ label: 'No', action: { keys: ['down', 'down'] } });
  });

  test('maps option rows inside a framed permission box', () => {
    const line2 = "│   2. Yes, and don't ask again                │";
    const box = [
      '╭───╮',
      '│ ❯ 1. Yes                                    │',
      line2,
      '│   3. No                                      │',
      '╰───╯',
    ].join('\n');
    const found = findAffordances(parseAnsi(box), PROFILES.claude!);
    const optionRows = found.filter(item => item.action && 'keys' in item.action && item.action.keys.every(k => k === 'up' || k === 'down'));
    expect(optionRows).toHaveLength(3);
    expect(found.find(item => item.row === 3)).toMatchObject({ label: 'No', action: { keys: ['down', 'down'] } });
    expect(found.find(item => item.row === 1)?.action).toEqual({ keys: [] });
    const row2 = found.find(item => item.row === 2)!;
    expect(row2.colStart).toBeGreaterThanOrEqual(line2.indexOf('2.'));
  });

  test('recognises k9s and htop Hint runs', () => {
    const k9s = findAffordances(parseAnsi('<0> all  <1> default  <d> describe  <ctrl-d> delete'), PROFILES.k9s!);
    expect(k9s).toHaveLength(4);
    expect(k9s[3]).toMatchObject({ label: 'delete', action: { keys: ['ctrl+d'] } });
    const htop = findAffordances(parseAnsi('F1Help  F2Setup F3SearchF4FilterF5Tree  F6SortByF7Nice -F8Nice +F9Kill  F10Quit'), PROFILES.htop!);
    expect(htop).toHaveLength(10);
    expect(htop[9]).toMatchObject({ label: 'Quit', action: { keys: ['f10'] } });
    expect(htop.map(item => item.label)).toEqual(['Help', 'Setup', 'Search', 'Filter', 'Tree', 'SortBy', 'Nice -', 'Nice +', 'Kill', 'Quit']);
  });

  test('recognises Claude status, generic key Hints, and URLs', () => {
    const footer = findAffordances(parseAnsi('⏵⏵ auto mode on (shift+tab to cycle) · ← 1 agent\n[2 shells]\nesc to cancel\nsee https://example.com/x)'), PROFILES.claude!);
    expect(footer.filter(item => 'keys' in item.action && item.action.keys[0] === 'shift+tab')).toHaveLength(2);
    expect(footer.some(item => item.label === 'auto mode on' && 'keys' in item.action)).toBe(true);
    expect(footer.some(item => item.label === '← 1 agent' && 'command' in item.action && item.action.command === '/tasks')).toBe(true);
    expect(footer.some(item => item.label === '[2 shells]' && 'command' in item.action && item.action.command === '/tasks')).toBe(true);
    expect(footer.some(item => item.label === 'cancel' && 'keys' in item.action && item.action.keys[0] === 'esc')).toBe(true);
    expect(footer.some(item => 'copy' in item.action && item.action.copy === 'https://example.com/x')).toBe(true);
  });

  test('normalises Herdr key tokens', () => {
    expect(['ctrl-d', 'shift-f', 'F5', '↑', '↓', '←', '→', 'escape', 'return', 'space', 'a', '7'].map(herdrKey))
      .toEqual(['ctrl+d', 'shift+f', 'f5', 'up', 'down', 'left', 'right', 'esc', 'enter', 'space', 'a', '7']);
  });
});
