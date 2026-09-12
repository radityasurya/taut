import { TopBar } from './header.tsx';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type {
  NewTabBody, NewTabResult, NewWorkspaceBody, NewWorkspaceResult, RenameBody, State, StatePane, StateWorkspace, Status,
} from '../shared/types.ts';
import { api, Link, navigate, opensWith, reducedMotion } from './app.tsx';
import { ChevronDown, ChevronRight, Plus } from './icons.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { MenuSheet, NewTabSheet, NewWorkspaceSheet, RenameSheet } from './sheets.tsx';
import { isUnseen } from '../shared/seen.ts';

// ---- status ----

const COLOR: Record<Status, string> = {
  blocked: 'var(--warn)',
  working: 'var(--accent)',
  done: 'var(--ok)',
  idle: 'var(--muted)',
  unknown: 'var(--muted)',
};

export const statusText: Record<Status, string> = {
  blocked: 'text-warn',
  working: 'text-accent',
  done: 'text-ok',
  idle: 'text-muted',
  unknown: 'text-muted',
};

/** 8 px by default. Filled means unseen; a 1.5 px ring means seen. Decoration only: the
 *  row's `aria-label` and the printed status word carry the fact. */
export function Dot({ status, seen, size = 8 }: { status: Status; seen?: boolean; size?: number }) {
  const c = COLOR[status];
  return (
    <span
      aria-hidden
      className="shrink-0 rounded-full"
      style={{ width: size, height: size, boxSizing: 'border-box', ...(seen ? { border: `1.5px solid ${c}` } : { background: c }) }}
    />
  );
}

// ---- seen ----
// tautan's own flag, never written back to the Mux. One revision map, read through a module cache.

let seenAt: Record<string, number> | null = null;
const seen = () => (seenAt ??= JSON.parse(localStorage.getItem('tautan.seen') ?? '{}') as Record<string, number>);

export function markSeen(key: string, revision: number) {
  seen()[key] = revision;
  localStorage.setItem('tautan.seen', JSON.stringify(seen()));
}

/** Seed a new device from its first snapshot. Blocked remains actionable regardless. */
export function seedSeen(panes: StatePane[]) {
  const current = seen();
  if (Object.keys(current).length) return;
  for (const pane of panes) current[pane.key] = pane.revision;
  localStorage.setItem('tautan.seen', JSON.stringify(current));
}

/**
 * `idle` means the user already looked (CONTEXT.md) and `unknown` is all tmux can report,
 * so neither can be unseen. Legacy timestamp entries remain readable while each Pane
 * migrates to a revision the next time it is opened.
 */
export const unseen = (p: StatePane) => isUnseen(p, seen());

export function timeAgo(at?: number): string {
  if (!at) return '';
  const s = Math.max(0, Date.now() - at) / 1000;
  if (s < 45) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
}

const RANK: Record<Status, number> = { blocked: 0, working: 1, done: 2, idle: 3, unknown: 4 };
const basename = (cwd?: string) => cwd?.replace(/\/+$/, '').split('/').pop();
/** `~/projects/tautan` → `~/projects`: where a sibling Workspace would go. */
export const parentDir = (cwd?: string) => cwd?.replace(/\/+$/, '').replace(/\/[^/]+$/, '') || undefined;

/** The Agent most of these Panes run, `''` when none does: the New Tab chip to preselect. */
export function commonAgent(panes: StatePane[]): string {
  const tally = new Map<string, number>();
  for (const p of panes) if (p.agent) tally.set(p.agent, (tally.get(p.agent) ?? 0) + 1);
  return [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

/** Blocked reason, else the last non-empty screen line, else the directory. */
const preview = (p: StatePane) => p.lastLine ?? basename(p.cwd) ?? '';

/** The most urgent status present, as the collapsed group's one-line summary. */
function summary(panes: StatePane[]): string {
  for (const s of Object.keys(RANK) as Status[]) {
    const n = panes.filter((p) => p.status === s).length;
    if (n) return `${n} ${s}`;
  }
  return '';
}

// ---- rows ----

function Row({ pane, first }: { pane: StatePane; first?: boolean }) {
  const fresh = unseen(pane);
  const word = pane.status === 'blocked' ? 'Blocked' : pane.status === 'done' ? 'Done' : '';
  const when = timeAgo(pane.statusChangedAt);
  return (
    <li className={first ? '' : 'border-t border-border/60'}>
      <Link
        to={`#/pane/${encodeURIComponent(pane.key)}`}
        aria-label={[pane.agent ?? 'shell', pane.title, pane.status, fresh ? 'unseen' : 'seen', when]
          .filter(Boolean)
          .join(', ')}
        className="press flex min-h-14 items-center gap-3 px-4 py-2.5 active:bg-surface"
      >
        <Dot status={pane.status} seen={!fresh} />
        <span aria-hidden className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-body text-muted">{pane.agent ?? 'shell'}</span>
            <span className={`truncate text-body ${fresh ? 'font-medium text-fg' : 'text-muted'}`}>{pane.title}</span>
          </span>
          <span className={`truncate text-caption text-muted ${pane.lastLine ? '' : 'font-mono'}`}>
            {word && <span className={statusText[pane.status]}>{word} · </span>}
            {preview(pane)}
          </span>
        </span>
        <span aria-hidden className="shrink-0 font-mono text-caption tabular-nums text-muted">
          {when}
        </span>
      </Link>
    </li>
  );
}

/** 500 ms, cancelled by 10 px of movement, so a scroll never opens the menu. */
function useLongPress(fn: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const from = useRef({ x: 0, y: 0 });
  const stop = () => clearTimeout(timer.current);
  useEffect(() => stop, []);
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      from.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(fn, 500);
    },
    onPointerMove: (e: ReactPointerEvent) => {
      if (Math.hypot(e.clientX - from.current.x, e.clientY - from.current.y) > 10) stop();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
  };
}

/** The Workspace group header: tap collapses, long-press opens the group menu. */
function GroupHeader({
  label,
  host,
  summary,
  open,
  onToggle,
  onMenu,
}: {
  label: string;
  host?: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  onMenu: () => void;
}) {
  const press = useLongPress(onMenu);
  return (
    <h2>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        {...press}
        className="label-caps flex w-full items-center px-4 pt-6 pb-1.5 text-left [-webkit-touch-callout:none]"
      >
        {open ? <ChevronDown className="mr-1.5 shrink-0" /> : <ChevronRight className="mr-1.5 shrink-0" />}
        {label}
        {host && <span className="ml-1.5 font-medium tracking-normal normal-case text-muted">· {host}</span>}
        <span className="ml-auto pl-2 font-medium tracking-normal normal-case text-muted">{summary}</span>
      </button>
    </h2>
  );
}

// ---- screen ----

const COLLAPSED = 'tautan.collapsed';
const readCollapsed = (): string[] => JSON.parse(localStorage.getItem(COLLAPSED) ?? '[]') as string[];

export function Home({ state }: { state: State | null }) {
  const [host, setHost] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [newWorkspace, setNewWorkspace] = useState(() => opensWith('newworkspace'));
  const [newTab, setNewTab] = useState<StateWorkspace | null>(null);
  const [menu, setMenu] = useState<StateWorkspace | null>(null);
  const [rename, setRename] = useState<StateWorkspace | null>(null);
  // The Workspace this screen just created: it stays listed until State fills it with a
  // Pane, and scrolls itself into view the first time State carries it.
  const [created, setCreated] = useState<string | null>(null);
  const sections = useRef(new Map<string, HTMLElement>());
  const scrolled = useRef(false);

  const write = (next: string[]) => {
    setCollapsed(next);
    localStorage.setItem(COLLAPSED, JSON.stringify(next));
  };
  const toggle = (key: string) =>
    write(collapsed.includes(key) ? collapsed.filter((k) => k !== key) : [...collapsed, key]);

  useEffect(() => {
    const el = created && sections.current.get(created);
    if (!el || scrolled.current) return;
    scrolled.current = true;
    el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [state, created]);

  const hostOf = (muxKey: string) => state?.muxes.find((m) => m.key === muxKey)?.hostId;
  const hostLabel = (muxKey: string) => state?.hosts.find((h) => h.id === hostOf(muxKey))?.label;
  const panesOf = (w: StateWorkspace) =>
    (state?.panes ?? []).filter((p) => p.muxKey === w.muxKey && p.workspaceId === w.id).sort((a, b) => RANK[a.status] - RANK[b.status]);

  const visible = (muxKey: string) => !host || hostOf(muxKey) === host;
  /** Only herdr writes. tmux answers 501, so tautan never offers the action. */
  const writable = (muxKey?: string) => state?.muxes.find((m) => m.key === muxKey)?.kind === 'herdr';
  const needsYou = (state?.panes ?? []).filter((p) => visible(p.muxKey) && unseen(p) && (p.status === 'blocked' || p.status === 'done'));
  const groups = (state?.workspaces ?? [])
    .filter((w) => visible(w.muxKey))
    .map((w) => {
      const hostId = hostOf(w.muxKey);
      return {
        w,
        host: state?.hosts.find((h) => h.id === hostId),
        panes: panesOf(w).filter((p) => !needsYou.includes(p)),
      };
    })
    .filter((g) => g.panes.length > 0 || g.host?.online === false || g.w.key === created);

  const tabIn = newTab ?? (opensWith('newtab') ? (groups[0]?.w ?? null) : null);
  // A new Workspace lands on the Mux the list already shows, next to the Workspace it was
  // started from: one herdr Mux is the common case, and nothing here asks which.
  const beside = groups.find((g) => writable(g.w.muxKey))?.w ?? state?.workspaces.find((w) => writable(w.muxKey));

  const createTab = async (w: StateWorkspace, o: { label?: string; cwd?: string; agent?: string }) => {
    const { paneKey } = await api<NewTabResult>(`/api/muxes/${encodeURIComponent(w.muxKey)}/tabs`, {
      workspaceId: w.id,
      ...o,
    } satisfies NewTabBody);
    navigate(`#/pane/${encodeURIComponent(paneKey)}`);
  };

  const createWorkspace = async (o: { cwd: string; label?: string; branch?: string }) => {
    const { workspaceKey } = await api<NewWorkspaceResult>(
      `/api/muxes/${encodeURIComponent(beside!.muxKey)}/workspaces`,
      o satisfies NewWorkspaceBody,
    );
    write(collapsed.filter((k) => k !== workspaceKey));
    scrolled.current = false;
    setCreated(workspaceKey);
  };
  const counts = state && `${state.hosts.length} host${state.hosts.length === 1 ? '' : 's'} · ${state.panes.length} panes`;

  return (
    <div className="mx-auto max-w-2xl pt-[env(safe-area-inset-top)] pb-28">
      <TopBar
        title="tautan"
        right={
          <>
          <span className="mr-1.5 text-caption tabular-nums text-muted">{counts}</span>
          {beside && (
            <button
              type="button"
              aria-label="New Workspace"
              onClick={() => setNewWorkspace(true)}
              className="-mr-2.5 flex size-11 items-center justify-center text-accent"
            >
              <Plus size={22} />
            </button>
          )}
          </>
        }
      />

      {state && state.hosts.length > 1 && (
        <div role="group" aria-label="Filter by Host" className="hscroll flex gap-2 px-4 pt-1.5 pb-0.5">
          {[{ id: null, label: 'All', online: true }, ...state.hosts].map((h) => (
            <button
              key={h.id ?? 'all'}
              type="button"
              aria-pressed={host === h.id}
              onClick={() => setHost(h.id)}
              className={`press shrink-0 rounded-chip px-3 py-1.5 text-caption ${
                host === h.id ? 'bg-accent font-semibold text-bg' : 'bg-surface font-medium text-muted'
              } ${h.online ? '' : 'line-through'}`}
            >
              {h.label}
            </button>
          ))}
        </div>
      )}

      {!state ? (
        <ul aria-busy className="pt-6">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
              <Skeleton className="size-2 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </li>
          ))}
        </ul>
      ) : needsYou.length === 0 && groups.length === 0 ? (
        <div className="flex flex-col items-start gap-3 px-4 pt-8">
          <p className="text-body text-muted">No panes yet.</p>
          <Link to="#/hosts" className="text-body font-medium text-accent">
            Add a Host
          </Link>
        </div>
      ) : (
        <>
          {needsYou.length > 0 && (
            <section>
              <h2 className="label-caps px-4 pt-3.5 pb-1.5">Needs you</h2>
              <ul>
                {needsYou.map((p, i) => (
                  <Row key={p.key} pane={p} first={i === 0} />
                ))}
              </ul>
            </section>
          )}

          {groups.map(({ w, host: h, panes }) => {
            const shut = collapsed.includes(w.key);
            return (
              <section
                key={w.key}
                ref={(el) => {
                  if (el) sections.current.set(w.key, el);
                  else sections.current.delete(w.key);
                }}
              >
                <GroupHeader
                  label={w.label}
                  host={h?.label}
                  summary={summary(panes)}
                  open={!shut}
                  onToggle={() => toggle(w.key)}
                  onMenu={() => setMenu(w)}
                />
                {!shut && (
                  <ul>
                    {panes.map((p, i) => (
                      <Row key={p.key} pane={p} first={i === 0} />
                    ))}
                    {h?.online === false && (
                      <li>
                        <Link
                          to="#/hosts"
                          className="flex min-h-11 items-center gap-3 px-4 py-2.5 active:bg-surface"
                          aria-label={`${h.label} unreachable, ${h.error ?? 'offline'}. Open Hosts`}
                        >
                          <span aria-hidden className="size-2 shrink-0 rounded-full bg-danger" />
                          <span aria-hidden className="min-w-0 flex-1 truncate text-[13px] text-muted">
                            <span className="text-danger">{h.label} unreachable</span> · {h.error}
                          </span>
                          <span aria-hidden className="shrink-0 text-caption text-accent">
                            Hosts ›
                          </span>
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </section>
            );
          })}
        </>
      )}

      <NewWorkspaceSheet
        open={newWorkspace}
        onClose={() => setNewWorkspace(false)}
        cwd={parentDir(beside?.cwd)}
        onSubmit={createWorkspace}
      />
      <NewTabSheet
        open={tabIn !== null}
        onClose={() => setNewTab(null)}
        cwd={tabIn?.cwd}
        agent={commonAgent(tabIn ? panesOf(tabIn) : [])}
        where={
          <>
            in <span className="text-fg">{tabIn?.label}</span> · {hostLabel(tabIn?.muxKey ?? '')}
          </>
        }
        onSubmit={(o) => createTab(tabIn!, o)}
      />
      <MenuSheet
        open={menu !== null}
        title={menu?.label ?? ''}
        onClose={() => setMenu(null)}
        items={[
          ...(writable(menu?.muxKey)
            ? [
                { label: 'New Tab', onClick: () => setNewTab(menu) },
                { label: 'Rename', onClick: () => setRename(menu) },
              ]
            : []),
          { label: 'Diff', onClick: () => menu && navigate(`#/diff/${encodeURIComponent(menu.key)}`) },
          { label: collapsed.includes(menu?.key ?? '') ? 'Expand' : 'Collapse', onClick: () => menu && toggle(menu.key) },
        ]}
      />
      <RenameSheet
        open={rename !== null}
        kind="Workspace"
        current={rename?.label ?? ''}
        onClose={() => setRename(null)}
        onSubmit={(label) =>
          api<void>('/api/rename', { muxKey: rename!.muxKey, workspaceId: rename!.id, label } satisfies RenameBody)
        }
      />
    </div>
  );
}
