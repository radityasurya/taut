import { resolve, sep } from 'node:path';
import type { InputBody, ScreenMode, SeenBody } from '../shared/types.ts';
import type { Hub } from './mux.ts';

const json = (value: unknown, status = 200) => Response.json(value, { status });
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export function startHttp(hub: Hub, opts: { port: number; hostname: string; staticDir: string }): ReturnType<typeof Bun.serve> {
  const root = resolve(opts.staticDir);
  return Bun.serve({
    port: opts.port, hostname: opts.hostname,
    // SSE streams idle between pings; adapter has its own 10 s RPC timeout
    idleTimeout: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const origin = req.headers.get('origin');
        try {
          if (!origin || new URL(origin).host !== req.headers.get('host')) return json({ error: 'origin' }, 403);
        } catch { return json({ error: 'origin' }, 403); }
      }
      // ponytail: Tailscale-User-Login check in phase 5.
      try {
        if (req.method === 'GET' && url.pathname === '/api/state') return json(await hub.state());
        if (req.method === 'GET' && url.pathname === '/api/events') {
          const paneKey = url.searchParams.get('pane') ?? undefined;
          const mode: ScreenMode = url.searchParams.get('mode') === 'recent' ? 'recent' : 'visible';
          if (paneKey && !await hub.hasPane(paneKey)) return json({ error: 'pane not found' }, 404);
          const encoder = new TextEncoder(); let cleanup = () => {};
          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              let closed = false;
              const send = (event: string, value: unknown) => {
                if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`));
              };
              send('state', await hub.state());
              const unsubscribe = hub.subscribe({ paneKey, mode, onState: state => send('state', state), onScreen: screen => send('screen', screen) });
              const ping = setInterval(() => { if (!closed) controller.enqueue(encoder.encode(': ping\n\n')); }, 25_000);
              cleanup = () => { if (closed) return; closed = true; unsubscribe(); clearInterval(ping); try { controller.close(); } catch {} };
              req.signal.addEventListener('abort', cleanup, { once: true });
            },
            cancel() { cleanup(); },
          });
          return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' } });
        }
        const match = url.pathname.match(/^\/api\/panes\/([^/]+)\/(screen|input|seen|explain)$/);
        if (match) {
          let key: string;
          try { key = decodeURIComponent(match[1]!); } catch { return json({ error: 'bad pane key' }, 400); }
          if (!await hub.hasPane(key)) return json({ error: 'pane not found' }, 404);
          const action = match[2];
          if (req.method === 'GET' && action === 'screen') {
            const mode: ScreenMode = url.searchParams.get('mode') === 'recent' ? 'recent' : 'visible';
            return json(await hub.read(key, mode));
          }
          if (req.method === 'GET' && action === 'explain') return json(await hub.explain(key));
          if (req.method === 'POST' && action === 'input') {
            let body: InputBody;
            try { body = await req.json(); } catch { return json({ error: 'body' }, 400); }
            if (typeof body !== 'object' || body === null || Array.isArray(body) || body.text !== undefined && typeof body.text !== 'string' ||
              body.keys !== undefined && (!Array.isArray(body.keys) || body.keys.some(key => typeof key !== 'string'))) return json({ error: 'body' }, 400);
            await hub.input(key, body); return new Response(null, { status: 204 });
          }
          if (req.method === 'POST' && action === 'seen') {
            let body: SeenBody;
            try { body = await req.json(); } catch { return json({ error: 'body' }, 400); }
            if (typeof body?.revision !== 'number' || !Number.isFinite(body.revision)) return json({ error: 'body' }, 400);
            hub.markSeen(key, body.revision); return new Response(null, { status: 204 });
          }
        }
        if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
        if (!['GET', 'HEAD'].includes(req.method)) return json({ error: 'not found' }, 404);

        const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
        let path = resolve(root, relative);
        if (path !== root && !path.startsWith(`${root}${sep}`)) return json({ error: 'not found' }, 404);
        let file = Bun.file(path);
        if (!await file.exists()) { path = resolve(root, 'index.html'); file = Bun.file(path); }
        if (!await file.exists()) return new Response('taut web build not found; run pnpm build\n', { status: 404 });
        const headers = new Headers();
        if (path.endsWith('/index.html') || path.endsWith('/sw.js')) headers.set('cache-control', 'no-cache');
        if (file.type) headers.set('content-type', file.type);
        return new Response(req.method === 'HEAD' ? null : file, { headers });
      } catch (error) {
        const message = errorMessage(error);
        return json({ error: message }, message === 'pane not found' ? 404 : 502);
      }
    },
  });
}
