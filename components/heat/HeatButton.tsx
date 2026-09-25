'use client';
/* ============================================================================
   components/heat/HeatButton — the core interaction (spec §11 ignition)

     • tap         → level 1 "ember"   (or cool down to 0 if already lit)
     • hold 1.15s  → level 2 "blaze"
     • hold 2.45s  → level 3 "inferno" → full-card IGNITION for 2.4s
     • release early → commits the level reached; never overshoots
     • scroll intent always wins (24px move cancels the heat clock)

   A conic-gradient ring renders progress (GPU, no layout), haptics mark each
   threshold, and the whole thing is keyboard accessible (Enter/Space tap,
   hold Space for level 3).
   ==========================================================================*/

import * as React from 'react';
import { HOLD_MS, LEVEL_META, tempLabel } from '@/lib/heat';
import type { HeatLevel } from '@/lib/types';
import { cls } from '@/lib/util';

export type HeatButtonProps = {
  level: HeatLevel;
  count: number;
  temp?: number;
  onChange: (level: HeatLevel, meta: { ignited: boolean }) => void;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  label?: string;
  className?: string;
  compact?: boolean;
};

const SIZE = {
  sm: { pad: '5px 9px 5px 7px', icon: 15, font: 'var(--fs-micro)', gap: 5 },
  md: { pad: '7px 12px 7px 10px', icon: 18, font: 'var(--fs-sm)', gap: 7 },
  lg: { pad: '11px 18px 11px 15px', icon: 24, font: 'var(--fs-base)', gap: 9 },
};

export function HeatButton({
  level,
  count,
  temp = 0,
  onChange,
  size = 'md',
  showCount = true,
  label,
  className,
  compact,
}: HeatButtonProps) {
  const [hold, setHold] = React.useState(0); // 0..1 progress toward L3
  const [preview, setPreview] = React.useState<HeatLevel>(0);
  const [pop, setPop] = React.useState(0); // bump animation key
  const raf = React.useRef(0);
  const started = React.useRef(0);
  const committed = React.useRef<HeatLevel>(0);
  const moved = React.useRef(false);
  const origin = React.useRef<{ x: number; y: number } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const s = SIZE[size];

  const buzz = React.useCallback((pattern: number | number[]) => {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch {/* unsupported */}
  }, []);

  const stopClock = React.useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
  }, []);

  const tick = React.useCallback(() => {
    const t = performance.now() - started.current;
    const p = Math.min(1, t / HOLD_MS[3]);
    setHold(p);
    const want: HeatLevel = t >= HOLD_MS[3] ? 3 : t >= HOLD_MS[2] ? 2 : 1;
    if (want !== preview) {
      setPreview(want);
      buzz(want === 3 ? [16, 26, 42] : want === 2 ? 12 : 6);
      if (want === 3) {
        // ignite immediately at the threshold — do not wait for release
        committed.current = 3;
        setPop((x) => x + 1);
        onChange(3, { ignited: true });
        stopClock();
        setHold(0);
        setPreview(0);
        burstEmbers();
      }
    }
    if (t < HOLD_MS[3]) raf.current = requestAnimationFrame(tick);
  }, [buzz, onChange, preview, stopClock]);

  const burstEmbers = () => {
    const el = btnRef.current;
    if (!el) return;
    for (let i = 0; i < 9; i++) {
      const e = document.createElement('span');
      e.className = 'ht-ember';
      const dx = (Math.random() - 0.5) * 90;
      const dy = -40 - Math.random() * 120;
      e.style.cssText = `left:${el.offsetWidth / 2}px;top:${el.offsetHeight / 2}px;--dx:${dx}px;--dy:${dy}px;--d:${1.1 + Math.random()}s`;
      el.parentElement?.appendChild(e);
      setTimeout(() => e.remove(), 2400);
    }
    const shock = document.createElement('span');
    shock.className = 'ht-shock';
    shock.style.cssText = `left:${el.offsetLeft + el.offsetWidth / 2}px;top:${el.offsetTop + el.offsetHeight / 2}px`;
    el.parentElement?.appendChild(shock);
    setTimeout(() => shock.remove(), 900);
  };

  const begin = (e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    moved.current = false;
    origin.current = { x: e.clientX, y: e.clientY };
    committed.current = level;
    started.current = performance.now();
    setPreview(level || 0);
    stopClock();
    raf.current = requestAnimationFrame(tick);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (!origin.current) return;
    if (Math.abs(e.clientX - origin.current.x) > 24 || Math.abs(e.clientY - origin.current.y) > 24) {
      moved.current = true;
      cancelHold();
    }
  };

  const cancelHold = () => {
    stopClock();
    setHold(0);
    setPreview(0);
    origin.current = null;
  };

  const end = () => {
    stopClock();
    const wasHolding = !!origin.current;
    origin.current = null;
    const elapsed = wasHolding ? performance.now() - started.current : 0;
    setHold(0);
    setPreview(0);
    if (moved.current) return;

    if (!wasHolding || elapsed < HOLD_MS[2]) {
      // a tap: light an ember, or cool back down when already lit
      if (level > 0) {
        onChange(0, { ignited: false });
        setPop((x) => x + 1);
      } else {
        onChange(1, { ignited: false });
        setPop((x) => x + 1);
        buzz(8);
      }
      return;
    }
    if (committed.current === 3) return; // ignition already committed
    const reached: HeatLevel = elapsed >= HOLD_MS[3] ? 3 : elapsed >= HOLD_MS[2] ? 2 : 1;
    if (reached !== level) {
      onChange(reached, { ignited: reached === 3 });
      setPop((x) => x + 1);
    }
  };

  // keyboard: hold Enter/Space to ramp, release to commit
  const keyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (e.repeat) return;
    started.current = performance.now();
    committed.current = level;
    setPreview(level || 0);
    stopClock();
    raf.current = requestAnimationFrame(tick);
  };
  const keyUp = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    end();
  };

  React.useEffect(() => () => stopClock(), [stopClock]);

  const shown = preview || level;
  const meta = LEVEL_META[shown];
  const label_ = label ?? (level === 0 ? 'Heat this post' : `${meta?.name ?? ''} — hold to intensify`);
  const { color } = tempLabel(temp);

  return (
    <button
      type="button"
      ref={btnRef}
      className={cls('ht-heat-btn', className)}
      data-level={level || undefined}
      aria-label={label_}
      aria-pressed={level > 0}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={cancelHold}
      onKeyDown={keyDown}
      onKeyUp={keyUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{ padding: s.pad, gap: s.gap, fontSize: s.font, touchAction: 'pan-y' }}
      title={compact ? undefined : 'Tap = ember · hold = blaze · hold to 3 = ignition'}
    >
      <span
        className="ht-ring"
        style={{ ['--p' as string]: Math.max(0, hold), ['--o' as string]: hold > 0.02 ? 1 : 0 }}
        aria-hidden
      />
      <span
        key={pop}
        style={{
          display: 'inline-flex',
          animation: pop ? 'ht-heat-pop .5s cubic-bezier(.2,1.4,.3,1)' : undefined,
          filter: level >= 2 ? `drop-shadow(0 0 8px ${color})` : undefined,
        }}
      >
        <FlameIcon level={level} preview={preview} size={s.icon} />
      </span>

      {showCount && (
        <span className={cls('ht-num font-semibold', level > 0 && 'ht-heat-text')}>
          {count >= 1000 ? `${(count / 1000).toFixed(count < 10000 ? 1 : 0)}K` : count}
        </span>
      )}

      {preview >= 2 && (
        <span
          className="pointer-events-none absolute left-1/2 -top-8 -translate-x-1/2 whitespace-nowrap rounded-full border border-ember-500/40 bg-[#1A0E02]/95 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-ember-200"
          style={{ boxShadow: '0 8px 24px -8px rgba(255,180,84,.7)' }}
        >
          {preview === 3 ? 'Igniting…' : 'Hold for ignition'}
        </span>
      )}
      <style>{`@keyframes ht-heat-pop{0%{transform:scale(.72)}45%{transform:scale(1.28)}100%{transform:scale(1)}}`}</style>
    </button>
  );
}

function FlameIcon({ level, preview, size }: { level: HeatLevel; preview: HeatLevel; size: number }) {
  const l = Math.max(level, preview);
  const id = React.useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`htf-${id}`} x1="0" x2="0" y1="1" y2="0">
          <stop offset="0" stopColor={l >= 2 ? '#EFCB8B' : '#F59A2B'} />
          <stop offset="0.55" stopColor={l >= 3 ? '#FFF6E8' : '#FFB454'} />
          <stop offset="1" stopColor={l >= 1 ? '#FFC978' : '#8A8A8A'} />
        </linearGradient>
      </defs>
      <path
        d={
          l >= 1
            ? 'M12 2.2c1.1 3 .2 4.5-1 5.9-1.4 1.6-3.1 3-3.1 6A6.1 6.1 0 0 0 12 21a6.1 6.1 0 0 0 4.2-10.9c-.5 1.2-1.2 1.7-1.9 1.9.6-2.7-.3-6.6-2.3-9.8Z'
            : 'M12 3.4c.9 2.4.1 3.7-1 4.9-1.3 1.4-2.7 2.6-2.7 5.2A4.7 4.7 0 0 0 12 19.6a4.7 4.7 0 0 0 3.7-6.1c-.4.9-1 1.3-1.6 1.5.5-2.3-.2-5.6-2.1-8.4Z'
        }
        fill={l >= 1 ? `url(#htf-${id})` : 'none'}
        stroke={l >= 1 ? `url(#htf-${id})` : 'currentColor'}
        strokeWidth="1.6"
        strokeLinejoin="round"
        style={l >= 3 ? { filter: `drop-shadow(0 0 7px rgba(255,180,84,.95))`, animation: 'ht-flicker 1.1s ease-in-out infinite' } : undefined}
      />
      {l >= 3 && (
        <path
          d="M12 12.6c.5 1.3.1 2-.6 2.8-.6.7-1 1.3-1 2.1a1.7 1.7 0 0 0 3.3.3c0-.9-.4-1.5-1.7-5.2Z"
          fill="#FFF6E8"
          opacity=".95"
        />
      )}
      <style>{`@keyframes ht-flicker{0%,100%{transform:scale(1)}50%{transform:scale(1.07) translateY(-.4px)}}`}</style>
    </svg>
  );
}
