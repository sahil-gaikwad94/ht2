'use client';
/* ============================================================================
   heatt client store — single zustand slice persisted to localStorage.
   Owns: identity, heat ledger, follows, library, notifications, prefs, drafts.
   Heat is the source of truth for ranking, the heatmap and the streak.
   ==========================================================================*/

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { HeatEvent, HeatLevel, Notification, Prefs, Spark, User } from './types';
import { uid } from './util';

export type LocalArticle = {
  id: string;
  kind: 'forge';
  title: string;
  dek: string;
  author: string;
  tags: string[];
  cover?: string;
  date: string;
  minutes: number;
  markdown: string;
  source?: { name: string; url: string };
};

export type Reply = {
  id: string;
  postId: string;
  author: string;
  text: string;
  at: number;
  heat: number;
  parent?: string;
};

type HeatKey = string; // post id

export type State = {
  booted: boolean;
  introSeen: boolean;
  onboarded: boolean;
  me: User | null;
  prefs: Prefs;

  heat: Record<HeatKey, HeatEvent>;
  heatCounts: Record<HeatKey, number>; // aggregate public heats (+1 when I heat)
  reads: Record<HeatKey, { pct: number; at: number; finished?: boolean }>;
  saved: Record<HeatKey, number>; // bookmarks / library
  shares: Record<HeatKey, number>;
  follows: string[];
  muted: string[];
  replies: Reply[];
  mySparks: Spark[];
  myArticles: LocalArticle[];
  notifications: Notification[];
  /** ISO date strings of days with activity → drives the heatmap + streak */
  activity: Record<string, { reads: number; heats: number; ignites: number; posts: number; minutes: number }>;
  interests: string[];
  /** live syndication payload cache */
  wire: { at: number; items: unknown[] } | null;

  // actions
  setBooted: (v: boolean) => void;
  setIntroSeen: () => void;
  completeOnboarding: (patch: Partial<User>, interests: string[]) => void;
  updateMe: (patch: Partial<User>) => void;
  setPrefs: (patch: Partial<Prefs>) => void;
  setHeat: (id: HeatKey, level: HeatLevel) => void;
  bumpHeatCount: (id: HeatKey, delta: number) => void;
  setRead: (id: HeatKey, pct: number, minutes?: number) => void;
  toggleSave: (id: HeatKey) => void;
  addShare: (id: HeatKey) => void;
  toggleFollow: (handle: string) => void;
  /** `muted` holds `@handle` (hide everything by them) and `#tag` (demote a topic) */
  toggleMute: (entry: string) => void;
  isMuted: (entry: string) => boolean;
  addReply: (r: Omit<Reply, 'id' | 'at' | 'heat'>) => void;
  addSpark: (s: Omit<Spark, 'id' | 'date' | 'kind'>) => Spark;
  addArticle: (a: Omit<LocalArticle, 'id' | 'date' | 'kind' | 'minutes'>) => LocalArticle;
  notify: (n: Omit<Notification, 'id' | 'at' | 'read'>) => void;
  markAllRead: () => void;
  logActivity: (kind: 'reads' | 'heats' | 'ignites' | 'posts', minutes?: number) => void;
  setWire: (items: unknown[]) => void;
  reset: () => void;
};

const DEFAULT_PREFS: Prefs = {
  density: 'normal',
  measure: 'normal',
  serif: true,
  reduceMotion: false,
  ambient: true,
  autoplayVideo: true,
  haptics: true,
  ignitionFx: 'full',
  customTheme: 'ember',
};

const today = () => new Date().toISOString().slice(0, 10);

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      booted: false,
      introSeen: false,
      onboarded: false,
      me: null,
      prefs: DEFAULT_PREFS,
      heat: {},
      heatCounts: {},
      reads: {},
      saved: {},
      shares: {},
      follows: ['nyra', 'amara', 'k-vasiliev', 'tobi', 'sena', 'heatt'],
      muted: [],
      replies: [],
      mySparks: [],
      myArticles: [],
      notifications: [],
      activity: {},
      interests: ['design', 'engineering', 'typography', 'ai'],
      wire: null,

      setBooted: (v) => set({ booted: v }),
      setIntroSeen: () => set({ introSeen: true }),

      completeOnboarding: (patch, interests) => {
        const handle = (patch.handle ?? 'you').replace(/^@/, '').toLowerCase();
        set({
          onboarded: true,
          interests,
          me: {
            handle,
            name: patch.name ?? handle,
            bio: patch.bio ?? 'New on heatt.',
            avatar: patch.avatar,
            cover: patch.cover,
            location: patch.location,
            site: patch.site,
            joined: today(),
            followers: 0,
            following: 0,
            thermalMass: 1,
            traits: interests.slice(0, 4),
          },
        });
      },

      updateMe: (patch) => set({ me: { ...(get().me as User), ...patch } }),

      setPrefs: (patch) => set({ prefs: { ...get().prefs, ...patch } }),

      setHeat: (id, level) => {
        const cur = get().heat[id]?.level ?? 0;
        if (level === 0) {
          const heat = { ...get().heat };
          delete heat[id];
          set({ heat });
          return;
        }
        set({ heat: { ...get().heat, [id]: { level, at: Date.now() } } });
        if (level > cur) get().logActivity('heats');
        if (level === 3 && cur < 3) get().logActivity('ignites');
      },

      bumpHeatCount: (id, delta) =>
        set({ heatCounts: { ...get().heatCounts, [id]: Math.max(0, (get().heatCounts[id] ?? 0) + delta) } }),

      setRead: (id, pct, minutes = 0) => {
        /* `finished` is edge-triggered: the day gets counted once, the first
           time you cross 97%, and never un-counted by scrolling back up. */
        const clean = Math.max(0, Math.min(100, Math.round(Number.isFinite(pct) ? pct : 0)));
        const prev = get().reads[id];
        const crossing = clean >= 97 && !prev?.finished;
        set({
          reads: {
            ...get().reads,
            [id]: {
              pct: Math.max(prev?.pct ?? 0, clean),
              at: Date.now(),
              finished: clean >= 97 || !!prev?.finished,
            },
          },
        });
        if (crossing) get().logActivity('reads', minutes);
      },

      toggleSave: (id) => {
        const saved = { ...get().saved };
        if (saved[id]) delete saved[id];
        else saved[id] = Date.now();
        set({ saved });
      },

      addShare: (id) => {
        set({ shares: { ...get().shares, [id]: (get().shares[id] ?? 0) + 1 } });
        get().logActivity('posts');
      },

      toggleFollow: (handle) => {
        const has = get().follows.includes(handle);
        set({ follows: has ? get().follows.filter((h) => h !== handle) : [...get().follows, handle] });
      },

      toggleMute: (entry) => {
        const has = get().muted.includes(entry);
        set({ muted: has ? get().muted.filter((m) => m !== entry) : [...get().muted, entry] });
      },
      isMuted: (entry) => get().muted.includes(entry),

      addReply: (r) =>
        set({ replies: [...get().replies, { ...r, id: uid('re'), at: Date.now(), heat: 0 }] }),

      addSpark: (s) => {
        const spark: Spark = { ...s, id: uid('sp'), kind: 'spark', date: new Date().toISOString() };
        set({ mySparks: [spark, ...get().mySparks] });
        get().logActivity('posts');
        return spark;
      },

      addArticle: (a) => {
        const words = a.markdown.split(/\s+/).length;
        const art: LocalArticle = {
          ...a,
          id: uid('fg'),
          kind: 'forge',
          date: new Date().toISOString(),
          minutes: Math.max(1, Math.round(words / 225)),
        };
        set({ myArticles: [art, ...get().myArticles] });
        get().logActivity('posts');
        return art;
      },

      notify: (n) =>
        set({ notifications: [{ ...n, id: uid('nt'), at: Date.now(), read: false }, ...get().notifications].slice(0, 80) }),

      markAllRead: () => set({ notifications: get().notifications.map((n) => ({ ...n, read: true })) }),

      logActivity: (kind, minutes = 0) => {
        const d = today();
        const cur = get().activity[d] ?? { reads: 0, heats: 0, ignites: 0, posts: 0, minutes: 0 };
        set({
          activity: {
            ...get().activity,
            [d]: { ...cur, [kind]: cur[kind] + 1, minutes: cur.minutes + minutes },
          },
        });
      },

      setWire: (items) => set({ wire: { at: Date.now(), items } }),

      reset: () =>
        set({
          booted: true,
          introSeen: true,
          onboarded: false,
          me: null,
          heat: {},
          heatCounts: {},
          reads: {},
          saved: {},
          shares: {},
          replies: [],
          mySparks: [],
          myArticles: [],
          notifications: [],
          activity: {},
          wire: null,
        }),
    }),
    {
      name: 'heatt-store-v1',
      storage: createJSONStorage(() => (typeof window === 'undefined' ? (undefined as never) : localStorage)),
      partialize: (s) => ({
        booted: s.booted,
        introSeen: s.introSeen,
        onboarded: s.onboarded,
        me: s.me,
        prefs: s.prefs,
        heat: s.heat,
        heatCounts: s.heatCounts,
        reads: s.reads,
        saved: s.saved,
        shares: s.shares,
        follows: s.follows,
        muted: s.muted,
        replies: s.replies,
        mySparks: s.mySparks,
        myArticles: s.myArticles,
        notifications: s.notifications,
        activity: s.activity,
        interests: s.interests,
      }),
    }
  )
);

/** Streak helpers — current run, longest run, and 365-day grid data. */
export function streakOf(activity: State['activity']) {
  const days = Object.keys(activity).sort();
  if (!days.length) return { current: 0, longest: 0 };
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]).getTime();
    const cur = new Date(days[i]).getTime();
    if (Math.round((cur - prev) / 86400000) === 1) run++;
    else run = 1;
    longest = Math.max(longest, run);
  }
  // current run counts back from today, tolerating "not yet logged today"
  const t = new Date();
  let current = 0;
  for (let i = 0; i < 365; i++) {
    const key = new Date(t.getTime() - i * 86400000).toISOString().slice(0, 10);
    const a = activity[key];
    if (a && (a.reads + a.heats + a.posts + a.ignites) > 0) current++;
    else if (i === 0) continue; // today not yet earned
    else break;
  }
  return { current, longest };
}

export function heatLevelOf(s: State, id: string): HeatLevel {
  return s.heat[id]?.level ?? 0;
}
