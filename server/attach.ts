import { mkdir, open, unlink } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import type { AttachResult } from '../shared/types.ts';
import { hostId as localHostId } from './hosts.ts';

export class TooLarge extends Error {}
export class EmptyBody extends Error {}

// Take the final path component, replace characters outside [A-Za-z0-9._-], cap at 120, and fall back to "file".
export function sanitizeName(raw: string | null): string {
  const leaf = (raw ?? 'file').split(/[\\/]/).at(-1)!.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
  return leaf || 'file';
}

export function remoteAttachmentCommand(name: string): string {
  return `mkdir -p ~/.cache/taut/attachments && cat > ~/.cache/taut/attachments/'${sanitizeName(name)}'`;
}

export function remoteAttachmentResult(target: string, name: string, bytes: number): AttachResult {
  const display = `~/.cache/taut/attachments/${sanitizeName(name)}`;
  const user = target.includes('@') ? target.slice(0, target.indexOf('@')) : '';
  return { path: user ? `/home/${user}/.cache/taut/attachments/${sanitizeName(name)}` : display, bytes, display };
}

export async function writeAttachment(hostId: string, name: string, body: ReadableStream<Uint8Array>, capBytes: number, target?: string, spawn: typeof Bun.spawn = Bun.spawn): Promise<AttachResult> {
  if (hostId !== localHostId) {
    if (!target) throw new Error('host target not found');
    const child = spawn(['ssh', '-o', 'BatchMode=yes', target, remoteAttachmentCommand(name)], { stdin: 'pipe', stdout: 'ignore', stderr: 'pipe' });
    let bytes = 0;
    try {
      for await (const chunk of body as ReadableStream<Uint8Array> & AsyncIterable<Uint8Array>) {
        bytes += chunk.byteLength; if (bytes > capBytes) throw new TooLarge();
        child.stdin.write(chunk); await child.stdin.flush();
      }
      if (!bytes) throw new EmptyBody();
      child.stdin.end();
      const stderr = await new Response(child.stderr).text();
      if (await child.exited !== 0) throw new Error(stderr.trim().split(/\r?\n/).filter(Boolean).at(-1) || 'ssh failed');
      return remoteAttachmentResult(target, name, bytes);
    } catch (error) {
      child.stdin.end(); child.kill(); await child.exited.catch(() => {});
      const cleanup = spawn(['ssh', '-o', 'BatchMode=yes', target, `rm -f ~/.cache/taut/attachments/'${sanitizeName(name)}'`], { stdout: 'ignore', stderr: 'ignore' });
      await cleanup.exited.catch(() => {}); throw error;
    }
  }
  const home = os.homedir();
  const directory = join(process.env.XDG_CACHE_HOME || join(home, '.cache'), 'taut/attachments');
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${Date.now()}-${name}`);
  const file = await open(path, 'wx');
  let bytes = 0;
  try {
    for await (const chunk of body as ReadableStream<Uint8Array> & AsyncIterable<Uint8Array>) {
      bytes += chunk.byteLength;
      if (bytes > capBytes) throw new TooLarge();
      await file.write(chunk);
    }
    if (bytes === 0) throw new EmptyBody();
    await file.close();
    return { path, bytes, display: path.startsWith(home) ? `~${path.slice(home.length)}` : path };
  } catch (error) {
    await file.close().catch(() => {});
    await unlink(path).catch(() => {});
    throw error;
  }
}
