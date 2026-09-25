'use client';
/* ============================================================================
   lib/motion — one motion vocabulary.

   Motion in heatt obeys three rules:

     1. Easing is never linear and never bouncy. Two curves: `ht` (a long,
        confident ease-out — the default) and `heat` (faster, tighter, for
        physical press answers). Springs are used only where an element must
        *settle*, never where it merely arrives.
     2. Duration scales with distance and mass, not with importance. A chip
        moves for 180ms; a full-screen plate takes 1.2s.
     3. Anything that loops is ambient and slow (7s+), so the room breathes
        without ever pulsing at reading speed.

   Reduced motion is respected at the source: `useMotionPrefs()` returns
   durations of 0 and disables looping, so callers don't each re-implement it.
   ==========================================================================*/

import * as React from 'react';
import type { Transition, Variants } from 'framer-motion';

/* ---------------------------------------------------------------- easing */

export const EASE = [0.22, 1, 0.36, 1] as const;
export const EASE_HEAT = [0.16, 0.9, 0.2, 1] as const;
export const EASE_EXIT = [0.6, 0, 0.2, 1] as const;
export const EASE_CINEMA = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------------ transitions */

export const T = {
  /** 180ms — colour, border, icon swaps */
  micro: { duration: 0.18, ease: EASE } as Transition,
  /** 320ms — the default: chips, tabs, hovers, disclosures */
  base: { duration: 0.32, ease: EASE } as Transition,
  /** 640ms — cards, sheets, section entrances */
  slow: { duration: 0.64, ease: EASE } as Transition,
  /** 1100ms — plates, hero type, scene handovers */
  cinema: { duration: 1.1, ease: EASE_CINEMA } as Transition,
  /** a press must feel instantaneous on the way in and settled on the way out */
  press: { duration: 0.16, ease: EASE_HEAT } as Transition,
  spring: { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 } as Transition,
  springSoft: { type: 'spring', stiffness: 260, damping: 30, mass: 1 } as Transition,
  /** shared-layout morph for the profile heat grid / nav pill */
  morph: { type: 'spring', stiffness: 320, damping: 32, mass: 0.8 } as Transition,
};

/* -------------------------------------------------------------- variants */

/** The default entrance: 16px up, out of a 12px blur. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(12px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: T.slow },
};

/** Plates and hero media arrive by resolving out of focus, never by sliding. */
export const plateIn: Variants = {
  hidden: { opacity: 0, scale: 1.05, filter: 'blur(18px)' },
  show: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 1.3, ease: EASE_CINEMA } },
  exit: { opacity: 0, filter: 'blur(10px)', transition: { duration: 0.7, ease: EASE_EXIT } },
};

/** Parent for a list that should arrive in sequence. */
export const stagger = (each = 0.06, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: each, delayChildren: delay } },
});

/** Line-by-line type: a mask wipe upward, the way a title card resolves. */
export const lineMask: Variants = {
  hidden: { y: '110%', opacity: 0 },
  show: { y: '0%', opacity: 1, transition: { duration: 0.95, ease: EASE_CINEMA } },
};

/** Word-by-word type for cinematic copy. */
export const wordFade: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(10px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.8, ease: EASE } },
};

/** Cards and tiles: a small settle, cheap enough to run on 40 items. */
export const tileIn: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: T.slow },
  exit: { opacity: 0, scale: 0.985, transition: T.micro },
};

/* ----------------------------------------------------------- preferences */

export type MotionPrefs = { reduced: boolean; t: (v: Transition) => Transition };

/**
 * Collapses a transition to nothing when the user (or the app switch) asked
 * for reduced motion. Returns `reduced` too so callers can skip looping
 * animation props entirely rather than running them at 0.001ms.
 */
export function useMotionPrefs(): MotionPrefs {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const read = () =>
      !!mq?.matches || document.documentElement.dataset.reduceMotion === 'true';
    setReduced(read());
    if (!mq?.addEventListener) return;
    const onChange = () => setReduced(read());
    mq.addEventListener('change', onChange);
    /* The in-app "reduce motion" switch lives on <html>, so watch it too —
       guarded, because non-DOM test environments may not expose it. */
    const MO = typeof MutationObserver !== 'undefined' ? MutationObserver : undefined;
    const obs = MO
      ? new MO(read as never)
      : undefined;
    (obs as MutationObserver | undefined)?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-reduce-motion'],
    });
    return () => {
      mq.removeEventListener('change', onChange);
      (obs as MutationObserver | undefined)?.disconnect();
    };
  }, []);

  const t = React.useCallback(
    (v: Transition): Transition => (reduced ? { duration: 0 } : v),
    [reduced]
  );

  return { reduced, t };
}

/* ---------------------------------------------------------------- helpers */

/** Page-transition variants used by the shell — fluid, never blocking. */
export const routeTransition: Variants = {
  hidden: { opacity: 0, y: 8, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: EASE } },
  exit: { opacity: 0, y: -6, filter: 'blur(8px)', transition: { duration: 0.28, ease: EASE_EXIT } },
};
