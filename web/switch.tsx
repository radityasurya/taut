import { useState } from 'react';
import type { State } from '../shared/types.ts';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer.tsx';
import { navigate } from './app.tsx';
import { Dot, unseen } from './home.tsx';
import { Search } from './icons.tsx';

/**
 * Two taps to any Pane on any Host: search, Host chips, then every Workspace with its
 * Panes under the Tab they belong to. Opened from the Pane status line and the Switch icon.
 */
export function SwitchDrawer({
  open,
  onClose,
  state,
  currentKey,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  state: State | null;
  currentKey: string;
  onPick?: () => void;
}) {
  const [q, setQ] = useState('');
  const [host, setHost] = useState<string | null>(null);

  const hostOf = (muxKey: string) => state?.muxes.find((m) => m.key === muxKey)?.hostId;
  const needle = q.trim().toLowerCase();
  const groups = (state?.workspaces ?? [])
    .filter((w) => !host || hostOf(w.muxKey) === host)
    .map((w) => {
      const mux = state?.muxes.find((m) => m.key === w.muxKey);
      return {
        w,
        mux,
        host: state?.hosts.find((h) => h.id === mux?.hostId),
        panes: (state?.panes ?? []).filter(
          (p) =>
            p.muxKey === w.muxKey &&
            p.workspaceId === w.id &&
            (!needle || `${p.agent ?? 'shell'} ${p.title} ${w.label}`.toLowerCase().includes(needle)),
        ),
      };
    })
    .filter((g) => g.panes.length > 0);

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} repositionInputs={false}>
      <DrawerContent aria-describedby={undefined} className="h-[85dvh] max-h-[85dvh] px-3">
        <DrawerTitle className="sr-only">Switch Pane</DrawerTitle>

        <label className="mt-1 flex min-h-11 items-center gap-2.5 rounded-composer border border-border bg-bg px-3.5 text-muted">
          <Search />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Switch to…"
            aria-label="Switch to"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-body text-fg placeholder:text-muted focus:outline-none"
          />
        </label>

        <div role="group" aria-label="Filter by Host" className="hscroll mt-3 flex shrink-0 gap-2">
          {[{ id: null, label: 'All', online: true }, ...(state?.hosts ?? [])].map((h) => (
            <button
              key={h.id ?? 'all'}
              type="button"
              aria-pressed={host === h.id}
              onClick={() => setHost(h.id)}
              className={`shrink-0 rounded-chip px-3 py-1.5 text-caption ${
                host === h.id ? 'bg-accent font-semibold text-bg' : 'bg-bg font-medium text-muted'
              } ${h.online ? '' : 'line-through'}`}
            >
              {h.label}
            </button>
          ))}
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {groups.length === 0 && <p className="px-3 py-6 text-body text-muted">Nothing matches “{q}”.</p>}
          {groups.map(({ w, mux, host: h, panes }) => (
            <section key={w.key}>
              <h3 className="label-caps flex px-3 pt-3.5 pb-1">
                {w.label}
                <span className="ml-1.5 font-medium tracking-normal normal-case text-muted">
                  · {h?.label}
                  {mux?.kind === 'tmux' && ' · tmux'}
                </span>
              </h3>
              <ul>
                {panes.map((p) => (
                  <li key={p.key}>
                    <button
                      type="button"
                      onClick={() => {
                        navigate(`#/pane/${encodeURIComponent(p.key)}`);
                        onPick?.();
                        onClose();
                      }}
                      aria-current={p.key === currentKey ? 'true' : undefined}
                      className={`flex min-h-11 w-full items-center gap-2.5 rounded-chip px-3 text-left ${
                        p.key === currentKey ? 'bg-muted/20' : 'active:bg-bg'
                      }`}
                    >
                      <span aria-hidden className="w-6 shrink-0 font-mono text-[11px] text-muted">
                        {p.tabId}
                      </span>
                      <Dot status={p.status} seen={!unseen(p)} />
                      <span className="shrink-0 text-body text-muted">{p.agent ?? 'shell'}</span>
                      <span className="truncate text-body">{p.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
