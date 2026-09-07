import type { State, StatePane, Status } from '../shared/types.ts';

const DOT: Record<Status, string> = {
  blocked: 'bg-warn',
  working: 'bg-accent',
  done: 'bg-ok',
  idle: 'bg-muted',
  unknown: 'bg-border',
};

export function Dot({ status }: { status: Status }) {
  return (
    <>
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${DOT[status]}`} />
      <span className="sr-only">{status}</span>
    </>
  );
}

const unseen = (p: StatePane) => p.revision > p.seenRevision;

// Seen `done` sits between `working` and `idle`: it is finished work you have already looked at.
const RANK: Record<Status, number> = { blocked: 2, working: 3, done: 4, idle: 5, unknown: 6 };
const rank = (p: StatePane) => {
  if (unseen(p) && p.status === 'blocked') return 0;
  if (unseen(p) && p.status === 'done') return 1;
  return RANK[p.status];
};

const basename = (cwd?: string) => cwd?.replace(/\/+$/, '').split('/').pop();

export function Home({ state }: { state: State | null }) {
  const groups = state
    ? state.workspaces
        .map((w) => ({
          key: w.key,
          label: w.label,
          panes: state.panes.filter((p) => p.muxKey === w.muxKey && p.workspaceId === w.id).sort((a, b) => rank(a) - rank(b)),
        }))
        .filter((g) => g.panes.length > 0)
    : [];

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between bg-bg px-4 pt-[env(safe-area-inset-top)]">
        <h1 className="text-[17px] font-semibold tracking-tight">taut</h1>
        <a
          href="#/settings"
          aria-label="Settings"
          className="-mr-2.5 flex size-11 items-center justify-center rounded-full text-muted hover:text-fg"
        >
          <GearIcon />
        </a>
      </header>

      {!state ? (
        <p className="px-4 py-6 text-sm text-muted">Connecting…</p>
      ) : groups.length === 0 ? (
        <p className="px-4 py-6 text-sm leading-relaxed text-muted">No panes. Is herdr running on this Host?</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="mt-5 first:mt-2">
            <h2 className="label-caps px-4 pb-1">{g.label}</h2>
            <ul>
              {g.panes.map((p) => (
                <li key={p.key} className="border-t border-border/60 first:border-0">
                  <a
                    href={`#/pane/${encodeURIComponent(p.key)}`}
                    className="flex min-h-11 items-center gap-3 px-4 py-2.5 active:bg-surface"
                  >
                    <Dot status={p.status} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span
                          className={`shrink-0 text-[15px] ${
                            p.agent ? (unseen(p) ? 'font-medium text-fg' : 'text-fg/70') : 'text-muted'
                          }`}
                        >
                          {p.agent ?? 'shell'}
                        </span>
                        <span className={`truncate text-[15px] ${unseen(p) ? 'text-fg' : 'text-fg/60'}`}>{p.title}</span>
                      </span>
                      {p.cwd && <span className="mt-0.5 block truncate text-xs text-muted">{basename(p.cwd)}</span>}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

export function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="3.2" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.7a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.01c.2.5.66.87 1.2.99H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"
      />
    </svg>
  );
}
