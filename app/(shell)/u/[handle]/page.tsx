'use client';
/* ============================================================================
   /u/[handle] — the profile.

   Structure follows the reference layout, inverted into obsidian and rebuilt
   with real craft:

     · a floating glass bar that densifies as you scroll
     · a full-bleed cover that parallaxes and loses focus behind the portrait
     · a centered portrait inside a conic amber→ice ring, with brushed-metal
       badges drifting around it on a gyroscope (not cartoon stickers)
     · name, then ONE quiet inline stat row, then bio, then trait pills
     · the body of work as a masonry board behind pill tabs
     · a translucent floating dock for navigation (shared with the shell)

   The reference is a light, playful card; this is the same skeleton in a
   premium dark register — metal instead of stickers, glow instead of colour,
   and no scoreboard anywhere.
   ==========================================================================*/

import * as React from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useApp } from '@/lib/app';
import { useStore, streakOf } from '@/lib/store';
import { getUser } from '@/lib/seed/users';
import { avatarDataUri, cls, compact, coverDataUri, prettyDate, timeAgo } from '@/lib/util';
import { HeatmapCard } from '@/components/heat/Heatmap';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { heatFor } from '@/lib/feed';
import { tileIn } from '@/lib/motion';
import { CountUp, FloatingBadge, Tilt, useInViewSafe } from '@/components/ui/motion';

type Tab = 'all' | 'forges' | 'sparks';
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'forges', label: 'Stories' },
  { key: 'sparks', label: 'Notes' },
];

export default function ProfilePage() {
  const params = useParams<{ handle: string }>();
  const app = useApp();
  const s = useStore();
  const handle = decodeURIComponent(params?.handle ?? s.me?.handle ?? 'you').replace(/^@/, '');
  const isMe = handle === (s.me?.handle ?? 'you') || handle === 'you';
  const user = isMe && s.me ? s.me : getUser(handle);
  const [editing, setEditing] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>('all');
  const [coverOk, setCoverOk] = React.useState(true);
  const [followPulse, setFollowPulse] = React.useState(false);
  const { scrollY } = useScroll();

  /* The cover behaves like a camera: it drifts, opens up and cools off as the
     content rises over it. Transform-only, so it stays on the compositor. */
  const coverY = useTransform(scrollY, [0, 300], [0, 90]);
  const coverScale = useTransform(scrollY, [0, 300], [1.06, 1.22]);
  const coverOpacity = useTransform(scrollY, [0, 260], [1, 0.35]);
  const barDense = useTransform(scrollY, [0, 90], [0, 1]);
  const barBg = useTransform(barDense, (v) => `rgba(5,5,5,${v * 0.82})`);
  const barBlur = useTransform(barDense, (v) => `blur(${v * 22}px) saturate(${100 + v * 50}%)`);

  const posts = React.useMemo(() => {
    const mine = app.posts
      .filter((p) => p.authorHandle === handle)
      .map((p) => ({ ...p, heat: p.heat ?? heatFor(p, s as never) }));
    return mine;
  }, [app.posts, handle, s]);

  const filtered = posts.filter((p) => (tab === 'all' ? true : p.kind === (tab === 'sparks' ? 'spark' : 'forge')));
  const forges = posts.filter((p) => p.kind === 'forge');
  const sparks = posts.filter((p) => p.kind === 'spark');
  const followers = user.followers + (isMe ? 1 : 0);
  const streak = streakOf(s.activity);
  const reads = Object.keys(s.reads).length;
  const cover = user.cover ?? (typeof window !== 'undefined' ? coverDataUri(handle) : undefined);
  const coverArt = cover;
  const displayName = isMe && s.me ? s.me.name : user.name;

  return (
    <div className="mx-auto w-full max-w-[880px] pb-28 md:pb-14">
      {/* ------------------------------------------------------------- bar */}
      <motion.div
        className="sticky top-0 z-30 -mx-4 flex h-[56px] items-center gap-2 px-4 sm:-mx-6 sm:px-6"
        style={{ background: barBg, backdropFilter: barBlur, WebkitBackdropFilter: barBlur }}
      >
        <button onClick={() => app.go('/feed')} className="ht-icon-btn" aria-label="Back to feed">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <motion.span
          className="ht-title flex-1 text-center text-[16px] text-white"
          style={{ opacity: barDense }}
        >
          {displayName}
        </motion.span>
        <button
          onClick={() => app.setShare(`profile:${handle}`)}
          className="ht-icon-btn"
          aria-label="Share this profile"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>
      </motion.div>

      {/* ------------------------------------------------------------ cover */}
      <div className="relative -mx-4 -mt-[56px] sm:-mx-6">
        <div data-profile-cover className="profile-cover relative h-[286px] overflow-hidden">
          {coverArt && coverOk ? (
            <motion.img
              src={coverArt}
              alt=""
              onError={() => setCoverOk(false)}
              className="h-full w-full object-cover"
              style={{ y: coverY, scale: coverScale, opacity: coverOpacity }}
            />
          ) : (
            <div className="h-full w-full" style={{ background: 'linear-gradient(150deg,#161616,#000)' }} />
          )}
          {/* the scrim stack: darken the top for the bar, and dissolve the
              bottom edge into the room so the portrait sits *in* the image */}
          <span aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.14) 34%,rgba(0,0,0,.55) 72%,var(--ht-void) 100%)' }} />
          <span aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(80% 60% at 50% 96%, rgba(255,180,84,.16), transparent 64%)' }} />
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,180,84,.5),transparent)' }} />
        </div>
      </div>

      <div className="relative -mt-[104px] px-4 text-center sm:px-6">
        {/* ------------------------------------------------- portrait + badges */}
        <div className="relative mx-auto grid h-[140px] w-[140px] place-items-center">
          <span aria-hidden className="absolute h-[196px] w-[196px] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle,rgba(255,180,84,.3),transparent 68%)' }} />
          {/* an orbit tick that turns slowly — thermal mass, not a spinner */}
          <motion.span
            aria-hidden
            className="absolute h-[176px] w-[176px] rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0 84%, rgba(255,180,84,.55) 92%, transparent 100%)',
              mask: 'radial-gradient(closest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1px))',
              WebkitMask: 'radial-gradient(closest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1px))',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
          />
          <span className="profile-avatar ht-avatar-ring grid place-items-center">
            <img
              src={user.avatar ?? avatarDataUri(displayName, user.handle)}
              alt={displayName}
              onError={(e) => ((e.target as HTMLImageElement).src = avatarDataUri(displayName, user.handle))}
              className="relative h-[128px] w-[128px] rounded-full object-cover"
              style={{ boxShadow: '0 26px 60px -24px rgba(0,0,0,1)' }}
            />
          </span>

          <FloatingBadge
            label={`${streak.current}-day reading rhythm`}
            tone={streak.current > 0 ? 'hot' : 'metal'}
            depth={1.15}
            delay={0}
            size={46}
            className="-left-[42px] top-0"
          >
            <FlameGlyph />
          </FloatingBadge>
          <FloatingBadge label={`${forges.length} stories`} depth={0.8} delay={0.9} size={42} className="-right-[44px] top-[44px]">
            <QuillGlyph />
          </FloatingBadge>
          <FloatingBadge label={`${sparks.length} notes`} tone="cold" depth={0.6} delay={1.6} size={38} className="-bottom-1 right-1">
            <SparkGlyph />
          </FloatingBadge>
        </div>

        {/* --------------------------------------------------------- identity */}
        <h1 className="ht-title mt-6 flex items-center justify-center gap-2 text-[clamp(1.7rem,1.2rem+1.6vw,2.3rem)] leading-none text-white">
          {displayName}
          {user.verified && (
            <span
              className="grid h-[19px] w-[19px] place-items-center rounded-full text-[10px] font-black text-[#1A0E02]"
              style={{ background: 'linear-gradient(140deg,var(--ht-flare),var(--ht-jade))', boxShadow: '0 0 16px -2px rgba(255,180,84,.7)' }}
              title="Verified"
            >
              ✓
            </span>
          )}
        </h1>

        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 text-[12.5px] text-ink-dim">
          <span className="rounded-full border border-white/[.09] bg-white/[.03] px-2.5 py-1 font-medium">@{user.handle}</span>
          {user.org && (
            <span className="rounded-full border border-white/[.09] bg-white/[.03] px-2.5 py-1 font-medium">{user.org}</span>
          )}
          {user.location && <span className="text-ink-mute">{user.location}</span>}
          <span aria-hidden className="h-1 w-1 rounded-full bg-ink-faint" />
          <span className="text-ink-mute">joined {prettyDate(user.joined)}</span>
        </div>

        <p className="mx-auto mt-4 max-w-[56ch] text-[14px] leading-relaxed text-ink-dim">{user.bio}</p>

        {/* ------------------------------------------------------- stat row --
            One row, numbers as the hero, labels as whispers. Nothing ranks
            this person against anyone else. */}
        <div className="mx-auto mt-5 flex max-w-[420px] items-stretch justify-center gap-1 rounded-[20px] border border-white/[.07] bg-white/[.02] p-1.5 backdrop-blur-sm">
          <Stat k="Followers" v={followers} />
          <span aria-hidden className="my-2 w-px bg-white/[.07]" />
          <Stat k="Following" v={user.following} />
          <span aria-hidden className="my-2 w-px bg-white/[.07]" />
          <Stat k="Reads" v={reads} />
        </div>

        {/* trait pills — the accent, used sparingly, on things that are true */}
        {(user.traits ?? []).length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {(user.traits ?? []).map((tg) => (
              <button
                key={tg}
                onClick={() => app.go(`/explore?tag=${encodeURIComponent(tg)}`)}
                className="ht-chip ht-chip--heat !normal-case !tracking-normal"
              >
                <span aria-hidden className="h-1 w-1 rounded-full bg-ember-300 shadow-[0_0_8px_#FFB454]" />
                {tg}
              </button>
            ))}
          </div>
        )}

        {/* --------------------------------------------------------- actions */}
        <div className="mt-5 flex items-center justify-center gap-2">
          {!isMe && (
            <button
              onClick={() => {
                const wasFollowing = app.follows.includes(user.handle);
                app.toggleFollow(user.handle);
                if (!wasFollowing) {
                  setFollowPulse(true);
                  window.setTimeout(() => setFollowPulse(false), 720);
                }
              }}
              className={cls('ht-btn !px-7', app.follows.includes(user.handle) ? '!px-5' : 'ht-btn--heat', followPulse && 'follow-pulse')}
            >
              {app.follows.includes(user.handle) ? 'Following ✓' : 'Follow'}
              {followPulse && <span className="follow-pulse__spark" aria-hidden>✦</span>}
            </button>
          )}
          {isMe && (
            <button onClick={() => setEditing(true)} className="ht-btn ht-btn--heat !px-6">
              Edit profile
            </button>
          )}
          <button
            onClick={() => app.setShare(`profile:${handle}`)}
            className="ht-btn ht-btn--glass !px-5"
          >
            Share
          </button>
          {!isMe && (
            <button onClick={() => app.setComposer(true)} className="ht-icon-btn" aria-label="Write a reply spark">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 6h16M4 12h10M4 18h7" />
              </svg>
            </button>
          )}
        </div>

        {isMe && (
          <div className="mt-8 text-left">
            <HeatmapCard handle={handle} onOpen={() => app.go('/heatmap')} />
          </div>
        )}

        {/* ------------------------------------------------------- the work */}
        <div className="mt-9 text-left">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="ht-eyebrow">{isMe ? 'your studio' : 'their studio'}</p>
              <h2 className="ht-title mt-1.5 text-[22px] text-white">
                {isMe ? 'Your writing' : `Writing by ${user.name.split(' ')[0]}`}
              </h2>
              <p className="mt-1.5 text-[12.5px] text-ink-mute">
                {posts.length} {posts.length === 1 ? 'piece' : 'pieces'} · stories, notes, and ideas
              </p>
            </div>
            <div
              className="ht-tabrail max-w-full"
              role="tablist"
              aria-label="Filter work"
            >
              {TABS.map((x) => (
                <button
                  key={x.key}
                  role="tab"
                  aria-selected={tab === x.key}
                  onClick={() => setTab(x.key)}
                  className="ht-tab"
                >
                  {x.label}
                  <span className="ml-1.5 opacity-60">
                    {x.key === 'all' ? posts.length : x.key === 'forges' ? forges.length : sparks.length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {!isMe && posts.length === 0 && (
            <div className="ht-panel mt-5 p-8 text-center text-[13.5px] text-ink-mute">
              Nothing published from this handle yet. Follow and their next piece lands in your board.
            </div>
          )}

          {filtered.length > 0 && (
            <div className="ht-masonry mt-5">
              <AnimatePresence mode="popLayout">
                {filtered.map((p, i) => (
                  <Tile key={p.id} post={p as never} index={i} onOpen={() => app.openPost(String(p.id))} />
                ))}
              </AnimatePresence>
            </div>
          )}

          {filtered.length > 0 && (
            <p className="py-8 text-center text-[12px] text-ink-faint">
              {filtered.length} {filtered.length === 1 ? 'piece' : 'pieces'} · newest first
            </p>
          )}
        </div>
      </div>

      <AnimatePresence>{editing && <ProfileEditor onClose={() => setEditing(false)} />}</AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

function Stat({ k, v, suffix = '' }: { k: string; v: number; suffix?: string }) {
  return (
    <div className="ht-stat flex-1">
      <span className="ht-stat-v">
        <CountUp value={v} format={(n) => compact(Math.round(n)) + suffix} />
      </span>
      <span className="ht-stat-k">{k}</span>
    </div>
  );
}

/* A tile: image or typographic cover, kind chip, title, quiet meta row.
   Hover lifts it 2px and opens the image — the same gesture as the card. */
function Tile({ post, onOpen, index }: { post: any; onOpen: () => void; index: number }) {
  const hasCover = !!post.cover;
  const { ref, seen } = useInViewSafe<HTMLDivElement>('-6% 0px -4% 0px');

  return (
    <motion.div
      ref={ref}
      layout="position"
      variants={tileIn}
      initial="hidden"
      animate={seen ? 'show' : 'hidden'}
      exit="exit"
      transition={{ delay: Math.min(0.24, (index % 6) * 0.045) }}
    >
      <Tilt intensity={4} lift={3}>
        <button onClick={onOpen} className="ht-tile group block w-full text-left">
          <span className={cls('relative block overflow-hidden', hasCover ? 'aspect-[4/5]' : 'aspect-[4/3.2]')}>
            {hasCover ? (
              <img src={post.cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <span
                className="grid h-full w-full place-items-center p-4 text-[13.5px] font-semibold leading-snug text-ink-dim"
                style={{
                  background:
                    'radial-gradient(120% 100% at 20% 0%, rgba(255,180,84,.16), transparent 60%), radial-gradient(100% 90% at 90% 100%, rgba(99,216,245,.1), transparent 60%), linear-gradient(160deg,#151515,#050505)',
                }}
              >
                {post.text?.slice(0, 110)}
              </span>
            )}
            <span aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.06) 38%,rgba(0,0,0,.86))' }} />
            <span className="absolute left-3 top-3 rounded-full border border-white/[.14] bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/90 backdrop-blur-md">
              {post.kind === 'forge' ? `${post.minutes ?? 6} min` : 'spark'}
            </span>
            {post.heat?.heat > 55 && (
              <span className="absolute right-3 top-3 rounded-full border border-ember-400/40 bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ember-100 backdrop-blur-md">
                hot
              </span>
            )}
            <span className="absolute inset-x-3 bottom-3 line-clamp-3 text-[13.5px] font-bold leading-snug text-white">
              {post.title ?? post.text?.slice(0, 90)}
            </span>
          </span>
          <span className="mt-2.5 flex items-center gap-1.5 px-0.5 text-[11.5px] text-ink-faint">
            <span className="truncate">@{post.authorHandle}</span>
            <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-ink-faint" />
            <span className="shrink-0">{timeAgo(post.date)}</span>
          </span>
        </button>
      </Tilt>
    </motion.div>
  );
}

/* Badge glyphs, drawn rather than emoji — they sit in brushed metal dials. */
function FlameGlyph() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3c1.6 3.4.3 5-1.2 6.6C9.2 11.3 7.6 12.8 7.6 15.4A4.6 4.6 0 0 0 12 20a4.6 4.6 0 0 0 4.6-4.6c0-2-1-3.6-2.6-5.2 1.7 1.8 2.5 3.9 2.5 6" />
    </svg>
  );
}
function QuillGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 3c-6 0-11 4-13 10l-3 8 8-3c6-2 10-7 8-15ZM7 13l4 4" />
    </svg>
  );
}
function SparkGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.5 6.5l3 3M14.5 14.5l3 3M17.5 6.5l-3 3M9.5 14.5l-3 3" />
    </svg>
  );
}
