'use client';
/* ============================================================================
   components/cards/PollBlock — heat polls: an option "wins" by temperature,
   and the bars are literally the heat ramp. Votes are local, deterministic
   and animated in on first paint.
   ==========================================================================*/

import * as React from 'react';
import { useApp } from '@/lib/app';
import { hash } from '@/lib/util';

export function PollBlock({ postId, poll }: { postId: string; poll: { question: string; options: { label: string; votes: number }[] } }) {
  const app = useApp();
  const key = `heatt-poll-${postId}`;
  const [pick, setPick] = React.useState<number | null>(null);
  const [extra, setExtra] = React.useState<number[]>(() => poll.options.map(() => 0));

  React.useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v !== null) setPick(Number(v));
    } catch {/* noop */}
  }, [key]);

  const base = poll.options.map((o, i) => o.votes + ((hash(`${postId}${i}`) % 900) / 10 | 0));
  const votes = base.map((b, i) => b + extra[i] + (pick === i ? 1 : 0));
  const total = Math.max(1, votes.reduce((a, b) => a + b, 0));
  const leader = votes.indexOf(Math.max(...votes));

  return (
    <div className="mt-3 rounded-[16px] border border-white/[.08] bg-black/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-bold text-ink">{poll.question}</span>
        <span className="ht-label">{total.toLocaleString()} votes</span>
      </div>
      <div className="grid gap-1.5">
        {poll.options.map((o, i) => {
          const pct = (votes[i] / total) * 100;
          const chosen = pick === i;
          return (
            <button
              key={o.label}
              disabled={pick !== null}
              onClick={() => {
                setPick(i);
                setExtra((e) => e.map((v, j) => (j === i ? v + 1 : v)));
                try {
                  localStorage.setItem(key, String(i));
                } catch {/* noop */}
                app.toast(chosen ? 'Vote cast' : 'Vote cast', 'heat');
              }}
              className="group relative overflow-hidden rounded-[11px] border px-3 py-2 text-left transition-all disabled:cursor-default"
              style={{
                borderColor: chosen || i === leader ? 'rgba(245,154,43,.35)' : 'var(--ht-line)',
                background: 'rgba(255,255,255,.02)',
              }}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0"
                style={{
                  width: pick === null ? '0%' : `${pct}%`,
                  background:
                    i === leader
                      ? 'linear-gradient(90deg,rgba(255,180,84,.3),rgba(255,203,120,.14))'
                      : 'linear-gradient(90deg,rgba(245,154,43,.14),rgba(245,154,43,.05))',
                  transition: 'width 1s cubic-bezier(.2,1,.3,1)',
                }}
              />
              <span className="relative flex items-center justify-between gap-3">
                <span className={chosen ? 'font-bold text-white' : 'text-ink-dim group-hover:text-ink'}>
                  {chosen && '✓ '}
                  {o.label}
                </span>
                {pick !== null && <span className="ht-num text-[12.5px] font-bold text-ember-200">{pct.toFixed(0)}%</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
