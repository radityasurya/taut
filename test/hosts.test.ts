import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { discoverRemote, forwarderArgs, herdrSupportsMachines, hostId, listHosts, localSockPath, nextBackoff, readHostsConfig, runtimeDir, validTarget, validateHosts, writeHostsConfig } from '../server/hosts.ts';
import { remoteAttachmentCommand, remoteAttachmentResult } from '../server/attach.ts';
import { startHttp } from '../server/http.ts';
import { Hub } from '../server/mux.ts';

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

test('Host sources merge by target with config taking precedence', async () => {
  const dir = await mkdtemp(join(os.tmpdir(), 'taut-hosts-')); dirs.push(dir); const path = join(dir, 'hosts.json');
  await writeFile(path, JSON.stringify([{ id: 'configured', label: 'Config label', target: 'u@same', session: 'chosen' }, { id: 'extra', target: 'u@extra' }]));
  const machinesJson = JSON.stringify({ machines: [
    { id: 'machine', label: 'Machine label', target: 'u@same', session: 'old', enabled: true },
    { id: 'off', target: 'u@off', enabled: false },
  ] });
  const hosts = await listHosts({ machinesJson, configPath: path });
  expect(hosts[0]).toEqual({ id: hostId, label: hostId, online: true, source: 'local' });
  expect(hosts[1]).toMatchObject({ id: 'configured', label: 'Config label', target: 'u@same', session: 'chosen', source: 'config' });
  expect(hosts[2]).toMatchObject({ id: 'extra', source: 'config' }); expect(hosts).toHaveLength(3);
});

test('failed machine discovery yields only local/config and versions gate machine list', async () => {
  expect(herdrSupportsMachines('herdr 0.8.0')).toBe(false); expect(herdrSupportsMachines('herdr 0.9.0')).toBe(true); expect(herdrSupportsMachines('1.0.0')).toBe(true);
  const hosts = await listHosts({ machinesJson: async () => { throw new Error('unknown command'); }, configPath: '/definitely/missing/taut-hosts.json' });
  expect(hosts.map(host => host.id)).toEqual([hostId]);
});

test('hosts config writes atomically and reads back', async () => {
  const dir = await mkdtemp(join(os.tmpdir(), 'taut-hosts-')); dirs.push(dir); const path = join(dir, 'nested/hosts.json');
  await writeHostsConfig([{ id: 'vps', target: 'me@vps' }], path);
  expect(await readHostsConfig(path)).toEqual([{ id: 'vps', target: 'me@vps' }]);
  expect(await readFile(path, 'utf8')).toEndWith('\n');
});

test('forwarder argv is exact', () => {
  expect(forwarderArgs('/run/taut', 'me@host', '/run/taut/h.sock', '/remote/h.sock')).toEqual([
    'ssh', '-N', '-o', 'ExitOnForwardFailure=yes', '-o', 'StreamLocalBindUnlink=yes', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3',
    '-o', 'ControlMaster=auto', '-o', 'ControlPath=/run/taut/cm-%C', '-o', 'ControlPersist=600', '-o', 'BatchMode=yes', '-L', '/run/taut/h.sock:/remote/h.sock', 'me@host',
  ]);
});

test('socket paths stay below the unix limit and hash only when needed', () => {
  expect(localSockPath('/tmp/taut', 'host', 'mux')).toBe('/tmp/taut/host-mux.sock');
  const long = localSockPath(`/tmp/${'r'.repeat(81)}`, 'host', 'mux');
  expect(Buffer.byteLength(long)).toBeLessThan(100); expect(long).not.toContain('host-mux');
  for (const [id, session] of [['../x', 'mux'], ['a/b', 'mux'], ['host', '../x']]) {
    const path = localSockPath('/tmp/taut', id!, session!); expect(path.startsWith('/tmp/taut/')).toBe(true); expect(path).not.toContain('..');
  }
});

test('ssh discovery rejects invalid targets before spawn and bad remote socket paths', async () => {
  let calls = 0;
  const spawn = ((_: string[]) => { calls++; return { stdout: new Response('{"sessions":[]}').body!, stderr: new Response('').body!, exited: Promise.resolve(0) }; }) as typeof Bun.spawn;
  await expect(discoverRemote('-bad', undefined, { spawn })).rejects.toThrow('invalid target'); expect(calls).toBe(0);
  const badSpawn = ((_: string[]) => ({ stdout: new Response('{"sessions":[{"running":true,"name":"x","socket_path":"relative.sock"}]}').body!, stderr: new Response('').body!, exited: Promise.resolve(0) })) as typeof Bun.spawn;
  await expect(discoverRemote('host', undefined, { spawn: badSpawn })).rejects.toThrow('bad socket path');
});

test('host validation rejects unsafe and duplicate config', () => {
  expect(validateHosts([{ id: '../x', target: 'host' }])).toBe('invalid id');
  expect(validateHosts([{ id: 'a', target: 'host' }, { id: 'a', target: 'other' }])).toBe('duplicate id');
  expect(validateHosts([{ id: 'a', target: 'host' }, { id: 'b', target: 'host' }])).toBe('duplicate target');
});

test('runtimeDir respects XDG_RUNTIME_DIR and falls back to /tmp/taut-<uid>', () => {
  const old = process.env.XDG_RUNTIME_DIR;
  try {
    process.env.XDG_RUNTIME_DIR = '/run/user/1000';
    expect(runtimeDir()).toBe('/run/user/1000/taut');
    delete process.env.XDG_RUNTIME_DIR;
    expect(runtimeDir()).toBe(`/tmp/taut-${process.getuid?.() ?? os.userInfo().uid}`);
  } finally {
    if (old === undefined) delete process.env.XDG_RUNTIME_DIR; else process.env.XDG_RUNTIME_DIR = old;
  }
});

test('forwarder backoff doubles, caps, and resets after a stable minute', () => {
  const values = [1_000]; for (let i = 0; i < 6; i++) values.push(nextBackoff(values.at(-1)!, 0));
  expect(values).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
  expect(nextBackoff(30_000, 60_000)).toBe(1_000);
});

test('remote attachment command and returned paths are stable', () => {
  expect(remoteAttachmentCommand('../odd name')).toBe("mkdir -p ~/.cache/taut/attachments && cat > ~/.cache/taut/attachments/'odd_name'");
  expect(remoteAttachmentResult('dev@vps', 'file.txt', 4)).toEqual({ path: '/home/dev/.cache/taut/attachments/file.txt', bytes: 4, display: '~/.cache/taut/attachments/file.txt' });
  expect(remoteAttachmentResult('vps', 'file.txt', 4).path).toBe('~/.cache/taut/attachments/file.txt');
  expect(validTarget('me@host')).toBe(true); expect(validTarget('-bad')).toBe(false); expect(validTarget('bad host')).toBe(false);
});

async function routeHarness(discoverRemote: (target: string, session?: string) => Promise<{ name: string; socketPath: string }[]>) {
  const dir = await mkdtemp(join(os.tmpdir(), 'taut-routes-')); dirs.push(dir);
  const oldConfig = process.env.XDG_CONFIG_HOME, oldState = process.env.XDG_STATE_HOME;
  process.env.XDG_CONFIG_HOME = join(dir, 'config'); process.env.XDG_STATE_HOME = join(dir, 'state');
  const hub = new Hub({ refreshMs: 0, suggest: null }); hub.setHost({ id: hostId, label: hostId, online: true, source: 'local' });
  let handle: ((request: Request) => Response | Promise<Response>) | undefined; const serve = Bun.serve;
  try { Bun.serve = ((options: { fetch: typeof handle }) => { handle = options.fetch; return {} as ReturnType<typeof Bun.serve>; }) as typeof Bun.serve;
    startHttp(hub, { port: 0, hostname: '127.0.0.1', staticDir: dir, discoverRemote });
  } finally { Bun.serve = serve; }
  const request = (path: string, body?: unknown, login?: string) => handle!(new Request(`http://taut.test${path}`, {
    method: body === undefined ? 'GET' : path === '/api/settings' ? 'PUT' : 'POST', headers: { host: 'taut.test', origin: 'http://taut.test', ...(login ? { 'tailscale-user-login': login } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
  return { hub, request, restore() { hub.close(); if (oldConfig === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = oldConfig; if (oldState === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = oldState; } };
}

test('probe, retry, settings, and trusted login routes', async () => {
  let fail = false;
  const h = await routeHarness(async target => { if (fail) throw new Error('first line\nlast ssh line'); return [{ name: target.includes('two') ? 'two' : 'one', socketPath: '/remote.sock' }]; });
  try {
    let response = await h.request('/api/hosts/probe', { target: 'me@one' }); expect(await response.json()).toEqual({ online: true, sessions: ['one'] });
    fail = true; response = await h.request('/api/hosts/probe', { target: 'me@one' }); expect(await response.json()).toEqual({ online: false, error: 'last ssh line' });
    response = await h.request('/api/hosts/probe', { target: '-bad' }); expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: 'target' });
    response = await h.request('/api/settings', { hosts: [{ id: 'remote', label: 'Remote', target: 'me@two' }] }); expect(response.status).toBe(200);
    response = await h.request('/api/settings', { hosts: [{ id: 'bad/id', target: 'host' }] }); expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: 'hosts' });
    expect((await h.request('/api/settings')).status).toBe(200); expect((await (await h.request('/api/settings')).json()).hosts[0].id).toBe('remote');
    fail = false; h.hub.setHost({ id: 'remote', label: 'Remote', target: 'me@two', source: 'config', online: false, error: 'old' });
    response = await h.request('/api/hosts/remote/retry', {}); expect(await response.json()).toMatchObject({ online: true, source: 'config' });
    response = await h.request('/api/settings', { trustedUser: 'alice' }, 'bob'); expect(response.status).toBe(400);
    response = await h.request('/api/settings', { trustedUser: 'alice' }, 'alice'); expect(response.status).toBe(200);
    expect((await h.request('/api/settings', undefined, 'bob')).status).toBe(403); expect((await h.request('/api/settings', undefined, 'alice')).status).toBe(200);
    response = await h.request('/api/settings', { trustedUser: null }, 'alice'); expect(response.status).toBe(200); expect((await h.request('/api/settings')).status).toBe(200);
  } finally { h.restore(); }
});

test('retry reuses the current host while discovery is in flight', async () => {
  let calls = 0, release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const h = await routeHarness(async () => { calls++; await pending; return []; });
  try {
    h.hub.setHost({ id: 'remote', label: 'Remote', target: 'host', source: 'config', online: false });
    const first = h.request('/api/hosts/remote/retry', {}); await Bun.sleep(0);
    const second = await h.request('/api/hosts/remote/retry', {});
    expect(second.status).toBe(200); expect(calls).toBe(1);
    release(); await first;
  } finally { release(); h.restore(); }
});
