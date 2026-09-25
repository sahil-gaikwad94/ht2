'use client';
/* ============================================================================
   /library — the reading desk. Saved forges live here as paper cards with
   resume progress, finished receipts, and an offline-ready cache panel.
   ==========================================================================*/

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useApp } from '@/lib/app';
import { useStore } from '@/lib/store';
import { Avatar } from '@/components/ui/primitives';
import { bodyCacheSize, clearBodies } from '@/lib/syndicate';
import { kelvin, tempLabel } from '@/lib/heat';
import { cls, timeAgo } from '@/lib/util';
import { heatFor } from '@/lib/feed';

type Row = { id: string; title: string; author: string; handle: string; avatar?: string; minutes: number; pct: number; saved?: number; readAt?: number; temp: number; tags: string[]; kind: 'forge' | 'spark' };

export default function LibraryPage() {
  const app = useApp();
  const s = useStore();
  const [filter, setFilter] = React.useState<'all' | 'saved' | 'reading' | 'done'>('all');
  const [cache, setCache] = React.useState(0);
  React.useEffect(() => setCache(bodyCacheSize()), []);

  const rows: Row[] = React.useMemo(() => {
    const out: Row[] = [];
    for (const p of app.posts) {
      const saved = s.saved[p.id];
      const r = s.reads[p.id];
      if (!saved && !r) continue;
      out.push({
        id: p.id,
        title: p.title ?? p.text?.slice(0, 80) ?? 'Untitled',
        author: p.authorName,
        handle: p.authorHandle,
        avatar: p.authorAvatar,
        minutes: p.minutes ?? 3,
        pct: r?.pct ?? 0,
        saved,
        readAt: r?.at,
        temp: p.heat?.temp ?? heatFor(p, s as any).temp,
        tags: p.tags,
        kind: p.kind,
      });
    }
    return out
      .filter((x) => (filter === 'saved' ? !!x.saved : filter === 'reading' ? x.pct > 0 && x.pct < 97 : filter === 'done' ? x.pct >= 97 : true))
      .sort((a, b) => Math.max(b.saved ?? 0, b.readAt ?? 0) - Math.max(a.saved ?? 0, a.readAt ?? 0));
  }, [app.posts, s, filter]);

  const savedCount = Object.keys(s.saved).length;
  const reading = Object.values(s.reads).filter((r) => r.pct > 0 && r.pct < 97).length;
  const done = Object.values(s.reads).filter((r) => r.pct >= 97).length;
  const minutes = Object.values(s.activity).reduce((a, d) => a + d.minutes, 0);
  const totalWords = rows.reduce((a, r) => a + Math.round((r.minutes * 225 * r.pct) / 100), 0);

  return (
    <div className="mx-auto w-full max-w-[760px]">
      {/* page header — same anatomy as the feed's greeting bar */}
      <header className="flex items-center gap-3 px-1 pb-4 pt-3">
        <div className="min-w-0 flex-1">
          <p className="ht-eyebrow">saved · resumable · offline</p>
          <h1 className="ht-title mt-1.5 truncate text-[26px] leading-tight text-ink">
            Your <span className="ht-heat-text">library</span>
          </h1>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full border border-white/[.09] px-3 py-1.5 text-[11.5px] text-ink-mute sm:flex">
          <span className="ht-num font-bold text-ember-300">{cache}</span> cached
          <button
            onClick={() => {
              clearBodies();
              setCache(0);
              app.toast('Offline text cache cleared', 'cool');
            }}
            className="ht-btn ht-btn--ghost !px-2 !py-0.5 !text-[11px]"
          >
            clear
          </button>
        </span>
      </header>

      <div className="mt-1 grid gap-3 sm:grid-cols-3">
        <StatCard label="saved for later" value={String(savedCount)} foot="stored on this device" />
        <StatCard label="in progress" value={String(reading)} foot="resume where you stopped" accent />
        <StatCard label="finished" value={String(done)} foot={`${minutes} min read · ${totalWords.toLocaleString()} words`} />
      </div>

      {/* pill filter row — the amber pill marks the active view */}
      <div className="mt-4 mb-4 flex items-center gap-1.5">
        <div className="ht-tabrail -ml-2 max-w-full" role="tablist" aria-label="Filter your library">
          {(['all', 'saved', 'reading', 'done'] as const).map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f)}
                className="ht-tab !px-4 !py-2 !text-[13px]"
              >
                {f === 'all' ? 'Everything' : f === 'reading' ? 'In progress' : f === 'done' ? 'Finished' : 'Saved'}
              </button>
            );
          })}
        </div>
        <span className="flex-1" />
        <span className="ht-num hidden shrink-0 pr-1 text-[11.5px] text-ink-faint sm:block">{rows.length} item{rows.length === 1 ? '' : 's'}</span>
      </div>

      <div className="space-y-3 pb-8">
        {rows.map((r, i) => (
          <PaperRow key={r.id} row={r} index={i} onOpen={() => app.openPost(r.id)} onRemove={() => { s.toggleSave(r.id); app.toast('Removed from library', 'cool'); }} />
        ))}

        {rows.length === 0 && (
          <div className="ht-panel p-10 text-center">
            <h2 className="ht-title text-[21px]">Your desk is clear</h2>
            <p className="mx-auto mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-ink-dim">
              Save a forge with the bookmark button and it lives here — cached on this device, resumable to the paragraph you left, and readable on a plane.
            </p>
            <Link href="/feed" className="ht-btn ht-btn--heat mt-4">
              Back to the board
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/* A saved piece as a charcoal glass tile: the work, the heat, and exactly how
   far in you got. One treatment for both modalities — the library is a shelf. */
function PaperRow({ row, index, onOpen, onRemove }: { row: Row; index: number; onOpen: () => void; onRemove: () => void }) {
  const t = tempLabel(row.temp);
  const done = row.pct >= 97;
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(0.18, index * 0.03), duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="ht-card group p-4"
      data-lib-item
    >
      <div className="flex items-center gap-3.5">
        <Avatar name={row.author} handle={row.handle} src={row.avatar} size={38} />
        <div className="min-w-0 flex-1">
          <button onClick={onOpen} className="block w-full text-left">
            <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-white">{row.title}</span>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-mute">
            <span>@{row.handle}</span>
            <span aria-hidden>·</span>
            <span>{row.minutes} min</span>
            {row.saved && (
              <>
                <span aria-hidden>·</span>
                <span className="text-ember-300">saved {timeAgo(row.saved)}</span>
              </>
            )}
            {row.pct > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className={done ? 'text-cryo-teal' : 'text-ink-dim'}>{done ? 'finished' : `${row.pct}% read`}</span>
              </>
            )}
          </div>
          {row.pct > 0 && !done && (
            <span className="mt-2.5 block h-[3px] w-full overflow-hidden rounded-full bg-white/[.07]">
              <motion.span
                className="block h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${row.pct}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
                style={{ background: 'linear-gradient(90deg,#EFCB8B,#FFB454)' }}
              />
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button onClick={onOpen} className="ht-btn !px-3 !py-1.5 !text-[11.5px]">
            {row.pct > 0 && !done ? 'Resume' : 'Open'}
          </button>
          <button onClick={onRemove} className="ht-btn ht-btn--ghost !px-3 !py-1 !text-[11px]">
            remove
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function StatCard({ label, value, foot, accent }: { label: string; value: string; foot: string; accent?: boolean }) {
  return (
    <div className="ht-panel p-4">
      <span className="ht-label !text-[9px]">{label}</span>
      <div className={cls('ht-num mt-1 text-[28px] font-black leading-none', accent ? 'ht-heat-text' : 'text-ink')}>{value}</div>
      <div className="mt-1.5 text-[11.5px] text-ink-faint">{foot}</div>
    </div>
  );
}
