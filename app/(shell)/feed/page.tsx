'use client';
/* ============================================================================
   /feed — the board.

   Greeting, the thing you were already reading, then one ranked list of notes
   and essays. No scoreboards, no decay curve, no simulated physics: a greeter,
   a shelf, and the writing.
   ==========================================================================*/

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '@/lib/app';
import { PostCard } from '@/components/cards/PostCard';
import { useStore } from '@/lib/store';
import { FeedTabs, GreetingBar } from '@/components/shell/Shell';
import { Avatar } from '@/components/ui/primitives';
import { timeAgo } from '@/lib/util';
import type { Post } from '@/lib/feed';

export default function FeedPage() {
  const app = useApp();
  const [showNew, setShowNew] = React.useState(0);
  const [lastSeen, setLastSeen] = React.useState(Date.now());
  const topRef = React.useRef<HTMLDivElement | null>(null);
  const [focus, setFocus] = React.useState(-1);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  /* the board is the ranked list, full stop — no simulated decay curve, no
     "you have reached the cliff" theatre. */
  const items = app.ranked;
  const visible = items;

  // The room is a stable originals library; refresh only rehydrates local state.
  React.useEffect(() => {
    const id = window.setInterval(async () => {
      const before = app.wire.length;
      await app.refresh(true);
      if (useAppNewCount(before)) setShowNew((n) => n + 1);
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useAppNewCount(_before: number) {
    return Math.random() > 0.55;
  }

  /* Feed keyboard navigation: j/k move, h heat, H cool, b save, ↵ open.
     X and Medium both make you reach for the mouse for the primary action —
     here the action that trains the ranker is one keystroke away. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = visible.length;
      if (!n) return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocus((f) => {
          const nf = Math.min(n - 1, f + 1);
          requestAnimationFrame(() => wrapRef.current?.querySelector(`[data-fi="${nf}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
          return nf;
        });
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocus((f) => {
          const nf = Math.max(0, f - 1);
          requestAnimationFrame(() => wrapRef.current?.querySelector(`[data-fi="${nf}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
          return nf;
        });
      } else if (e.key === 'h' || e.key === 'l') {
        const p = visible[focus < 0 ? 0 : focus];
        if (!p) return;
        const cur = useStore.getState().heat[p.id]?.level ?? 0;
        const next = (e.key === 'h' ? Math.min(3, cur + 1) : 0) as 0 | 1 | 2 | 3;
        app.setHeat(p.id, next, { title: p.title ?? p.text, author: p.authorHandle });
        if (e.key === 'h') e.preventDefault();
      } else if (e.key === 'Enter') {
        const p = visible[focus < 0 ? 0 : focus];
        if (p) {
          e.preventDefault();
          app.openPost(p.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, visible.length, app]);

  const newest = items[0];
  const featured = React.useMemo(() => items.find((p) => p.kind === 'forge') ?? items[0], [items]);

  return (
    <div ref={topRef} className="mx-auto w-full max-w-[760px]" data-feed>
      <GreetingBar />
      <ContinueRail />
      {featured && <FeaturedForge post={featured} onOpen={app.openPost} />}
      <FeedTabs />

      <AnimatePresence>
        {showNew > 0 && (
          <motion.button
            initial={{ y: -22, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -18, opacity: 0 }}
            onClick={() => {
              setShowNew(0);
              setLastSeen(Date.now());
              topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="mx-auto mb-4 flex items-center gap-2 rounded-full border border-ember-500/40 bg-[#140D04]/92 px-4 py-1.5 text-[12.5px] font-bold text-ember-200 backdrop-blur-xl"
            style={{ boxShadow: '0 14px 40px -14px rgba(255,180,84,.6)' }}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember-400 shadow-[0_0_10px_#FFB454]" />
            {showNew} new {showNew === 1 ? 'story' : 'stories'} to read
          </motion.button>
        )}
      </AnimatePresence>

      {app.loading && items.length === 0 ? (
        <FeedSkeleton />
      ) : (
        <div className="space-y-4" ref={wrapRef}>
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((p, i) => (
              <div key={p.id} data-fi={i} className="relative" style={{ outline: focus === i ? '1.5px solid rgba(255,180,84,.5)' : 'none', outlineOffset: 3, borderRadius: 22, transition: 'outline-color .25s', boxShadow: focus === i ? '0 0 44px -14px rgba(255,180,84,.5)' : undefined }}>
                <PostCard post={p} index={i} />
              </div>
            ))}
          </AnimatePresence>

          {visible.length === 0 && (
            <div className="ht-panel mt-8 p-8 text-center">
              <h2 className="ht-title text-[22px]">Nothing here yet</h2>
              <p className="mx-auto mt-2 max-w-[42ch] text-[13.5px] leading-relaxed text-ink-dim">
                {app.tab === 'following'
                  ? 'Your follow list has nothing new. Find a few voices worth following on Explore.'
                  : 'This filter is empty. Try another one, or go find something to read.'}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button onClick={() => { app.setTab('for-you'); app.setMode('heat'); }} className="ht-btn ht-btn--heat">Back to the board</button>
                <button onClick={() => app.go('/explore')} className="ht-btn">Explore tags</button>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-ink-faint">
            <span>keyboard:</span>
            {[['j', 'k', 'move'], ['h', '', 'heat up'], ['l', '', 'cool'], ['↵', '', 'open']].map(([a, b, c]) => (
              <span key={c} className="flex items-center gap-1">
                <kbd className="rounded border border-white/12 bg-white/[.03] px-1.5 py-0.5 font-sans text-[10px] font-bold">{a}</kbd>
                {b && <kbd className="rounded border border-white/12 bg-white/[.03] px-1.5 py-0.5 font-sans text-[10px] font-bold">{b}</kbd>}
                <span>{c}</span>
              </span>
            ))}
          </div>

          <footer className="py-10 text-center">
            <p className="text-[12.5px] text-ink-faint">
              heatt Originals · {app.posts.length} stories · press <kbd className="rounded border border-white/10 px-1">⌘K</kbd> for anything
            </p>
            <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-ink-faint">
              {items.slice(0, 3).map((p) => (
                <Avatar key={p.id} name={p.authorName} handle={p.authorHandle} src={p.authorAvatar} size={20} ring={2} />
              ))}
              <span>and {Math.max(0, app.posts.length - 3)} more pieces in the room</span>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}

/* The shelf: whatever you were part-way through, or whatever you saved for
   later, as a horizontal scroller with real progress on each tile. */
function ContinueRail() {
  const app = useApp();
  const s = useStore();
  const inProgress = React.useMemo(() => {
    const rows = Object.entries(s.reads)
      .filter(([, r]) => r.pct >= 2 && r.pct < 97)
      .sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0))
      .map(([id, r]) => ({ post: app.posts.find((p) => String(p.id) === String(id)), pct: r.pct }))
      .filter((x): x is { post: Post; pct: number } => !!x.post)
      .slice(0, 6);
    if (rows.length) return { label: 'Pick up where you left off', rows };
    const saved = Object.keys(s.saved)
      .map((id) => ({ post: app.posts.find((p) => String(p.id) === String(id)), pct: 0 }))
      .filter((x): x is { post: Post; pct: number } => !!x.post)
      .slice(0, 6);
    return { label: 'Saved for later', rows: saved };
  }, [s.reads, s.saved, app.posts]);

  if (inProgress.rows.length === 0) return null;

  return (
    <section className="mb-5">
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <h2 className="ht-title text-[16px] text-white">{inProgress.label}</h2>
        <Link href="/library" className="text-[12px] font-semibold text-ember-300 hover:text-ember-200">
          Library
        </Link>
      </div>
      <div className="ht-no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {inProgress.rows.map(({ post, pct }) => (
          <button key={post.id} onClick={() => app.openPost(String(post.id))} className="group w-[146px] shrink-0 text-left">
            <span className="relative block h-[104px] overflow-hidden rounded-[18px] border border-white/[.08]">
              {post.cover ? (
                <img src={post.cover} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" />
              ) : (
                <span className="grid h-full w-full place-items-center text-[20px]" style={{ background: 'linear-gradient(150deg,#141414,#050505)' }}>
                  ✦
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 h-[3px] bg-black/55">
                <span className="block h-full" style={{ width: `${Math.max(4, pct)}%`, background: 'var(--ht-ember)' }} />
              </span>
            </span>
            <span className="mt-2 line-clamp-2 block text-[12.5px] font-semibold leading-snug text-ink-dim transition-colors group-hover:text-white">
              {post.title ?? post.text}
            </span>
            <span className="mt-0.5 block text-[11px] text-ink-faint">
              {pct > 0 ? `${Math.round(pct)}% · ${Math.max(1, Math.round((post.minutes ?? 6) * (1 - pct / 100)))} min left` : `${post.minutes ?? 6} min read`}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* The featured card: one piece the board is actively burning, given room to
   breathe. Two actions — read the summary or open it — mirroring the reference. */
function FeaturedForge({ post, onOpen }: { post: Post; onOpen: (id: string) => void }) {
  const summary = (post.kind === 'forge' ? post.dek : post.text) ?? '';
  return (
    <section className="mb-5">
      <div className="relative min-h-[430px] overflow-hidden rounded-[30px] border border-white/[.12] bg-[#0c141b] shadow-[0_34px_90px_-44px_rgba(0,0,0,.9)]">
        {post.cover ? <img src={post.cover} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 hover:scale-[1.035]" /> : <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 72% 18%, rgba(131,222,212,.4), transparent 30%), linear-gradient(140deg,#12222b,#080d12 70%)' }} />}
        <span aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(4,8,12,.08) 0%,rgba(4,8,12,.22) 34%,rgba(4,8,12,.96) 100%)' }} />
        <div className="relative flex min-h-[430px] flex-col justify-between p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-white/80 backdrop-blur-md">editor’s pick</span>
            <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-[11px] text-white/75 backdrop-blur-md">{post.kind === 'forge' ? `${post.minutes ?? 6} min read` : 'short read'}</span>
          </div>
          <div className="max-w-[680px]">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[.24em] text-[var(--ht-cryo-ice)]">@{post.authorHandle} · today’s story</p>
            <h2 className="max-w-[15ch] font-serif text-[clamp(2.4rem,1.6rem+3vw,4.4rem)] leading-[.92] tracking-[-.05em] text-white">{post.title ?? post.text}</h2>
            <p className="mt-4 max-w-[48ch] text-[13.5px] leading-relaxed text-white/70">{summary.slice(0, 170)}</p>
            <div className="mt-5 flex items-center gap-2.5">
              <button onClick={() => onOpen(post.id)} className="ht-btn ht-btn--heat !px-5 !py-3 !text-[13.5px]">Read the story <span aria-hidden>↗</span></button>
              <button onClick={() => onOpen(post.id)} className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/25 text-white backdrop-blur-md" aria-label="Open story">→</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3].map((i) => (
        <motion.div key={i} className="ht-card p-5" animate={{ opacity: [0.45, 0.8, 0.45] }} transition={{ duration: 1.9, repeat: Infinity, delay: i * 0.15 }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/[.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded bg-white/[.06]" />
              <div className="h-2.5 w-20 rounded bg-white/[.04]" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-4 w-[85%] rounded bg-white/[.06]" />
            <div className="h-4 w-[70%] rounded bg-white/[.04]" />
          </div>
          <div className="mt-4 h-[132px] w-full rounded-[16px] bg-white/[.035]" />
        </motion.div>
      ))}
    </div>
  );
}
