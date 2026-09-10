import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer.tsx';

// One input look and one primary button look for every sheet.
export const field =
  'min-h-11 w-full rounded-composer border border-border bg-surface px-3.5 text-body text-fg placeholder:text-muted';
export const primary =
  'min-h-12 w-full rounded-chip bg-accent text-body font-semibold text-bg active:opacity-90';

export function Field({ label, hint, ...input }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block px-4 py-2">
      <span className="label-caps block pb-1.5">{label}</span>
      <input {...input} className={field} />
      {hint && <span className="mt-1 block text-caption text-muted">{hint}</span>}
    </label>
  );
}

/** Reads the trimmed value of a named field, or undefined when it is empty. */
const values = (form: HTMLFormElement) => {
  const data = new FormData(form);
  return (name: string) => (String(data.get(name) ?? '').trim() || undefined);
};

/**
 * Bottom sheet: the shadcn Drawer (vaul). Swipe to dismiss, scroll lock, focus trap and
 * Escape all come from vaul; taut only supplies the surface and the title.
 * ponytail: `repositionInputs` is off because the viewport meta already asks the browser
 * for `interactive-widget=resizes-content`, which moves the drawer for us. Turn it back
 * on if a browser without that support ever hides a focused field behind the keyboard.
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
  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} repositionInputs={false}>
      {/* No description: every sheet is a titled form. Telling Radix so keeps it quiet. */}
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto overscroll-contain pb-2">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * One chip per agent plus "shell only", as radio inputs so the form still reads
 * `agent` from FormData. The chip is the label; the input stays screen-reader only.
 */
function AgentChips({ agents }: { agents: string[] }) {
  return (
    <fieldset className="px-4 py-2">
      <legend className="label-caps pb-1.5">Start</legend>
      <div className="flex flex-wrap gap-2">
        {[...agents, ''].map((a, i) => (
          <label key={a || 'shell'} className="block">
            <input type="radio" name="agent" value={a} defaultChecked={i === 0} className="peer sr-only" />
            <span
              className="flex min-h-10 items-center rounded-chip border border-border bg-surface px-3.5 text-[13px] text-fg peer-checked:border-accent peer-checked:bg-accent peer-checked:font-semibold peer-checked:text-bg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
            >
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
        <AgentChips agents={agents} />
        <div className="px-4 pt-3">
          <button type="submit" className={primary}>
            Create tab
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
        <div className="px-4 pt-3">
          <button type="submit" className={primary}>
            Create workspace
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
        <div className="px-4 pt-3">
          <button type="submit" className={primary}>
            Rename
          </button>
        </div>
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
