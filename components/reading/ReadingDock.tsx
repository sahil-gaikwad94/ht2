'use client';
/* ============================================================================
   components/reading/ReadingDock — the app's only floating reading chrome.

   If you left an article part-read, this pill hovers over whatever screen you
   are on with the piece, how far in you got, and one tap back into it. It
   replaces the old per-article "reading receipt" dashboard entirely.
   ==========================================================================*/

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/app';
import { useStore } from '@/lib/store';

export function ReadingDock() {
  const app = useApp();
  const s = useStore();
  const path = usePathnameSafe();
  const [dismissed, setDismissed] = React.useState<string | null>(null);

  const current = React.useMemo(() => {
    const entries = Object.entries(s.reads)
      .filter(([, r]) => r.pct >= 3 && r.pct < 97)
      .sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0));
    for (const [id, r] of entries) {
      const post = app.posts.find((p) => String(p.id) === String(id));
      if (post) return { post, pct: Math.round(r.pct) };
    }
    return null;
  }, [s.reads, app.posts]);

  /* never while the article itself is open, and never after a dismissal */
  if (!current || path.startsWith('/read/') || dismissed === String(current.post.id)) return null;

  const { post, pct } = current;
  const remaining = Math.max(1, Math.round((post.minutes ?? 6) * (1 - pct / 100)));
  const title = post.title ?? post.text ?? 'Untitled';

  return (
    <AnimatePresence>
      <motion.div
        key={String(post.id)}
        initial={{ y: 26, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 22, opacity: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none fixed inset-x-0 bottom-[max(86px,calc(env(safe-area-inset-bottom)+86px))] z-40 flex justify-center px-4 md:bottom-6"
      >
        <div className="ht-glass pointer-events-auto flex w-[min(520px,94vw)] items-center gap-3 !rounded-full py-2 pl-2 pr-2.5">
          <span className="relative grid h-[38px] w-[38px] shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: 'linear-gradient(140deg,rgba(255,180,84,.35),rgba(0,0,0,.6))' }}>
            {post.cover ? (
              <img src={post.cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 4.5h6a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2.5H5ZM19 4.5h-1.5A2.5 2.5 0 0 0 15 7v13a2.5 2.5 0 0 1 2.5-2.5H19Z" />
              </svg>
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-ember-300">continue reading</span>
            <span className="mt-0.5 block truncate text-[13.5px] font-semibold text-white">{title}</span>
            <span className="relative mt-1 block h-[3px] w-full overflow-hidden rounded-full bg-white/[.1]">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg,var(--ht-flame),var(--ht-ember))' }}
              />
            </span>
          </span>

          <span className="ht-num hidden shrink-0 text-[11.5px] text-ink-mute sm:block">{remaining} min left</span>

          <button
            onClick={() => app.openPost(String(post.id))}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-bold text-[#1A0E02]"
            style={{ background: 'var(--ht-ember)', boxShadow: '0 10px 26px -10px rgba(255,180,84,.8)' }}
            aria-label={`Resume ${title}`}
          >
            →
          </button>
          <button
            onClick={() => setDismissed(String(post.id))}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] text-ink-mute transition-colors hover:text-white"
            aria-label="Hide reading progress"
          >
            ✕
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function usePathnameSafe() {
  try {
    return usePathname() ?? '/';
  } catch {
    return '/';
  }
}
