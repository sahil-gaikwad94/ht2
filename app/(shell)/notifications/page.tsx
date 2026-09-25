'use client';
/* ============================================================================
   /notifications — the heat log.

   Structured like the rest of the board: an avatar-led row per event, a hot
   highlight card when something genuinely good happened to you, quick actions
   inline, and a collapsed "Older" pile so the top of the page is always the
   part that is still warm.
   ==========================================================================*/

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/lib/app';
import { useStore } from '@/lib/store';
import { TopBar } from '@/components/shell/Shell';
import { Avatar } from '@/components/ui/primitives';
import { getUser } from '@/lib/seed/users';
import { cls, timeAgo } from '@/lib/util';
import { dailyDigest } from '@/lib/feed';
import type { Notification } from '@/lib/types';

const TONE: Record<string, string> = {
  ignite: 'linear-gradient(140deg,rgba(255,180,84,.22),transparent)',
  heat: 'linear-gradient(140deg,rgba(245,154,43,.16),transparent)',
  follow: 'linear-gradient(140deg,rgba(99,216,245,.14),transparent)',
  reply: 'linear-gradient(140deg,rgba(255,255,255,.05),transparent)',
  milestone: 'linear-gradient(140deg,rgba(239,203,139,.2),transparent)',
  digest: 'linear-gradient(140deg,rgba(138,166,255,.14),transparent)',
};

const VERB: Record<string, string> = {
  ignite: 'ignited something of yours',
  heat: 'heated one of your pieces',
  follow: 'started following you',
  reply: 'replied to you',
  milestone: 'a milestone on heatt',
  digest: 'your day in heat',
};

export default function NotificationsPage() {
  const app = useApp();
  const s = useStore();
  const digest = React.useMemo(() => dailyDigest(app.posts, s as any), [app.posts, s]);
  const [openOlder, setOpenOlder] = React.useState(false);

  React.useEffect(() => {
    if (s.notifications.length === 0) {
      const d = new Date();
      const t = (h: number) => new Date(d.getTime() - h * 3600_000).toISOString();
      const seed = [
        { type: 'ignite' as const, actor: 'amara', text: '@amara ignited your spark about reading progress', postId: 'sp-04', level: 3 as const },
        { type: 'heat' as const, actor: 'k-vasiliev', text: '@k-vasiliev heated your piece on long-form layout', postId: 'orig-heat-diffusion', level: 2 as const },
        { type: 'follow' as const, actor: 'sena', text: '@sena started following you', read: true },
        { type: 'milestone' as const, actor: 'heatt', text: 'You finished three forges this week.', read: true },
      ];
      seed.forEach((n, i) => setTimeout(() => useStore.getState().notify({ ...n, read: false, at: t(i * 3) } as any), 300 + i * 260));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = s.notifications;
  const fresh = list.filter((n) => !n.read);
  const older = list.filter((n) => n.read);
  /* the one that deserves the hot card: the most recent ignition or milestone */
  const highlight = fresh.find((n) => n.type === 'ignite' || n.type === 'milestone') ?? null;

  const dismiss = (id: string) =>
    useStore.setState((st) => ({ notifications: st.notifications.filter((x) => x.id !== id) }));

  return (
    <div className="mx-auto w-full max-w-[680px] pb-6">
      <TopBar
        title={`Notifications${fresh.length ? ` (${fresh.length})` : ''}`}
        sub={list.length ? `${older.length} older` : 'quiet'}
        right={
          list.length > 0 ? (
            <button onClick={() => useStore.getState().markAllRead()} className="ht-btn ht-btn--ghost !px-3 !py-1.5 !text-[12px]">
              Clean all
            </button>
          ) : undefined
        }
      />

      {/* ------------------------------------------------------------- digest */}
      <section className="ht-panel mt-1 overflow-hidden !rounded-[24px] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="ht-label">today</span>
            <h2 className="ht-title mt-1.5 text-[21px]">What happened while you were away</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">
              {digest.items} new pieces on the board{fresh.length ? ` · ${fresh.length} waiting on you` : ''}.
            </p>
          </div>
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/[.08] text-[17px] text-ink-dim"
            style={{ background: 'radial-gradient(circle at 38% 30%, rgba(255,180,84,.22), rgba(255,255,255,.02))' }}
          >
            ◷
          </span>
        </div>
        {digest.hottest && (
          <button
            onClick={() => app.openPost(digest.hottest!.id)}
            className="mt-4 flex w-full items-center gap-3 rounded-[16px] border border-white/[.07] bg-black/30 p-3 text-left transition-colors hover:border-ember-500/40"
          >
            <span className="ht-num shrink-0 rounded-full bg-[var(--ht-ember)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#1A0E02]">
              top pick
            </span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">{digest.hottest.title}</span>
            <span className="shrink-0 text-[12px] text-ink-mute">
              {digest.hottest.minutes ? `${digest.hottest.minutes} min` : 'spark'}
            </span>
          </button>
        )}
      </section>

      {/* ---------------------------------------------------------- new events */}
      <section className="mt-3.5 space-y-2.5">
        <AnimatePresence initial={false}>
          {fresh.map((n, i) => (
            <NotificationRow
              key={n.id}
              n={n}
              index={i}
              featured={highlight?.id === n.id}
              onOpen={() => n.postId && app.openPost(n.postId)}
              onDismiss={() => dismiss(n.id)}
            />
          ))}
        </AnimatePresence>

        {list.length === 0 && (
          <div className="ht-panel !rounded-[24px] p-10 text-center">
            <h3 className="ht-title text-[19px]">No heat on you yet</h3>
            <p className="mx-auto mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-ink-dim">
              Publish a spark or a forge — ignitions, replies and milestones land here.
            </p>
            <button onClick={() => app.setComposer(true)} className="ht-btn ht-btn--heat mt-4">
              Write something
            </button>
          </div>
        )}
      </section>

      {/* -------------------------------------------------------------- older */}
      {older.length > 0 && (
        <section className="mt-6">
          <button
            onClick={() => setOpenOlder((v) => !v)}
            aria-expanded={openOlder}
            className="flex w-full items-center justify-between rounded-[18px] px-1 py-3 text-left"
          >
            <span className="ht-title text-[19px] text-ink">Older</span>
            <span className="flex items-center gap-2 text-[12px] text-ink-mute">
              {older.length}
              <motion.svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                animate={{ rotate: openOlder ? 180 : 0 }}
                transition={{ duration: 0.25 }}
              >
                <path d="m6 9 6 6 6-6" strokeLinecap="round" />
              </motion.svg>
            </span>
          </button>
          <AnimatePresence initial={false}>
            {openOlder && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-2.5 pt-1">
                  {older.map((n, i) => (
                    <NotificationRow
                      key={n.id}
                      n={n}
                      index={i}
                      onOpen={() => n.postId && app.openPost(n.postId)}
                      onDismiss={() => dismiss(n.id)}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}

function NotificationRow({
  n,
  index,
  featured,
  onOpen,
  onDismiss,
}: {
  n: Notification;
  index: number;
  featured?: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const u = getUser(n.actor);
  const tone = TONE[n.type] ?? TONE.heat;
  const body = n.text.replace(`@${n.actor}`, '').trim();

  if (featured) {
    /* the hot card — reserved for things that actually happened to you */
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ delay: Math.min(0.25, index * 0.05), duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[24px] p-4 text-[#1A0E02]"
        style={{
          background: 'linear-gradient(135deg, var(--ht-ember-300), var(--ht-ember) 55%, var(--ht-flare))',
          boxShadow: '0 26px 60px -30px rgba(255,180,84,.75), 0 1px 0 rgba(255,255,255,.45) inset',
        }}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1A0E02]/10">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M12 3c1 2.6.2 3.9-1 5.2C9.7 9.6 8.2 10.8 8.2 13.4A4.4 4.4 0 0 0 16.4 18c.1-2.2-1.3-3.6-1.8-5.6 2 1.9 3.2 4 3.2 6.4A5.8 5.8 0 1 1 6.2 11C6.2 6.9 9.6 4.4 12 3Z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15.5px] font-black leading-tight">
              {n.type === 'ignite' ? 'Ignition!' : 'Good news'}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#3A2104]">{body}</p>
          </div>
          <button
            onClick={onOpen}
            aria-label="Open the post"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1A0E02] text-[#FFF6E8] transition-transform hover:scale-[1.04]"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="mt-3.5 flex items-center gap-2">
          <button
            onClick={onOpen}
            className="rounded-full bg-[#1A0E02]/10 px-3.5 py-1.5 text-[12.5px] font-bold transition-colors hover:bg-[#1A0E02]/20"
          >
            {n.level === 3 ? 'See the ignition' : 'See the forge'}
          </button>
          <button
            onClick={onDismiss}
            className="rounded-full border border-[#1A0E02]/20 px-3.5 py-1.5 text-[12.5px] font-bold transition-colors hover:bg-[#1A0E02]/10"
          >
            Maybe later
          </button>
          <span className="flex-1" />
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="grid h-9 w-9 place-items-center rounded-full bg-[#1A0E02]/10 transition-colors hover:bg-[#1A0E02]/20"
          >
            <TrashIcon />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: Math.min(0.25, index * 0.05), duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cls('ht-card p-4', !n.read && '!border-ember-500/25')}
    >
      <div className="flex items-start gap-3">
        <Avatar name={u.name} handle={u.handle} src={u.avatar} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-[13.5px] font-bold text-ink">{u.name}</span>
            <span className="text-[12px] text-ink-mute">{VERB[n.type] ?? 'sent you heat'}</span>
            <span className="text-ink-faint">·</span>
            <span className="ht-num text-[12px] text-ink-mute">{timeAgo(n.at)}</span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">{body}</p>
        </div>
        <button
          onClick={onOpen}
          aria-label="Open"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#1A0E02] transition-transform hover:scale-[1.04]"
          style={{ background: 'var(--ht-ember)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
            <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-white/[.05] pt-3">
        {n.postId && (
          <button onClick={onOpen} className="rounded-full border border-white/[.09] px-3.5 py-1.5 text-[12px] font-bold text-ink-dim transition-colors hover:border-ember-500/40 hover:text-ink">
            Open thread
          </button>
        )}
        <button onClick={onDismiss} className="rounded-full border border-white/[.09] px-3.5 py-1.5 text-[12px] font-bold text-ink-mute transition-colors hover:text-ink">
          Maybe later
        </button>
        <span className="flex-1" />
        {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-[var(--ht-ember)] shadow-[0_0_10px_rgba(255,180,84,.8)]" />}
        <button onClick={onDismiss} aria-label="Dismiss" className="grid h-8 w-8 place-items-center rounded-full border border-white/[.09] text-ink-mute transition-colors hover:text-magma">
          <TrashIcon />
        </button>
      </div>
    </motion.div>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 7h16M9 7V4.6h6V7M6.5 7l.9 12.2A1.6 1.6 0 0 0 9 20.6h6a1.6 1.6 0 0 0 1.6-1.4L17.5 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
