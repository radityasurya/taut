import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import { installMock } from './mock.ts';
import './theme.css';

// A no-op unless the page was opened with `?mock`.
// ponytail: imported unconditionally, so the fixtures ride along in the bundle (~6 KB
// gzipped). Move behind a dynamic import if the bundle budget ever bites.
installMock();

createRoot(document.getElementById('root')!).render(<App />);
