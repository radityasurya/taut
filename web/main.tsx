import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import { installMock } from './mock.ts';
import './theme.css';

// A no-op unless the page was opened with `?mock`.
// ponytail: imported unconditionally, so the fixtures ride along in the bundle (~6 KB
// gzipped). Move behind a dynamic import if the bundle budget ever bites.
installMock();

// Agentation: dev-only annotation overlay that hands UI notes to Claude Code over MCP
// (see .mcp.json). Desktop pointers only; it is not built for touch and never ships.
const Dev =
  import.meta.env.DEV && matchMedia('(pointer: fine)').matches
    ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation })))
    : null;

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    {Dev && (
      <Suspense>
        <Dev />
      </Suspense>
    )}
  </>,
);
