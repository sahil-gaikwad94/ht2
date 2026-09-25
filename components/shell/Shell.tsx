'use client';
/* ============================================================================
   components/shell — the app frame.

   Left: navigation rail with a heat indicator per destination.
   Right: a live "board is burning" rail — the ranker made visible, plus your
   streak and syndication status. On mobile the rail collapses to a tab bar
   with an amber FAB and the right rail moves into /explore.
   ==========================================================================*/

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useApp } from '@/lib/app';
import { useStore } from '@/lib/store';
import { getUser } from '@/lib/seed/users';
import { cls, compact, timeAgo } from '@/lib/util';
import { Avatar, Sparkline } from '@/components/ui/primitives';
import { WaveBars } from '@/components/cards/PostCard';
import { waveformFor } from '@/lib/feed';

export type NavKey = 'feed' | 'explore' | 'notifications' | 'library' | 'profile' | 'settings';

const NAV: { key: NavKey; href: string; label: string; hint: string; icon: (a: { color: string }) => React.ReactNode }[] = [
  { key: 'feed', href: '/feed', label: 'Home', hint: 'g h', icon: (p) => <Icon d="M4 5h16M4 12h16M4 19h10" {...p} /> },
  { key: 'explore', href: '/explore', label: 'Discover', hint: 'g d', icon: (p) => <Icon d="M11 3a8 8 0 1 0 0 16 8 8 0 0 0-0-16ZM20 20l-4.2-4.2" {...p} /> },
  { key: 'notifications', href: '/notifications', label: 'Activity', hint: 'activity', icon: (p) => <Icon d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M10.3 20a2 2 0 0 0 3.4 0" {...p} /> },
  { key: 'library', href: '/library', label: 'Saved', hint: 'g s', icon: (p) => <Icon d="M5 4h6a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H5ZM19 4h-1.5A2.5 2.5 0 0 0 15 6.5V20a2.5 2.5 0 0 1 2.5-2.5H19Z" {...p} /> },
  { key: 'profile', href: '/u/you', label: 'You', hint: 'g p', icon: (p) => <Icon d="M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4ZM4.2 20.4a7.8 7.8 0 0 1 15.6 0" {...p} /> },
  { key: 'settings', href: '/settings', label: 'Settings', hint: 'prefs', icon: (p) => <Icon d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm8-3.2a8 8 0 0 0-.15-1.5l2-1.5-2-3.4-2.3 1a8 8 0 0 0-2.6-1.5L14.5 2h-4l-.45 2.6a8 8 0 0 0-2.6 1.5l-2.3-1-2 3.4 2 1.5a8 8 0 0 0 0 3l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 2.6 1.5l.45 2.6h4l.45-2.6a8 8 0 0 0 2.6-1.5l2.3 1 2-3.4-2-1.5c.1-.5.15-1 .15-1.5Z" {...p} /> },
];

function Icon({ d, color }: { d: string; color: string }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split('M').filter(Boolean).map((seg, i) => (
        <path key={i} d={`M${seg}`} />
      ))}
    </svg>
  );
}

export function NavRail() {
  const app = useApp();
  const me = app.me;
  const unread = app.notifications.filter((n) => !n.read).length;
  const savedCount = useStore((s) => Object.keys(s.saved).length);
  const path = usePathnameSafe();

  return (
    <nav className="sticky top-0 hidden h-[100dvh] w-[76px] shrink-0 flex-col items-center gap-1 border-r border-white/[.05] bg-black/25 py-4 backdrop-blur-xl md:flex xl:w-[236px] xl:items-stretch xl:px-4">
      <Link href="/feed" className="mb-3 flex items-center gap-2 px-1 xl:px-2" aria-label="heatt home">
        <Logo />
        <span className="ht-title ht-heat-text hidden text-[23px] leading-none xl:block">heatt</span>
      </Link>

      {NAV.map((item) => {
        const active = item.key === 'profile' ? path.startsWith(`/u/${me?.handle ?? 'you'}`) : path === item.href || path.startsWith(`${item.href}/`);
        return <NavItem key={item.key} item={item} active={active} badge={item.key === 'notifications' ? unread : 0} />;
      })}

      <button
        onClick={() => app.setComposer(true)}
        className="ht-btn ht-btn--heat mt-3 hidden h-[46px] w-full !rounded-full xl:flex"
        style={{ fontSize: 15 }}
      >
        <ForgeGlyph /> Compose
      </button>
      <button
        onClick={() => app.setComposer(true)}
        className="ht-btn ht-btn--heat mt-2 grid h-[46px] w-[46px] place-items-center !rounded-full xl:hidden"
        aria-label="Compose"
      >
        <ForgeGlyph />
      </button>

      <div className="mt-auto hidden min-w-0 xl:block">
        <div className="rounded-[16px] border border-white/[.06] bg-white/[.02] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="ht-label !text-[9px]">your reading room</span>
            <span className="ht-num text-[11px] font-bold text-ember-300">{savedCount}</span>
          </div>
          <div className="flex items-center gap-2 text-[11.5px] text-ink-mute">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: app.live ? '#63D8F5' : '#6F6F6F', boxShadow: app.live ? '0 0 10px #63D8F5' : undefined }} />
            {app.live ? 'freshly synced' : 'curated snapshot'}
          </div>
        </div>
        <Link href={me ? `/u/${me.handle}` : '/settings'} className="mt-2 flex items-center gap-2.5 rounded-[16px] p-2 transition-colors hover:bg-white/[.04]">
          <Avatar name={me?.name ?? 'Guest'} handle={me?.handle ?? 'guest'} src={me?.avatar} size={34} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold text-ink">{me?.name ?? 'Guest'}</span>
            <span className="block truncate text-[11.5px] text-ink-mute">@{me?.handle ?? 'guest'}</span>
          </span>
        </Link>
      </div>
    </nav>
  );

}

function usePathnameSafe() {
  try {
    return usePathname() ?? '/';
  } catch {
    return '/';
  }
}

function NavItem({ item, active, badge }: { item: (typeof NAV)[number]; active: boolean; badge: number }) {
  return (
    <Link
      href={item.href === '/u/you' ? `/u/${useApp().me?.handle ?? 'you'}` : item.href}
      className="group/nav relative flex items-center gap-3.5 rounded-[14px] px-3 py-2.5 transition-colors hover:bg-white/[.045] xl:mx-[-4px]"
      title={`${item.label} · ${item.hint}`}
    >
      {active && (
        <>
          <motion.span
            layoutId="nav-active"
            className="absolute inset-0 rounded-[14px]"
            style={{
              background: 'linear-gradient(90deg, rgba(255,180,84,.13), rgba(255,180,84,.03) 70%, transparent)',
              boxShadow: '0 1px 0 rgba(255,255,255,.05) inset',
            }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          />
          <motion.span
            layoutId="nav-active-bar"
            className="absolute left-0 top-1/2 h-[22px] w-[3px] -translate-y-1/2 rounded-r-full"
            style={{ background: 'linear-gradient(180deg,var(--ht-flare),var(--ht-ember))', boxShadow: '0 0 14px rgba(255,180,84,.9)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          />
        </>
      )}
      <span className="relative mx-auto xl:mx-0" style={{ color: active ? 'var(--ht-ember-300)' : 'var(--ht-ink-dim)' }}>
        {item.icon({ color: 'currentColor' })}
        {badge > 0 && (
          <span className="ht-num absolute -right-2 -top-1.5 grid h-[15px] min-w-[15px] place-items-center rounded-full px-[3px] text-[9px] font-black text-[#1A0E02]" style={{ background: 'linear-gradient(120deg,var(--ht-flare),var(--ht-magma))' }}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className={cls('hidden flex-1 text-[15px] font-semibold tracking-[-0.01em] xl:block', active ? 'text-ink' : 'text-ink-dim')}>{item.label}</span>
      <span className="ht-label hidden text-[9px] opacity-0 transition-opacity group-hover/nav:opacity-100 xl:block">{item.hint}</span>
    </Link>
  );
}

/* ------------------------------------------------------------------ right rail */

export function RightRail() {
  const app = useApp();
  const s = useStore();
  const board = React.useMemo(() => [...app.posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6), [app.posts]);
  const suggested = React.useMemo(() => {
    const known = new Set([...app.follows, app.me?.handle]);
    return app.posts
      .map((p) => p.authorHandle)
      .filter((h, i, arr) => !known.has(h) && arr.indexOf(h) === i)
      .slice(0, 3)
      .map(getUser);
  }, [app.posts, app.follows, app.me]);

  return (
    <aside className="ht-no-scrollbar sticky top-0 hidden h-[100dvh] w-[330px] shrink-0 overflow-y-auto overscroll-contain border-l border-white/[.05] px-5 py-5 backdrop-blur-sm xl:block">
      <section className="ht-panel p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="ht-title text-[15px] text-ink">Worth your time</h2>
          <button onClick={() => app.setMode('top')} className="ht-chip !text-[9px]">
            see all
          </button>
        </header>
        <ol className="space-y-3">
          {board.map((p, i) => (
            <li key={p.id}>
              <button onClick={() => app.openPost(p.id)} className="group/row flex w-full items-start gap-2.5 text-left">
                <span className="ht-num mt-[3px] w-3 shrink-0 text-[11px] font-bold text-ember-500/80">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink-dim transition-colors group-hover/row:text-ink">
                    {p.title ?? p.text?.slice(0, 90)}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-[11px] text-ink-mute">
                    <span>@{p.authorHandle}</span>
                    <span aria-hidden>·</span>
                    <span>{p.kind === 'forge' ? `${p.minutes ?? 6} min read` : 'short read'}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="ht-panel mt-4 p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="ht-title text-[15px]">Your reading rhythm</h2>
          <span className="text-[11px] text-ink-mute">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </header>
        <div className="flex items-end gap-3">
          <span className="ht-title text-[34px] leading-none text-white">{app.streak.current}</span>
          <span className="pb-1 text-[12px] text-ink-mute">
            days in a row
            <br />
            <span className="text-ink-faint">keep the thread going</span>
          </span>
          <span className="flex-1" />
          <MiniGrid activity={s.activity} />
        </div>
        <Link href="/library" className="ht-btn mt-3 w-full !py-2 !text-[12.5px]">
          Open your library →
        </Link>
      </section>

      {suggested.length > 0 && (
        <section className="ht-panel mt-4 p-4">
          <h2 className="ht-title mb-3 text-[15px]">Worth following</h2>
          <div className="space-y-3">
            {suggested.map((u) => (
              <div key={u.handle} className="flex items-center gap-2.5">
                <Link href={`/u/${u.handle}`}>
                  <Avatar name={u.name} handle={u.handle} src={u.avatar} size={36} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${u.handle}`} className="block truncate text-[13px] font-bold hover:underline">
                    {u.name}
                  </Link>
                  <span className="block truncate text-[11.5px] text-ink-mute">{compact(u.followers)} followers</span>
                </div>
                <button onClick={() => app.toggleFollow(u.handle)} className={cls('ht-btn !px-3 !py-1.5 !text-[11.5px]', app.follows.includes(u.handle) && '!border-ember-500/40 !text-ember-200')}>
                  {app.follows.includes(u.handle) ? 'Following' : 'Follow'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-4 rounded-[18px] border border-white/[.06] p-3.5 text-[11.5px] leading-relaxed text-ink-faint">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: app.live ? '#63D8F5' : '#FFB454' }} />
          <span className="ht-label !text-[9px]">syndication</span>
        </div>
        {app.live ? (
          <>A quiet library of heatt Originals, written to be read here — no redirects, no filler.</>
        ) : (
          <>Wire unreachable from here, so the bundled library is serving the board. Everything still reads in-app.</>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span>{app.posts.length} original stories</span>
          <button onClick={() => app.refresh(true)} className="ht-btn ht-btn--ghost !py-1 !text-[11px]">
            Refresh
          </button>
        </div>
      </section>
    </aside>
  );
}

export function MiniGrid({ activity, days = 35 }: { activity: Record<string, any>; days?: number }) {
  const cells = React.useMemo(() => {
    const out: { key: string; v: number }[] = [];
    const t = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(t.getTime() - i * 86400000).toISOString().slice(0, 10);
      const a = activity[d];
      const v = a ? Math.min(1, (a.reads + a.heats + a.ignites * 2 + a.posts * 2) / 8) : 0;
      out.push({ key: d, v });
    }
    return out;
  }, [activity, days]);
  return (
    <span className="grid grid-cols-7 gap-[3px]" aria-hidden>
      {cells.map((c) => (
        <span
          key={c.key}
          className="h-[7px] w-[7px] rounded-[2px]"
          style={{
            background:
              c.v > 0
                ? `hsl(${Math.round(196 - c.v * 158)} 92% ${28 + c.v * 42}%)`
                : 'rgba(255,255,255,.055)',
            boxShadow: c.v > 0.55 ? `0 0 9px hsl(38 92% 62% / ${c.v * 0.75})` : undefined,
          }}
        />
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------- mobile bar */

export function ReferenceHeader() {
  const app = useApp();
  const path = usePathnameSafe();
  return (
    <header className="sticky top-0 z-40 mx-auto flex h-[72px] w-full max-w-[1080px] items-center justify-between px-4 sm:px-6">
      <Link href="/feed" className="flex items-center gap-2.5" aria-label="heatt home">
        <span className="grid h-9 w-9 place-items-center rounded-[13px] bg-[linear-gradient(140deg,var(--ht-cryo-teal),var(--ht-ember-300))] text-[22px] font-bold text-[#081014] shadow-[0_12px_30px_-16px_rgba(131,222,212,.9)]">h</span>
        <span className="ht-display text-[23px] text-white">heatt</span>
      </Link>
      <div className="hidden items-center gap-2 md:flex">
        {[['/feed', 'Home'], ['/explore', 'Explore'], ['/library', 'Saved']].map(([href, label]) => (
          <Link key={href} href={href} className={cls('rounded-full px-4 py-2 text-[12px] font-semibold transition-colors', path.startsWith(href) ? 'bg-white/[.1] text-white' : 'text-ink-mute hover:text-white')}>
            {label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => app.setPalette(true)} className="grid h-10 w-10 place-items-center rounded-full border border-white/[.1] bg-white/[.035] text-ink-dim transition-colors hover:text-white" aria-label="Search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-4.2-4.2" strokeLinecap="round" /></svg>
        </button>
        <button onClick={() => app.setComposer(true)} className="hidden h-10 rounded-full bg-white px-4 text-[12px] font-bold text-[#081014] transition-transform active:scale-95 sm:block">Write a note</button>
      </div>
    </header>
  );
}

export function EditorialDock() {
  const app = useApp();
  const path = usePathnameSafe();
  const items = [['/feed', 'Today', '◒'], ['/explore', 'Discover', '⌕'], ['/library', 'Collected', '□'], ['/notifications', 'Signals', '◌']] as const;
  return (
    <aside className="editorial-dock">
      <div className="editorial-dock__eyebrow">YOUR ROOM</div>
      <nav>{items.map(([href, label, icon]) => { const active = path === href || path.startsWith(`${href}/`); return <Link key={href} href={href} className={cls('editorial-dock__item', active && 'is-active')}><span>{icon}</span><b>{label}</b><i>{active ? 'now' : ''}</i></Link>; })}</nav>
      <div className="editorial-dock__rule" />
      <Link href={`/u/${app.me?.handle ?? 'you'}`} className={cls('editorial-dock__profile', path.startsWith('/u/') && 'is-active')}><span className="editorial-dock__avatar">{(app.me?.name ?? 'G').slice(0, 1)}</span><span><b>{app.me?.name ?? 'Guest'}</b><small>your profile</small></span><strong>↗</strong></Link>
      <button onClick={() => app.setComposer(true)} className="editorial-dock__write">Write something <span>＋</span></button>
    </aside>
  );
}

export function MobileTabs() {
  const app = useApp();
  const path = usePathnameSafe();
  const me = app.me;
  const items: { key: NavKey; href: string; label: string; icon: string }[] = [
    { key: 'feed', href: '/feed', label: 'Feed', icon: 'M4 11 12 4l8 7M6 10v9h12v-9' },
    { key: 'explore', href: '/explore', label: 'Explore', icon: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM20 20l-4.2-4.2' },
    { key: 'notifications', href: '/notifications', label: 'Updates', icon: 'M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M10.3 20a2 2 0 0 0 3.4 0' },
    { key: 'library', href: '/library', label: 'Saved', icon: 'M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-3.8L5.5 20.5v-16a1 1 0 0 1 1-1Z' },
    { key: 'profile', href: `/u/${me?.handle ?? 'you'}`, label: 'You', icon: 'M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4ZM4.2 20.4a7.8 7.8 0 0 1 15.6 0' },
  ];
  return (
    <>
      <nav className="ht-dock fixed inset-x-0 bottom-0 z-50 mx-auto mb-[max(12px,env(safe-area-inset-bottom))] flex w-[min(93vw,480px)] items-center justify-between gap-0.5 px-2 py-1.5">
        {items.map((it) => {
          const active = it.key === 'profile' ? path.startsWith('/u/') : path === it.href;
          return (
            <Link
              key={it.key}
              href={it.href}
              aria-label={it.label}
              data-active={active || undefined}
              className="ht-dock-item"
            >
              {active && (
                <motion.span
                  layoutId="mtab"
                  className="ht-dock-active"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">
                <Icon d={it.icon} color="currentColor" />
              </span>
              {it.key === 'notifications' && app.notifications.some((n) => !n.read) && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cryo-teal" />
              )}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={() => app.setComposer(true)}
        className="fixed bottom-[96px] right-[max(16px,calc((100vw-1080px)/2))] z-50 grid h-[54px] w-[54px] place-items-center rounded-full text-[#081014] transition-transform active:scale-95"
        style={{
          background: 'linear-gradient(135deg,var(--ht-ember),var(--ht-flare))',
          boxShadow: '0 16px 40px -14px rgba(255,180,84,.85), 0 1px 0 rgba(255,255,255,.5) inset',
        }}
        aria-label="Compose"
      >
        <ForgeGlyph />
      </button>
    </>
  );
}

export function TopBar({ title, sub, right }: { title?: string; sub?: string; right?: React.ReactNode }) {
  const app = useApp();
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <div
      className={cls(
        'sticky top-0 z-40 -mx-4 mb-3 border-b px-4 backdrop-blur-xl transition-all sm:-mx-6 sm:px-6',
        scrolled ? 'border-white/[.07] bg-[#050505]/80' : 'border-transparent'
      )}
      style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}
    >
      <div className="flex h-[52px] items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="ht-title truncate text-[19px] leading-tight">{title ?? 'Feed'}</h1>
            {sub && <span className="truncate text-[12px] text-ink-mute">{sub}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {right}
          <button onClick={() => app.setPalette(true)} className="ht-btn ht-btn--ghost !px-2.5" aria-label="Search and commands">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4.2-4.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export function GreetingBar() {
  const app = useApp();
  const me = app.me;
  const hour = new Date().getHours();
  const part = hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = (me?.name ?? 'forger').split(' ')[0];
  return (
    <header className="flex items-center gap-3 px-1 pb-4 pt-3">
      <Link href={me ? `/u/${me.handle}` : '/settings'} aria-label="Your profile">
        <Avatar name={me?.name ?? 'Guest'} handle={me?.handle ?? 'guest'} src={me?.avatar} size={44} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] text-ink-mute">{part}</p>
        <h1 className="ht-title truncate text-[22px] leading-tight text-ink">
          Hi, <span className="ht-heat-text">{name}</span>
        </h1>
      </div>
      <button onClick={() => app.setComposer(true)} className="ht-btn ht-btn--heat !px-4 !py-2 !text-[13px]" aria-label="Compose">
        Compose
      </button>
      <button onClick={() => app.setPalette(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[.09] text-ink-dim transition-colors hover:text-ink" aria-label="Search and commands">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4.2-4.2" strokeLinecap="round" />
        </svg>
      </button>
    </header>
  );
}

export function Logo() {
  return (
    <span className="relative grid h-[30px] w-[30px] shrink-0 place-items-center">
      <svg viewBox="0 0 32 32" className="h-full w-full" aria-label="heatt">
        <defs>
          <linearGradient id="htlogo" x1="0" y1="1" x2="0.7" y2="0">
            <stop offset="0" stopColor="#F59A2B" />
            <stop offset="0.5" stopColor="#FFB454" />
            <stop offset="1" stopColor="#FFF6E8" />
          </linearGradient>
        </defs>
        <path
          d="M16.6 1.6c1.6 4.3.3 6.4-1.5 8.4-2 2.3-4.5 4.3-4.5 8.5a8.6 8.6 0 0 0 17.2.6c.1-3.4-1.9-5.7-2.7-8.9 2.2 2.6 3.7 5.5 3.7 9.1A12.4 12.4 0 0 1 16.6 30 12.4 12.4 0 0 1 4 17.7C4 9.8 11.5 5.5 16.6 1.6Z"
          transform="translate(-2.5 0)"
          fill="url(#htlogo)"
        />
      </svg>
      <span aria-hidden className="absolute inset-0 -z-10 rounded-full blur-lg" style={{ background: 'radial-gradient(circle,rgba(255,180,84,.55),transparent 70%)' }} />
    </span>
  );
}

function ForgeGlyph() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function FeedTabs() {
  const app = useApp();
  const tabs: { key: string; label: string; badge?: string }[] = [
    { key: 'for-you', label: 'All' },
    { key: 'forges', label: 'Long-form' },
    { key: 'sparks', label: 'Sparks' },
    { key: 'following', label: 'Following' },
    { key: 'library', label: 'Saved' },
  ];
  const modes: { key: string; label: string }[] = [
    { key: 'heat', label: 'For you' },
    { key: 'new', label: 'Fresh' },
    { key: 'top', label: 'Popular' },
    { key: 'contested', label: 'Discussed' },
  ];
  return (
    <div className="-mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4 ht-no-scrollbar sm:-mx-6 sm:px-6">
      {tabs.map((t) => {
        const active = app.tab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => app.setTab(t.key)}
            aria-selected={active}
            role="tab"
            className="ht-tab !px-4 !py-2 !text-[13.5px]"
          >
            {t.label}
          </button>
        );
      })}
      <span className="flex-1" />
      <div className="hidden shrink-0 items-center gap-1 pr-1 sm:flex">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => app.setMode(m.key as never)}
            className={cls('shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors', app.mode === m.key ? 'bg-white/[.09] text-ink' : 'text-ink-mute hover:text-ink-dim')}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
