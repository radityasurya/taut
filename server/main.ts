#!/usr/bin/env bun
import { resolve } from 'node:path';
import { HerdrMux } from './herdr.ts';
import { discoverLocalMuxes, hostId } from './hosts.ts';
import { startHttp } from './http.ts';
import { Hub } from './mux.ts';

const port = Number(process.env.TAUT_PORT ?? 7700);
const hostname = process.env.TAUT_BIND ?? '127.0.0.1';
const discovered = await discoverLocalMuxes();
const hub = new Hub();
const muxes = discovered.map(item => new HerdrMux(item.id, item.socketPath));
for (const mux of muxes) hub.add(hostId, mux);

const server = startHttp(hub, { port, hostname, staticDir: resolve(import.meta.dir, '../dist/web') });
console.log(`taut: http://${hostname}:${port}  muxes: ${muxes.map(mux => mux.id).join(', ') || 'none'}`);
for (const item of discovered) console.log(`taut: ${item.id} ${item.socketPath}`);
if (!muxes.length) console.warn('taut: warning: no Muxes found');

const shutdown = () => {
  hub.close(); server.stop(); process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
