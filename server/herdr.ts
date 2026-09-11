import { basename } from 'node:path';
import { createConnection, type Socket } from 'node:net';
import { offeredKeys } from '../shared/blocked.ts';
import type { Explain, Mux, Pane, Screen, ScreenMode, Status, Tree, Workspace } from '../shared/types.ts';

type Json = Record<string, any>;
const statuses = new Set<Status>(['idle', 'working', 'blocked', 'done', 'unknown']);

export class HerdrMux implements Mux {
  readonly kind = 'herdr' as const;
  private revisions = new Map<string, number>();
  private rows = new Map<string, number>();
  private listeners = new Set<(paneIds: string[] | 'all') => void>();
  private stream?: Socket;
  private stopped = false;
  private retry?: ReturnType<typeof setTimeout>;
  private paneTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(readonly id: string, readonly socketPath: string) {}

  private rpc(method: string, params: Json): Promise<Json> {
    return new Promise((resolve, reject) => {
      const socket = createConnection(this.socketPath);
      let data = '';
      const timeout = setTimeout(() => socket.destroy(new Error('Herdr RPC timed out')), 10_000);
      const finish = (error?: Error, value?: Json) => {
        clearTimeout(timeout); socket.destroy();
        error ? reject(error) : resolve(value!);
      };
      socket.setEncoding('utf8');
      socket.on('connect', () => socket.write(`${JSON.stringify({ id: crypto.randomUUID(), method, params })}\n`));
      socket.on('data', chunk => {
        data += chunk;
        const end = data.indexOf('\n');
        if (end < 0) return;
        try {
          const message = JSON.parse(data.slice(0, end));
          if (message.error) finish(new Error(`${message.error.code}: ${message.error.message}`));
          else finish(undefined, message.result);
        } catch (error) { finish(error as Error); }
      });
      socket.on('error', error => finish(error));
      socket.on('end', () => { if (!data.includes('\n')) finish(new Error('Herdr RPC closed without a response')); });
    });
  }

  async tree(): Promise<Tree> {
    const result = await this.rpc('session.snapshot', {});
    const snap = result.snapshot;
    const sizes = new Map<string, { cols?: number; rows?: number }>();
    for (const layout of snap.layouts ?? []) for (const item of layout.panes ?? []) {
      sizes.set(item.pane_id, { cols: item.rect?.width, rows: item.rect?.height });
    }
    const panes: Pane[] = (snap.panes ?? []).map((pane: Json) => {
      this.revisions.set(pane.pane_id, pane.revision ?? 0);
      const rows = sizes.get(pane.pane_id)?.rows;
      if (rows) this.rows.set(pane.pane_id, rows);
      const agent = pane.display_agent ?? pane.agent;
      return {
        id: pane.pane_id, tabId: pane.tab_id, workspaceId: pane.workspace_id,
        title: pane.terminal_title_stripped || pane.label || pane.terminal_title || (pane.cwd && basename(pane.cwd)) || pane.pane_id,
        ...(pane.cwd ? { cwd: pane.cwd } : {}), ...(agent ? { agent } : {}),
        status: statuses.has(pane.agent_status) ? pane.agent_status : 'unknown',
        revision: pane.revision ?? 0, ...sizes.get(pane.pane_id),
      };
    });
    return {
      workspaces: (snap.workspaces ?? []).map((w: Json) => ({ id: w.workspace_id, label: w.label || w.workspace_id, ...(w.cwd ? { cwd: w.cwd } : {}) })),
      tabs: (snap.tabs ?? []).map((t: Json) => ({ id: t.tab_id, workspaceId: t.workspace_id, label: t.label || t.tab_id })),
      panes,
    };
  }

  async read(paneId: string, mode: ScreenMode): Promise<Screen> {
    const params = mode === 'visible'
      ? { pane_id: paneId, source: 'visible', format: 'ansi', strip_ansi: false }
      // ponytail: herdr 0.8.0 costs ~30 ms per requested line once `lines` reaches the pane
      // height, on panes running Claude Code — 500 lines is ~16 s, past our own 10 s timeout,
      // and the orphaned job then blocks the next read of that pane. Stay under the cliff:
      // `rows - 2` is the most herdr returns cheaply, and matches Screen/recent in CONTEXT.md
      // ("recent output as reflowed text"). Raise it when herdr fixes the scrollback path.
      : { pane_id: paneId, source: 'recent', format: 'text', strip_ansi: true, lines: Math.max(2, (this.rows.get(paneId) ?? 50) - 2) };
    const result = (await this.rpc('pane.read', params)).read;
    return { text: result.text, ansi: mode === 'visible', revision: this.revisions.get(paneId) ?? result.revision, mode };
  }

  async sendText(paneId: string, text: string): Promise<void> { await this.rpc('pane.send_text', { pane_id: paneId, text }); }
  async sendKeys(paneId: string, keys: string[]): Promise<void> { await this.rpc('pane.send_keys', { pane_id: paneId, keys }); }

  async explain(paneId: string): Promise<Explain | null> {
    try {
      const [explained, detected] = await Promise.all([
        this.rpc('agent.explain', { target: paneId }),
        this.rpc('pane.read', { pane_id: paneId, source: 'detection', format: 'text', strip_ansi: true }),
      ]);
      const value = explained.explain;
      const detection = detected.read.text as string;
      const hintKeys: Explain['hintKeys'] = [];
      for (const line of detection.split(/\r?\n/).slice(-3)) {
        for (const match of line.matchAll(/\b(enter|esc|tab|space|[a-z]|[1-9]|↑|↓)\s+to\s+([a-z][a-z ]+)/gi)) {
          hintKeys.push({ key: match[1]!.toLowerCase(), label: match[2]!.trim() });
        }
      }
      const explain: Explain = { ruleId: value.matched_rule?.id ?? '', state: statuses.has(value.state) ? value.state : 'unknown', detection, hintKeys };
      return { ...explain, hintKeys: offeredKeys(explain) };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('agent_not_found:')) return null;
      throw error;
    }
  }

  async newTab(workspaceId: string, o: { cwd?: string; label?: string; agent?: string }): Promise<Pane> {
    const result = await this.rpc('tab.create', { workspace_id: workspaceId, cwd: o.cwd, label: o.label, focus: false });
    const pane = result.root_pane;
    if (o.agent) await this.rpc('agent.start', { name: o.agent, pane_id: pane.pane_id, timeout_ms: 30_000 });
    return this.paneRecord(pane);
  }

  async newWorkspace(o: { cwd?: string; label?: string; branch?: string }): Promise<Workspace> {
    const method = o.branch ? 'worktree.create' : 'workspace.create';
    const result = await this.rpc(method, { ...(o.branch ? { branch: o.branch } : {}), cwd: o.cwd, label: o.label, focus: false });
    const workspace = result.workspace ?? result;
    return { id: workspace.workspace_id, label: workspace.label || o.label || workspace.workspace_id, ...(workspace.cwd ? { cwd: workspace.cwd } : {}) };
  }

  async rename(target: { workspaceId: string } | { tabId: string } | { paneId: string }, label: string): Promise<void> {
    if ('workspaceId' in target) await this.rpc('workspace.rename', { workspace_id: target.workspaceId, label });
    else if ('tabId' in target) await this.rpc('tab.rename', { tab_id: target.tabId, label });
    else await this.rpc('pane.rename', { pane_id: target.paneId, label });
  }
  async closePane(paneId: string): Promise<void> { await this.rpc('pane.close', { pane_id: paneId }); }

  private paneRecord(pane: Json): Pane {
    const agent = pane.display_agent ?? pane.agent;
    return { id: pane.pane_id, tabId: pane.tab_id, workspaceId: pane.workspace_id,
      title: pane.terminal_title_stripped || pane.label || pane.terminal_title || (pane.cwd && basename(pane.cwd)) || pane.pane_id,
      ...(pane.cwd ? { cwd: pane.cwd } : {}), ...(agent ? { agent } : {}),
      status: statuses.has(pane.agent_status) ? pane.agent_status : 'unknown', revision: pane.revision ?? 0 };
  }

  onChange(cb: (paneIds: string[] | 'all') => void): () => void {
    this.listeners.add(cb);
    if (!this.stream && !this.retry) this.connectEvents();
    return () => this.listeners.delete(cb);
  }

  private connectEvents(backoff = 1_000): void {
    if (this.stopped || !this.listeners.size) return;
    const socket = this.stream = createConnection(this.socketPath);
    let data = '';
    let started = false;
    const fail = () => {
      if (this.stream !== socket) return;
      this.stream = undefined; socket.destroy();
      if (this.stopped) return;
      this.retry = setTimeout(() => { this.retry = undefined; this.connectEvents(Math.min(backoff * 2, 10_000)); }, backoff);
    };
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(`${JSON.stringify({ id: crypto.randomUUID(), method: 'events.subscribe', params: { subscriptions: [
      'pane.updated', 'pane.created', 'pane.closed', 'pane.exited', 'pane.agent_detected', 'workspace.created', 'workspace.updated',
      'workspace.renamed', 'workspace.closed', 'tab.created', 'tab.closed', 'tab.renamed',
    ].map(type => ({ type })) } })}\n`));
    socket.on('data', chunk => {
      data += chunk;
      while (data.includes('\n')) {
        const end = data.indexOf('\n'); const line = data.slice(0, end); data = data.slice(end + 1);
        if (!line) continue;
        try {
          const message = JSON.parse(line);
          if (message.result?.type === 'subscription_started') { started = true; if (backoff > 1_000) this.emit('all'); continue; }
          if (message.event === 'pane_updated') {
            const pane = message.data?.pane; if (!pane?.pane_id) continue;
            if (pane.revision !== undefined) this.revisions.set(pane.pane_id, pane.revision);
            clearTimeout(this.paneTimers.get(pane.pane_id));
            this.paneTimers.set(pane.pane_id, setTimeout(() => { this.paneTimers.delete(pane.pane_id); this.emit([pane.pane_id]); }, 150));
          } else if (message.event) this.emit('all');
        } catch { fail(); }
      }
    });
    socket.on('error', fail); socket.on('close', fail);
    setTimeout(() => { if (!started && this.stream === socket) fail(); }, 10_000);
  }

  private emit(ids: string[] | 'all'): void { for (const listener of this.listeners) listener(ids); }
  close(): void {
    this.stopped = true; this.stream?.destroy(); clearTimeout(this.retry);
    for (const timer of this.paneTimers.values()) clearTimeout(timer);
    this.paneTimers.clear(); this.listeners.clear();
  }
}
