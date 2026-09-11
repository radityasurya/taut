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

export async function writeAttachment(hostId: string, name: string, body: ReadableStream<Uint8Array>, capBytes: number): Promise<AttachResult> {
  // ponytail: phase 5 adds an ssh target running `mkdir -p ~/.cache/taut/attachments && cat > …`.
  if (hostId !== localHostId) throw new Error('remote hosts: phase 5');
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
