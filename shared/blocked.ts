import type { Explain } from './types.ts';

/** A yes/no prompt always answers to enter/esc, even when the Mux names no hint keys. */
const PRESET = [
  { key: 'enter', label: 'Yes' },
  { key: 'esc', label: 'No' },
];

/** `❯ 1. Yes`, `1. Allow`, `Accept` — the first option of an approval box, whatever the agent. */
const AFFIRMATIVE = /^[^\S\n]*[❯>»]?[^\S\n]*(?:[1-9][.)][^\S\n]*)?(?:yes|allow|accept|approve)\b/im;

/**
 * Does this prompt take enter as "yes" and esc as "no"?
 *
 * The rule id alone is not enough: a real Claude Code permission box matches
 * `live_blocked_form` (priority 980) long before `bash_permission_prompt` (850), because its
 * "esc to cancel · enter to confirm" footer sits after a horizontal rule. So read the box as
 * well as the id — an options list that offers Yes/Allow/Accept first is a yes/no prompt.
 */
export const asksYesNo = (explain: Explain): boolean =>
  /permission|approval|approve/i.test(explain.ruleId) || AFFIRMATIVE.test(explain.detection);

/**
 * The keys to offer for a blocked Pane: the Yes/No preset first when the prompt takes one,
 * then whatever hint keys the Mux found, minus the duplicates (the footer's own
 * `esc to cancel` and `enter to confirm` are the preset under another name).
 *
 * Idempotent, so the Hub can apply it on the way out and the card again on the way in.
 */
export function offeredKeys(explain: Explain): Explain['hintKeys'] {
  const keys = asksYesNo(explain) ? [...PRESET, ...explain.hintKeys] : explain.hintKeys;
  return keys.filter((key, i) => keys.findIndex(other => other.key === key.key) === i);
}
