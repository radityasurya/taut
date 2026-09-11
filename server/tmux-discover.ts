import { readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

export async function discoverLocalTmux(): Promise<{ id: string; socketPath: string }[]> {
  const dir = `/tmp/tmux-${process.getuid?.() ?? 0}`;
  let names: string[];
  try { names = await readdir(dir); } catch { return []; }
  const found: { id: string; socketPath: string }[] = [];
  for (const name of names) {
    const socketPath = join(dir, name);
    try {
      if (!(await stat(socketPath)).isSocket()) continue;
      const proc = Bun.spawn(['tmux', '-S', socketPath, 'list-sessions'], { stdout: 'ignore', stderr: 'ignore' });
      if (await proc.exited === 0) found.push({ id: basename(socketPath), socketPath });
    } catch {}
  }
  return found.sort((a, b) => a.id.localeCompare(b.id));
}

export async function remoteTmuxSockets(exec: (cmd: string) => Promise<{ stdout: string; stderr: string; code: number }>): Promise<{ id: string; socketPath: string }[]> {
  const uid = (await exec('id -u')).stdout.trim();
  if (!/^\d+$/.test(uid)) return [];
  const dir = `/tmp/tmux-${uid}`;
  const listed = await exec(`ls -1 ${dir} 2>/dev/null`);
  if (listed.code !== 0) return [];
  const found: { id: string; socketPath: string }[] = [];
  for (const id of listed.stdout.split(/\r?\n/).filter(Boolean)) {
    if (!/^[A-Za-z0-9._-]+$/.test(id)) continue;
    const socketPath = `${dir}/${id}`;
    // A zero exit code is the health check; output is deliberately discarded.
    const checked = await exec(`tmux -S ${socketPath} list-sessions >/dev/null 2>&1`);
    if (checked.code === 0) found.push({ id, socketPath });
  }
  return found.sort((a, b) => a.id.localeCompare(b.id));
}
