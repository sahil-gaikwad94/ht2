'use client';
/* ============================================================================
   components/palette — ⌘K for everything. Search, navigate, toggle prefs and
   heat a post directly from the keyboard. Fuzzy-scored, heat-ordered.
   ==========================================================================*/

import * as React from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/lib/app';
import { useStore } from '@/lib/store';
import { cls, timeAgo } from '@/lib/util';
import { kelvin } from '@/lib/heat';
import { Avatar } from '@/components/ui/primitives';

type Cmd = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon?: string;
  run: () => void;
  score?: number;
};

export function CommandPalette() {
  const app = useApp();
  const s = useStore();
  const open = app.paletteOpen;
  const [q, setQ] = React.useState('');
  const [i, setI] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const attachInput = React.useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
    // focus when the node appears — the modal mounts a frame after `open`
    if (el) el.focus();
  }, []);

  React.useEffect(() => {
    if (open) {
      setQ('');
      setI(0);
      inputRef.current?.focus();
    }
  }, [open]);

  const cmds = React.useMemo<Cmd[]>(() => {
    const nav: Cmd[] = [
      { id: 'n-feed', group: 'Go to', label: 'The Board (feed)', hint: 'g f', icon: '▤', run: () => app.go('/feed') },
      { id: 'n-explore', group: 'Go to', label: 'Explore & search', hint: 'g e', icon: '◎', run: () => app.go('/explore') },
      { id: 'n-lib', group: 'Go to', label: 'Library — saved & in progress', hint: 'g l', icon: '❑', run: () => app.go('/library') },
      { id: 'n-notif', group: 'Go to', label: 'Updates & replies', icon: '▲', run: () => app.go('/notifications') },
      { id: 'n-me', group: 'Go to', label: `Profile — @${s.me?.handle ?? 'you'}`, hint: 'g p', icon: '☺', run: () => app.go(`/u/${s.me?.handle ?? 'you'}`) },
      { id: 'n-set', group: 'Go to', label: 'Settings', icon: '⚙', run: () => app.go('/settings') },
    ];
    const act: Cmd[] = [
      { id: 'a-spark', group: 'Create', label: 'Strike a spark', hint: 'short-form', icon: '✦', run: () => app.setComposer(true, { kind: 'spark' }) },
      { id: 'a-forge', group: 'Create', label: 'Forge a long read', hint: 'markdown, live preview', icon: '⚒', run: () => app.setComposer(true, { kind: 'forge' }) },
      {
        id: 'a-motion',
        group: 'Toggle',
        label: `${s.prefs.reduceMotion ? 'Disable' : 'Enable'} reduced motion`,
        icon: '◑',
        run: () => {
          s.setPrefs({ reduceMotion: !s.prefs.reduceMotion });
          app.toast(`Reduced motion ${!s.prefs.reduceMotion ? 'on' : 'off'}`, 'cool');
        },
      },
      {
        id: 'a-ambient',
        group: 'Toggle',
        label: `${s.prefs.ambient ? 'Turn off' : 'Turn on'} ambient heat field`,
        icon: '≈',
        run: () => s.setPrefs({ ambient: !s.prefs.ambient }),
      },
      {
        id: 'a-serif',
        group: 'Toggle',
        label: `${s.prefs.serif ? 'Sans' : 'Serif'} reading face`,
        icon: 'Aa',
        run: () => s.setPrefs({ serif: !s.prefs.serif }),
      },
      {
        id: 'a-density',
        group: 'Toggle',
        label: `Density → ${s.prefs.density === 'dense' ? 'normal' : s.prefs.density === 'normal' ? 'cozy' : 'dense'}`,
        icon: '≡',
        run: () => s.setPrefs({ density: s.prefs.density === 'dense' ? 'normal' : s.prefs.density === 'normal' ? 'cozy' : 'dense' }),
      },
      { id: 'a-refresh', group: 'Toggle', label: 'Refresh Originals library', icon: '↻', run: () => { app.refresh(true); app.toast('Originals library refreshed', 'cool'); } },
      { id: 'a-intro', group: 'Toggle', label: 'Replay the cinematic intro', icon: '▶', run: () => { s.setIntroSeen(); useStore.setState({ introSeen: false }); location.reload(); } },
    ];
    const heatTargets = [...app.posts]
      .sort((a, b) => (b.heat?.score ?? 0) - (a.heat?.score ?? 0))
      .slice(0, 26)
      .map<Cmd>((p) => ({
        id: `p-${p.id}`,
        group: 'Writing',
        label: (p.title ?? p.text ?? '').slice(0, 76),
        hint: `@${p.authorHandle} · ${timeAgo(p.date)}`,
        icon: p.kind === 'forge' ? '⚒' : '✦',
        run: () => app.openPost(p.id),
        score: p.heat?.score,
      }));
    const tags = [...new Set(app.posts.flatMap((p) => p.tags))].slice(0, 18).map<Cmd>((t) => ({
      id: `t-${t}`,
      group: 'Tags',
      label: `#${t}`,
      hint: `${app.posts.filter((p) => p.tags.includes(t)).length} items`,
      icon: '#',
      run: () => app.go(`/explore?tag=${encodeURIComponent(t)}`),
    }));
    return [...act, ...nav, ...heatTargets, ...tags];
  }, [app, s]);

  const results = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    const scored = cmds.map((c) => {
      if (!query) return { c, m: c.score ?? 0 };
      const hay = `${c.group} ${c.label} ${c.hint ?? ''}`.toLowerCase();
      const idx = hay.indexOf(query);
      let m = idx < 0 ? 0 : 1000 - idx;
      // subsequence fallback
      if (m === 0) {
        let k = 0;
        for (const ch of hay) if (ch === query[k]) k++;
        if (k === query.length) m = 300 - Math.min(200, hay.length / 8);
      }
      return { c, m };
    });
    return scored
      .filter((x) => x.m > 0 || !query)
      .sort((a, b) => b.m - a.m)
      .slice(0, 40)
      .map((x) => x.c);
  }, [q, cmds]);

  React.useEffect(() => {
    setI(0);
  }, [q]);

  if (!open) return null;

  const grouped: [string, Cmd[]][] = [];
  for (const r of results) {
    const g = grouped.find((x) => x[0] === r.group);
    if (g) g[1].push(r);
    else grouped.push([r.group, [r]]);
  }

  const flat = results;

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center px-3 pt-[8vh]" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_20%,rgba(255,180,84,.07),transparent_60%)] backdrop-blur-md" style={{ background: 'rgba(4,4,6,.72)' }} onClick={() => app.setPalette(false)} />
      <motion.div
        initial={{ opacity: 0, y: -14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="ht-glass relative w-full max-w-[620px] overflow-hidden rounded-[22px]"
        style={{ boxShadow: '0 50px 130px -40px rgba(0,0,0,1), 0 0 0 1px rgba(255,180,84,.1)' }}
      >
        <div className="flex items-center gap-2.5 border-b border-white/[.07] px-4 py-3">
          <span className="text-ember-400">⌘</span>
          <input
            ref={attachInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search posts, tags, people, commands…"
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setI((x) => Math.min(flat.length - 1, x + 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setI((x) => Math.max(0, x - 1));
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                flat[i]?.run();
                app.setPalette(false);
              }
              if (e.key === 'Escape') app.setPalette(false);
            }}
          />
          <span className="ht-label !text-[9px]">{flat.length}</span>
        </div>

        <div ref={listRef} className="max-h-[54vh] overflow-y-auto p-2">
          {grouped.map(([group, items]) => (
            <div key={group} className="mb-1">
              <div className="px-2 py-1.5">
                <span className="ht-label !text-[9px]">{group}</span>
              </div>
              {items.map((c) => {
                const idx = flat.indexOf(c);
                return (
                  <button
                    key={c.id}
                    onMouseEnter={() => setI(idx)}
                    onClick={() => {
                      c.run();
                      app.setPalette(false);
                    }}
                    className={cls(
                      'flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left transition-colors',
                      idx === i ? 'bg-[linear-gradient(90deg,rgba(255,180,84,.16),rgba(255,203,120,.05))] text-ink' : 'text-ink-dim hover:bg-white/[.04]'
                    )}
                  >
                    <span className={cls('grid h-6 w-6 shrink-0 place-items-center rounded-[8px] border text-[12px]', idx === i ? 'border-ember-500/45 text-ember-300' : 'border-white/[.08] text-ink-mute')}>
                      {c.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{c.label}</span>
                    {c.hint && <span className="ht-num shrink-0 truncate text-[11px] text-ink-faint">{c.hint}</span>}
                    {idx === i && <kbd className="shrink-0 rounded border border-white/12 px-1.5 py-0.5 text-[9px] font-bold text-ink-mute">↵</kbd>}
                  </button>
                );
              })}
            </div>
          ))}
          {flat.length === 0 && <div className="p-8 text-center text-[13px] text-ink-mute">Nothing matches “{q}”. Try a tag, e.g. typography.</div>}
        </div>

        <div className="flex items-center justify-between border-t border-white/[.07] px-4 py-2.5 text-[11px] text-ink-faint">
          <span className="flex items-center gap-2">
            <Avatar name={s.me?.name ?? 'You'} handle={s.me?.handle ?? 'you'} src={s.me?.avatar} size={16} />
            @<b>{s.me?.handle ?? 'you'}</b>
          </span>
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-white/12 px-1">↑↓</kbd> navigate
            <kbd className="rounded border border-white/12 px-1">↵</kbd> open
            <kbd className="rounded border border-white/12 px-1">esc</kbd> close
          </span>
        </div>
      </motion.div>
    </div>
  );
}
