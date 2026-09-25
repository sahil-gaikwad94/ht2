'use client';
/* ============================================================================
   /settings — prefs that actually change the product: reading environment,
   ignition spectacle, motion, syndication, data. No accounts, no cloud, so
   "reset" is honest: it clears this device.
   ==========================================================================*/

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useApp } from '@/lib/app';
import { TopBar } from '@/components/shell/Shell';
import { cls } from '@/lib/util';
import { WEIGHT_LEGEND } from '@/lib/feed';
import { K } from '@/lib/heat';

export default function SettingsPage() {
  const s = useStore();
  const app = useApp();
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-[680px] pb-10">
      <TopBar title="Settings" sub="device-local" />

      <Section title="Reading environment" note="Applies to every forge, immediately.">
        <Seg label="Density" value={s.prefs.density} options={['dense', 'normal', 'cozy']} onChange={(v) => s.setPrefs({ density: v as any })} />
        <Seg label="Measure" value={s.prefs.measure} options={['narrow', 'normal', 'wide']} onChange={(v) => s.setPrefs({ measure: v as any })} />
        <Toggle label="Serif reading face" value={s.prefs.serif} onChange={(v) => s.setPrefs({ serif: v })} hint="Newsreader for bodies, Inter for chrome." />
        <Toggle label="Reduce motion" value={s.prefs.reduceMotion} onChange={(v) => s.setPrefs({ reduceMotion: v })} hint="Turns off parallax, embers and page transitions. Your system default is respected either way." />
        <Toggle label="Ambient glow" value={s.prefs.ambient} onChange={(v) => s.setPrefs({ ambient: v })} hint="The soft light behind the app. Off = flat black, zero GPU." />
      </Section>

      <Section title="Ignition spectacle" note="What happens when you hold to level 3.">
        <Seg label="Intensity" value={s.prefs.ignitionFx} options={['full', 'subtle', 'off']} onChange={(v) => s.setPrefs({ ignitionFx: v as any })} />
        <Toggle label="Haptics" value={s.prefs.haptics} onChange={(v) => s.setPrefs({ haptics: v })} hint="Vibration at each heat threshold, where supported." />
      </Section>

      <Section title="How your feed is ranked" note="Ranking rewards recent reading and replies, and lets anything cool off rather than punishing it.">
        <div className="divide-y divide-white/[.06]">
          {WEIGHT_LEGEND.map((w) => (
            <div key={w.label} className="flex items-center justify-between py-2 text-[13px]">
              <span className="text-ink-dim">{w.label}</span>
              <span className="ht-num font-bold text-ember-300">×{w.value}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Originals & data" note="heatt Originals are bundled for instant, redirect-free reading.">
        <div className="flex items-center justify-between py-2 text-[13px]">
          <span className="text-ink-dim">
            Library status
            <span
              className="ml-2 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
              style={{ background: app.live ? 'rgba(99,216,245,.14)' : 'rgba(255,180,84,.1)', color: app.live ? 'var(--ht-cryo-teal)' : 'var(--ht-flare)' }}
            >
              {app.posts.length} originals
            </span>
          </span>
          <button onClick={() => { app.refresh(true); app.toast('Originals library refreshed', 'cool'); }} className="ht-btn !py-1.5 !text-[12px]">
            Refresh Originals
          </button>
        </div>
        <div className="flex items-center justify-between py-2 text-[13px]">
          <span className="text-ink-dim">Article bodies · bundled locally</span>
          <span className="ht-chip !py-1.5 !text-[12px]">Always available</span>
        </div>
        <div className="flex items-center justify-between py-2 text-[13px]">
          <span className="text-ink-dim">Replay the cinematic intro</span>
          <button
            onClick={() => {
              useStore.setState({ introSeen: false });
              app.toast('Intro armed — reloading', 'heat');
              setTimeout(() => router.replace('/feed'), 420);
            }}
            className="ht-btn !py-1.5 !text-[12px]"
          >
            Watch again
          </button>
        </div>
        <div className="flex items-center justify-between py-2 text-[13px]">
          <span className="text-ink-dim">Reset everything on this device</span>
          <button
            onClick={() => {
              if (confirm('Clear heat, follows, drafts, profile and reading state from this browser?')) {
                localStorage.clear();
                location.href = '/';
              }
            }}
            className="ht-btn !border-magma/40 !py-1.5 !text-[12px] hover:!border-magma"
          >
            Reset
          </button>
        </div>
      </Section>

      <Section title="Muted & demoted" note="Your rules only — nobody else sees them, and nothing is deleted for the author.">
        <MutedList />
      </Section>

      <Section title="Your identity" note="Handle, avatar, cover, bio and interests.">
        <button onClick={() => router.push(`/u/${s.me?.handle ?? 'you'}`)} className="ht-btn ht-btn--heat !py-2 !text-[13px]">
          Open profile editor
        </button>
      </Section>

      <p className={cls('mt-6 text-center text-[11.5px] leading-relaxed text-ink-faint')}>
        heatt · heat is a judgement, not a click · <br />
        heatt Originals · complete articles, read here
      </p>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="ht-panel mt-4 p-5">
      <header className="mb-3">
        <h2 className="ht-title text-[16px]">{title}</h2>
        {note && <p className="mt-0.5 text-[12px] text-ink-mute">{note}</p>}
      </header>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Seg({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <span className="text-[13.5px] font-semibold text-ink-dim">{label}</span>
      <div className="flex gap-1">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)} className={cls('rounded-full border px-3 py-1 text-[12px] font-bold capitalize transition-all', value === o ? 'border-ember-500/50 bg-ember-500/12 text-ember-100' : 'border-white/[.07] text-ink-mute hover:border-white/25 hover:text-ink')}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <span className="text-[13.5px] font-semibold text-ink-dim">{label}</span>
        {hint && <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-faint">{hint}</p>}
      </div>
      <button
        role="switch"
        aria-label={label}
        aria-checked={value}
        onClick={() => onChange(!value)}
        className="relative h-[26px] w-[46px] shrink-0 rounded-full border transition-all"
        style={{
          borderColor: value ? 'rgba(255,180,84,.4)' : 'var(--ht-line)',
          background: value ? 'linear-gradient(90deg,rgba(255,180,84,.42),rgba(255,203,120,.3))' : 'rgba(255,255,255,.05)',
          boxShadow: value ? '0 0 18px -4px rgba(255,180,84,.65)' : undefined,
        }}
      >
        <span className="absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-white transition-all" style={{ left: value ? 24 : 4, boxShadow: '0 2px 8px rgba(0,0,0,.6)' }} />
      </button>
    </div>
  );
}

function MutedList() {
  const muted = useStore((s) => s.muted);
  const app = useApp();
  if (!muted.length)
    return (
      <p className="rounded-[12px] border border-dashed border-white/[.08] px-3 py-3 text-[12.5px] text-ink-faint">
        No mutes yet. The ⋯ menu on any card can hide an author or cool a tag; muted authors disappear from every feed,
        demoted tags stay searchable but rank cold.
      </p>
    );
  return (
    <ul className="space-y-1.5 pt-1">
      {muted.map((m) => (
        <li key={m} className="flex items-center gap-2 rounded-[12px] border border-white/[.06] bg-white/[.02] px-3 py-2">
          <span className="ht-num text-[12.5px] text-ink">{m}</span>
          <span className="text-[11.5px] text-ink-mute">{m.startsWith('@') ? 'author · hidden everywhere' : 'tag · demoted in ranking'}</span>
          <span className="flex-1" />
          <button
            onClick={() => {
              useStore.getState().toggleMute(m);
              app.toast(`Removed rule ${m}`, 'cool');
            }}
            className="ht-btn ht-btn--ghost !px-2.5 !py-1 !text-[11.5px]"
          >
            Undo
          </button>
        </li>
      ))}
    </ul>
  );
}
