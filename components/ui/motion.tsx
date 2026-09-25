'use client';
/* ============================================================================
   components/ui/motion — the motion primitives.

   These are the only places scroll observation, parallax, gyro response and
   3D tilt are implemented. Screens compose them; they never re-invent them.
   Each one degrades to a static, fully-visible state when the device, the
   browser or the user declines motion — including in jsdom, where
   IntersectionObserver does not exist.
   ==========================================================================*/

import * as React from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useScroll,
  type MotionStyle,
  type Variants,
} from 'framer-motion';
import { EASE, EASE_CINEMA, plateIn, stagger, wordFade, useMotionPrefs } from '@/lib/motion';
import { cls } from '@/lib/util';

/* ------------------------------------------------------------ in-view hook */

/**
 * IntersectionObserver with a hard guarantee: if the API is missing (jsdom,
 * very old browsers) or motion is reduced, content is simply visible. A
 * reveal animation must never be load-bearing for whether text is on screen.
 */
export function useInViewSafe<T extends HTMLElement>(margin = '-12% 0px -8% 0px') {
  const ref = React.useRef<T | null>(null);
  const [seen, setSeen] = React.useState(false);

  React.useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setSeen(true);
      },
      { rootMargin: margin, threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin, seen]);

  return { ref, seen };
}

/* ----------------------------------------------------------------- Reveal */

export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
  as = 'div',
  once = true,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
  once?: boolean;
}) {
  const { ref, seen } = useInViewSafe<HTMLDivElement>();
  const { reduced } = useMotionPrefs();
  const Tag = motion[as] as typeof motion.div;
  const show = seen || reduced;

  return (
    <Tag
      ref={ref}
      initial={false}
      animate={show ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y, filter: 'blur(10px)' }}
      transition={{ duration: reduced ? 0 : 0.72, ease: EASE, delay: reduced ? 0 : delay }}
      className={className}
      data-revealed={show ? 'true' : 'false'}
      // `once` is intentionally not used to unmount: the observer disconnects
      // itself after first intersection, so this stays cheap.
      style={once ? undefined : { willChange: 'transform' }}
    >
      {children}
    </Tag>
  );
}

/* -------------------------------------------------------------- SplitText */

/** Words resolve out of a blur, in order. Used for cinematic headlines. */
export function SplitText({
  text,
  className,
  wordClassName,
  delay = 0,
  each = 0.075,
  play = true,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
  each?: number;
  play?: boolean;
}) {
  const { reduced } = useMotionPrefs();
  const words = text.split(' ');
  return (
    <span className={cls('inline-block', className)}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className={cls('inline-block', wordClassName)}
          initial={false}
          animate={play || reduced ? 'show' : 'hidden'}
          variants={wordFade}
          transition={{ delay: reduced ? 0 : delay + i * each, duration: 0.8, ease: EASE }}
        >
          {w}
          {i < words.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </span>
  );
}

/* -------------------------------------------------------------- Parallax */

/**
 * Scroll-driven depth. `speed` is how far the layer travels over the scroll
 * range in pixels — negative moves against the scroll (the "far" plane).
 */
export function Parallax({
  children,
  speed = -40,
  range = ['start end', 'end start'],
  className,
  style,
}: {
  children: React.ReactNode;
  speed?: number;
  range?: [string, string];
  className?: string;
  style?: MotionStyle;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const { reduced } = useMotionPrefs();
  const { scrollYProgress } = useScroll({ target: ref, offset: range as never });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : speed]);

  return (
    <motion.div ref={ref} style={{ y, ...style }} className={className}>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------- Gyro / pointer drift */

/**
 * one source of "the world is physical": the device gyroscope where it exists
 * (phones, tablets) and pointer position everywhere else, so a floating badge
 * always answers to *something* with no permission prompt.
 */
export function useDrift(enabled = true) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 60, damping: 18, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 60, damping: 18, mass: 0.6 });
  const { reduced } = useMotionPrefs();

  React.useEffect(() => {
    if (!enabled || reduced || typeof window === 'undefined') return;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null && e.beta == null) return;
      x.set(clamp((e.gamma ?? 0) / 26));
      y.set(clamp(((e.beta ?? 0) - 45) / 30));
    };
    const onPointer = (e: PointerEvent) => {
      x.set(clamp((e.clientX / window.innerWidth) * 2 - 1));
      y.set(clamp((e.clientY / window.innerHeight) * 2 - 1));
    };
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('pointermove', onPointer);
    };
  }, [enabled, reduced, x, y]);

  return { x: sx, y: sy };
}

/**
 * A floating metal badge around the profile portrait. Depth comes from the
 * size of the drift and the drop shadow, not from a cartoon sticker.
 */
export function FloatingBadge({
  depth = 1,
  className,
  children,
  label,
  tone = 'metal',
  delay = 0,
  size = 44,
}: {
  depth?: number;
  className?: string;
  children: React.ReactNode;
  label: string;
  tone?: 'metal' | 'hot' | 'cold';
  delay?: number;
  size?: number;
}) {
  const drift = useDrift();
  const { reduced } = useMotionPrefs();
  const x = useTransform(drift.x, (v) => v * 14 * depth);
  const y = useTransform(drift.y, (v) => v * 11 * depth);

  return (
    <motion.span
      className={cls(
        'ht-badge',
        tone === 'hot' && 'ht-badge--hot',
        tone === 'cold' && 'ht-badge--cold',
        className
      )}
      style={{
        x,
        y,
        width: size,
        height: size,
        fontSize: size * 0.42,
        animation: reduced ? undefined : `badge-drift 7s ease-in-out ${delay}s infinite`,
      }}
      title={label}
      aria-hidden
    >
      {children}
    </motion.span>
  );
}

/* ------------------------------------------------------------------- Tilt */

/** 3D pointer tilt for a card or a tile. Falls back to flat on touch. */
export function Tilt({
  children,
  className,
  intensity = 6,
  lift = 6,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
  lift?: number;
}) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const z = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 180, damping: 22 });
  const sry = useSpring(ry, { stiffness: 180, damping: 22 });
  const sz = useSpring(z, { stiffness: 200, damping: 24 });
  const { reduced } = useMotionPrefs();

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType === 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * intensity * 2);
    rx.set(-py * intensity * 2);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
    z.set(0);
  };

  return (
    <motion.div
      onPointerMove={onMove}
      onPointerEnter={() => z.set(lift)}
      onPointerLeave={reset}
      style={{ rotateX: srx, rotateY: sry, z: sz, transformPerspective: 900 }}
      className={cls('will-change-transform', className)}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------ PressBloom */

/**
 * The micro-interaction every tappable thing answers with: a short amber
 * bloom that expands from the contact point and fades. Purely decorative —
 * it is layered above the child and never intercepts a pointer.
 */
export function PressBloom({ tone = 'hot' }: { tone?: 'hot' | 'cold' }) {
  const [bursts, setBursts] = React.useState<{ id: number; x: number; y: number }[]>([]);
  const { reduced } = useMotionPrefs();
  const idRef = React.useRef(0);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    const id = ++idRef.current;
    setBursts((b) => [...b.slice(-2), { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 640);
  };

  const color = tone === 'hot' ? 'rgba(255,180,84,.5)' : 'rgba(99,216,245,.45)';

  return (
    <>
      <span
        aria-hidden
        onPointerDown={onPointerDown as never}
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
      />
      {bursts.map((b) => (
        <motion.span
          key={b.id}
          aria-hidden
          initial={{ opacity: 0.75, scale: 0 }}
          animate={{ opacity: 0, scale: 1 }}
          transition={{ duration: 0.62, ease: EASE_CINEMA }}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: b.x,
            top: b.y,
            width: 260,
            height: 260,
            marginLeft: -130,
            marginTop: -130,
            background: `radial-gradient(circle, ${color}, transparent 62%)`,
            mixBlendMode: 'screen',
          }}
        />
      ))}
    </>
  );
}

/* ---------------------------------------------------------------- CountUp */

/** Numbers that travel to their value. Tabular, so layout never jitters. */
export function CountUp({
  value,
  duration = 900,
  className,
  format = (n: number) => String(Math.round(n)),
}: {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const [shown, setShown] = React.useState(value);
  const from = React.useRef(value);
  const { reduced } = useMotionPrefs();

  React.useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const loop = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(loop);
      else from.current = value;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return <span className={cls('ht-num', className)}>{format(shown)}</span>;
}

export { plateIn, stagger, wordFade };
