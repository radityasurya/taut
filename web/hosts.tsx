import type { FormEvent } from 'react';
import type { State } from '../shared/types.ts';
import { Field, primary, Sheet } from './sheets.tsx';

export function HostList({ hosts, onAdd }: { hosts: State['hosts']; onAdd: () => void }) {
  return (
    <section className="mt-5">
      <h2 className="label-caps px-4 pb-1">Hosts</h2>
      <ul>
        {hosts.length === 0 && <li className="px-4 py-2.5 text-[15px] text-muted">No Hosts yet</li>}
        {hosts.map((h) => (
          <li key={h.id} className="border-t border-border/60 first:border-0">
            <div className="flex min-h-11 items-center gap-3 px-4 py-2.5">
              <span aria-hidden className={`size-2 shrink-0 rounded-full ${h.online ? 'bg-ok' : 'bg-danger'}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{h.label}</span>
                <span className={`mt-0.5 block truncate text-xs ${h.error ? 'text-danger' : 'text-muted'}`}>
                  {h.error ?? (h.online ? 'Online' : 'Offline')}
                </span>
              </span>
            </div>
          </li>
        ))}
        <li className="border-t border-border/60">
          <button
            type="button"
            onClick={onAdd}
            className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] text-accent active:bg-surface"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
            Add Host
          </button>
        </li>
      </ul>
    </section>
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
        <div className="px-4 py-3">
          <button type="submit" className={primary}>
            Add Host
          </button>
        </div>
      </form>
    </Sheet>
  );
}

export function PushToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex min-h-11 items-center gap-3 px-4 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">Push notifications</span>
        <span className="mt-0.5 block text-xs text-muted">Alerts when a Pane is blocked or done</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Push notifications"
        onClick={() => onChange(!enabled)}
        className={`h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors ${enabled ? 'bg-accent' : 'bg-border'}`}
      >
        <span
          aria-hidden
          className={`block size-5 rounded-full bg-bg transition-transform ${enabled ? 'translate-x-4' : ''}`}
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
    <div className="flex min-h-11 items-start gap-3 px-4 py-2.5">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="mt-0.5 shrink-0 text-muted"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V4m0 0 3.2 3.2M12 4 8.8 7.2" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 10.5H6A1.5 1.5 0 0 0 4.5 12v6.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5h-1.5"
        />
      </svg>
      <span className="min-w-0">
        <span className="block text-[15px]">Add to Home Screen</span>
        <span className="mt-0.5 block text-xs text-muted">Share → Add to Home Screen for full screen and push.</span>
      </span>
    </div>
  );
}
