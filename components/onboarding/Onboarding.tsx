'use client';
/* ============================================================================
   components/onboarding/Onboarding — the reel.

   The brief was explicit and it is the right call: **no profile creation, no
   fields, no fences.** A first-time visitor gets a cinematic sequence, one
   gesture, and then the app. Their identity is generated for them and stays
   editable from the profile forever after.

   Four scenes, each a full-bleed plate composed like a film frame:

     · a depth-of-field stack — a heavily blurred far plate drifting one way
       behind a sharper near plate drifting the other, so the camera *pans*
       rather than cross-fades
     · type that resolves (words fade up out of a blur, in order)
     · a scene-specific demonstration, not a screenshot: the light pushes in,
       a reader sheet rises out of the dark, a heat ring fills under a finger,
       a year of temperature ignites cell by cell
     · one control at the bottom: a glass capsule you drag, or click, or press
       ← → / ↵ / space to advance. Nothing is gated behind the gesture.

   Gyroscope/pointer drift moves the plates, so the frame feels physical in the
   hand. Everything collapses to a static scene under reduced motion.
   ==========================================================================*/

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE, EASE_CINEMA } from '@/lib/motion';
import { useDrift } from '@/components/ui/motion';
import { useStore } from '@/lib/store';
import { cls } from '@/lib/util';

const SCENE_MS = 9800;

const INTERESTS = ['design', 'engineering', 'reading'];

/* ---------------------------------------------------------------- scenes */

type Scene = {
  id: string;
  img: string;
  sub?: string;
  kicker: string;
  title: string;
  body: string;
  /** which live demonstration plays inside this frame */
  demo: 'gate' | 'sheet' | 'ring' | 'year';
  accent: 'heat' | 'cryo';
};

const SCENES: Scene[] = [
  {
    id: 'curiosity',
    img: '/art/ref-curiosity-portal.jpg',
    sub: '/art/ref-curiosity-portal.jpg',
    demo: 'gate',
    accent: 'heat',
    kicker: 'two modalities, one feed',
    title: 'Chase your curiosity',
    body: 'A short note and a full story live in the same room — discovered together, then read without leaving the app.',
  },
  {
    id: 'reader',
    img: '/art/ref-dark-apps.jpg',
    sub: '/art/ref-dark-apps.jpg',
    demo: 'sheet',
    accent: 'heat',
    kicker: 'long-form, all of it',
    title: 'Read it here, not elsewhere',
    body: 'Full articles render natively — real typography, inline code, figures, footnotes. No redirects and no “keep reading over there” wall.',
  },
  {
    id: 'heat',
    img: '/art/ref-honey-journey.jpg',
    demo: 'ring',
    accent: 'heat',
    kicker: 'your attention shapes the room',
    title: 'Leave a signal, not a score',
    body: 'Press and hold when a thought stays with you. The gesture is expressive, brief, and never turns reading into a leaderboard.',
  },
  {
    id: 'year',
    img: '/art/ref-profile.jpg',
    sub: '/art/ref-home.jpg',
    demo: 'year',
    accent: 'cryo',
    kicker: 'a year, in one square',
    title: 'A rhythm you can see',
    body: 'Your profile keeps a quiet record of what you read, saved, and made. Empty days stay empty — there is no performance scoreboard.',
  },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = React.useState(0);
  const [starting, setStarting] = React.useState(false);
  const drift = useDrift();
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    setReduced(
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.dataset.reduceMotion === 'true'
    );
  }, []);

  /* the reel advances itself — but never while the visitor is mid-gesture */
  React.useEffect(() => {
    if (reduced || starting) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % SCENES.length), SCENE_MS);
    return () => window.clearInterval(id);
  }, [reduced, starting]);

  /* The tour ends in the room. Identity stays deliberately uncreated until the
     visitor chooses to write or edit a profile from inside the app. */
  const start = React.useCallback(() => {
    if (starting) return;
    setStarting(true);
    useStore.setState((st) => ({ onboarded: true, interests: INTERESTS, me: st.me }));
    useStore.setState((st) => ({
      prefs: { ...st.prefs, ignitionFx: 'subtle', ambient: true },
      interests: INTERESTS,
    }));
    window.setTimeout(onDone, 1150);
  }, [onDone, starting]);

  /* keyboard: ↵ / space starts · ← → step. Skip is always available. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        start();
      }
      if (e.key === 'Escape') start();
      if (e.key === 'ArrowRight' && !starting) setI((v) => (v + 1) % SCENES.length);
      if (e.key === 'ArrowLeft' && !starting) setI((v) => (v - 1 + SCENES.length) % SCENES.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [start, starting]);

  const scene = SCENES[i];

  return (
    <div className="fixed inset-0 z-[190] overflow-hidden bg-black">
      {/* ------------------------------------------------------- the plates */}
      <AnimatePresence>
        <motion.div
          key={scene.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 1.25, ease: EASE_CINEMA }}
          className="absolute inset-0"
          aria-hidden
        >
          {/* far plane: blurred, drifts one way and never quite settles */}
          <motion.span
            className="absolute inset-[-6%]"
            style={{ x: drift.x, y: drift.y }}
            aria-hidden
          >
            <motion.img
              src={scene.img}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: 'blur(40px) saturate(112%) brightness(.55)' }}
              animate={reduced ? undefined : { scale: [1.32, 1.26, 1.32], x: [0, -14, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.span>
          {/* near plane: the subject, resolving sharp against it */}
          <motion.img
            src={scene.sub ?? scene.img}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ scale: 1.08, filter: 'saturate(106%) contrast(106%)' }}
          />
          {/* the room: scrims that keep type legible over any photograph */}
          <span
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,.78) 0%, rgba(0,0,0,.3) 30%, rgba(0,0,0,.62) 62%, #000 100%)',
            }}
          />
          <span
            className="absolute inset-0"
            style={{
              background:
                scene.accent === 'heat'
                  ? 'radial-gradient(85% 60% at 20% 76%, rgba(255,180,84,.24), transparent 62%)'
                  : 'radial-gradient(85% 60% at 22% 74%, rgba(99,216,245,.2), transparent 62%)',
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* drifting pointer parallax on a thin light layer — the "camera" breathes */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          x: drift.x,
          y: drift.y,
          background:
            'radial-gradient(40% 30% at 78% 18%, rgba(255,246,232,.12), transparent 70%)',
        }}
      />

      <div className="pointer-events-none absolute inset-0 opacity-70">
        <span className="ht-atmos-noise absolute inset-0" />
      </div>

      {/* ------------------------------------------------------- the frame */}
      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1240px] flex-col px-6 pb-7 pt-7 sm:px-10 sm:pb-10">
        <header className="flex items-center gap-4">
          <span className="ht-display ht-heat-text text-[24px] leading-none">heatt</span>
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.32em] text-white/35 sm:block">
            the reel
          </span>
          <span className="flex-1" />
          {/* scene ticks: hairline, amber fill tracks the scene duration */}
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Scenes">
            {SCENES.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setI(idx)}
                role="tab"
                aria-selected={idx === i}
                aria-label={`Scene ${idx + 1}: ${s.kicker}`}
                className="relative h-[3px] w-8 overflow-hidden rounded-full bg-white/15 transition-[width] duration-500 hover:bg-white/25 sm:w-14"
              >
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: 'var(--ht-ember)' }}
                  initial={{ width: '0%' }}
                  animate={{ width: idx < i ? '100%' : idx === i ? '100%' : '0%' }}
                  transition={{
                    duration: idx === i && !reduced ? SCENE_MS / 1000 : 0.45,
                    ease: 'linear',
                  }}
                />
              </button>
            ))}
          </div>
        </header>

        {/* the composition: copy low-left, demonstration floating right */}
        <div className="relative flex flex-1 items-end">
          <div className="grid w-full items-end gap-10 lg:grid-cols-[1.05fr_.95fr]">
            <div className="max-w-[38rem] pb-8 sm:pb-12">
              <AnimatePresence mode="wait">
                <motion.div
                  key={scene.title}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: -16, filter: 'blur(10px)', transition: { duration: 0.45 } }}
                >
                  <motion.p
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
                    }}
                    className="ht-kicker"
                  >
                    {scene.kicker}
                  </motion.p>

                  <h1 className="ht-display mt-4 text-[clamp(2.6rem,1.5rem+5.6vw,5.6rem)] text-white">
                    {scene.title.split(' ').map((w, idx) => (
                      <motion.span
                        key={`${w}-${idx}`}
                        variants={{
                          hidden: { opacity: 0, y: 26, filter: 'blur(12px)' },
                          show: {
                            opacity: 1,
                            y: 0,
                            filter: 'blur(0px)',
                            transition: { delay: 0.08 + idx * 0.075, duration: 0.8, ease: EASE_CINEMA },
                          },
                        }}
                        className="mr-[0.22em] inline-block"
                        style={{ textShadow: '0 6px 40px rgba(0,0,0,.65)' }}
                      >
                        {w}
                      </motion.span>
                    ))}
                  </h1>

                  <motion.p
                    variants={{
                      hidden: { opacity: 0 },
                      show: { opacity: 1, transition: { delay: 0.42, duration: 0.9, ease: EASE } },
                    }}
                    className="mt-5 max-w-[52ch] text-[clamp(.95rem,.88rem+.35vw,1.15rem)] leading-[1.7] text-ink-dim"
                  >
                    {scene.body}
                  </motion.p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* the demonstration layer — a live vignette, not a screenshot */}
            <div className="hidden min-h-[300px] items-center justify-center lg:flex">
              <AnimatePresence mode="wait">
                <motion.div
                  key={scene.demo}
                  initial={{ opacity: 0, y: 24, filter: 'blur(14px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -18, filter: 'blur(14px)' }}
                  transition={{ duration: 0.9, ease: EASE_CINEMA, delay: 0.2 }}
                  className="w-full max-w-[380px]"
                >
                  {scene.demo === 'gate' && <DemoGate />}
                  {scene.demo === 'sheet' && <DemoSheet />}
                  {scene.demo === 'ring' && <DemoRing />}
                  {scene.demo === 'year' && <DemoYear />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------ the control */}
        <SwipeToStart onDone={start} starting={starting} reduced={reduced} />
      </div>

      {/* --------------------------------------------------- the handoff */}
      <AnimatePresence>
        {starting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.7, ease: EASE }}
            className="absolute inset-0 z-30 grid place-items-center bg-black"
          >
            <div className="px-6 text-center">
              <motion.span
                aria-hidden
                className="mx-auto mb-8 block h-14 w-14 rounded-full"
                style={{
                  background: 'radial-gradient(circle, var(--ht-whitehot), rgba(255,180,84,.4) 46%, transparent 72%)',
                }}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: [0.4, 1.25, 1], opacity: [0, 1, 0.85] }}
                transition={{ duration: 1.5, ease: EASE_CINEMA }}
              />
              <motion.h2
                initial={{ opacity: 0, y: 18, filter: 'blur(18px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: reduced ? 0 : 1, ease: EASE_CINEMA, delay: 0.1 }}
                className="ht-display ht-heat-text text-[clamp(2rem,1.3rem+4.6vw,4.4rem)]"
              >
                Welcome to the room
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduced ? 0 : 0.45, duration: 0.7 }}
                className="mt-4 text-[13.5px] text-ink-dim"
              >
                No forms, no fences. Start with a story, save something beautiful, or simply look around.
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================== demos ==== */

/* 1 · the gate: light pushes in through a keyhole, streaks build, then settle */
function DemoGate() {
  const [p, setP] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      const v = ((now - t0) / 3200) % 1;
      setP(v);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="ht-glass relative aspect-[4/5] overflow-hidden rounded-[28px]">
      <div className="absolute inset-0 grid place-items-center">
        <span
          className="block rounded-full"
          style={{
            width: `${26 + p * 120}px`,
            height: `${26 + p * 120}px`,
            background: 'radial-gradient(circle, #FFF6E8, rgba(255,180,84,.45) 44%, transparent 72%)',
            filter: 'blur(2px)',
            opacity: 1 - p * 0.55,
          }}
        />
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="absolute left-0 right-0 h-px"
          style={{
            top: `${12 + i * 14}%`,
            background:
              'linear-gradient(90deg, transparent, rgba(255,214,150,.7) 34%, rgba(255,246,232,.9) 50%, rgba(99,216,245,.5) 68%, transparent)',
            opacity: Math.max(0, Math.sin((p + i * 0.12) * Math.PI * 2) * 0.8),
            transform: `scaleX(${0.4 + p * 0.75})`,
          }}
        />
      ))}
      <div className="absolute inset-x-5 bottom-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">
          one board · two modalities
        </p>
        <div className="mt-2 flex gap-1.5">
          {['spark', 'forge', 'spark', 'spark', 'forge', 'spark'].map((k, i) => (
            <span
              key={i}
              className={cls(
                'h-1 flex-1 rounded-full',
                k === 'forge' ? 'bg-ember-400/80' : 'bg-white/20'
              )}
              style={{ opacity: 0.35 + (Math.sin(p * 6.28 + i) + 1) * 0.3 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* 2 · the sheet: a reading surface lifts out of the dark and fills with ink */
function DemoSheet() {
  const lines = [96, 88, 92, 74, 0, 90, 84, 90, 62, 0, 78, 88, 46];
  const [p, setP] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      setP(Math.min(1, ((now - t0) / 4200) % 1.25));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="ht-glass relative overflow-hidden rounded-[28px] p-5">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-ember-400 shadow-[0_0_10px_#FFB454]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/50">
          reading in place
        </span>
        <span className="ml-auto ht-num text-[10px] text-white/40">68ch</span>
      </div>
      <div className="mt-4 space-y-2.5">
        {lines.map((w, i) =>
          w === 0 ? (
            <div key={i} className="h-4" />
          ) : (
            <span
              key={i}
              className="block h-[7px] rounded-full"
              style={{
                width: `${w}%`,
                background:
                  i === 5
                    ? 'linear-gradient(90deg, var(--ht-ember-400), var(--ht-ember-200))'
                    : 'rgba(255,255,255,.13)',
                opacity: Math.max(0.08, Math.min(1, (p - i * 0.06) * 2.4)),
                transform: `translateY(${(1 - Math.min(1, Math.max(0, (p - i * 0.06) * 2.4))) * 6}px)`,
              }}
            />
          )
        )}
      </div>
      <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
        <span className="h-7 w-7 rounded-full bg-white/10" />
        <span className="flex-1">
          <span className="block h-2 w-24 rounded-full bg-white/20" />
          <span className="mt-1.5 block h-1.5 w-16 rounded-full bg-white/10" />
        </span>
        <span className="rounded-full bg-ember-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ember-200">
          12 min
        </span>
      </div>
    </div>
  );
}

/* 3 · the ring: a hold-to-heat gesture, demonstrated, then released */
function DemoRing() {
  const [p, setP] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      const v = ((now - t0) / 2600) % 1;
      setP(v);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const R = 62;
  const C = 2 * Math.PI * R;

  return (
    <div className="ht-glass relative overflow-hidden rounded-[28px] p-6">
      <p className="ht-eyebrow">hold to heat · 2.45s to ignite</p>
      <div className="mt-5 grid place-items-center">
        <div className="relative grid h-[170px] w-[170px] place-items-center">
          <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90">
            <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3" />
            <circle
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - p)}
            />
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#63D8F5" />
                <stop offset="0.55" stopColor="#FFB454" />
                <stop offset="1" stopColor="#FFF6E8" />
              </linearGradient>
            </defs>
          </svg>
          <span
            className="grid h-[104px] w-[104px] place-items-center rounded-full text-[26px]"
            style={{
              background: `radial-gradient(circle, rgba(255,246,232,${0.1 + p * 0.55}), rgba(255,180,84,${
                0.1 + p * 0.35
              }) 52%, transparent 74%)`,
              boxShadow: `0 0 ${10 + p * 46}px rgba(255,180,84,${0.2 + p * 0.6})`,
            }}
          >
            <span aria-hidden style={{ filter: `saturate(${0.6 + p * 0.8})` }}>
              ◉
            </span>
          </span>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        {['warm', 'blaze', 'ignite'].map((k, i) => (
          <span
            key={k}
            className={cls(
              'rounded-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors',
              p > (i + 1) / 4 ? 'bg-ember-400/20 text-ember-100' : 'bg-white/[.05] text-white/35'
            )}
          >
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

/* 4 · the year: a heat grid igniting cell by cell, cooled cells in ice */
function DemoYear() {
  const cells = React.useMemo(
    () =>
      Array.from({ length: 7 * 26 }, (_, i) => {
        const h = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        return Math.abs(h);
      }),
    []
  );
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setStep((s) => (s + 1) % 40), 90);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="ht-glass relative overflow-hidden rounded-[28px] p-5">
      <div className="flex items-baseline justify-between">
        <p className="ht-eyebrow">your reading rhythm · 26 weeks</p>
        <span className="ht-num text-[11px] font-bold text-ember-300">41 active days</span>
      </div>
      <div className="mt-4 grid grid-cols-[repeat(26,1fr)] gap-[3px]">
        {cells.map((v, i) => {
          const hot = v > 0.72;
          const warm = v > 0.42 && v <= 0.72;
          const lit = i <= step * 4.5;
          return (
            <span
              key={i}
              className="aspect-square rounded-[3px] transition-all duration-500"
              style={{
                background: !lit
                  ? 'rgba(255,255,255,.05)'
                  : hot
                    ? 'linear-gradient(140deg,#FFF6E8,#FFB454)'
                    : warm
                      ? 'rgba(255,180,84,.42)'
                      : 'rgba(99,216,245,.2)',
                boxShadow: lit && hot ? '0 0 8px rgba(255,180,84,.6)' : undefined,
                opacity: lit ? 0.35 + v * 0.65 : 1,
              }}
            />
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between text-[10px] text-white/40">
        <span>empty days stay neutral</span>
        <span>never a leaderboard</span>
      </div>
    </div>
  );
}

/* ============================================================ the control */

function SwipeToStart({
  onDone,
  starting,
  reduced,
}: {
  onDone: () => void;
  starting: boolean;
  reduced: boolean;
}) {
  const track = React.useRef<HTMLDivElement | null>(null);
  const [max, setMax] = React.useState(260);
  const [x, setX] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    const measure = () => {
      const w = track.current?.clientWidth ?? 0;
      if (w) setMax(Math.max(120, w - 66));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const done = React.useCallback(() => {
    setX(max);
    window.setTimeout(onDone, 180);
  }, [max, onDone]);

  const progress = max > 0 ? Math.min(1, x / max) : 0;

  return (
    <div className="pt-2">
      <div
        ref={track}
        className="ht-swipe relative flex h-[64px] items-center rounded-full px-2"
        role="button"
        tabIndex={0}
        aria-label="Swipe to start"
        onClick={done}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            done();
          }
        }}
      >
        <motion.span
          aria-hidden
          className="ht-swipe-fill absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.max(62, x + 62)}px` }}
        />
        {/* the track lights up as the knob travels — feedback before commitment */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-4 bottom-[7px] h-[2px] overflow-hidden rounded-full bg-white/10"
        >
          <span
            className="block h-full rounded-full transition-[width] duration-150"
            style={{
              width: `${progress * 100}%`,
              background: 'linear-gradient(90deg, var(--ht-ember-500), var(--ht-flare))',
              boxShadow: '0 0 12px rgba(255,180,84,.8)',
            }}
          />
        </span>
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: max }}
          dragElastic={0.03}
          dragMomentum={false}
          animate={{ x }}
          onDragStart={() => setDragging(true)}
          onDrag={(_, info) => setX(Math.max(0, Math.min(max, info.offset.x)))}
          onDragEnd={(_, info) => {
            setDragging(false);
            if (info.offset.x > max * 0.76) done();
            else setX(0);
          }}
          className="relative z-10 grid h-[48px] w-[48px] shrink-0 cursor-grab place-items-center rounded-full active:cursor-grabbing"
          style={{
            background: 'linear-gradient(135deg,var(--ht-ember),var(--ht-flare))',
            boxShadow: `0 12px 34px -12px rgba(255,180,84,.75), 0 1px 0 rgba(255,255,255,.5) inset${
              dragging ? ', 0 0 0 6px rgba(255,180,84,.12)' : ''
            }`,
            transition: 'box-shadow .3s cubic-bezier(.22,1,.36,1)',
          }}
        >
          <motion.svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1A0E02"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            animate={reduced ? undefined : { x: [0, 3, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <path d="M5 12h13M13 6l6 6-6 6" />
          </motion.svg>
        </motion.div>
        <span
          className="pointer-events-none absolute inset-0 grid place-items-center text-[13.5px] font-semibold tracking-[0.01em] text-white/85"
          style={{ paddingLeft: 54 }}
        >
          {starting ? 'Starting…' : 'Swipe to start'}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-center gap-3 text-[11.5px] text-ink-mute">
        <span>No sign-up form.</span>
        <span aria-hidden className="h-1 w-1 rounded-full bg-ink-faint" />
        <span>Look around first. Make a profile only when you’re ready.</span>
      </div>
    </div>
  );
}
