'use client';
/* ============================================================================
   components/heat/FireOverlay — the 2.4s ignition.

   Real flame simulation, cheap enough to run per-card: a 1/3-resolution
   offscreen buffer with a 1D height field of temperature that (1) cools,
   (2) diffuses sideways, (3) is driven by turbulence noise and (4) upscales
   with a CSS blur so the low-res grid reads as soft fire instead of blocks.
   Ends on its own — fire that loops is a screensaver.
   ==========================================================================*/

import * as React from 'react';

export type FireProps = {
  active: boolean;
  /** ms; spec default 2400 */
  duration?: number;
  /** 'full' burns the card bottom + border, 'subtle' is border-only */
  variant?: 'full' | 'subtle';
  onDone?: () => void;
  className?: string;
};

const FW = 96; // sim width
const FH = 40; // sim height

export function FireOverlay({ active, duration = 2400, variant = 'full', onDone, className }: FireProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;

  React.useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced =
      document.documentElement.dataset.reduceMotion === 'true' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = 1; // intentionally low-res; CSS upsamples + blurs
    canvas.width = FW * dpr;
    canvas.height = FH * dpr;

    const img = ctx.createImageData(FW, FH);
    const buf = new Float32Array(FW * FH);
    const prev = new Float32Array(FW * FH);

    const t0 = performance.now();
    let raf = 0;
    let frame = 0;

    const decay = 1 - 0.034; // heat lost per frame at the top
    const spread = 0.14; // lateral diffusion — makes tongues, not bars

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const el = now - t0;
      const life = 1 - Math.min(1, el / duration);
      // ignition curve: snap up, hold, then die down with a final flare
      const env = Math.min(1, el / 190) * (0.35 + 0.65 * Math.pow(life, 0.72)) + (life < 0.12 ? life * 4.2 : 0);
      frame++;

      // --- 1. source row: turbulent heat injected along the bottom edge ---
      const y = FH - 1;
      for (let x = 0; x < FW; x++) {
        const n =
          Math.sin((x * 0.19 + frame * 0.11) * 1.7) * 0.5 +
          Math.sin((x * 0.045 - frame * 0.052) * 3.1) * 0.34 +
          Math.sin((x * 0.71 + frame * 0.21)) * 0.12 +
          (Math.random() - 0.5) * 0.5;
        // gusts travel along the base so flames lean
        const gust = 0.55 + 0.45 * Math.sin(frame * 0.045 + x * 0.02);
        buf[y * FW + x] = Math.max(0, (0.52 + n * 0.5) * gust * env);
      }

      // --- 2. cool + rise + diffuse -------------------------------------
      for (let row = FH - 2; row >= 0; row--) {
        for (let x = 0; x < FW; x++) {
          const i = row * FW + x;
          const below = prev[(row + 1) * FW + x];
          const l = prev[i - 1] ?? 0;
          const r = prev[i + 1] ?? 0;
          const dx = (l - r) * 0.035; // flame bends toward cooler air
          const src = buf[i + FW + (dx > 0 ? 1 : dx < 0 ? -1 : 0)] ?? below;
          buf[i] = Math.max(0, (below * decay + src * 0.16) * (1 - 0.02) + (l + r) * spread * 0.5 - below * spread);
          buf[i] *= 0.985;
        }
      }

      // swap
      prev.set(buf);

      // --- 3. palette: black → ember → flame → incandescent --------------
      const d = img.data;
      for (let i = 0; i < FW * FH; i++) {
        const v = Math.min(1, buf[i] * 1.45);
        let r = 0,
          g = 0,
          b = 0,
          a = 0;
        if (v > 0.02) {
          if (v < 0.28) {
            const k = v / 0.28;
            r = 22 * k;
            g = 86 * k;
            b = 34 * k;
            a = 255 * k * 0.72;
          } else if (v < 0.62) {
            const k = (v - 0.28) / 0.34;
            r = 22 + 38 * k;
            g = 86 + 84 * k;
            b = 34 + 16 * k;
            a = 255 * (0.7 + 0.3 * k);
          } else if (v < 0.86) {
            const k = (v - 0.62) / 0.24;
            r = 60 + 120 * k;
            g = 170 + 80 * k;
            b = 50 + 30 * k;
            a = 255;
          } else {
            const k = (v - 0.86) / 0.14;
            r = 180 + 67 * k;
            g = 250 + 5 * k;
            b = 80 + 148 * k;
            a = 255;
          }
        }
        const o = i * 4;
        d[o] = r;
        d[o + 1] = g;
        d[o + 2] = b;
        d[o + 3] = a;
      }
      ctx.putImageData(img, 0, 0);

      if (el >= duration) {
        cancelAnimationFrame(raf);
        ctx.clearRect(0, 0, FW, FH);
        doneRef.current?.();
      }
    };

    if (reduced || variant === 'subtle') {
      // still honour the moment, without the particle work
      canvas.style.opacity = '0.45';
      const id = setTimeout(() => doneRef.current?.(), duration);
      return () => clearTimeout(id);
    }

    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      const id = window.setTimeout(() => doneRef.current?.(), duration + 60);
      return () => clearTimeout(id);
    };
  }, [active, duration, variant]);

  if (!active) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className={className}
        style={{
          position: 'absolute',
          left: '-4%',
          bottom: '-6%',
          width: '108%',
          height: '74%',
          pointerEvents: 'none',
          zIndex: 40,
          filter: 'blur(7px) saturate(1.2)',
          mixBlendMode: 'screen',
          opacity: 0.8,
          imageRendering: 'auto',
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 39,
          background: 'radial-gradient(90% 55% at 50% 112%, rgba(255,180,84,.22), transparent 68%)',
          mixBlendMode: 'screen',
          animation: 'ht-fire-bloom 2.4s cubic-bezier(.2,.9,.2,1) forwards',
        }}
      />
      <style>{`@keyframes ht-fire-bloom{0%{opacity:0}10%{opacity:1}70%{opacity:.85}100%{opacity:0}}`}</style>
    </>
  );
}

/** Rising ember trail used on heated (not ignited) cards + avatars. */
export function EmberTrail({ active, count = 10 }: { active: boolean; count?: number }) {
  if (!active) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 20 }}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="ht-ember"
          style={
            {
              left: `${6 + (i * 89) % 88}%`,
              bottom: '-4px',
              ['--dx' as string]: `${((i * 37) % 30) - 15}px`,
              ['--dy' as string]: `${-70 - ((i * 53) % 90)}px`,
              ['--d' as string]: `${2 + ((i * 17) % 14) / 10}s`,
              animationDelay: `${((i * 29) % 20) / 10}s`,
              animationIterationCount: '3',
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
