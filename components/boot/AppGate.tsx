'use client';
/* Guards the app routes: a first-time visitor must clear intro + onboarding
   before the shell is interactive, and returning users get the app instantly.
   Also paints the per-route page transition and the global heat "room tone". */

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { ThreadSheet } from '@/components/thread/ThreadSheet';
import { useApp } from '@/lib/app';

export function AppGate({ children }: { children: React.ReactNode }) {
  const introSeen = useStore((s) => s.introSeen);
  const onboarded = useStore((s) => s.onboarded);
  const path = usePathname();
  const app = useApp();

  const blocked = !introSeen || !onboarded;

  React.useEffect(() => {
    if (!blocked) return;
    // if the boot layer is showing, keep the shell mounted but non-interactive
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [blocked]);

  return (
    <>
      <motion.div
        key={path}
        initial={false}
        animate={{ opacity: blocked ? 0.15 : 1, filter: blocked ? 'blur(6px)' : 'blur(0px)', scale: blocked ? 0.99 : 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ pointerEvents: blocked ? 'none' : 'auto' }}
      >
        {children}
      </motion.div>
      <ThreadSheet />
      {app.mode === 'contested' && !blocked && (
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[45] h-[2px]" style={{ background: 'linear-gradient(90deg,transparent,var(--ht-cryo-teal),transparent)', opacity: 0.7 }} />
      )}
    </>
  );
}
