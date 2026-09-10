import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer.tsx';

// One inset-control look and one primary button look for every sheet. The drawer surface
// is `--elevated`, so a field inset into it reads as `--bg`.
export const field =
  'min-h-11 w-full rounded-composer border border-border bg-bg px-3.5 text-body text-fg placeholder:text-muted';
export const primary =
  'flex h-12 w-full items-center justify-center rounded-composer bg-accent text-body font-semibold text-bg active:opacity-90';

export function Field({
  label,
  hint,
  className,
  ...input
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caption text-muted">{label}</span>
      <input {...input} className={className ?? field} />
      {hint && <span className="text-caption text-muted">{hint}</span>}
    </label>
  );
}

/** Reads the trimmed value of a named field, or undefined when it is empty. */
const values = (form: HTMLFormElement) => {
  const data = new FormData(form);
  return (name: string) => String(data.get(name) ?? '').trim() || undefined;
};

/**
 * Bottom sheet: the shadcn Drawer (vaul). Swipe to dismiss, scroll lock, focus trap and
 * Escape all come from vaul; taut only supplies the surface, the title and the meta line.
 * ponytail: `repositionInputs` is off because the viewport meta already asks the browser
 * for `interactive-widget=resizes-content`, which moves the drawer for us. Turn it back
 * on if a browser without that support ever hides a focused field behind the keyboard.
 */
export function Sheet({
  open,
  title,
  meta,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  meta?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} repositionInputs={false}>
      {/* No description: every sheet is a titled form. Telling Radix so keeps it quiet. */}
      <DrawerContent aria-describedby={undefined}>
        <div className="flex items-center justify-between px-4 pt-1 pb-3.5">
          <DrawerTitle className="text-title tracking-tight">{title}</DrawerTitle>
          {meta && <span className="text-caption text-muted">{meta}</span>}
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pb-1">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}

/** A list of actions, from the ⋯ button and from a long-press. */
export function MenuSheet({
  open,
  title,
  onClose,
  items,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  items: { label: string; onClick?: () => void; hint?: string; danger?: boolean; disabled?: boolean }[];
}) {
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <ul className="pb-2">
        {items.map((it) => (
          <li key={it.label}>
            <button
              type="button"
              disabled={it.disabled}
              onClick={() => {
                it.onClick?.();
                onClose();
              }}
              className={`flex min-h-12 w-full items-center gap-3 rounded-chip px-1 text-left text-body active:bg-surface disabled:opacity-40 ${
                it.danger ? 'text-danger' : 'text-fg'
              }`}
            >
              <span className="flex-1">{it.label}</span>
              {it.hint && <span className="font-mono text-caption text-muted">{it.hint}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/**
 * One chip per agent plus "shell only", as radio inputs so the form still reads
 * `agent` from FormData. The chip is the label; the input stays screen-reader only.
 */
function AgentChips({ agents }: { agents: string[] }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2 text-caption text-muted">Start</legend>
      <div className="flex flex-wrap gap-2">
        {[...agents, ''].map((a, i) => (
          <label key={a || 'shell'} className="block">
            <input type="radio" name="agent" value={a} defaultChecked={i === 0} className="peer sr-only" />
            <span className="flex items-center gap-1.5 rounded-chip border border-border bg-bg px-3.5 py-2 text-[13px] text-fg peer-checked:border-accent peer-checked:bg-accent peer-checked:font-semibold peer-checked:text-bg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
              {i === 0 && <span aria-hidden>✻</span>}
              {a || 'shell only'}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function NewTabSheet({
  open,
  onClose,
  onSubmit,
  where,
  cwd,
  agents = ['claude', 'pi', 'codex'],
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (o: { label?: string; cwd?: string; agent?: string }) => void;
  where?: ReactNode;
  cwd?: string;
  agents?: string[];
}) {
  return (
    <Sheet open={open} title="New Tab" meta={where} onClose={onClose}>
      <form
        className="flex flex-col gap-3.5 pb-2"
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
          defaultValue={cwd}
          placeholder="~/projects/taut"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`${field} font-mono text-[13px]`}
        />
        <AgentChips agents={agents} />
        <button type="submit" className={`${primary} mt-1`}>
          Create tab
        </button>
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
        className="flex flex-col gap-3.5 pb-2"
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
          className={`${field} font-mono text-[13px]`}
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
        <button type="submit" className={`${primary} mt-1`}>
          Create workspace
        </button>
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
        className="flex flex-col gap-3.5 pb-2"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          onSubmit(values(e.currentTarget)('label')!);
          onClose();
        }}
      >
        <Field label="Name" name="label" required defaultValue={current} autoCapitalize="none" autoCorrect="off" />
        <button type="submit" className={`${primary} mt-1`}>
          Rename
        </button>
      </form>
    </Sheet>
  );
}

/** A destructive confirm is a Dialog, not a drawer: it must not be swipe-dismissible. */
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
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close Pane</DialogTitle>
          <DialogDescription className="text-fg">Close “{title}”?</DialogDescription>
        </DialogHeader>
        <p className="mt-1 text-body text-muted">The Pane and anything running in it stops.</p>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-chip bg-surface text-body font-medium active:opacity-90"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="min-h-11 flex-1 rounded-chip bg-danger text-body font-medium text-bg active:opacity-90"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
