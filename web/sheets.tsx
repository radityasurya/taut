import { useEffect, useId, useRef } from 'react';
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react';

// One input look and one primary button look for every sheet.
export const field =
  'min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-[15px] text-fg placeholder:text-muted';
export const primary = 'min-h-11 w-full rounded-lg bg-accent text-[15px] font-medium text-bg active:opacity-90';

export function Field({ label, hint, ...input }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block px-4 py-2">
      <span className="label-caps block pb-1.5">{label}</span>
      <input {...input} className={field} />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** Reads the trimmed value of a named field, or undefined when it is empty. */
const values = (form: HTMLFormElement) => {
  const data = new FormData(form);
  return (name: string) => (String(data.get(name) ?? '').trim() || undefined);
};

/**
 * Bottom sheet. Closes on Escape and on a backdrop tap, and focuses its first field.
 * ponytail: no scroll lock and no focus trap; add both when a sheet grows past one form.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    addEventListener('keydown', onKey);
    panel.current?.querySelector<HTMLElement>('input, select')?.focus();
    return () => removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-fg/40" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-bg pb-[env(safe-area-inset-bottom)]"
      >
        <div className="sticky top-0 bg-bg pt-2">
          <span aria-hidden className="mx-auto block h-1 w-9 rounded-full bg-border" />
          <h2 id={titleId} className="px-4 pt-3 pb-1 text-[15px] font-medium">
            {title}
          </h2>
        </div>
        {children}
      </div>
    </div>
  );
}

export function NewTabSheet({
  open,
  onClose,
  onSubmit,
  agents = ['claude', 'codex'],
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (o: { label?: string; cwd?: string; agent?: string }) => void;
  agents?: string[];
}) {
  return (
    <Sheet open={open} title="New Tab" onClose={onClose}>
      <form
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const v = values(e.currentTarget);
          onSubmit({ label: v('label'), cwd: v('cwd'), agent: v('agent') });
          onClose();
        }}
      >
        <Field label="Label" name="label" placeholder="Optional" />
        <Field
          label="Directory"
          name="cwd"
          placeholder="~/projects/taut"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <label className="block px-4 py-2">
          <span className="label-caps block pb-1.5">Agent</span>
          <select name="agent" defaultValue="" className={field}>
            <option value="">None</option>
            {agents.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <div className="px-4 py-3">
          <button type="submit" className={primary}>
            Open Tab
          </button>
        </div>
      </form>
    </Sheet>
  );
}

export function NewWorkspaceSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (o: { cwd: string; label?: string; branch?: string }) => void;
}) {
  return (
    <Sheet open={open} title="New Workspace" onClose={onClose}>
      <form
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const v = values(e.currentTarget);
          onSubmit({ cwd: v('cwd')!, label: v('label'), branch: v('branch') });
          onClose();
        }}
      >
        <Field
          label="Directory"
          name="cwd"
          required
          placeholder="~/projects/taut"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <Field label="Label" name="label" placeholder="Optional" />
        <Field
          label="Branch"
          name="branch"
          placeholder="Optional"
          hint="Creates a worktree for this branch"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="px-4 py-3">
          <button type="submit" className={primary}>
            Open Workspace
          </button>
        </div>
      </form>
    </Sheet>
  );
}

export function RenameSheet({
  open,
  onClose,
  onSubmit,
  current,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (label: string) => void;
  current: string;
  kind: 'Workspace' | 'Tab' | 'Pane';
}) {
  return (
    <Sheet open={open} title={`Rename ${kind}`} onClose={onClose}>
      <form
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          onSubmit(values(e.currentTarget)('label')!);
          onClose();
        }}
      >
        <Field label="Name" name="label" required defaultValue={current} autoCapitalize="none" autoCorrect="off" />
        <div className="px-4 py-3">
          <button type="submit" className={primary}>
            Rename
          </button>
        </div>
      </form>
    </Sheet>
  );
}

export function ConfirmCloseSheet({
  open,
  onClose,
  onConfirm,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <Sheet open={open} title="Close Pane" onClose={onClose}>
      <p className="px-4 pt-1 text-[15px]">Close “{title}”?</p>
      <p className="px-4 pt-1 text-sm leading-relaxed text-muted">The Pane and anything running in it stops.</p>
      <div className="flex gap-2 px-4 py-4">
        <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-lg bg-surface text-[15px] font-medium">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="min-h-11 flex-1 rounded-lg bg-danger text-[15px] font-medium text-bg active:opacity-90"
        >
          Close
        </button>
      </div>
    </Sheet>
  );
}
