import { access, cp, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { createConnection } from 'node:net';
import os from 'node:os';
import { join } from 'node:path';
import { HerdrMux } from '../server/herdr.ts';

const herdr = Bun.which('herdr');
export const herdrAvailable = Boolean(herdr);

export function herdrRpc(sock: string, method: string, params: Record<string, unknown> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(sock);
    let data = '';
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(`${JSON.stringify({ id: crypto.randomUUID(), method, params })}\n`));
    socket.on('data', chunk => {
      data += chunk;
      const end = data.indexOf('\n');
      if (end < 0) return;
      socket.destroy();
      const message = JSON.parse(data.slice(0, end));
      message.error ? reject(new Error(`${message.error.code}: ${message.error.message}`)) : resolve(message.result);
    });
    socket.on('error', reject);
  });
}

export async function startThrowawayHerdr(): Promise<{ sock: string; dir: string; stop(): Promise<void> }> {
  if (!herdr) throw new Error('herdr is not on PATH');
  const dir = await mkdtemp(join(os.tmpdir(), 'taut-herdr-'));
  const state = join(dir, 'state');
  const manifests = join(os.homedir(), '.local/state/herdr/agent-detection/remote');
  await mkdir(join(state, 'herdr/agent-detection'), { recursive: true });
  await mkdir(join(dir, 'runtime'), { recursive: true });
  // Agent manifests are downloaded state, so an isolated HOME otherwise has none.
  try { await cp(manifests, join(state, 'herdr/agent-detection/remote'), { recursive: true }); } catch {}
  const sock = join(dir, 'h.sock');
  const child = Bun.spawn([herdr, 'server'], {
    cwd: dir,
    env: { ...process.env, HOME: dir, XDG_CONFIG_HOME: join(dir, 'config'), XDG_STATE_HOME: state, XDG_RUNTIME_DIR: join(dir, 'runtime'), HERDR_SOCKET_PATH: sock },
    stdout: 'pipe', stderr: 'pipe',
  });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try { await access(sock); break; } catch {}
    if (child.exitCode !== null) {
      const stderr = await new Response(child.stderr).text();
      await rm(dir, { recursive: true, force: true });
      throw new Error(`herdr server exited ${child.exitCode}: ${stderr.trim()}`);
    }
    await Bun.sleep(25);
  }
  try { await access(sock); } catch {
    child.kill(); await child.exited; await rm(dir, { recursive: true, force: true });
    throw new Error('herdr server did not create HERDR_SOCKET_PATH');
  }
  let stopped = false;
  return {
    sock, dir,
    async stop() {
      if (stopped) return;
      stopped = true;
      try { await herdrRpc(sock, 'server.stop'); } catch {}
      if (await Promise.race([child.exited.then(() => true), Bun.sleep(1_000).then(() => false)]) === false) child.kill();
      await child.exited;
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export const herdrMux = (sock: string) => new HerdrMux('throwaway', sock);
