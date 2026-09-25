'use client';
/* ============================================================================
   components/cards/PostCard — the hybrid unit of heatt.

   A spark (short-form) and a forge (long-form) render from one component so
   they share heat, sharing, replies and ranking chrome; only the composition
   of the body differs. This is the whole product thesis in one file: the same
   feed, the same heat, two modalities.
   ==========================================================================*/

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/lib/app';
import type { Post } from '@/lib/feed';
import { cls, compact, plain, timeAgo } from '@/lib/util';
import { Avatar } from '@/components/ui/primitives';
import { HeatButton } from '@/components/heat/HeatButton';
import { FireOverlay, EmberTrail } from '@/components/heat/FireOverlay';
import { useStore } from '@/lib/store';
import { LinkPreview } from './LinkPreview';
import { PollBlock } from './PollBlock';

export function PostCard({ post, index = 0, dense }: { post: Post; index?: number; dense?: boolean }) {
  const app = useApp();
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const burning = !!app.igniting[post.id];
  const level = app.heatOf(post.id);
  const heat = post.heat!;
  const local = useLocal();
  /* a covered forge gets a full-bleed hero image with the writing beneath it */
  const bleed = post.kind === 'forge' && !!post.cover;
  const saved = local.saved[post.id];
  const myReplies = React.useMemo(
    () => local.replies.filter((r) => r.postId === post.id).length,
    [local.replies, post.id]
  );
  /* body excerpt for the paper card: real prose, not a truncated teaser */
  const excerpt = React.useMemo(() => {
    if (post.kind !== 'forge') return '';
    const blocks = post.blocks;
    if (blocks && blocks.length) {
      const text = blocks
        .filter((b) => b.t === 'p')
        .map((b) => ('text' in b ? b.text : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) return text;
    }
    if (post.markdown) return plain(post.markdown);
    return '';
  }, [post]);

  return (
    <motion.article
      ref={cardRef}
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, delay: Math.min(0.08, index * 0.02), ease: [0.22, 1, 0.36, 1] }}
      className={cls(
        'ht-card group relative',
        level === 1 && 'ht-card--heated',
        level >= 2 && 'ht-card--heated',
        burning && 'ht-card--ignited ht-ignite-card'
      )}
      style={{ padding: bleed ? '0 0 12px' : dense ? '16px 18px' : '18px 20px 12px' }}
    >
      <span className="ht-heat-aura" aria-hidden />
      <FireOverlay active={burning} variant={local.prefs.ignitionFx === 'off' ? 'subtle' : 'full'} />
      {/* embers only during an actual burn — a lit post is a state, not a fireworks show */}
      {burning && <EmberTrail active count={10} />}

      {/* ---------------------------------------------------------- header */}
      <header className={cls('mb-2.5 flex items-start gap-3', bleed && 'px-5 pt-[18px]')}>
        <button onClick={() => app.go(`/u/${post.authorHandle}`)} className="relative shrink-0" aria-label={`Open ${post.authorName}`}>
          <Avatar name={post.authorName} handle={post.authorHandle} src={post.authorAvatar} size={40} />
          {level > 0 && (
            <span
              aria-hidden
              className="absolute -inset-1 rounded-full"
              style={{ boxShadow: `0 0 0 1px rgba(255,180,84,${0.22 * level}), 0 0 18px -5px rgba(245,154,43,${0.5 * level})` }}
            />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <button
              onClick={() => app.go(`/u/${post.authorHandle}`)}
              className="truncate text-[15px] font-bold tracking-tight text-ink hover:underline"
            >
              {post.authorName}
            </button>
            {post.author?.verified && <VerifiedBadge />}
            <span className="truncate text-[13px] text-ink-mute">@{post.authorHandle}</span>
            <span className="text-ink-faint">·</span>
            <span className="ht-num text-[13px] text-ink-mute">{timeAgo(post.date)}</span>
            {post.org && <span className="ht-chip !py-[1px] !text-[9px] !normal-case !tracking-wide">{post.org}</span>}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="ht-chip !border-transparent !py-[2px] !text-[9px]"
              style={{
                background: post.kind === 'forge' ? 'linear-gradient(120deg,rgba(255,180,84,.18),rgba(255,203,120,.1))' : 'rgba(99,216,245,.1)',
                color: post.kind === 'forge' ? 'var(--ht-flare)' : 'var(--ht-cryo-teal)',
              }}
            >
              {post.kind === 'forge' ? `forge · ${post.minutes ?? 5} min` : 'spark'}
            </span>
            {post.origin === 'wire' && (
              <span className="ht-chip !py-[2px] !text-[9px] !normal-case">syndicated · attributed</span>
            )}
            {post.flare && <span className="ht-chip !py-[2px] !text-[9px] !normal-case">#{post.flare}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <CardMenu post={post} />
        </div>
      </header>

      {/* ------------------------------------------------------ forge body */}
      {post.kind === 'forge' ? (
        /* ---------------- a full article card: image, then the writing below */
        <div className="relative">
          {post.cover && (
            <div className="relative">
              <CoverArt src={post.cover} alt={post.title ?? ''} burning={burning} bleed={bleed} />
              <span className="absolute bottom-4 left-4 rounded-full border border-white/[.14] bg-black/55 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md">
                {post.minutes ?? 6} min read
              </span>
              {/* the reference's over-image controls: the primary action in
                  amber, secondary ones as glass discs, all floating over art */}
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    useStore.getState().toggleSave(post.id);
                    app.toast(saved ? 'Removed from library' : 'Saved — offline ready', saved ? 'cool' : 'heat');
                  }}
                  aria-label={saved ? 'Remove from library' : 'Save to library'}
                  className="ht-icon-btn !h-10 !w-10"
                  style={saved ? { color: 'var(--ht-flare)', borderColor: 'rgba(255,180,84,.4)' } : undefined}
                >
                  <BookmarkIcon active={!!saved} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    app.setShare(post.id);
                  }}
                  aria-label="Make a share poster"
                  className="ht-icon-btn !h-10 !w-10"
                >
                  <ShareIcon />
                </button>
                <span
                  aria-hidden
                  className="pointer-events-none grid h-11 w-11 place-items-center rounded-full text-[15px] font-bold transition-transform duration-500 group-hover:scale-[1.06]"
                  style={{ background: 'var(--ht-ember)', color: '#1A0E02', boxShadow: '0 12px 34px -12px rgba(255,180,84,.85)' }}
                >
                  →
                </span>
              </div>
            </div>
          )}

          <button onClick={() => app.openPost(post.id)} className={cls('block w-full text-left', !bleed && 'mt-3.5')}>
            <div className={cls(bleed && 'px-5 pt-4')}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ember-200"
                  style={{ background: 'rgba(255,180,84,.1)', border: '1px solid rgba(255,180,84,.26)' }}
                >
                  {post.origin === 'wire' ? 'syndicated' : 'long-form'}
                </span>
                {post.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full border border-white/[.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-dim">
                    #{tag}
                  </span>
                ))}
              </div>

              <h2 className="ht-title mt-3.5 text-[clamp(1.45rem,1.15rem+1vw,2.05rem)] leading-[1.1] text-white transition-colors">
                {post.title}
              </h2>

              {/* spec strip: the facts of the piece, divided by hairlines —
                  the same "1200 sq ft · 3 beds · 2 bath" rhythm, for prose */}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-ink-mute">
                <Spec>{post.minutes ?? 6} min</Spec>
                <Spec>
                  {post.origin === 'wire'
                    ? `${compact(post.reactions ?? 0)} reactions`
                    : `${compact(post.reactions ?? 0)} reactions`}
                </Spec>
                <Spec>{compact(post.comments ?? 0)} replies</Spec>
                <Spec>{(post.tags ?? []).length} tags</Spec>
                {typeof post.heat?.temp === 'number' && (
                  <Spec>
                    <span style={{ color: 'var(--ht-ember-300)' }}>{Math.round(post.heat.temp)}° signal</span>
                  </Spec>
                )}
              </div>

              {post.dek && <p className="mt-3 text-[15px] leading-[1.68] text-ink-dim">{post.dek}</p>}

              {excerpt && (
                <div
                  className="relative mt-3 max-h-[122px] overflow-hidden"
                  style={{ maskImage: 'linear-gradient(180deg,#000 52%,transparent)', WebkitMaskImage: 'linear-gradient(180deg,#000 52%,transparent)' }}
                >
                  <p className="ht-prose ht-prose--paper text-[14.5px] leading-[1.72]">{excerpt}</p>
                </div>
              )}

              <div className="mt-5 flex items-center gap-3 border-t border-white/[.07] pt-4">
                <span className="text-[12.5px] font-semibold text-ember-300 transition-colors group-hover:text-ember-200">
                  Read full article →
                </span>
                <span className="flex-1" />
                <span className="ht-num text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                  {post.origin === 'wire' ? 'attributed' : 'native'}
                </span>
              </div>
            </div>
          </button>

        </div>
      ) : (
        /* ---------------------------------------------------- spark body */
        <div>
          <RichText text={post.text ?? ''} onTag={(tg) => { app.go(`/explore?tag=${encodeURIComponent(tg)}`); }} onMention={(h) => app.go(`/u/${h}`)} />

          {post.quoteOf && (
            <div className="mt-3 rounded-[14px] border border-white/[.07] bg-black/35 p-3">
              <div className="mb-1 text-[12px] font-semibold text-ember-300">@{post.quoteOf.author}</div>
              <p className="text-[13.5px] leading-relaxed text-ink-dim">{post.quoteOf.text}</p>
            </div>
          )}

          {post.media?.length ? (
            <div className={cls('mt-3 grid gap-1 overflow-hidden rounded-[16px] border border-white/[.07]', post.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
              {post.media.map((m) => (
                <img key={m.url} src={m.url} alt={m.alt} loading="lazy" className="aspect-[16/10] w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
              ))}
            </div>
          ) : null}

          {post.link && <LinkPreview url={post.link.url} seed={post.link} />}
          {post.poll && <PollBlock postId={post.id} poll={post.poll} />}
          {post.longRef && (
            <button
              onClick={() => app.openPost(post.longRef!)}
              className="mt-3 flex w-full items-center gap-2.5 rounded-[14px] border border-ember-500/25 bg-[linear-gradient(90deg,rgba(255,180,84,.09),transparent)] px-3 py-2.5 text-left transition-all hover:border-ember-500/60"
            >
              <span className="text-ember-400">
                <ForgeIcon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-bold uppercase tracking-[0.14em] text-ember-300">Expanded into an essay</span>
                <span className="block truncate text-[13px] text-ink-dim">Read the full version inside heatt →</span>
              </span>
            </button>
          )}
        </div>
      )}

      {/* -------------------------------------------------------- actions */}
      <footer className={cls('relative z-40 mt-3 flex items-center gap-1 border-t border-white/[.05] pt-1.5', bleed && 'mx-5')}>
        <ActionButton
          label="reply"
          hint={`Reply to ${post.authorName} in the thread`}
          count={(post.comments ?? 0) + myReplies}
          onClick={() => app.openPost(post.id)}
          icon={<ReplyIcon />}
        />
        <ActionButton
          label="repost"
          hint="Share to your notes"
          count={post.reposts ?? 0}
          onClick={() => app.toast('Shared to your notes', 'heat')}
          icon={<RepostIcon />}
        />
        <div className="relative">
          <HeatButton
            level={level}
            count={app.countOf(post)}
            temp={heat.temp}
            onChange={(lv, meta) => app.setHeat(post.id, lv, { ignited: meta.ignited, title: post.title ?? post.text, author: post.authorHandle })}
          />
        </div>

        <ActionButton
          label="share"
          hint="Share as a story"
          onClick={() => app.setShare(post.id)}
          icon={<ShareIcon />}
        />
        <ActionButton
          label="save"
          hint={saved ? 'Remove from your library' : 'Save to library (reads offline)'}
          active={!!saved}
          onClick={() => {
            useLocal().toggleSave(post.id);
            app.toast(saved ? 'Removed from library' : 'Saved to library — offline ready', saved ? 'cool' : 'heat');
          }}
          icon={<BookmarkIcon active={!!saved} />}
        />

        <span className="flex-1" />
        {level > 0 && (
          <span className="rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ember-200" style={{ background: 'rgba(255,180,84,.1)' }}>
            {level === 3 ? 'you highlighted this' : level === 2 ? 'you marked this' : 'you liked this'}
          </span>
        )}
      </footer>
    </motion.article>
  );
}

/* ------------------------------------------------------------------ pieces */

/** one subscription for prefs / saved / replies — no prop drilling */
function useLocal() {
  return useStore();
}

/* One cell of a spec row. Each is followed by a hairline except the last. */
function Spec({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className="ht-num font-semibold">{children}</span>
      {!last && <span aria-hidden className="h-2.5 w-px bg-white/[.09]" />}
    </span>
  );
}

function VerifiedBadge() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-label="verified" style={{ flexShrink: 0 }}>
      <path
        d="M12 2.4l2.2 2.1 3-.5.8 2.9 2.8 1.2-1 2.9 1 2.9-2.8 1.2-.8 2.9-3-.5L12 21.6l-2.2-2.1-3 .5-.8-2.9L3.2 16l1-2.9-1-2.9 2.8-1.2.8-2.9 3 .5L12 2.4z"
        fill="url(#vfg)"
      />
      <path d="M8.4 12.2l2.5 2.4 4.7-4.9" stroke="#160b04" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="vfg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF6E8" />
          <stop offset="0.6" stopColor="#FFB454" />
          <stop offset="1" stopColor="#EFCB8B" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function CoverArt({ src, alt, burning, bleed }: { src: string; alt: string; burning?: boolean; bleed?: boolean }) {
  const [ok, setOk] = React.useState(true);
  return (
    <div
      className={cls('relative overflow-hidden', bleed ? 'rounded-none border-b border-white/[.06]' : 'rounded-[16px] border border-white/[.06]')}
      style={{ background: 'linear-gradient(140deg,#161616,#0a0a0a)' }}
    >
      {ok ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setOk(false)}
          className="block aspect-[16/9] w-full object-cover"
          style={{
            filter: burning ? 'saturate(1.3) brightness(1.06)' : 'saturate(1.04)',
            transition: 'filter .6s, transform 1.2s var(--ease-ht)',
          }}
        />
      ) : (
        <div className="flex aspect-[16/9] w-full items-end p-4" style={{ background: 'radial-gradient(90% 80% at 20% 110%, rgba(255,180,84,.16), transparent 65%), #0a0a0a' }}>
          <span className="ht-title text-lg text-ink/70">{alt?.slice(0, 40)}</span>
        </div>
      )}
      <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,.7) 100%)' }} />
    </div>
  );
}

export function WaveBars({ values, burning, h = 16 }: { values: number[]; burning?: boolean; h?: number }) {
  const n = Math.min(28, Math.max(10, values.length));
  const step = values.length / n;
  const bars = Array.from({ length: n }, (_, i) => values[Math.floor(i * step)] ?? 0.2);
  return (
    <span className="flex flex-1 items-end gap-[2px]" aria-hidden>
      {bars.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${Math.max(8, v * 100)}%`,
            minHeight: 3,
            transformOrigin: 'bottom',
            background: v > 0.62 ? 'linear-gradient(180deg,var(--ht-whitehot),var(--ht-ember))' : 'linear-gradient(180deg,var(--ht-flame),rgba(255,180,84,.26))',
            opacity: 0.5 + v * 0.5,
            animation: burning ? `ht-wave-burn 1.4s ease-in-out ${i * 0.03}s infinite` : undefined,
            boxShadow: v > 0.7 ? '0 0 10px rgba(255,180,84,.55)' : undefined,
          }}
        />
      ))}
      <style>{`@keyframes ht-wave-burn{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.5)}}`}</style>
    </span>
  );
}

function ActionButton({
  icon,
  label,
  hint,
  count,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  count?: number;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={hint ?? label}
      title={hint ?? label}
      className="group/act flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-ink-mute transition-all hover:bg-white/[.06] hover:text-ember-300 active:scale-95"
      style={active ? { color: 'var(--ht-flare)' } : undefined}
    >
      <span className="transition-transform duration-300 group-hover/act:-translate-y-[1px]">{icon}</span>
      {count !== undefined && count > 0 && <span className="ht-num">{compact(count)}</span>}
    </button>
  );
}

/* ----------------------------------------------------------- rich text */

export function RichText({ text, onTag, onMention }: { text: string; onTag?: (t: string) => void; onMention?: (h: string) => void }) {
  const parts = React.useMemo(() => text.split(/(\s+)/), [text]);
  return (
    <p className="whitespace-pre-wrap text-[15.5px] leading-[1.62] tracking-[-0.005em] text-ink" style={{ textWrap: 'pretty' as any }}>
      {parts.map((tok, i) => {
        if (/^#[\p{L}\p{N}_-]+[!.]?$/u.test(tok)) {
          const t = tok.replace(/^#/, '').replace(/[!.]$/, '');
          return (
            <button key={i} onClick={() => onTag?.(t)} className="font-semibold text-ember-300 hover:text-ember-200 hover:underline">
              #{t}
            </button>
          );
        }
        if (/^@[\p{L}\p{N}_-]+/u.test(tok)) {
          const h = tok.replace(/^@/, '').replace(/[.,;:!?]$/, '');
          return (
            <button key={i} onClick={() => onMention?.(h)} className="font-semibold text-[var(--ht-cryo-teal)] hover:underline">
              @{h}
            </button>
          );
        }
        if (/^https?:\/\//.test(tok)) {
          const host = tok.replace(/^https?:\/\//, '').split('/')[0];
          return (
            <a key={i} href={tok} target="_blank" rel="noopener noreferrer" className="break-all text-ember-200 underline decoration-ember-500/40 hover:decoration-ember-300">
              {host}
            </a>
          );
        }
        return <React.Fragment key={i}>{tok}</React.Fragment>;
      })}
    </p>
  );
}

/* --------------------------------------------------------------- icons */

const ico = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const ReplyIcon = () => (
  <svg {...ico}>
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-3.7-.8L3 21l1.9-4.6A8.3 8.3 0 0 1 3.6 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 8.4 8.4z" />
  </svg>
);
export const RepostIcon = () => (
  <svg {...ico}>
    <path d="M17 2.5 21 6l-4 3.5" />
    <path d="M3 12V9a3 3 0 0 1 3-3h15" />
    <path d="M7 21.5 3 18l4-3.5" />
    <path d="M21 12v3a3 3 0 0 1-3 3H3" />
  </svg>
);
export const ShareIcon = () => (
  <svg {...ico}>
    <path d="M12 16V4" />
    <path d="m8 8 4-4 4 4" />
    <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
  </svg>
);
/** Per-post controls that every platform hides: mute the author, demote a tag,
 *  copy the deep link. Here they are one click from the card itself. */
export function CardMenu({ post }: { post: Post }) {
  const app = useApp();
  const [open, setOpen] = React.useState(false);
  const wrap = React.useRef<HTMLDivElement | null>(null);
  const mutedAuthor = useStore((s) => s.muted.includes(`@${post.authorHandle}`));
  const tag = post.tags[0];
  const mutedTag = useStore((s) => (tag ? s.muted.includes(`#${tag}`) : false));

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const item = 'flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-ink-dim transition-colors hover:bg-white/[.05] hover:text-ink';

  return (
    <div ref={wrap} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Post options"
        aria-expanded={open}
        className="ht-btn ht-btn--ghost !px-2 !py-1 !text-ink-mute"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-[calc(100%+6px)] z-40 w-[228px] overflow-hidden rounded-[14px] border border-white/10 bg-[#121212]/95 py-1 shadow-[0_28px_70px_-24px_rgba(0,0,0,.9)] backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={item}
              onClick={() => {
                const url = `${window.location.origin}/read/${post.id}`;
                navigator.clipboard?.writeText(url).then(
                  () => app.toast('Link copied', 'cool'),
                  () => app.toast(url, 'plain')
                );
                setOpen(false);
              }}
            >
              <span className="text-ink-faint">⧉</span> Copy link to this {post.kind === 'forge' ? 'essay' : 'note'}
            </button>
            {post.kind === 'forge' && (
              <button
                className={item}
                onClick={() => {
                  app.setShare(post.id);
                  setOpen(false);
                }}
              >
                <span className="text-ink-faint">↗</span> Share as a story
              </button>
            )}
            <div className="my-1 h-px bg-white/[.07]" />
            <button
              className={item}
              onClick={() => {
                useStore.getState().toggleMute(`#${tag}`);
                app.toast(mutedTag ? `#${tag} demotion lifted` : `Demoted #${tag} in your feed`, mutedTag ? 'cool' : 'heat');
                setOpen(false);
              }}
              disabled={!tag}
            >
              <span className="text-ink-faint">▽</span>
              {tag ? (mutedTag ? `Restore #${tag}` : `Demote #${tag}`) : 'No tags to demote'}
            </button>
            <button
              className={cls(item, '!text-magma')}
              onClick={() => {
                useStore.getState().toggleMute(`@${post.authorHandle}`);
                app.toast(mutedAuthor ? `@${post.authorHandle} unmuted` : `Muted @${post.authorHandle}`, mutedAuthor ? 'cool' : 'heat');
                setOpen(false);
              }}
            >
              <span>⊘</span> {mutedAuthor ? `Unmute @${post.authorHandle}` : `Mute @${post.authorHandle}`}
            </button>
            <div className="border-t border-white/[.06] px-3 py-1.5 text-[10.5px] leading-relaxed text-ink-faint">
              Muting is local — it changes what the ranker shows you, not what anyone else sees.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const BookmarkIcon = ({ active }: { active?: boolean }) => (
  <svg {...ico} fill={active ? 'currentColor' : 'none'}>
    <path d="M18.5 3.5H5.5A1.5 1.5 0 0 0 4 5v15.5l8-4.6 8 4.6V5a1.5 1.5 0 0 0-1.5-1.5Z" />
  </svg>
);
export const ForgeIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
    <path d="M13 2c.9 2.6.1 3.9-1.1 5.2C10.4 8.7 8.6 10 8.6 13a4.6 4.6 0 0 0 9.2.4c.1-2.4-1.4-4-1.9-6.3C17.4 9.6 19 12 19 14.6A7 7 0 1 1 5 14.4C5 9.9 9.6 6.6 13 2Z" />
  </svg>
);
