import { access } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';

export const hostId = os.hostname();

export async function discoverLocalMuxes(): Promise<{ id: string; socketPath: string }[]> {
  if (process.env.HERDR_SOCKET_PATH) {
    try { await access(process.env.HERDR_SOCKET_PATH); return [{ id: 'default', socketPath: process.env.HERDR_SOCKET_PATH }]; } catch { return []; }
  }
  try {
    const process = Bun.spawn(['herdr', 'session', 'list', '--json'], { stdout: 'pipe', stderr: 'ignore' });
    const output = await new Response(process.stdout).text();
    if (await process.exited !== 0) throw new Error('herdr list failed');
    const rows = JSON.parse(output).sessions ?? [];
    const found = rows.filter((row: any) => row.running).map((row: any) => ({ id: row.name, socketPath: row.socket_path }));
    if (found.length) return found;
  } catch {}
  // ponytail: local only; hosts.json + ssh forwarders in phase 5.
  const socketPath = join(os.homedir(), '.config/herdr/herdr.sock');
  try { await access(socketPath); return [{ id: 'default', socketPath }]; } catch { return []; }
}
