'use client';
/* ============================================================================
   components/thread/ThreadSheet — replies for a spark, with context rail.
   Opens from the feed (comment button) and from /read for forges.
   ==========================================================================*/

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/lib/app';
import { useStore } from '@/lib/store';
import { Modal, Avatar } from '@/components/ui/primitives';
import { RichText } from '@/components/cards/PostCard';
import { cls, timeAgo, uid } from '@/lib/util';
import { getUser } from '@/lib/seed/users';

export function ThreadSheet() {
  const app = useApp();
  const s = useStore();
  const post = app.open ? app.posts.find((p) => p.id === app.open) : null;
  const open = !!post && post.kind === 'spark';
  const [text, setText] = React.useState('');
  const replies = React.useMemo(() => (post ? s.replies.filter((r) => r.postId === post.id) : []), [post, s.replies]);
  const me = app.me;

  const seedReplies = React.useMemo(() => {
    if (!post) return [];
    // a small deterministic set so threads are never empty in a demo build
    const pool = [
      { handle: 'amara', text: 'The line-length constraint is the whole trick. Once the column is fixed, everything else is decoration.' },
      { handle: 'tobi', text: 'This is the "we cache at the edge" argument in miniature — the cheap version of the same insight.' },
      { handle: 'k-vasiliev', text: 'Counterpoint: a signal that costs effort is also a signal that suppresses new voices. Worth holding both.' },
      { handle: 'sena', text: 'We measured the same thing with streak cells. Cost of action predicts trust in the action.' },
    ];
    const n = 1 + (post.id.length % 3);
    return pool.slice(0, n);
  }, [post]);

  return (
    <Modal open={open} onClose={app.closePost} align="top" wide={false}>
      {post && (
        <div className="max-h-[86vh] overflow-y-auto overscroll-contain">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[.06] bg-[#0a0a0a]/88 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <span className="ht-label">Thread</span>
              <span className="ht-num text-[12px] text-ink-mute">{replies.length + seedReplies.length} replies</span>
            </div>
            <button onClick={app.closePost} className="ht-btn ht-btn--ghost !px-2.5 !py-1.5" aria-label="Close">
              ✕
            </button>
          </header>

          <div className="p-4">
            <div className="flex items-start gap-3">
              <Avatar name={post.authorName} handle={post.authorHandle} src={post.authorAvatar} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="text-[15px] font-bold">{post.authorName}</span>
                  <span className="text-[13px] text-ink-mute">@{post.authorHandle}</span>
                  <span className="text-ink-faint">·</span>
                  <span className="text-[13px] text-ink-mute">{timeAgo(post.date)}</span>
                </div>
                <div className="mt-2">
                  <RichText text={post.text ?? ''} onTag={(t) => { app.closePost(); app.go(`/explore?tag=${encodeURIComponent(t)}`); }} onMention={() => {}} />
                </div>

                {post.media?.map((m) => (
                  <img key={m.url} src={m.url} alt={m.alt} className="mt-3 w-full rounded-[16px] border border-white/[.07]" />
                ))}

                <div className="mt-3 flex items-center gap-4 border-t border-white/[.06] pt-2 text-[12.5px] text-ink-mute">
                  <span><b className="ht-num text-ember-300">{app.countOf(post)}</b> heats</span>
                  <span><b className="ht-num text-ink">{Math.round(post.heat?.temp ?? 0)}°</b> temperature</span>
                  {post.longRef && (
                    <button onClick={() => app.openPost(post.longRef!)} className="ml-auto font-bold text-ember-300 hover:underline">
                      Read the forge →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* composer */}
            <div className="mt-5 flex items-start gap-3 rounded-[16px] border border-white/[.07] bg-black/25 p-3">
              <Avatar name={me?.name ?? 'Guest'} handle={me?.handle ?? 'guest'} src={me?.avatar} size={34} />
              <div className="min-w-0 flex-1">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={2}
                  placeholder="Add to the thread…"
                  className="ht-input resize-none !bg-transparent !px-0 !text-[14.5px] focus:!shadow-none"
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className={cls('ht-num text-[11px]', text.length > 480 ? 'text-ember-300' : 'text-ink-faint')}>{text.length}/500</span>
                  <button
                    disabled={!text.trim() || text.length > 500}
                    onClick={() => {
                      s.addReply({ postId: post.id, author: me?.handle ?? 'you', text: text.trim() });
                      s.notify({ type: 'reply', actor: me?.handle ?? 'you', text: `You replied to @${post.authorHandle}`, postId: post.id });
                      setText('');
                      app.toast('Reply posted', 'heat');
                    }}
                    className="ht-btn ht-btn--heat !py-1.5 !text-[12.5px] disabled:opacity-40"
                  >
                    Reply
                  </button>
                </div>
              </div>
            </div>

            {/* replies */}
            <div className="mt-5 space-y-4">
              <AnimatePresence initial={false}>
                {replies.map((r) => (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
                    <Avatar name={getUser(r.author).name} handle={r.author} size={32} />
                    <div>
                      <div className="flex items-baseline gap-1.5 text-[13px]">
                        <b>{getUser(r.author).name}</b>
                        <span className="text-ink-mute">@{r.author}</span>
                        <span className="text-ink-faint">·</span>
                        <span className="text-ink-mute">{timeAgo(r.at)}</span>
                      </div>
                      <p className="mt-1 text-[14px] leading-relaxed text-ink-dim">{r.text}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {seedReplies.map((r, i) => {
                const u = getUser(r.handle);
                return (
                  <div key={i} className="flex items-start gap-3">
                    <Avatar name={u.name} handle={u.handle} src={u.avatar} size={32} />
                    <div>
                      <div className="flex items-baseline gap-1.5 text-[13px]">
                        <b>{u.name}</b>
                        <span className="text-ink-mute">@{u.handle}</span>
                        <span className="text-ink-faint">·</span>
                        <span className="text-ink-mute">{timeAgo(Date.now() - (i + 1) * 3600_000)}</span>
                      </div>
                      <p className="mt-1 text-[14px] leading-relaxed text-ink-dim">{r.text}</p>
                      <div className="mt-1.5 flex items-center gap-3 text-[11.5px] text-ink-mute">
                        <span>↩ reply</span>
                        <span>⇄ repost</span>
                        <span>♡ {12 + i * 7}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
