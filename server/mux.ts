import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { parseAnsi } from '../shared/ansi.ts';
import type { Explain, InputBody, Mux, PushSubscriptionBody, Screen, ScreenEvent, ScreenMode, State, Tree } from '../shared/types.ts';
import { sendPush, type VapidKeys } from './push.ts';

export interface HubListener {
  onState(s: State): void;
  onScreen?(s: ScreenEvent): void;
  paneKey?: string;
  mode?: ScreenMode;
}

type Entry = { hostId: string; mux: Mux; tree?: Tree; refresh?: Promise<void>; again: boolean; timer?: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval>; unsubscribe: () => void };

interface StoredState { seen: Record<string, number>; vapid?: VapidKeys; subscriptions?: PushSubscriptionBody[] }

export class Hub {
  private entries = new Map<string, Entry>();
  private listeners = new Set<HubListener>();
  private screenTimers = new Map<HubListener, ReturnType<typeof setTimeout>>();
  private cached?: State;
  private statuses = new Map<string, { status: string; at: number }>();
  private lastLines = new Map<string, { revision: number; line?: string }>();
  private lastLineReads = 0;
  private lastLineWaiters: (() => void)[] = [];
  private seen: Record<string, number> = {};
  private stateTimer?: ReturnType<typeof setTimeout>;
  private seenTimer?: ReturnType<typeof setTimeout>;
  private lastStateAt = 0;
  private readonly statePath: string;
  private vapid: VapidKeys;
  private subscriptions: PushSubscriptionBody[];
  private readonly refreshMs: number;

  constructor(opts: { refreshMs?: number } = {}) {
    this.refreshMs = opts.refreshMs ?? 15_000;
    const root = process.env.XDG_STATE_HOME || join(os.homedir(), '.local/state');
    this.statePath = join(root, 'taut/state.json');
    let stored: StoredState = { seen: {} };
    try { stored = JSON.parse(readFileSync(this.statePath, 'utf8')); } catch {}
    this.seen = stored.seen ?? {};
    this.subscriptions = stored.subscriptions ?? [];
    if (stored.vapid) this.vapid = stored.vapid;
    else {
      const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const publicJwk = pair.publicKey.export({ format: 'jwk' });
      const privateJwk = pair.privateKey.export({ format: 'jwk' });
      this.vapid = { publicKey: Buffer.concat([Buffer.from([4]), Buffer.from(publicJwk.x!, 'base64url'), Buffer.from(publicJwk.y!, 'base64url')]).toString('base64url'), privateKey: privateJwk.d! };
      this.save();
    }
  }

  add(hostId: string, mux: Mux): void {
    const key = `${hostId}/${mux.id}`;
    const entry: Entry = { hostId, mux, again: false, unsubscribe: () => {} };
    entry.unsubscribe = mux.onChange(ids => this.changed(key, ids));
    if (this.refreshMs > 0) entry.interval = setInterval(() => void this.refresh(key).catch(() => {}), this.refreshMs);
    this.entries.set(key, entry);
    this.cached = undefined;
  }

  hasMux(hostId: string, muxId: string): boolean { return this.entries.has(`${hostId}/${muxId}`); }

  async refreshHost(hostId: string): Promise<void> {
    await Promise.all([...this.entries].filter(([, entry]) => entry.hostId === hostId).map(([key]) => this.refresh(key)));
    this.recompute();
    this.emitState();
  }

  private changed(muxKey: string, ids: string[] | 'all'): void {
    const entry = this.entries.get(muxKey); if (!entry) return;
    clearTimeout(entry.timer);
    // Nobody awaits this one, so a Mux that dies mid-refresh must not raise an unhandled
    // rejection: the routes that do await refresh still see the error and answer 502.
    entry.timer = setTimeout(() => void this.refresh(muxKey).catch(() => {}), 200);
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
        await this.fillLastLines(muxKey, entry);
        this.recompute();
        this.emitState();
      } while (entry.again);
    })().finally(() => { entry.refresh = undefined; });
    return entry.refresh;
  }

  private async fillLastLines(muxKey: string, entry: Entry): Promise<void> {
    const pending = (entry.tree?.panes ?? []).filter(pane => pane.agent && this.lastLines.get(`${muxKey}/${pane.id}`)?.revision !== pane.revision);
    await Promise.all(pending.map(async pane => {
      const key = `${muxKey}/${pane.id}`;
      await this.acquireLastLineRead();
      try {
        const screen = await entry.mux.read(pane.id, 'visible');
        const line = parseAnsi(screen.text).map(spans => spans.map(span => span.text).join('').trim()).filter(Boolean).at(-1)?.slice(0, 200);
        this.lastLines.set(key, { revision: pane.revision, line });
      } catch {
        this.lastLines.set(key, { revision: pane.revision });
      } finally {
        this.releaseLastLineRead();
      }
    }));
  }

  private async acquireLastLineRead(): Promise<void> {
    if (this.lastLineReads >= 4) await new Promise<void>(resolve => this.lastLineWaiters.push(resolve));
    this.lastLineReads++;
  }

  private releaseLastLineRead(): void {
    this.lastLineReads--;
    this.lastLineWaiters.shift()?.();
  }

  private recompute(): State {
    const hostIds = [...new Set([...this.entries.values()].map(e => e.hostId))];
    const state: State = {
      hosts: hostIds.map(id => ({ id, label: id, online: true, source: 'local' })), muxes: [], workspaces: [], tabs: [], panes: [],
    };
    for (const [muxKey, entry] of this.entries) {
      state.muxes.push({ key: muxKey, hostId: entry.hostId, kind: entry.mux.kind, label: entry.mux.id, online: true });
      if (!entry.tree) continue;
      for (const workspace of entry.tree.workspaces) state.workspaces.push({ key: `${muxKey}/${workspace.id}`, muxKey, ...workspace });
      for (const tab of entry.tree.tabs) state.tabs.push({ key: `${muxKey}/${tab.id}`, muxKey, ...tab });
      for (const pane of entry.tree.panes) {
        const key = `${muxKey}/${pane.id}`;
        const previous = this.statuses.get(key);
        if (pane.status === 'blocked' && previous?.status !== 'blocked') {
          console.log(`taut: ${key} → blocked`);
          const workspace = entry.tree.workspaces.find(item => item.id === pane.workspaceId);
          const payload = JSON.stringify({
            title: `${pane.agent?.trim() || 'Agent'} needs you`,
            body: `${workspace?.label ?? pane.workspaceId} · ${this.lastLines.get(key)?.line || pane.title}`,
            url: `#/pane/${key}`, tag: key,
          });
          // ponytail: independent sends are enough until subscription counts become large.
          for (const subscription of [...this.subscriptions]) void sendPush(subscription, payload, this.vapid).then(response => {
            if (response.status === 404 || response.status === 410) this.removeSubscription(subscription.endpoint);
            else if (!response.ok) console.warn(`taut: push ${response.status} ${subscription.endpoint}`);
          }).catch(error => console.warn(`taut: push failed ${subscription.endpoint}`, error));
        }
        const status = previous?.status === pane.status ? previous : { status: pane.status, at: Date.now() };
        this.statuses.set(key, status);
        state.panes.push({ key, muxKey, ...pane, seenRevision: this.seen[key] ?? 0, lastLine: pane.agent ? this.lastLines.get(key)?.line : undefined, statusChangedAt: status.at });
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
    this.seenTimer = setTimeout(() => this.save(), 100);
  }
  private save(): void {
    mkdirSync(dirname(this.statePath), { recursive: true });
    writeFileSync(this.statePath, `${JSON.stringify({ seen: this.seen, vapid: this.vapid, subscriptions: this.subscriptions }, null, 2)}\n`);
  }
  vapidPublicKey(): string { return this.vapid.publicKey; }
  addSubscription(subscription: PushSubscriptionBody): void {
    const index = this.subscriptions.findIndex(item => item.endpoint === subscription.endpoint);
    if (index < 0) this.subscriptions.push(subscription); else this.subscriptions[index] = subscription;
    this.save();
  }
  removeSubscription(endpoint: string): void {
    const next = this.subscriptions.filter(item => item.endpoint !== endpoint);
    if (next.length === this.subscriptions.length) return;
    this.subscriptions = next; this.save();
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
    for (const entry of this.entries.values()) { entry.unsubscribe(); entry.mux.close(); clearTimeout(entry.timer); clearInterval(entry.interval); }
    clearTimeout(this.stateTimer); clearTimeout(this.seenTimer);
    for (const timer of this.screenTimers.values()) clearTimeout(timer);
  }
}
