'use client';
/* ============================================================================
   lib/tilt — one tiny parallax source for "floating" elements.

   Uses the device gyroscope where it exists (phones/tablets) and pointer
   position everywhere else, so a floating badge or a parallax layer always
   answers to *something* without ever triggering a permission prompt.
   Returns spring-free values in [-1, 1]; callers scale them.
   ==========================================================================*/

import * as React from 'react';

export type Tilt = { x: number; y: number };

export function useTilt(enabled = true): Tilt {
  const [t, setT] = React.useState<Tilt>({ x: 0, y: 0 });
  const reduced = React.useRef(false);

  React.useEffect(() => {
    reduced.current =
      typeof window === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.reduceMotion === 'true';
  }, []);

  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (reduced.current) return;

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null && e.beta == null) return;
      const x = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 26));
      const y = Math.max(-1, Math.min(1, ((e.beta ?? 0) - 45) / 30));
      setT({ x, y });
    };
    const onPointer = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setT({ x, y });
    };

    window.addEventListener('deviceorientation', onOrient);
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      window.removeEventListener('deviceorientation', onOrient);
      window.removeEventListener('pointermove', onPointer);
    };
  }, [enabled]);

  return t;
}
