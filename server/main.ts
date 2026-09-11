#!/usr/bin/env bun
import { resolve } from 'node:path';
import { HerdrMux } from './herdr.ts';
import { discoverLocalMuxes, hostId, syncHosts } from './hosts.ts';
import { startHttp } from './http.ts';
import { Hub } from './mux.ts';
import { TmuxMux } from './tmux.ts';
import { discoverLocalTmux } from './tmux-discover.ts';

const port = Number(process.env.TAUT_PORT ?? 7700);
const hostname = process.env.TAUT_BIND ?? '127.0.0.1';
const discovered = await discoverLocalMuxes();
const hub = new Hub();
hub.setHost({ id: hostId, label: hostId, online: true, source: 'local' });
const muxes = discovered.map(item => new HerdrMux(item.id, item.socketPath));
for (const mux of muxes) hub.add(hostId, mux);
// Local tmux servers ride along, read-only from the phone. Prefixed so a tmux socket named
// `default` cannot collide with the herdr Mux of the same name on this Host.
const tmuxes = await discoverLocalTmux().catch(() => []);
for (const t of tmuxes) hub.add(hostId, new TmuxMux({ id: `tmux-${t.id}`, socket: t.socketPath }));

const server = startHttp(hub, { port, hostname, staticDir: resolve(import.meta.dir, '../dist/web') });
console.log(`taut: http://${hostname}:${port}  muxes: ${[...muxes.map(mux => mux.id), ...tmuxes.map(t => `tmux-${t.id}`)].join(', ') || 'none'}`);
for (const item of discovered) console.log(`taut: ${item.id} ${item.socketPath}`);
if (!muxes.length && !tmuxes.length) console.warn('taut: warning: no Muxes found');
void syncHosts(hub).catch(error => console.warn('taut: remote Host discovery failed', error));

const shutdown = () => {
  hub.close(); server.stop(); process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
