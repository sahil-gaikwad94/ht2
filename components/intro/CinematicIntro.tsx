'use client';
/* ============================================================================
   components/intro/CinematicIntro — the title sequence.

   ~4.6s, three acts, no canvas and no rAF churn beyond one progress value:

     VOID     a single quiet point of light opens a dark room into a portal
     SPREAD   the camera pushes through the keyhole plate — two layers panning
              against each other behind a depth-of-field blur, arcs of light
              streaking past, exactly like a film's title cards
     FORM     the wordmark resolves letter by letter and hands the room over

   Cinema conventions do the work: letterbox bars, a hairline timeline with act
   ticks, a lab-stamp, and a subtitle that arrives rather than appears. Skipping
   is always one click, one key, anywhere on the frame — and under
   `prefers-reduced-motion` it collapses straight to its final frame.
   ==========================================================================*/

import * as React from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { EASE, EASE_CINEMA } from '@/lib/motion';

const TOTAL = 4.6;
type Act = 'VOID' | 'SPREAD' | 'FORM';
const actAt = (t: number): Act => (t < 1.5 ? 'VOID' : t < 3.1 ? 'SPREAD' : 'FORM');

const ACT_META: Record<Act, { n: string; line: string }> = {
  VOID: { n: '01', line: 'chase your curiosity' },
  SPREAD: { n: '02', line: 'follow the thread until it opens' },
  FORM: { n: '03', line: 'keep what stays with you' },
};

const PLATE = '/art/ref-curiosity-portal.jpg';
const SUB = '/art/ref-honey-journey.jpg';

export function CinematicIntro({ onDone, done }: { onDone: () => void; done: boolean }) {
  const [t, setT] = React.useState(0);
  const [exiting, setExiting] = React.useState(false);
  const progress = useMotionValue(0);
  const bar = useTransform(progress, (v) => `${Math.min(100, v * 100)}%`);
  const [reduced, setReduced] = React.useState(false);
  const finished = React.useRef(false);

  const finish = React.useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setExiting(true);
    window.setTimeout(onDone, 440);
  }, [onDone]);

  /* the clock: one rAF loop driving one state value and one motion value */
  React.useEffect(() => {
    const isReduced =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.reduceMotion === 'true';
    if (isReduced) {
      setReduced(true);
      progress.set(1);
      setT(TOTAL);
      const id = window.setTimeout(finish, 1000);
      return () => window.clearTimeout(id);
    }
    if (done) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      const v = Math.min(TOTAL, (now - t0) / 1000);
      setT(v);
      progress.set(v / TOTAL);
      if (v < TOTAL) raf = requestAnimationFrame(loop);
      else finish();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  const act = actAt(t);
  /* 0..1 across the whole sequence, and a local push value for SPREAD */
  const p = reduced ? 1 : t / TOTAL;
  const push = Math.max(0, Math.min(1, (t - 1.4) / 2.0));

  return (
    <div
      onClick={finish}
      className="fixed inset-0 z-[200] cursor-pointer select-none overflow-hidden bg-black"
      style={{ animation: exiting ? 'ht-intro-out .44s cubic-bezier(.6,0,.2,1) forwards' : undefined }}
      role="presentation"
    >
      {/* -------------------------------------------------------- act 1: void */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 45% at 50% 46%, rgba(255,180,84,.22), transparent 66%), radial-gradient(110% 80% at 50% 118%, rgba(99,216,245,.09), transparent 62%)',
          opacity: 0.4 + Math.min(0.6, p * 1.4),
        }}
      />
      {/* the igniting point of light */}
      <motion.span
        aria-hidden
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, #FFF6E8, rgba(255,180,84,.5) 42%, transparent 70%)' }}
        initial={{ width: 6, height: 6, opacity: 0 }}
        animate={{
          width: 6 + 340 * Math.min(1, p * 2.2),
          height: 6 + 340 * Math.min(1, p * 2.2),
          opacity: act === 'FORM' ? 0.35 : 0.9,
        }}
        transition={{ duration: reduced ? 0 : 0.6, ease: EASE }}
      />

      {/* ------------------------------------------------- act 2: the push in */}
      <AnimatePresence>
        {act !== 'VOID' && (
          <motion.div
            key="plate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 1.5, ease: EASE_CINEMA }}
            className="absolute inset-0"
            aria-hidden
          >
            {/* far plane: heavy blur, drifts one way, scales down as we push */}
            <img
              src={PLATE}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                transform: `scale(${1.5 - push * 0.24}) translate3d(${push * -26}px, ${push * -12}px, 0)`,
                filter: 'blur(38px) saturate(105%) brightness(.42)',
              }}
            />
            {/* near plane: the camera, moving the other way, resolving sharp */}
            <img
              src={SUB}
              alt=""
              className="absolute inset-0 h-full w-full object-cover mix-blend-screen"
              style={{
                transform: `scale(${1.24 + push * 0.1}) translate3d(${push * 22}px, ${push * 10}px, 0)`,
                filter: `blur(${(1 - (act === 'FORM' ? 1 : push)) * 22}px) saturate(112%) contrast(104%)`,
                opacity: (act === 'FORM' ? 0.5 : 0.72) * Math.min(1, push * 2.4),
              }}
            />
            <span
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(0,0,0,.82) 0%, rgba(0,0,0,.42) 34%, rgba(0,0,0,.66) 68%, rgba(0,0,0,.94) 100%)',
              }}
            />
            {/* horizontal light streaks: pure CSS, synced to the push */}
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="absolute left-0 right-0"
                style={{
                  top: `${16 + i * 17}%`,
                  height: i % 2 ? 1 : 2,
                  background:
                    'linear-gradient(90deg, transparent, rgba(255,214,150,.5) 30%, rgba(255,246,232,.75) 50%, rgba(99,216,245,.4) 72%, transparent)',
                  opacity: Math.min(0.55, push) * (i % 2 ? 0.7 : 1),
                  transform: `scaleX(${0.35 + push * 0.9}) translateX(${(1 - push) * (i % 2 ? 12 : -14)}%)`,
                  filter: 'blur(.4px)',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------------- letterbox */}
      <motion.span
        aria-hidden
        className="absolute inset-x-0 top-0 bg-black"
        initial={{ height: 0 }}
        animate={{ height: reduced ? 0 : 42 }}
        transition={{ duration: 1.2, ease: EASE_CINEMA }}
      />
      <motion.span
        aria-hidden
        className="absolute inset-x-0 bottom-0 bg-black"
        initial={{ height: 0 }}
        animate={{ height: reduced ? 0 : 42 }}
        transition={{ duration: 1.2, ease: EASE_CINEMA }}
      />

      {/* ------------------------------------------------------------ type */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <AnimatePresence mode="wait">
          {act === 'FORM' ? (
            <motion.div
              key="mark"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.4 }}
              className="flex flex-col items-center"
            >
              <Wordmark />
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduced ? 0 : 0.5, duration: 0.8, ease: EASE }}
                className="mt-7 max-w-[46ch]"
              >
                <p className="text-[clamp(1rem,.9rem+.45vw,1.25rem)] leading-relaxed text-ink-dim">
                  Short thoughts and full stories in one calm room —
                  <span className="text-white"> every word read here, never somewhere else.</span>
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  {['follow curiosity', 'save the good parts', 'no redirects', 'read it all in-app'].map(
                    (chip, i) => (
                      <motion.span
                        key={chip}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: reduced ? 0 : 0.62 + i * 0.07, duration: 0.5, ease: EASE }}
                        className="rounded-full border border-white/[.14] bg-white/[.04] px-3 py-1.5 text-[11px] font-semibold tracking-[0.03em] text-white/80 backdrop-blur-sm"
                      >
                        {chip}
                      </motion.span>
                    )
                  )}
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key={act}
              initial={{ opacity: 0, y: 16, filter: 'blur(12px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -14, filter: 'blur(12px)' }}
              transition={{ duration: reduced ? 0 : 1, ease: EASE_CINEMA, delay: 0.18 }}
              className="max-w-[22ch]"
            >
              <p
                className="ht-display text-[clamp(1.7rem,1.1rem+3.2vw,3.4rem)] leading-[1.06] text-white"
                style={{ textShadow: '0 0 70px rgba(0,0,0,.92)' }}
              >
                {ACT_META[act].line}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ----------------------------------------------------------- chrome */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 p-5 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="ht-num text-[10px] font-bold tracking-[0.32em] text-white/45">
            {ACT_META[act].n} / 03
          </span>
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.32em] text-ember-300 sm:inline">
            {act}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            finish();
          }}
          className="ht-btn ht-btn--ghost !text-[12px] !text-white/80"
        >
          Skip intro <span className="opacity-50">↵</span>
        </button>
      </div>

      {/* timeline: a hairline with an act tick at each boundary */}
      <div className="absolute inset-x-0 bottom-0 z-30 h-[2px]">
        <motion.div
          aria-hidden
          className="h-full origin-left"
          style={{
            width: bar,
            background:
              'linear-gradient(90deg,rgba(99,216,245,.85),var(--ht-ember) 55%,var(--ht-whitehot))',
            boxShadow: '0 0 18px rgba(255,180,84,.5)',
          }}
        />
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {[1.5 / TOTAL, 3.1 / TOTAL].map((f) => (
            <span
              key={f}
              className="absolute top-[-5px] h-[11px] w-px bg-white/25"
              style={{ left: `${f * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* film grain over the whole sequence */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <style>{`@keyframes ht-intro-out{to{opacity:0;transform:scale(1.04);filter:blur(10px)}}`}</style>
    </div>
  );
}

/* Letter-by-letter wordmark with a specular pass and a warm bloom behind it. */
function Wordmark() {
  const letters = ['h', 'e', 'a', 't', 't'];
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[-20%] inset-y-[-60%] -z-10"
        style={{ background: 'radial-gradient(50% 60% at 50% 55%, rgba(255,180,84,.3), transparent 70%)' }}
      />
      <h1
        aria-label="heatt"
        className="ht-display ht-heat-text ht-sweep flex select-none text-[clamp(3.6rem,1.4rem+13vw,9.5rem)]"
      >
        {letters.map((l, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 26, filter: 'blur(16px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.06 + i * 0.075, duration: 0.7, ease: EASE_CINEMA }}
            className="inline-block"
          >
            {l}
          </motion.span>
        ))}
      </h1>
      <motion.span
        aria-hidden
        className="mt-2 block h-px w-full origin-left"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,180,84,.7), transparent)' }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.5, duration: 0.9, ease: EASE }}
      />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.62, duration: 0.6 }}
        className="mt-3 text-[11px] font-bold uppercase tracking-[0.42em] text-ink-mute"
      >
        where curiosity gathers
      </motion.p>
    </div>
  );
}
