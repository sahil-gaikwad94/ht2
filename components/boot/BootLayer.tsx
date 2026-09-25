'use client';
/* ============================================================================
   components/boot/BootLayer — first-visit choreography + global overlays.

   New user: 8.4s WebGL cinematic intro → onboarding → app.
   Returning user: straight to the app, ambient field still running.
   Heavy overlays are dynamically imported so the intro never waits on the
   reader, the share studio or the composer to become interactive.
   ==========================================================================*/

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useApp } from '@/lib/app';
import { useStore } from '@/lib/store';
import { Atmosphere } from '@/components/gl/Atmosphere';
import { Toast } from '@/components/ui/primitives';

const CinematicIntro = dynamic(() => import('@/components/intro/CinematicIntro').then((m) => m.CinematicIntro), { ssr: false });
const Onboarding = dynamic(() => import('@/components/onboarding/Onboarding').then((m) => m.Onboarding), { ssr: false });
const ShareStudio = dynamic(() => import('@/components/share/ShareStudio').then((m) => m.ShareStudio), { ssr: false });
const Composer = dynamic(() => import('@/components/compose/Composer').then((m) => m.Composer), { ssr: false });
const CommandPalette = dynamic(() => import('@/components/palette/CommandPalette').then((m) => m.CommandPalette), { ssr: false });

export function BootLayer({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const introSeen = useStore((s) => s.introSeen);
  const onboarded = useStore((s) => s.onboarded);
  const ambient = app.prefs.ambient;
  const [hydrated, setHydrated] = React.useState(false);
  const [phase, setPhase] = React.useState<'wait' | 'intro' | 'onboard' | 'app'>('wait');
  const [introDone, setIntroDone] = React.useState(false);

  /* Never decide before the persisted store has rehydrated, or a returning
     user gets a one-frame flash of the intro and a hydration mismatch. */
  React.useEffect(() => {
    const persist = (useStore as unknown as { persist?: { hasHydrated?: () => boolean; onFinishHydration?: (cb: () => void) => () => void } }).persist;
    if (!persist?.hasHydrated) {
      setHydrated(true);
      return;
    }
    if (persist.hasHydrated()) setHydrated(true);
    else return persist.onFinishHydration!(() => setHydrated(true)) as unknown as void;
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    setPhase(!introSeen ? 'intro' : !onboarded ? 'onboard' : 'app');
  }, [hydrated, introSeen, onboarded]);



  // global shortcuts: ⌘K palette, / search, ? help
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        app.setPalette(!app.paletteOpen);
        return;
      }
      if (typing) return;
      if (e.key === '/') {
        e.preventDefault();
        app.setPalette(true);
      }
      if (e.key === 'g' && !e.metaKey) {
        // g then f/e/p — feed / explore / profile
        let done = false;
        const next = (ev: KeyboardEvent) => {
          done = true;
          window.removeEventListener('keydown', next);
          if (ev.key === 'f') app.go('/feed');
          if (ev.key === 'e') app.go('/explore');
          if (ev.key === 'l') app.go('/library');
          if (ev.key === 'p' && app.me) app.go(`/u/${app.me.handle}`);
        };
        window.addEventListener('keydown', next, { once: true });
        window.setTimeout(() => {
          if (!done) window.removeEventListener('keydown', next);
        }, 1200);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [app]);

  const finishIntro = () => {
    useStore.getState().setIntroSeen();
    setIntroDone(true);
    if (!onboarded) setPhase('onboard');
    else setPhase('app');
  };

  if (phase === 'wait') return <>{children}</>;

  return (
    <>
      {/* ambient room tone behind everything (paused while the intro owns it) */}
      {ambient && phase === 'app' && (
        <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
          <Atmosphere />
        </div>
      )}
      {!ambient && (
        <div
          className="pointer-events-none fixed inset-0 z-0"
          aria-hidden
          style={{ background: 'radial-gradient(120% 90% at 50% 112%, rgba(255,180,84,.045), transparent 62%), linear-gradient(180deg,#0a0a0a,#000000)' }}
        />
      )}

      {phase === 'intro' && <CinematicIntro onDone={finishIntro} done={introDone} />}
      {phase === 'onboard' && <Onboarding onDone={() => setPhase('app')} />}

      {/* plain ternary, not useMemo: a hook here would run after the early
          return above and change the hook order between renders (React throws). */}
      <div className={phase === 'app' ? 'relative z-10' : 'relative z-10 opacity-0 pointer-events-none'}>
        {children}
      </div>

      {/* overlays — the reader is a route (/read/[id]), everything else is a layer */}
      <ShareStudio />
      <Composer />
      <CommandPalette />
      <Toast items={app.toasts} dismiss={app.dismissToast} />
    </>
  );
}
