import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join } from 'node:path';
import type { Explain, InputBody, Mux, Screen, ScreenEvent, ScreenMode, State, Tree } from '../shared/types.ts';

export interface HubListener {
  onState(s: State): void;
  onScreen?(s: ScreenEvent): void;
  paneKey?: string;
  mode?: ScreenMode;
}

type Entry = { hostId: string; mux: Mux; tree?: Tree; refresh?: Promise<void>; again: boolean; timer?: ReturnType<typeof setTimeout>; unsubscribe: () => void };

export class Hub {
  private entries = new Map<string, Entry>();
  private listeners = new Set<HubListener>();
  private screenTimers = new Map<HubListener, ReturnType<typeof setTimeout>>();
  private cached?: State;
  private statuses = new Map<string, string>();
  private seen: Record<string, number> = {};
  private stateTimer?: ReturnType<typeof setTimeout>;
  private seenTimer?: ReturnType<typeof setTimeout>;
  private lastStateAt = 0;
  private readonly statePath: string;

  constructor() {
    const root = process.env.XDG_STATE_HOME || join(os.homedir(), '.local/state');
    this.statePath = join(root, 'taut/state.json');
    try { this.seen = JSON.parse(readFileSync(this.statePath, 'utf8')).seen ?? {}; } catch {}
  }

  add(hostId: string, mux: Mux): void {
    const key = `${hostId}/${mux.id}`;
    const entry: Entry = { hostId, mux, again: false, unsubscribe: () => {} };
    entry.unsubscribe = mux.onChange(ids => this.changed(key, ids));
    this.entries.set(key, entry);
    this.cached = undefined;
  }

  private changed(muxKey: string, ids: string[] | 'all'): void {
    const entry = this.entries.get(muxKey); if (!entry) return;
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => void this.refresh(muxKey), 200);
    for (const listener of this.listeners) {
      if (!listener.paneKey || !listener.onScreen) continue;
      const parsed = this.resolve(listener.paneKey);
      if (!parsed || parsed.muxKey !== muxKey || ids !== 'all' && !ids.includes(parsed.paneId)) continue;
      clearTimeout(this.screenTimers.get(listener));
      this.screenTimers.set(listener, setTimeout(() => { this.screenTimers.delete(listener); void this.sendScreen(listener); }, 150));
    }
  }

  private async refresh(muxKey: string): Promise<void> {
    const entry = this.entries.get(muxKey); if (!entry) return;
    if (entry.refresh) { entry.again = true; return entry.refresh; }
    entry.refresh = (async () => {
      do {
        entry.again = false;
        entry.tree = await entry.mux.tree();
        this.recompute();
        this.emitState();
      } while (entry.again);
    })().finally(() => { entry.refresh = undefined; });
    return entry.refresh;
  }

  private recompute(): State {
    const hostIds = [...new Set([...this.entries.values()].map(e => e.hostId))];
    const state: State = {
      hosts: hostIds.map(id => ({ id, label: id, online: true })), muxes: [], workspaces: [], panes: [],
    };
    for (const [muxKey, entry] of this.entries) {
      state.muxes.push({ key: muxKey, hostId: entry.hostId, kind: entry.mux.kind, label: entry.mux.id, online: true });
      if (!entry.tree) continue;
      for (const workspace of entry.tree.workspaces) state.workspaces.push({ key: `${muxKey}/${workspace.id}`, muxKey, ...workspace });
      for (const pane of entry.tree.panes) {
        const key = `${muxKey}/${pane.id}`;
        const previous = this.statuses.get(key);
        if (pane.status === 'blocked' && previous !== 'blocked') console.log(`taut: ${key} → blocked`);
        this.statuses.set(key, pane.status);
        state.panes.push({ key, muxKey, ...pane, seenRevision: this.seen[key] ?? 0 });
      }
    }
    this.cached = state;
    return state;
  }

  async state(): Promise<State> {
    await Promise.all([...this.entries.keys()].map(key => this.entries.get(key)!.tree ? undefined : this.refresh(key)));
    return this.cached ?? this.recompute();
  }

  private resolve(paneKey: string): { muxKey: string; paneId: string; entry: Entry } | undefined {
    const first = paneKey.indexOf('/'); const second = paneKey.indexOf('/', first + 1);
    if (first < 0 || second < 0) return;
    const muxKey = paneKey.slice(0, second); const entry = this.entries.get(muxKey);
    if (!entry || !entry.tree?.panes.some(p => p.id === paneKey.slice(second + 1))) return;
    return { muxKey, paneId: paneKey.slice(second + 1), entry };
  }

  async read(paneKey: string, mode: ScreenMode): Promise<Screen> {
    await this.state(); const found = this.resolve(paneKey);
    if (!found) throw new Error('pane not found');
    return found.entry.mux.read(found.paneId, mode);
  }
  async input(paneKey: string, body: InputBody): Promise<void> {
    await this.state(); const found = this.resolve(paneKey);
    if (!found) throw new Error('pane not found');
    if (body.text !== undefined) await found.entry.mux.sendText(found.paneId, body.text);
    if (body.keys?.length) await found.entry.mux.sendKeys(found.paneId, body.keys);
  }
  async explain(paneKey: string): Promise<Explain | null> {
    await this.state(); const found = this.resolve(paneKey);
    if (!found) throw new Error('pane not found');
    return found.entry.mux.explain(found.paneId);
  }
  async hasPane(paneKey: string): Promise<boolean> { await this.state(); return Boolean(this.resolve(paneKey)); }

  markSeen(paneKey: string, revision: number): void {
    this.seen[paneKey] = revision; this.recompute(); this.emitState(); clearTimeout(this.seenTimer);
    this.seenTimer = setTimeout(() => void this.saveSeen(), 100);
  }
  private async saveSeen(): Promise<void> {
    await mkdir(dirname(this.statePath), { recursive: true });
    await writeFile(this.statePath, `${JSON.stringify({ seen: this.seen }, null, 2)}\n`);
  }

  subscribe(listener: HubListener): () => void {
    this.listeners.add(listener);
    if (listener.paneKey && listener.onScreen) queueMicrotask(() => void this.sendScreen(listener));
    return () => { this.listeners.delete(listener); clearTimeout(this.screenTimers.get(listener)); this.screenTimers.delete(listener); };
  }
  private async sendScreen(listener: HubListener): Promise<void> {
    if (!this.listeners.has(listener) || !listener.paneKey || !listener.onScreen) return;
    try { listener.onScreen({ key: listener.paneKey, ...await this.read(listener.paneKey, listener.mode ?? 'visible') }); } catch {}
  }
  private emitState(): void {
    const wait = Math.max(0, 500 - (Date.now() - this.lastStateAt));
    clearTimeout(this.stateTimer);
    this.stateTimer = setTimeout(() => {
      this.lastStateAt = Date.now(); const state = this.cached ?? this.recompute();
      for (const listener of this.listeners) listener.onState(state);
    }, wait);
  }
  close(): void {
    for (const entry of this.entries.values()) { entry.unsubscribe(); entry.mux.close(); clearTimeout(entry.timer); }
    clearTimeout(this.stateTimer); clearTimeout(this.seenTimer);
    for (const timer of this.screenTimers.values()) clearTimeout(timer);
  }
}
