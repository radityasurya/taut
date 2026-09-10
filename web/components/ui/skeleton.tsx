// shadcn Skeleton, restyled onto taut's tokens. `--surface` is the inset-control
// surface, which is what a placeholder should read as.
import type * as React from 'react';

import { cn } from '@/lib/utils.ts';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('animate-pulse rounded-chip bg-surface', className)} {...props} />;
}

export { Skeleton };
