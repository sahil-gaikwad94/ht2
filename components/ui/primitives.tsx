'use client';
import * as React from 'react';
import { cls } from '@/lib/util';

/* ============================================================================
   heatt UI primitives — avatar, modal, toast, sparkline, gauge, tabs, kbd
   ==========================================================================*/

export function Avatar({
  name,
  handle,
  src,
  size = 40,
  ring = 0,
  className,
  online,
}: {
  name: string;
  handle?: string;
  src?: string;
  size?: number;
  ring?: number;
  className?: string;
  online?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  const uri = src && !failed ? src : undefined;
  const fallback = React.useMemo(() => {
    // procedural, deterministic — a broken URL never shows a grey box
    if (typeof window === 'undefined') return undefined;
    return import('@/lib/util').then((m) => m.avatarDataUri(name, handle ?? name));
  }, [name, handle]);
  const [fb, setFb] = React.useState<string>();
  React.useEffect(() => {
    let alive = true;
    fallback?.then((v) => alive && setFb(v));
    return () => {
      alive = false;
    };
  }, [fallback]);

  const dim = size + ring * 2;
  return (
    <span
      className={cls('relative inline-block shrink-0 align-middle', className)}
      style={{ width: dim, height: dim }}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: ring ? `0 0 0 ${ring}px var(--ht-void)` : undefined }}
      />
      <img
        src={uri ?? fb ?? undefined}
        alt={uri ? name : ''}
        aria-hidden={!uri}
        width={dim}
        height={dim}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="relative block rounded-full object-cover"
        style={{
          width: dim,
          height: dim,
          border: '1px solid rgba(255,255,255,.09)',
          background: 'linear-gradient(140deg,#1b1b20,#0c0c0f)',
        }}
      />
      {online && (
        <span
          aria-hidden
          className="absolute"
          style={{
            right: 1,
            bottom: 1,
            width: Math.max(8, size / 4.5),
            height: Math.max(8, size / 4.5),
            borderRadius: 99,
            background: '#63D8F5',
            boxShadow: '0 0 10px rgba(99,216,245,.9)',
            border: '2px solid var(--ht-void)',
          }}
        />
      )}
    </span>
  );
}

/* --------------------------------------------------------------------- modal */

export function Modal({
  open,
  onClose,
  children,
  labelledBy,
  wide,
  bare,
  align = 'center',
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
  wide?: boolean;
  bare?: boolean;
  align?: 'center' | 'top';
}) {
  const [mounted, setMounted] = React.useState(false);
  const shown = open && mounted;

  React.useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(id);
    }
    setMounted(false);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!shown) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex justify-center px-3"
      style={{
        alignItems: align === 'center' ? 'center' : 'flex-start',
        paddingTop: align === 'top' ? 'max(4vh, env(safe-area-inset-top))' : 0,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(90% 70% at 50% 40%, rgba(0,0,0,.72), rgba(4,4,5,.9))',
          backdropFilter: 'blur(10px) saturate(120%)',
          WebkitBackdropFilter: 'blur(10px) saturate(120%)',
          animation: 'ht-fade .28s ease-out',
        }}
      />
      <div
        className={cls('relative w-full', wide ? 'max-w-[1080px]' : 'max-w-[600px]')}
        style={{
          animation: 'ht-modal-in .42s cubic-bezier(.2,1,.3,1)',
          maxHeight: align === 'top' ? '92vh' : '92vh',
        }}
      >
        {bare ? (
          children
        ) : (
          <div className="ht-glass overflow-hidden rounded-[26px]" style={{ boxShadow: '0 50px 120px -40px rgba(0,0,0,.95), 0 0 0 1px rgba(255,255,255,.06)' }}>
            {children}
          </div>
        )}
      </div>
      <style>{`
        @keyframes ht-modal-in{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
        @keyframes ht-fade{from{opacity:0}to{opacity:1}}
      `}</style>
    </div>
  );
}

/* --------------------------------------------------------------- sparkline */

export function Sparkline({
  values,
  w = 84,
  h = 22,
  color = 'var(--ht-flame)',
  fill = true,
  strokeWidth = 1.6,
}: {
  values: number[];
  w?: number;
  h?: number;
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
}) {
  if (!values.length) return null;
  const max = Math.max(...values, 0.0001);
  const min = Math.min(...values, 0);
  const span = Math.max(0.0001, max - min);
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 2) - 1;
    return [x, y] as const;
  });
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${d} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ overflow: 'visible' }}>
      {fill && <path d={area} fill={color} opacity={0.14} />}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={1.9} fill={color} />
    </svg>
  );
}

/* ------------------------------------------------------------------- gauges */

export function HeatGauge({ value, size = 46, label }: { value: number; size?: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const hue = 8 + (v / 100) * 40;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} title={label}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={3} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`hsl(${hue} 88% ${46 + v * 0.24}%)`}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          style={{ transition: 'stroke-dasharray .8s cubic-bezier(.2,1,.3,1)', filter: `drop-shadow(0 0 6px hsl(${hue} 88% 55% / .7))` }}
        />
      </svg>
      <span
        className="ht-num absolute font-extrabold"
        style={{ fontSize: size * 0.28, color: v > 66 ? 'var(--ht-whitehot)' : 'var(--ht-flare)' }}
      >
        {Math.round(v)}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------- toast */

export function Toast({
  items,
  dismiss,
}: {
  items: { id: number; text: string; tone?: 'heat' | 'cool' | 'plain'; icon?: React.ReactNode }[];
  dismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(84px,calc(env(safe-area-inset-bottom)+84px))] z-[90] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="ht-glass pointer-events-auto flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px] font-semibold"
          style={{
            animation: 'ht-toast .5s cubic-bezier(.2,1,.3,1)',
            borderColor: t.tone === 'heat' ? 'rgba(245,154,43,.34)' : t.tone === 'cool' ? 'rgba(99,216,245,.35)' : 'var(--ht-line)',
            boxShadow: t.tone === 'heat' ? '0 18px 50px -18px rgba(255,180,84,.6)' : '0 18px 50px -20px rgba(0,0,0,.9)',
          }}
        >
          {t.icon}
          <span className={t.tone === 'heat' ? 'ht-heat-text' : ''}>{t.text}</span>
        </button>
      ))}
      <style>{`@keyframes ht-toast{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

/* ----------------------------------------------------------------- kbd hint */

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="rounded-[6px] border border-white/10 bg-white/[.04] px-1.5 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider text-ink-dim"
      style={{ boxShadow: '0 1px 0 rgba(0,0,0,.6)' }}
    >
      {children}
    </kbd>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cls('ht-hairline my-4', className)} />;
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ animation: 'spin 1s linear infinite' }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="2.4" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="var(--ht-ember)" strokeWidth="2.4" strokeLinecap="round" />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  );
}

export function Meter({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className={cls('relative block h-[3px] w-full overflow-hidden rounded-full bg-white/[.07]', className)}>
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${v * 100}%`,
          background: 'linear-gradient(90deg,var(--ht-magma),var(--ht-flame) 60%,var(--ht-whitehot))',
          boxShadow: '0 0 12px rgba(255,180,84,.7)',
          transition: 'width .6s cubic-bezier(.2,1,.3,1)',
        }}
      />
    </span>
  );
}
