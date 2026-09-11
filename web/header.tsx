import { useEffect, useState, type ReactNode } from 'react';

/**
 * Sticky top bar for the root screens. Large title at rest; once the page scrolls past
 * a few pixels it shrinks to the compact 44 px bar and gains a hairline. The document is
 * the scroller on these screens, so one window listener is enough.
 */
export function TopBar({ title, right, below }: { title: string; right?: ReactNode; below?: ReactNode }) {
  const [compact, setCompact] = useState(() => scrollY > 24);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setCompact(scrollY > 24));
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => { removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);
  return (
    <header
      className={`sticky top-0 z-30 bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-md transition-[box-shadow] duration-200 ${
        compact ? 'shadow-[0_1px_0_0_var(--border)]' : ''
      }`}
    >
      <div
        className={`flex items-center justify-between px-4 transition-[height] duration-200 motion-reduce:transition-none ${
          compact ? 'h-11' : 'h-14'
        }`}
      >
        <h1
          className={`origin-left font-semibold tracking-tight transition-[font-size] duration-200 motion-reduce:transition-none ${
            compact ? 'text-[17px]' : 'text-[26px]'
          }`}
        >
          {title}
        </h1>
        {right && <div className="flex items-center gap-1">{right}</div>}
      </div>
      {below}
    </header>
  );
}
