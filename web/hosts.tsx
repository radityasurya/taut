import { useState } from 'react';
import type { FormEvent } from 'react';
import type { State, StateHost } from '../shared/types.ts';
import { opensWith } from './app.tsx';
import { Install, Plus } from './icons.tsx';
import { Field, primary, Sheet } from './sheets.tsx';

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

function HostCard({ host, state }: { host: StateHost; state: State }) {
  const [retrying, setRetrying] = useState(false);
  const muxes = state.muxes.filter((m) => m.hostId === host.id);
  const panes = state.panes.filter((p) => muxes.some((m) => m.key === p.muxKey));

  const retry = () => {
    setRetrying(true);
    // The Hub re-dials the Host; the SSE `state` event is the receipt.
    fetch(`/api/hosts/${encodeURIComponent(host.id)}/retry`, { method: 'POST' })
      .catch(() => {})
      .finally(() => setTimeout(() => setRetrying(false), 800));
  };

  return (
    <li className="flex flex-col gap-2.5 rounded-card bg-elevated px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className={`size-2 shrink-0 rounded-full ${host.online ? 'bg-ok' : 'bg-danger'}`} />
        <span className="font-semibold">{host.label}</span>
        <span className={`min-w-0 truncate text-caption text-muted ${host.target ? 'font-mono' : ''}`}>
          {host.target ?? 'this machine'}
        </span>
        {host.online && (
          <span className="ml-auto shrink-0 text-caption tabular-nums text-muted">{count(panes.length, 'pane')}</span>
        )}
      </div>

      {host.online ? (
        <ul className="flex flex-col gap-1.5">
          {muxes.map((m) => {
            const mine = panes.filter((p) => p.muxKey === m.key);
            const blocked = mine.filter((p) => p.status === 'blocked').length;
            return (
              <li key={m.key} className="flex items-center gap-2.5 text-[13px] text-muted">
                <span className="font-mono text-fg">{m.kind}</span>
                {m.label !== m.kind && <span>{m.label}</span>}
                <span className="ml-auto tabular-nums">
                  {count(mine.length, 'pane')}
                  {blocked > 0 && ` · ${blocked} blocked`}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <p className="text-[13px] text-danger">{host.error ?? 'unreachable'}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={retry}
              disabled={retrying}
              className="flex h-9 items-center rounded-chip border border-border bg-bg px-3.5 text-[13px] font-medium active:bg-surface disabled:opacity-50"
            >
              {retrying ? 'Retrying…' : 'Retry now'}
            </button>
            {host.source === 'machines' && (
              <span className="ml-auto text-caption text-muted">from herdr machine list</span>
            )}
          </div>
        </>
      )}
    </li>
  );
}

export function Hosts({ state }: { state: State | null }) {
  const [add, setAdd] = useState(() => opensWith('addhost'));
  const hub = state?.hosts.find((h) => h.source === 'local' || !h.target);

  return (
    <div className="mx-auto max-w-2xl pt-[env(safe-area-inset-top)] pb-28">
      <header className="flex h-11 items-center justify-between px-4">
        <h1 className="text-title tracking-tight">Hosts</h1>
        {hub && <span className="text-caption text-muted">hub · {hub.label}</span>}
      </header>

      <ul className="flex flex-col gap-3 px-4 pt-2">
        {state?.hosts.map((h) => (
          <HostCard key={h.id} host={h} state={state} />
        ))}
        <li>
          <button
            type="button"
            onClick={() => setAdd(true)}
            className="flex w-full items-center gap-2.5 rounded-card border border-dashed border-border px-4 py-3.5 text-left font-medium text-accent active:bg-surface"
          >
            <Plus size={18} />
            Add Host
            <span className="ml-auto text-caption font-normal text-muted">ssh target · herdr or tmux</span>
          </button>
        </li>
      </ul>

      <AddHostSheet open={add} onClose={() => setAdd(false)} onSubmit={noop} />
    </div>
  );
}

export function AddHostSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (o: { label: string; ssh: string; session?: string }) => void;
}) {
  return (
    <Sheet open={open} title="Add Host" onClose={onClose}>
      <form
        className="flex flex-col gap-3.5 pb-2"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const v = (name: string) => String(data.get(name) ?? '').trim();
          onSubmit({ label: v('label'), ssh: v('ssh'), session: v('session') || undefined });
          onClose();
        }}
      >
        <Field label="Label" name="label" required placeholder="workstation" />
        <Field
          label="SSH target"
          name="ssh"
          required
          placeholder="user@host"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <Field
          label="tmux target"
          name="session"
          placeholder="main"
          hint="Leave empty for herdr"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <button type="submit" className={`${primary} mt-1`}>
          Add Host
        </button>
      </form>
    </Sheet>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-body">{label}</span>
        {hint && <span className="mt-px block text-caption text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`h-6.5 w-11 shrink-0 rounded-full p-[3px] transition-colors ${checked ? 'bg-accent' : 'bg-border'}`}
      >
        <span
          aria-hidden
          className={`block size-5 rounded-full transition-transform ${checked ? 'translate-x-[18px] bg-bg' : 'bg-fg'}`}
        />
      </button>
    </div>
  );
}

/** iOS only, and only outside the installed app: push needs Add to Home Screen there. */
export function InstallHint() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || location.search.includes('mock');
  const installed =
    matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  if (!ios || installed) return null;

  return (
    <p className="mx-4 mt-2 flex gap-2.5 rounded-card bg-elevated px-3 py-2.5 text-caption leading-relaxed text-muted">
      <Install className="mt-px shrink-0" />
      On iPhone, add taut to the Home Screen from the Share menu to receive notifications.
    </p>
  );
}

// ponytail: adding a Host writes hosts.json in phase 3.
const noop = () => {};
