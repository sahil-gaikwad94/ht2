'use client';
/* ============================================================================
   lib/app.tsx — the app-level context: navigation, ignition orchestration,
   toasts, sheet/modal state, live feed data (syndication) and prefs effects.

   One provider, no prop drilling: cards need heat state, the reader needs the
   post, the shell needs the nav, and every action can raise a toast or start a
   burn. Centralising it also lets us queue ignitions so 12 simultaneous
   combustions never jank the main thread.
   ==========================================================================*/

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useStore, streakOf, type LocalArticle } from './store';
import { assemble, rank, type Post, type RankMode } from './feed';
import type { WireItem } from './syndicate';
import { getUser } from './seed/users';
import type { HeatLevel, Notification, User } from './types';

export type Toast = { id: number; text: string; tone?: 'heat' | 'cool' | 'plain'; icon?: React.ReactNode };

export type Ctx = {
  posts: Post[];
  wire: WireItem[];
  live: boolean;
  loading: boolean;
  refresh: (force?: boolean) => void;
  /** ranked view for the current tab/mode */
  ranked: Post[];
  tab: string;
  setTab: (t: string) => void;
  mode: RankMode;
  setMode: (m: RankMode) => void;
  query: string;
  setQuery: (q: string) => void;

  open: string | null;
  openPost: (id: string) => void;
  closePost: () => void;

  ignite: (id: string) => void;
  igniting: Record<string, number>;
  setHeat: (id: string, level: HeatLevel, opts?: { ignited?: boolean; title?: string; author?: string }) => void;

  toast: (text: string, tone?: Toast['tone'], icon?: React.ReactNode) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;

  composerOpen: boolean;
  setComposer: (open: boolean, seed?: { kind?: 'spark' | 'forge'; quote?: string; article?: Partial<LocalArticle> }) => void;
  composerSeed: { kind?: 'spark' | 'forge'; quote?: string; article?: Partial<LocalArticle> };

  shareId: string | null;
  setShare: (id: string | null) => void;

  paletteOpen: boolean;
  setPalette: (v: boolean) => void;

  go: (href: string) => void;
  push: (href: string) => void;

  heatOf: (id: string) => HeatLevel;
  countOf: (p: Post) => number;

  me: User | null;
  ensureMe: () => User;
  follows: string[];
  toggleFollow: (h: string) => void;

  prefs: ReturnType<typeof useStore.getState>['prefs'];
  setPrefs: (p: Partial<ReturnType<typeof useStore.getState>['prefs']>) => void;
  streak: { current: number; longest: number };
  notifications: Notification[];
  notify: (n: Omit<Notification, 'id' | 'at' | 'read'>) => void;
  markAll: () => void;
  ready: boolean;
};

const AppCtx = React.createContext<Ctx | null>(null);
export const useApp = () => {
  const c = React.useContext(AppCtx);
  if (!c) throw new Error('useApp must be used inside <AppProvider>');
  return c;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const s = useStore();
  const [wire, setWire] = React.useState<WireItem[]>([]);
  const [live, setLive] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<string>('for-you');
  const [mode, setMode] = React.useState<RankMode>('heat');
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState<string | null>(null);
  const [igniting, setIgniting] = React.useState<Record<string, number>>({});
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [composerSeed, setComposerSeed] = React.useState<Ctx['composerSeed']>({});
  const [shareId, setShareId] = React.useState<string | null>(null);
  const [paletteOpen, setPalette] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => setReady(true), []);

  /* ------------------------------------------------------------ hydration */
  React.useEffect(() => {
    if (!s.booted) useStore.getState().setBooted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------- prefs → <html> */
  React.useEffect(() => {
    const el = document.documentElement;
    el.dataset.density = s.prefs.density;
    el.dataset.measure = s.prefs.measure;
    el.dataset.serif = String(s.prefs.serif);
    el.dataset.reduceMotion = String(s.prefs.reduceMotion);
    el.dataset.theme = s.prefs.customTheme;
    if (s.prefs.density === 'cozy') el.style.fontSize = '17px';
    else if (s.prefs.density === 'dense') el.style.fontSize = '15px';
    else el.style.fontSize = '16px';
  }, [s.prefs.density, s.prefs.measure, s.prefs.serif, s.prefs.reduceMotion, s.prefs.customTheme]);

  /* --------------------------------------------------------- originals only */
  const refresh = React.useCallback(async (force = false) => {
    void force;
    setLoading(true);
    setWire([]);
    setLive(false);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void refresh(false);
    const id = window.setInterval(() => void refresh(false), 5 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------- toasts */
  const toast = React.useCallback((text: string, tone: Toast['tone'] = 'plain', icon?: React.ReactNode) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((t) => [...t.slice(-2), { id, text, tone, icon }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const dismissToast = React.useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  /* ------------------------------------------------------------ ranking */
  /* Every input assemble()/rank() reads has to be a dependency — mute was
     missing once, which made hiding an author a no-op until the next reload. */
  const posts = React.useMemo(() => assemble(s as any, wire), [
    wire,
    s.mySparks,
    s.myArticles,
    s.heat,
    s.saved,
    s.reads,
    s.shares,
    s.heatCounts,
    s.me,
    s.follows,
    s.muted,
    s.interests,
  ]);

  const ranked = React.useMemo(() => {
    const r = rank(posts, s as any, { mode, tab: tab as any, query: query || undefined });
    return r.items;
  }, [posts, mode, tab, query, s]);

  /* ---------------------------------------------------------- ignition */
  const igniteQueue = React.useRef<string[]>([]);
  const burning = React.useRef(0);

  const pumpIgnition = React.useCallback(() => {
    // at most 2 concurrent burns: spectacular, not a slideshow hazard
    while (burning.current < 2 && igniteQueue.current.length) {
      const id = igniteQueue.current.shift()!;
      burning.current += 1;
      setIgniting((m) => ({ ...m, [id]: Date.now() }));
      window.setTimeout(() => {
        burning.current -= 1;
        setIgniting((m) => {
          const n = { ...m };
          delete n[id];
          return n;
        });
        pumpIgnition();
      }, 2400);
    }
  }, []);

  const ignite = React.useCallback(
    (id: string) => {
      igniteQueue.current.unshift(id);
      pumpIgnition();
      try {
        if (navigator.vibrate && useStore.getState().prefs.haptics) navigator.vibrate([18, 26, 44]);
      } catch {/* unsupported */}
    },
    [pumpIgnition]
  );

  /* -------------------------------------------------------------- heat */
  const setHeat = React.useCallback(
    (id: string, level: HeatLevel, opts?: { ignited?: boolean; title?: string; author?: string }) => {
      const store = useStore.getState();
      const prev = store.heat[id]?.level ?? 0;
      store.setHeat(id, level);
      if (level > prev) store.bumpHeatCount(id, level === 3 ? 3 : level === 2 ? 2 : 1);
      if (level < prev) store.bumpHeatCount(id, -Math.max(1, prev));

      if (level === 3 || opts?.ignited) {
        ignite(id);
        store.notify({
          type: 'ignite',
          actor: store.me?.handle ?? 'you',
          text: `You ignited ${opts?.author ? `@${opts.author}` : 'a post'}${opts?.title ? ` — “${truncate(opts.title, 42)}”` : ''}`,
          postId: id,
          level: 3,
        });
        toast('Ignition · inferno injected into the ranker', 'heat');
      } else if (level === 2 && prev < 2) {
        toast('Blaze · heat doubled on this post', 'heat');
      } else if (level === 0 && prev > 0) {
        toast('Cooled down', 'cool');
      }
    },
    [ignite, toast]
  );

  /* --------------------------------------------------------- navigation */
  const go = React.useCallback((href: string) => router.push(href), [router]);
  const push = React.useCallback((href: string) => router.push(href), [router]);

  const openPost = React.useCallback((id: string) => {
    const p = posts.find((x) => x.id === id);
    if (!p) return;
    if (p.kind === 'forge') {
      setOpen(id);
      router.push(`/read/${encodeURIComponent(id)}`);
    } else {
      toast('Spark opened', 'plain');
      setOpen(id);
    }
  }, [posts, router, toast]);

  const closePost = React.useCallback(() => setOpen(null), []);

  const heatOf = React.useCallback((id: string) => s.heat[id]?.level ?? 0, [s.heat]);
  const countOf = React.useCallback(
    (p: Post) => (p.reactions ?? 0) + (s.heatCounts[p.id] ?? 0) + ((s.heat[p.id]?.level ?? 0) > 0 ? (s.heat[p.id]?.level ?? 0) : 0),
    [s.heatCounts, s.heat]
  );

  const ensureMe = React.useCallback((): User => {
    const st = useStore.getState();
    if (st.me) return st.me;
    const guest: User = {
      handle: 'you',
      name: 'Guest forger',
      bio: 'Reading first. Writing later.',
      joined: new Date().toISOString().slice(0, 10),
      followers: 0,
      following: 0,
      thermalMass: 1,
    };
    useStore.setState({ me: guest, onboarded: st.onboarded });
    return guest;
  }, []);

  const streak = React.useMemo(() => streakOf(s.activity), [s.activity]);

  const value: Ctx = {
    posts,
    wire,
    live,
    loading,
    refresh,
    ranked,
    tab,
    setTab,
    mode,
    setMode,
    query,
    setQuery,
    open,
    openPost,
    closePost,
    ignite,
    igniting,
    setHeat,
    toast,
    toasts,
    dismissToast,
    composerOpen,
    setComposer: (open, seed) => {
      setComposerSeed(seed ?? {});
      setComposerOpen(open);
    },
    composerSeed,
    shareId,
    setShare: setShareId,
    paletteOpen,
    setPalette,
    go,
    push,
    heatOf,
    countOf,
    me: s.me,
    ensureMe,
    follows: s.follows,
    toggleFollow: (h) => {
      s.toggleFollow(h);
      const now = useStore.getState().follows.includes(h);
      toast(now ? `Following @${h}` : `Unfollowed @${h}`, now ? 'heat' : 'cool');
      if (now) {
        const u = getUser(h);
        s.notify({ type: 'follow', actor: h, text: `You started following ${u.name}`, read: false } as any);
      }
    },
    prefs: s.prefs,
    setPrefs: s.setPrefs,
    streak,
    notifications: s.notifications,
    notify: s.notify,
    markAll: s.markAllRead,
    ready,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
