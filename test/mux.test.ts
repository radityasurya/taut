import { expect, test } from 'bun:test';
import type { Explain, Mux, Pane, Screen, ScreenMode, Tree, Workspace } from '../shared/types.ts';
import { startHttp } from '../server/http.ts';
import { hostId } from '../server/hosts.ts';
import { Hub } from '../server/mux.ts';

test('Hub adds tabs, status timestamps, and cached agent last lines', async () => {
  let reads = 0;
  const tree: Tree = {
    workspaces: [{ id: 'w1', label: 'Work' }],
    tabs: [{ id: 't1', workspaceId: 'w1', label: 'Tab' }],
    panes: [
      { id: 'agent', tabId: 't1', workspaceId: 'w1', title: 'Agent', agent: 'codex', status: 'working', revision: 1 },
      { id: 'shell', tabId: 't1', workspaceId: 'w1', title: 'Shell', status: 'unknown', revision: 1 },
    ],
  };
  const mux: Mux = {
    kind: 'herdr', id: 'fake', tree: async () => tree,
    read: async (_paneId: string, mode: ScreenMode): Promise<Screen> => { reads++; return { text: 'first\n\x1b[31m last line \x1b[0m\n\n', ansi: true, revision: 1, mode }; },
    sendText: async () => {}, sendKeys: async () => {}, onChange: () => () => {},
    newTab: async (): Promise<Pane> => tree.panes[0]!, newWorkspace: async (): Promise<Workspace> => tree.workspaces[0]!,
    rename: async () => {}, closePane: async () => {}, explain: async (): Promise<Explain | null> => null, close: () => {},
  };
  const hub = new Hub(); hub.add('local', mux);
  const first = await hub.state();
  expect(first.tabs).toEqual([{ key: 'local/fake/t1', muxKey: 'local/fake', id: 't1', workspaceId: 'w1', label: 'Tab' }]);
  expect(first.panes.find(pane => pane.id === 'agent')?.lastLine).toBe('last line');
  expect(first.panes.find(pane => pane.id === 'shell')?.lastLine).toBeUndefined();
  const firstAt = first.panes[0]!.statusChangedAt!;
  expect(firstAt).toBeNumber(); expect(reads).toBe(1);
  await hub.refreshHost('local'); expect(reads).toBe(1);
  await Bun.sleep(2); tree.panes[0]!.status = 'done';
  await hub.refreshHost('local');
  expect((await hub.state()).panes[0]!.statusChangedAt).toBeGreaterThan(firstAt);
  expect(reads).toBe(1);
  hub.close();
});

test('host retry runs discovery and returns the refreshed host', async () => {
  let discoveries = 0;
  let refreshes = 0;
  let handle: ((request: Request) => Response | Promise<Response>) | undefined;
  const hub = {
    hasMux: () => true,
    add: () => {},
    refreshHost: async (id: string) => { expect(id).toBe(hostId); refreshes++; },
    state: async () => ({
      hosts: [{ id: hostId, label: hostId, online: true, source: 'local' as const }],
      muxes: [], workspaces: [], tabs: [], panes: [],
    }),
  } as unknown as Hub;
  const serve = Bun.serve;
  try {
    Bun.serve = ((options: { fetch: typeof handle }) => { handle = options.fetch; return {} as ReturnType<typeof Bun.serve>; }) as typeof Bun.serve;
    startHttp(hub, {
      port: 0, hostname: '127.0.0.1', staticDir: import.meta.dir,
      discover: async () => { discoveries++; return [{ id: 'fake', socketPath: '/unused' }]; },
    });
  } finally {
    Bun.serve = serve;
  }
  const response = await handle!(new Request(`http://taut.test/api/hosts/${encodeURIComponent(hostId)}/retry`, {
    method: 'POST', headers: { host: 'taut.test', origin: 'http://taut.test' },
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: hostId, label: hostId, online: true, source: 'local' });
  expect(discoveries).toBe(1);
  expect(refreshes).toBe(1);
});
