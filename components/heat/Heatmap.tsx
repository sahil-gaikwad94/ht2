'use client';
/* ============================================================================
   components/heat/Heatmap — the thermal ledger (spec §5)

   Collapsed: a compact square of the last 5 weeks, high-level only.
   Expanded: a 53-week dashboard with day-level interrogation, weekly rhythm,
   streak mechanics that never punish, and a generated narrative for the day
   you tap. Cells are SVG rects — 365 of them, one paint, no layout thrash.
   ==========================================================================*/

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, streakOf } from '@/lib/store';
import { cls } from '@/lib/util';
import { useApp } from '@/lib/app';

type Day = { key: string; date: Date; v: number; reads: number; heats: number; ignites: number; posts: number; minutes: number };

export function buildDays(activity: ReturnType<typeof useStore.getState>['activity'], weeks = 53): Day[][] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  // start on the Sunday 52 weeks back
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - (weeks - 1) * 7);
  const cols: Day[][] = [];
  let col: Day[] = [];
  const d = new Date(start);
  while (d <= today) {
    const key = d.toISOString().slice(0, 10);
    const a = activity[key];
    const raw = a ? a.reads + a.heats + a.ignites * 2.4 + a.posts * 2 : 0;
    col.push({
      key,
      date: new Date(d),
      v: Math.min(1, raw / 9),
      reads: a?.reads ?? 0,
      heats: a?.heats ?? 0,
      ignites: a?.ignites ?? 0,
      posts: a?.posts ?? 0,
      minutes: a?.minutes ?? 0,
    });
    if (col.length === 7) {
      cols.push(col);
      col = [];
    }
    d.setDate(d.getDate() + 1);
  }
  if (col.length) cols.push(col);
  return cols;
}

export function cellColor(v: number) {
  if (v <= 0) return 'rgba(255,255,255,.055)';
  if (v < 0.22) return '#6E3C08';
  if (v < 0.45) return '#D97B12';
  if (v < 0.7) return '#FFB454';
  if (v < 0.9) return '#FFCB7D';
  return '#FFF6E8';
}

export function HeatmapCard({ handle, onOpen }: { handle: string; onOpen?: () => void }) {
  const activity = useStore((s) => s.activity);
  const saved = useStore((s) => s.saved);
  const reads = useStore((s) => s.reads);
  const app = useApp();
  const [expanded, setExpanded] = React.useState(false);
  const days = React.useMemo(() => buildDays(activity, expanded ? 53 : 6), [activity, expanded]);
  const flat = days.flat();
  const total = flat.reduce((a, d) => a + d.reads + d.heats + d.ignites + d.posts, 0);
  const streak = streakOf(activity);
  const timeline = React.useMemo(() => {
    const events = [
      ...Object.entries(saved).map(([id, at]) => ({ id: `saved-${id}`, type: 'Saved', label: app.posts.find((p) => p.id === id)?.title ?? 'A piece for later', at })),
      ...Object.entries(reads).map(([id, row]) => ({ id: `read-${id}`, type: row.finished ? 'Finished' : 'Reading', label: app.posts.find((p) => p.id === id)?.title ?? 'A piece from your room', at: row.at })),
      ...app.posts.filter((p) => p.authorHandle === handle).map((p) => ({ id: `post-${p.id}`, type: 'Published', label: p.title ?? p.text ?? 'A new note', at: new Date(p.date).getTime() })),
    ];
    return events.filter((x) => Number.isFinite(x.at)).sort((a, b) => b.at - a.at).slice(0, 5);
  }, [saved, reads, app.posts, handle]);
  const finished = Object.values(reads).filter((r) => r.finished).length;
  const authored = app.posts.filter((p) => p.authorHandle === handle).length;

  return (
    <motion.div layout className="ht-panel overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <motion.div layout className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="ht-title text-[15px]">Your rhythm</h2>
            <span className="ht-num text-[11.5px] text-ink-mute">
              {total} moments · <span className="text-ember-300">{streak.current}d</span> active
            </span>
          </div>
          <div className="mt-3 overflow-hidden rounded-[10px]">
            <Grid days={days} small onCell={() => setExpanded(true)} />
          </div>
          <p className="mt-2 text-[11.5px] text-ink-faint">
            {expanded ? 'Your year at a glance' : 'Tap to open your full reading year'}
          </p>
        </motion.div>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid gap-3 border-t border-white/[.06] px-4 py-4 sm:grid-cols-[1.05fr_.95fr]"
          >
            <div>
              <p className="ht-label !text-[9px]">recent timeline</p>
              <div className="mt-2 space-y-2">
                {timeline.length ? timeline.map((event) => (
                  <div key={event.id} className="flex items-center gap-2.5 text-[11.5px]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember-300 shadow-[0_0_8px_rgba(255,180,84,.7)]" />
                    <span className="min-w-0 flex-1 truncate text-ink-dim">{event.label}</span>
                    <span className="shrink-0 text-[10px] text-ink-faint">{event.type} · {new Date(event.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                )) : <p className="text-[11.5px] text-ink-faint">Your saved pieces and finished reads will appear here.</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Insight label="finished reads" value={finished} />
              <Insight label="pieces published" value={authored} />
              <Insight label="active days" value={Object.keys(activity).length} />
              <Insight label="saved for later" value={Object.keys(saved).length} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-between border-t border-white/[.06] px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[10.5px] text-ink-mute">
          <span>Less</span>
          {[0, 0.15, 0.35, 0.55, 0.8, 1].map((v) => (
            <span key={v} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: cellColor(v) }} />
          ))}
          <span>Incandescent</span>
        </div>
        <div className="flex gap-1.5">
          {onOpen && (
            <button onClick={onOpen} className="ht-btn ht-btn--ghost !py-1 !text-[11.5px]">
              Dashboard
            </button>
          )}
          <button onClick={() => setExpanded((e) => !e)} className="ht-btn !py-1 !text-[11.5px]">
            {expanded ? 'Collapse' : 'Expand year'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Insight({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] border border-white/[.06] bg-white/[.025] p-2.5">
      <span className="ht-num block text-[18px] font-semibold text-white">{value}</span>
      <span className="mt-0.5 block text-[10px] leading-tight text-ink-faint">{label}</span>
    </div>
  );
}

function Grid({ days, small, onCell, selected, hover }: { days: Day[][]; small?: boolean; onCell?: (d: Day) => void; selected?: string; hover?: string }) {
  const size = small ? 9 : 12;
  const gap = small ? 2.5 : 3.5;
  return (
    <svg
      width={days.length * (size + gap)}
      height={7 * (size + gap)}
      viewBox={`0 0 ${days.length * (size + gap)} ${7 * (size + gap)}`}
      role="img"
      aria-label="Daily heat activity grid"
      style={{ display: 'block', maxWidth: '100%', height: 'auto', overflow: 'visible' }}
    >
      {days.map((week, wi) =>
        week.map((d, di) => (
          <rect
            key={d.key}
            className="ht-cell"
            x={wi * (size + gap)}
            y={di * (size + gap)}
            width={size}
            height={size}
            rx={size / 4}
            fill={cellColor(d.v)}
            stroke={selected === d.key ? 'var(--ht-whitehot)' : hover === d.key ? 'rgba(255,255,255,.4)' : 'transparent'}
            strokeWidth={1.2}
            style={d.v > 0.75 ? { filter: `drop-shadow(0 0 ${3 + d.v * 5}px ${cellColor(d.v)})` } : undefined}
            onClick={() => onCell?.(d)}
          >
            <title>{`${d.key} — ${d.reads} reads · ${d.heats} heats · ${d.ignites} ignitions · ${d.posts} posts`}</title>
          </rect>
        ))
      )}
    </svg>
  );
}

/* ------------------------------------------------------------ dashboard */

export function HeatDashboard() {
  const s = useStore();
  const app = useApp();
  const [sel, setSel] = React.useState<Day | null>(null);
  const days = React.useMemo(() => buildDays(s.activity, 53), [s.activity]);
  const flat = days.flat();
  const streak = streakOf(s.activity);
  const totals = flat.reduce(
    (a, d) => ({
      reads: a.reads + d.reads,
      heats: a.heats + d.heats,
      ignites: a.ignites + d.ignites,
      posts: a.posts + d.posts,
      minutes: a.minutes + d.minutes,
    }),
    { reads: 0, heats: 0, ignites: 0, posts: 0, minutes: 0 }
  );
  const busiest = flat.reduce((a, d) => (d.v > (a?.v ?? -1) ? d : a), flat[0]);
  const weekday = [0, 0, 0, 0, 0, 0, 0];
  flat.forEach((d) => (weekday[d.date.getDay()] += d.reads + d.heats + d.ignites * 2 + d.posts * 2));
  const wmax = Math.max(1, ...weekday);
  const months = days
    .map((w, i) => ({ i, m: w[0]?.date.getMonth() }))
    .filter((x, i, arr) => x.m !== undefined && (i === 0 || arr[i - 1].m !== x.m));

  const narrative = sel ? narrativeFor(sel, streak) : null;

  return (
    <div className="mx-auto w-full max-w-[900px]">
      <div className="ht-panel relative overflow-hidden p-5">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(80% 120% at 10% 0%, rgba(255,180,84,.08), transparent 60%)' }} />
        <header className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="ht-label">thermal ledger</span>
            <h2 className="ht-title text-[clamp(1.5rem,1.1rem+1.6vw,2.3rem)]">
              {totals.reads + totals.heats + totals.posts > 0 ? 'Your year, lit' : 'Nothing here yet — that changes today'}
            </h2>
            <p className="mt-1 text-[13px] text-ink-mute">
              {app.me ? `@${app.me.handle}` : '@you'} · {flat.length} days tracked · {compactNum(totals.minutes)} minutes of reading ·{' '}
              <span className="text-ember-300">{totals.ignites} ignitions</span>
            </p>
          </div>
          <button onClick={() => { app.toast('Opening share studio for your year', 'heat'); app.setShare('year'); }} className="ht-btn ht-btn--heat !py-2 !text-[12.5px]">
            Share my year
          </button>
        </header>

        <div className="relative overflow-x-auto pb-2">
          <div className="min-w-[720px]">
            <div className="mb-1 flex gap-[3.5px] pl-[26px]">
              {months.map((m) => (
                <span key={m.i} className="text-[10px] uppercase tracking-[0.1em] text-ink-faint" style={{ width: (12 + 3.5) * 4 }}>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m.m!]}
                </span>
              ))}
            </div>
            <div className="flex gap-[3.5px]">
              <div className="flex w-[22px] flex-col gap-[3.5px] pr-1 text-[9px] text-ink-faint">
                {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
                  <span key={i} style={{ height: 12, lineHeight: '12px' }}>
                    {d}
                  </span>
                ))}
              </div>
              <Grid days={days} onCell={(d) => setSel(d)} selected={sel?.key} />
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {narrative && sel && (
            <motion.div
              key={sel.key}
              initial={{ opacity: 0, y: 12, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className="relative mt-4 overflow-hidden rounded-[16px] border border-ember-500/25 bg-[linear-gradient(110deg,rgba(255,180,84,.07),transparent_55%)] p-4"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="ht-title text-[17px] ht-heat-text">{sel.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                <span className="ht-num text-[12px] text-ink-mute">heat index {Math.round(sel.v * 100)}/100</span>
                <button onClick={() => setSel(null)} className="ht-btn ht-btn--ghost ml-auto !py-0.5 !text-[11px]">
                  close
                </button>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">{narrative}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11.5px]">
                <Metric label="reads" v={sel.reads} />
                <Metric label="heats" v={sel.heats} />
                <Metric label="ignitions" v={sel.ignites} hot />
                <Metric label="posts" v={sel.posts} />
                <Metric label="minutes" v={sel.minutes} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="ht-panel p-4">
          <span className="ht-label">current streak</span>
          <div className="mt-1 flex items-end gap-2">
            <span className="ht-title ht-heat-text text-[42px] leading-none">{streak.current}</span>
            <span className="pb-1 text-[12px] text-ink-mute">days</span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
            A missed day pauses the streak, it never breaks it. We do not do red gaps.
          </p>
        </div>
        <div className="ht-panel p-4">
          <span className="ht-label">weekly rhythm</span>
          <div className="mt-3 flex h-[54px] items-end gap-1.5">
            {weekday.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-[3px]" style={{ height: `${Math.max(3, (v / wmax) * 100)}%`, background: `linear-gradient(180deg,${cellColor(v / wmax)},rgba(255,180,84,.14))`, transition: 'height .8s cubic-bezier(.2,1,.3,1)' }} />
                <span className="text-[9px] uppercase text-ink-faint">{['s', 'm', 't', 'w', 't', 'f', 's'][i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="ht-panel p-4">
          <span className="ht-label">hottest day</span>
          {busiest ? (
            <>
              <div className="mt-1 text-[19px] font-bold">{new Date(busiest.key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              <p className="mt-1.5 text-[12px] text-ink-mute">
                {busiest.reads} reads, {busiest.ignites} ignitions — the day the grid went white-hot.
              </p>
            </>
          ) : (
            <p className="mt-2 text-[12px] text-ink-mute">—</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, v, hot }: { label: string; v: number; hot?: boolean }) {
  return (
    <span className={cls('ht-chip !normal-case !tracking-normal', hot && v > 0 && '!border-ember-500/45 !text-ember-200')}>
      <b className="ht-num">{v}</b> {label}
    </span>
  );
}

function narrativeFor(d: Day, streak: { current: number; longest: number }) {
  const bits: string[] = [];
  if (d.reads > 0) bits.push(`you finished ${d.reads} long-form ${d.reads === 1 ? 'piece' : 'pieces'}`);
  if (d.heats > 0) bits.push(`you heated ${d.heats} post${d.heats === 1 ? '' : 's'} — ${Math.round(d.heats * 0.6)} of them rose above an ember`);
  if (d.ignites > 0) bits.push(`${d.ignites} of those went to level 3 and caught fire`);
  if (d.posts > 0) bits.push(`you published ${d.posts} time${d.posts === 1 ? '' : 's'}`);
  if (!bits.length) return `A quiet day. The grid stays neutral rather than red — pausing is allowed, and ${d.key === new Date().toISOString().slice(0, 10) ? 'today is still open' : 'the streak is unbroken around it'}.`;
  const cap = bits[0][0].toUpperCase() + bits[0].slice(1);
  return `${cap}${bits.length > 1 ? `, and ${bits.slice(1).join(', ')}` : ''}. Heat index ${Math.round(d.v * 100)}/100 — ${d.v > 0.75 ? 'one of your incandescent days.' : d.v > 0.4 ? 'solidly burning.' : 'a warm, low-noise day.'}`;
}

function compactNum(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
