// Shared contract between the Hub (server/), the web app (web/), and tests.
// Vocabulary: see CONTEXT.md (Hub, Host, Mux, Workspace, Tab, Pane, Agent, Status, Seen, Screen, Explain).

export type Status = 'idle' | 'working' | 'blocked' | 'done' | 'unknown';

export interface Workspace { id: string; label: string; cwd?: string }
export interface Tab { id: string; workspaceId: string; label: string }
export interface Pane {
  id: string; tabId: string; workspaceId: string; title: string; cwd?: string;
  agent?: string; status: Status; revision: number; cols?: number; rows?: number;
}
export interface Tree { workspaces: Workspace[]; tabs: Tab[]; panes: Pane[] }

export type ScreenMode = 'visible' | 'recent';
export interface Screen { text: string; ansi: boolean; revision: number; mode: ScreenMode }

export interface Explain {
  ruleId: string; state: Status; detection: string;
  hintKeys: { key: string; label: string }[];
}

export interface Mux {
  readonly kind: 'herdr' | 'tmux';
  readonly id: string;
  tree(): Promise<Tree>;
  read(paneId: string, mode: ScreenMode): Promise<Screen>;
  sendText(paneId: string, text: string): Promise<void>;
  sendKeys(paneId: string, keys: string[]): Promise<void>; // herdr key names are canonical
  onChange(cb: (paneIds: string[] | 'all') => void): () => void;
  // herdr only; tmux throws Error('unsupported'). ponytail: no capability flags, add at a third backend.
  newTab(workspaceId: string, o: { cwd?: string; label?: string; agent?: string }): Promise<Pane>;
  newWorkspace(o: { cwd?: string; label?: string; branch?: string }): Promise<Workspace>;
  rename(t: { workspaceId: string } | { tabId: string } | { paneId: string }, label: string): Promise<void>;
  closePane(paneId: string): Promise<void>;
  explain(paneId: string): Promise<Explain | null>;
  close(): void;
}

// ---- HTTP API payloads ----
// Keys: muxKey = `${hostId}/${muxId}`, paneKey = `${muxKey}/${paneId}`. Raw in JSON;
// `encodeURIComponent(key)` when used as a path segment (`/api/panes/:key/...`).

export interface StateHost {
  id: string; label: string; online: boolean; error?: string;
  /** ssh target or tailnet name; absent for the local machine */
  target?: string;
  /** where the Host came from: this machine, `herdr machine list`, or the config file */
  source?: 'local' | 'machines' | 'config';
}
export interface StateMux { key: string; hostId: string; kind: 'herdr' | 'tmux'; label: string; online: boolean }
export interface StateWorkspace { key: string; muxKey: string; id: string; label: string; cwd?: string }
export interface StateTab { key: string; muxKey: string; workspaceId: string; id: string; label: string }
export interface StatePane {
  key: string; muxKey: string; workspaceId: string; tabId: string; id: string; title: string;
  cwd?: string; agent?: string; status: Status; revision: number; seenRevision: number;
  cols?: number; rows?: number;
  /** last non-empty line of the visible Screen; agent Panes only, cached per revision by the Hub */
  lastLine?: string;
  /** ms epoch of the last Status change the Hub observed; first sight counts as a change */
  statusChangedAt?: number;
}
/** GET /api/state and SSE `event: state` */
export interface State { hosts: StateHost[]; muxes: StateMux[]; workspaces: StateWorkspace[]; tabs: StateTab[]; panes: StatePane[] }
/** GET /api/panes/:key/screen?mode= and SSE `event: screen` */
export interface ScreenEvent extends Screen { key: string }
/** POST /api/panes/:key/input — text is sent first, then keys */
export interface InputBody { text?: string; keys?: string[] }
/** POST /api/panes/:key/seen */
export interface SeenBody { revision: number }
/** POST /api/push/subscribe */
export interface PushSubscriptionBody {
  endpoint: string; expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

// ---- ANSI spans (shared/ansi.ts) ----
// fg/bg: a number 0..15 is a palette index (render as `var(--ansi-N)`);
// a string is a CSS color such as `rgb(r,g,b)` (256-color cube/grayscale and truecolor).
export interface Span {
  text: string; fg?: number | string; bg?: number | string;
  bold?: boolean; dim?: boolean; italic?: boolean; underline?: boolean; inverse?: boolean; strike?: boolean;
}
