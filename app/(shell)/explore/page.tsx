'use client';
/* ============================================================================
   /explore — search that behaves like a ranker, not a string filter.

   • instant results across forges, sparks, people and tags, heat-ordered
   • query terms highlighted inside the actual body text
   • time windows (1h → all) re-cool the whole corpus instead of re-sorting it
   • board-shape histogram: the distribution of temperatures, so "why is my
     feed short today" has a visual answer
   ==========================================================================*/

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/lib/app';
import { TopBar } from '@/components/shell/Shell';
import { matches } from '@/lib/feed';
import { computeHeat, tempLabel } from '@/lib/heat';
import { Avatar, Sparkline } from '@/components/ui/primitives';
import { cls, compact, timeAgo } from '@/lib/util';
import { getUser } from '@/lib/seed/users';

const RANGES = [
  { key: '1h', h: 1, label: '1h' },
  { key: '24h', h: 24, label: '24h' },
  { key: '7d', h: 168, label: '7d' },
  { key: '30d', h: 720, label: '30d' },
  { key: 'all', h: 1e6, label: 'All' },
];

export default function ExplorePage() {
  // useSearchParams needs a Suspense boundary for static prerender
  return <Suspense fallback={<div className="mx-auto w-full max-w-[760px] px-4 py-10 text-[13px] text-ink-mute">Loading explore…</div>}><ExploreInner /></Suspense>;
}

function ExploreInner() {
  const app = useApp();
  const sp = useSearchParams();
  const tagParam = sp?.get('tag') ?? '';
  const [q, setQ] = React.useState(app.query || '');
  const [range, setRange] = React.useState('7d');
  const [focus, setFocus] = React.useState(false);
  const [which, setWhich] = React.useState<'all' | 'forges' | 'sparks' | 'people' | 'tags'>('all');
  const [cursor, setCursor] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    app.setQuery(q.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  React.useEffect(() => {
    if (tagParam) setQ('');
  }, [tagParam]);

  const hours = RANGES.find((r) => r.key === range)?.h ?? 168;
  const now = Date.now();

  const pool = React.useMemo(() => {
    return app.posts
      .map((p) => {
        const cooled = computeHeat(
          {
            reactions: p.reactions,
            comments: p.comments,
            reposts: p.reposts,
            date: p.date,
            thermalMass: p.author?.thermalMass ?? 1,
            seed: p.id,
          },
          now
        );
        const ageH = (now - new Date(p.date).getTime()) / 3600000;
        return { ...p, cooled, inRange: ageH <= hours };
      })
      .filter((p) => p.inRange || range === 'all')
      .sort((a, b) => b.cooled.score - a.cooled.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.posts, hours, range]);

  const tagPool = React.useMemo(() => {
    const m = new Map<string, { tag: string; count: number; heat: number; momentum: number }>();
    for (const p of pool) {
      for (const t of p.tags) {
        const e = m.get(t) ?? { tag: t, count: 0, heat: 0, momentum: 0 };
        e.count++;
        e.heat += p.cooled.temp;
        e.momentum += p.cooled.velocity;
        m.set(t, e);
      }
    }
    return [...m.values()].map((e) => ({ ...e, heat: Math.round(e.heat), momentum: Math.round((e.momentum / Math.max(1, e.count)) * 40) })).sort((a, b) => b.heat - a.heat);
  }, [pool]);

  const results = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    const withTag = tagParam ? pool.filter((p) => p.tags.includes(tagParam)) : pool;
    const filtered = query ? withTag.filter((p) => matches(p, query)) : withTag;
    const kinds = filtered.filter((p) => (which === 'all' || which === 'forges' ? p.kind === 'forge' : which === 'sparks' ? p.kind === 'spark' : true));
    return kinds.slice(0, 40);
  }, [q, tagParam, pool, which]);

  const people = React.useMemo(() => {
    const m = new Map<string, { handle: string; heat: number; posts: number }>();
    for (const p of pool) {
      const e = m.get(p.authorHandle) ?? { handle: p.authorHandle, heat: 0, posts: 0 };
      e.heat += p.cooled.temp;
      e.posts++;
      m.set(p.authorHandle, e);
    }
    return [...m.values()].sort((a, b) => b.heat - a.heat).slice(0, 8);
  }, [pool]);

  const hist = React.useMemo(() => {
    const bins = new Array(12).fill(0);
    for (const p of pool) bins[Math.min(11, Math.floor(p.cooled.temp / 8))]++;
    return bins;
  }, [pool]);
  const histMax = Math.max(1, ...hist);

  const suggestions = ['webgl', 'typography', 'edge caching', 'ranking', 'reading', 'postgres'];

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <TopBar title="Explore" sub={`${pool.length} items in range`} />

      {/* search */}        <div className="sticky top-[52px] z-30 -mx-4 border-b border-white/[.06] bg-[#050505]/85 px-4 pb-3 pt-2 backdrop-blur-2xl sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2 rounded-[16px] border border-white/[.09] bg-white/[.035] px-3 py-2 transition-all focus-within:border-ember-500/50 focus-within:bg-ember-500/[.05]">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--ht-ink-mute)" strokeWidth="1.9">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4.2-4.2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 140)}
            placeholder="Search forges, sparks, people, tags — heat-ranked"
            className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(results.length - 1, c + 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              }
              if (e.key === 'Enter' && results[cursor]) app.openPost(results[cursor].id);
              if (e.key === 'Escape') setQ('');
            }}
          />
          {q && (
            <button onClick={() => setQ('')} className="text-ink-mute hover:text-ink" aria-label="Clear">
              ✕
            </button>
          )}
          <span className="ht-label hidden !text-[9px] sm:block">↵ open</span>
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <div className="ht-tabrail -ml-2 max-w-full" role="tablist" aria-label="What to search">
            {(['all', 'forges', 'sparks', 'people', 'tags'] as const).map((w) => {
              const active = which === w;
              return (
                <button
                  key={w}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setWhich(w)}
                  className="ht-tab !px-3.5 !py-2 !text-[13px] capitalize"
                >
                  {w === 'all' ? 'All' : w}
                </button>
              );
            })}
          </div>
          <span className="flex-1" />
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cls(
                'shrink-0 rounded-full px-2.5 py-1.5 text-[11.5px] font-bold transition-colors',
                range === r.key ? 'bg-white/[.09] text-ink' : 'text-ink-mute hover:text-ink-dim'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {focus && !q && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="ht-label !text-[9px]">try</span>
              {suggestions.map((x) => (
                <button key={x} onMouseDown={() => setQ(x)} className="ht-chip !normal-case !tracking-normal">
                  {x}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {tagParam && (
        <div className="mt-4 flex items-center gap-2 rounded-[16px] border border-ember-500/30 bg-ember-500/[.07] px-4 py-3">
          <span className="ht-title text-[18px] ht-heat-text">#{tagParam}</span>
          <span className="text-[12.5px] text-ink-dim">{pool.filter((p) => p.tags.includes(tagParam)).length} items</span>
          <button onClick={() => app.go('/explore')} className="ht-btn ht-btn--ghost ml-auto !py-1 !text-[11px]">
            clear
          </button>
        </div>
      )}

      {/* board shape */}
      <section className="mt-5 rounded-[20px] border border-white/[.07] bg-white/[.02] p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="ht-title text-[15px]">Board shape</h2>
          <span className="ht-num text-[11px] text-ink-mute">{pool.length} items</span>
        </div>
        <div className="flex h-[54px] items-end gap-1">
          {hist.map((v, i) => {
            const h = (v / histMax) * 100;
            const c = tempLabel(i * 8);
            return (
              <div key={i} className="group/bar relative flex-1" style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(2, h)}%` }}
                  transition={{ delay: i * 0.03, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full rounded-t-[3px]"
                  style={{ background: `linear-gradient(180deg, ${c.color}, rgba(255,180,84,.16))`, opacity: v ? 0.95 : 0.28 }}
                />
                <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-1.5 py-0.5 text-[9.5px] opacity-0 transition-opacity group-hover/bar:opacity-100">
                  {i * 8}–{i * 8 + 8}° · {v}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11.5px] text-ink-faint">
Most of the board sits in the middle. A tall bar at the right means one post is eating everything else.
        </p>
      </section>

      {/* tags */}
      {(which === 'all' || which === 'tags') && (
        <section className="mt-5">
          <h2 className="ht-title mb-2.5 text-[15px]">Tags</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {tagPool.slice(0, 12).map((x, i) => (
              <button
                key={x.tag}
                onClick={() => app.go(`/explore?tag=${encodeURIComponent(x.tag)}`)}
                className="ht-card flex items-center gap-3 p-3 text-left"
                style={{ animationDelay: `${i * 0.02}s` }}
              >
                <span className="ht-num w-5 text-[12px] font-black text-ember-500/70">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">#{x.tag}</span>
                  <span className="block text-[11.5px] text-ink-mute">
                    {x.count} item{x.count === 1 ? '' : 's'} on the board
                  </span>
                </span>
                <Sparkline values={[x.heat * 0.3, x.heat * 0.5, x.heat * 0.45, x.heat * 0.8, x.heat, x.heat + x.momentum]} w={40} h={14} fill={false} />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* people */}
      {(which === 'all' || which === 'people') && (
        <section className="mt-6">
          <h2 className="ht-title mb-2.5 text-[15px]">People worth following</h2>
          <div className="ht-panel divide-y divide-white/[.05]">
            {people.map((x) => {
              const u = getUser(x.handle);
              return (
                <div key={x.handle} className="flex items-center gap-3 p-3">
                  <Avatar name={u.name} handle={u.handle} src={u.avatar} size={38} />
                  <div className="min-w-0 flex-1">
                    <button onClick={() => app.go(`/u/${u.handle}`)} className="block truncate text-[14px] font-bold hover:underline">
                      {u.name} {u.verified && <span className="text-ember-400">✓</span>}
                    </button>
                    <span className="block truncate text-[12px] text-ink-mute">
                      @{u.handle} · {compact(u.followers)} followers · {x.posts} item{x.posts === 1 ? '' : 's'} here
                    </span>
                  </div>
                  <button onClick={() => app.toggleFollow(u.handle)} className={cls('ht-btn !px-3 !py-1.5 !text-[12px]', app.follows.includes(u.handle) && '!border-ember-500/40 !text-ember-200')}>
                    {app.follows.includes(u.handle) ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* results */}
      <section className="mt-6 mb-6">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="ht-title text-[15px]">{q ? `Matches for “${q}”` : tagParam ? `#${tagParam}` : 'Hot right now'}</h2>
          <span className="ht-num text-[11.5px] text-ink-mute">{results.length} results · heat-ranked</span>
        </div>
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {results.map((p, i) => {
              return (
                <motion.button
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(0.16, i * 0.012) }}
                  onClick={() => app.openPost(p.id)}
                  onMouseEnter={() => setCursor(i)}
                  className={cls('ht-card flex w-full items-start gap-3 p-3.5 text-left', cursor === i && '!border-ember-500/45')}
                >
                  <Avatar name={p.authorName} handle={p.authorHandle} src={p.authorAvatar} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-1.5 text-[12px] text-ink-mute">
                      <b className="text-[13px] text-ink">{p.authorName}</b>
                      <span>@{p.authorHandle}</span>
                      <span>·</span>
                      <span>{timeAgo(p.date)}</span>
                      <span className="ht-chip !py-[1px] !text-[9px]" style={{ color: p.kind === 'forge' ? 'var(--ht-flare)' : 'var(--ht-cryo-teal)' }}>
                        {p.kind === 'forge' ? `${p.minutes}m forge` : 'spark'}
                      </span>
                    </span>
                    <span className="mt-1 block text-[15px] font-semibold leading-snug text-ink">
                      <Mark text={(p.title ?? p.text ?? '').slice(0, 190)} q={q} />
                    </span>
                    {p.dek && p.kind === 'forge' && (
                      <span className="mt-1 line-clamp-2 block text-[13px] leading-relaxed text-ink-mute">
                        <Mark text={p.dek.slice(0, 180)} q={q} />
                      </span>
                    )}
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {p.tags.slice(0, 3).map((tg) => (
                        <span key={tg} className="ht-chip !py-[1px] !text-[9.5px] !normal-case">
                          #{tg}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="shrink-0 text-[16px] text-ink-faint">→</span>
                </motion.button>
              );
            })}
          </AnimatePresence>
          {results.length === 0 && (
            <div className="ht-panel p-8 text-center">
              <h3 className="ht-title text-[18px]">Nothing in this window</h3>
              <p className="mt-1.5 text-[13px] text-ink-mute">Widen the time range, clear the query, or drop the tag filter.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Mark({ text, q }: { text: string; q: string }) {
  const query = q.trim();
  if (!query) return <>{text}</>;
  const toks = query.split(/\s+/).filter(Boolean).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${toks.join('|')})`, 'ig');
  return (
    <>
      {text.split(re).map((part, i) =>
        toks.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="rounded-[3px] bg-ember-500/25 px-0.5 text-white">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}
