import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { AGENT_KEYS, SHELL_KEYS } from '../web/keys.ts';
import { herdrAvailable, herdrMux, startThrowawayHerdr } from './harness.ts';

const eventually = async <T>(read: () => Promise<T>, accepts: (value: T) => boolean, timeout: number) => {
  const deadline = Date.now() + timeout;
  let value = await read();
  while (!accepts(value) && Date.now() < deadline) { await Bun.sleep(50); value = await read(); }
  return value;
};

describe.skipIf(!herdrAvailable)('HerdrMux contract', () => {
  let fixture: Awaited<ReturnType<typeof startThrowawayHerdr>>;
  let mux: ReturnType<typeof herdrMux>;
  let workspaceId: string;
  let paneId: string;

  beforeAll(async () => {
    fixture = await startThrowawayHerdr();
    mux = herdrMux(fixture.sock);
    const workspace = await mux.newWorkspace({ cwd: fixture.dir, label: 'taut-contract' });
    workspaceId = workspace.id;
    paneId = (await mux.tree()).panes.find(pane => pane.workspaceId === workspaceId)!.id;
  }, 15_000);

  afterAll(async () => { mux?.close(); await fixture?.stop(); });

  test('tree returns a pane', async () => {
    expect((await mux.tree()).panes.length).toBeGreaterThanOrEqual(1);
  });

  test('sendText and sendKeys reach the visible screen', async () => {
    await mux.sendText(paneId, 'echo taut-ok');
    await mux.sendKeys(paneId, ['enter']);
    const screen = await eventually(() => mux.read(paneId, 'visible'), value => value.text.includes('taut-ok'), 5_000);
    expect(screen.text).toContain('taut-ok');
  });

  test('onChange fires after a send', async () => {
    // herdr replays a backlog of `*_created` events on subscribe, so wait for that
    // backlog to settle first, or the assertion passes on stale events instead of the send.
    let lastEventAt = Date.now();
    const settleOff = mux.onChange(ids => {
      if (ids === 'all' || ids.includes(paneId)) lastEventAt = Date.now();
    });
    while (Date.now() - lastEventAt < 300) await Bun.sleep(50);
    settleOff();

    const marker = Date.now();
    const changed = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { off(); reject(new Error('onChange timed out')); }, 2_000);
      const off = mux.onChange(ids => {
        if ((ids === 'all' || ids.includes(paneId)) && Date.now() >= marker) { clearTimeout(timeout); off(); resolve(); }
      });
    });
    // A plain `echo` never touches PaneInfo, so herdr never emits `pane.updated` for it.
    // Set the terminal title instead: that's a real send through the same pty, and it's
    // the same OSC mechanism agent CLIs use to report status, which is what onChange exists for.
    await mux.sendText(paneId, "printf '\\033]0;taut-change\\007'");
    await mux.sendKeys(paneId, ['enter']);
    await changed;
  });

  test('all Pane key-bar names are accepted', async () => {
    const pane = await mux.newTab(workspaceId, { cwd: fixture.dir, label: 'key-test' });
    const names = [...new Set([...AGENT_KEYS, ...SHELL_KEYS].map(([name]) => name))];
    names.sort(name => name === 'ctrl+d' ? 1 : -1);
    await mux.sendKeys(pane.id, names);
    try { await mux.closePane(pane.id); } catch {}
  });

  test('newTab, rename, and closePane update the tree', async () => {
    const pane = await mux.newTab(workspaceId, { cwd: fixture.dir, label: 'new-tab' });
    expect((await mux.tree()).panes.some(item => item.id === pane.id)).toBe(true);
    await mux.rename({ paneId: pane.id }, 'renamed-pane');
    expect((await mux.tree()).panes.find(item => item.id === pane.id)?.title).toBe('renamed-pane');
    await mux.closePane(pane.id);
    const tree = await eventually(() => mux.tree(), value => !value.panes.some(item => item.id === pane.id), 2_000);
    expect(tree.panes.some(item => item.id === pane.id)).toBe(false);
  });

  test('explain returns null for a shell', async () => {
    expect(await mux.explain(paneId)).toBeNull();
  });
});
