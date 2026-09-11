import type { StatePane } from './types.ts';

/** Blocked is actionable even after it was Seen; other statuses follow revision history. */
export const isUnseen = (pane: StatePane, revisions: Record<string, number>) =>
  pane.status === 'blocked' ||
  pane.status !== 'idle' && pane.status !== 'unknown' && (
    (revisions[pane.key] ?? 0) > 1_000_000_000_000
      ? (revisions[pane.key] ?? 0) < (pane.statusChangedAt ?? 0)
      : pane.revision > (revisions[pane.key] ?? pane.seenRevision)
  );
