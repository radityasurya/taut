import { expect, test } from 'bun:test';
import type { Explain, Mux, Pane, Screen, ScreenMode, Tree, Workspace } from '../shared/types.ts';
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
