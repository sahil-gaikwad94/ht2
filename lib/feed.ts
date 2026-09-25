'use client';
/* ============================================================================
   lib/feed — the union type everything renders against, plus Heat Diffusion
   ranking, cliff truncation, search and explore aggregation.
   ==========================================================================*/

import { ORIGINALS } from './seed/articles';
import { getUser, SEED_USERS } from './seed/users';
import { computeHeat, cliffIndex, type HeatResult, K } from './heat';
import type { ArticleBlock, HeatLevel, Spark, User } from './types';
import type { State } from './store';
import type { WireItem } from './syndicate';
import { hash, rand01 } from './util';

export type Post = {
  id: string;
  kind: 'spark' | 'forge';
  origin: 'original' | 'user' | 'wire' | 'seed';
  authorHandle: string;
  authorName: string;
  authorAvatar?: string;
  author?: User;
  org?: string;
  date: string;
  tags: string[];
  reactions: number;
  comments: number;
  reposts?: number;
  /* spark */
  text?: string;
  media?: { url: string; alt: string }[];
  link?: Spark['link'];
  poll?: Spark['poll'];
  quoteOf?: Spark['quoteOf'];
  longRef?: string;
  /* forge */
  title?: string;
  dek?: string;
  cover?: string;
  minutes?: number;
  blocks?: ArticleBlock[];
  markdown?: string;
  canonical?: string;
  path?: string;
  source?: { name: string; url: string };
  flare?: string;
  hot?: boolean;
  /* computed */
  heat?: HeatResult;
  heated?: HeatLevel;
  savedAt?: number;
  readPct?: number;
};

export type RankMode = 'heat' | 'new' | 'top' | 'contested';

/* ------------------------------------------------------------------ assembly */

function fromOriginals(): Post[] {
  return ORIGINALS.map((a) => {
    const u = getUser('heatt');
    return {
      id: a.id,
      kind: 'forge' as const,
      origin: 'original' as const,
      authorHandle: 'heatt',
      authorName: 'heatt Originals',
      authorAvatar: u.avatar,
      author: u,
      date: a.date,
      tags: a.tags,
      reactions: a.reactions ?? 0,
      comments: a.comments ?? 0,
      title: a.title,
      dek: a.dek,
      cover: a.cover,
      minutes: a.minutes,
      blocks: a.blocks,
      canonical: `#/${a.id}`,
      hot: a.hot,
      source: { name: 'heatt Originals', url: '#/originals' },
    } as Post;
  });
}

function fromUserArticles(s: State): Post[] {
  return (s.myArticles ?? []).map((a) => {
    const me = s.me ?? getUser('you');
    return {
      id: a.id,
      kind: 'forge',
      origin: 'user',
      authorHandle: me.handle,
      authorName: me.name,
      authorAvatar: me.avatar,
      author: me,
      date: a.date,
      tags: a.tags,
      reactions: 0,
      comments: 0,
      title: a.title,
      dek: a.dek,
      cover: a.cover,
      minutes: a.minutes,
      markdown: a.markdown,
      source: a.source,
    } as Post;
  });
}

function fromSparks(list: Spark[], s: State, origin: 'seed' | 'user'): Post[] {
  return list.map((p) => {
    const u = origin === 'user' ? (s.me ?? getUser(p.author)) : getUser(p.author);
    return {
      id: p.id,
      kind: 'spark',
      origin,
      authorHandle: p.author,
      authorName: u.name,
      authorAvatar: u.avatar,
      author: u,
      org: u.org,
      date: p.date,
      tags: p.tags ?? [],
      reactions: p.reactions ?? 0,
      comments: p.comments ?? 0,
      reposts: p.reposts ?? 0,
      text: p.text,
      media: p.media,
      link: p.link,
      poll: p.poll,
      quoteOf: p.quoteOf,
      longRef: p.longRef,
    } as Post;
  });
}

function fromWire(items: WireItem[], s: State): Post[] {
  return items.map((w) => {
    const seedUser = SEED_USERS.find((u) => u.handle === w.handle);
    return {
      id: w.id,
      kind: 'forge',
      origin: 'wire',
      authorHandle: w.handle,
      authorName: w.author,
      authorAvatar: w.avatar,
      author: seedUser,
      org: w.org,
      date: w.date,
      tags: w.tags,
      reactions: w.reactions,
      comments: w.comments,
      title: w.title,
      dek: w.dek,
      cover: w.cover,
      minutes: w.minutes,
      canonical: w.canonical,
      path: w.path,
      flare: w.flare,
      source: { name: 'Dev.to', url: w.canonical },
    } as Post;
  });
}

export function assemble(s: State, wire: WireItem[]): Post[] {
  const all = fromOriginals();
  /* Ids are React keys *and* the heat ledger's primary key, so a collision
     would silently merge two posts' heat. First occurrence wins. */
  const seen = new Set<string>();
  /* Muting an author removes them from every surface — the only honest
     version of "not interested". Muting a tag is handled in rank() as a
     demotion so you can still find it through search. */
  const blocked = new Set((s.muted ?? []).filter((m) => m.startsWith('@')).map((m) => m.slice(1)));
  const visible = blocked.size ? all.filter((p) => !blocked.has(p.authorHandle)) : all;
  const out: Post[] = [];
  for (const p of visible) {
    if (seen.has(p.id)) {
      let n = 2;
      while (seen.has(`${p.id}#${n}`)) n++;
      out.push({ ...p, id: `${p.id}#${n}` });
      seen.add(`${p.id}#${n}`);
      continue;
    }
    seen.add(p.id);
    out.push(p);
  }
  /* Heat is part of the post, not part of a ranking pass: cards, the share
     studio, related rows and the profile sort all read `posts` directly, and
     each of them used to re-derive (or guess) a temperature. */
  return out.map((p) => ({ ...p, heat: heatFor(p, s) }));
}

/* -------------------------------------------------------------------- ranking */

export function heatFor(p: Post, s: State): HeatResult {
  /* Callers pass partial views of the store (explore, profile, share studio),
     so every map lookup is guarded rather than assumed. */
  const saved = s.saved ?? {};
  const reads = s.reads ?? {};
  const shares = s.shares ?? {};
  const heat = s.heat ?? {};
  const counts = s.heatCounts ?? {};
  const crowd =
    p.reactions + (p.comments ?? 0) * 2 + (p.reposts ?? 0) * 3 + Object.keys(saved).length * 0.001;
  return computeHeat({
    reactions: p.reactions + (counts[p.id] ?? 0),
    comments: p.comments,
    reposts: p.reposts,
    saves: saved[p.id] ? 1 : 0,
    reads: reads[p.id]?.pct,
    mine: {
      level: heat[p.id]?.level ?? 0,
      at: heat[p.id]?.at,
      read: (reads[p.id]?.pct ?? 0) > 70,
      saved: !!saved[p.id],
      shared: shares[p.id] ?? 0,
    },
    date: p.date,
    thermalMass: p.author?.thermalMass ?? 1 + Math.log1p(crowd) / 14,
    seed: p.id,
  });
}

export type RankOpts = {
  mode: RankMode;
  tab: 'for-you' | 'sparks' | 'forges' | 'following' | 'library' | 'tag' | 'search';
  tag?: string;
  query?: string;
  handle?: string;
  followBoost?: boolean;
};

export function rank(posts: Post[], s: State, opts: RankOpts) {
  const now = Date.now();
  const scored = posts.map((p) => {
    // assemble() already attached heat (and recomputes it when any input map
    // changes), so ranking reuses it instead of re-deriving per render pass.
    const heat = p.heat ?? heatFor(p, s);
    let score = heat.score;
    // personalization: follow boost + interest affinity
    if (opts.followBoost && (s.follows ?? []).includes(p.authorHandle)) score *= 1.55;
    const aff = p.tags.filter((t) => (s.interests ?? []).includes(t)).length;
    if (aff) score *= 1 + aff * 0.12;
    const demoted = p.tags.filter((t) => (s.muted ?? []).includes(`#${t}`)).length;
    if (demoted) score *= 0.22;
    /* Your own fresh work stays findable. A feed where what you just published
       falls below the cliff reads as "my post is lost", so a new post gets a
       decaying additive boost in logit space for its first six hours, then it
       has to live on its heat like everyone else. */
    const mine = s.me?.handle && p.authorHandle === s.me.handle;
    if (mine) {
      const freshH = Math.max(0, (now - new Date(p.date).getTime()) / 3600_000);
      if (freshH < 6) score += 7 * (1 - freshH / 6);
    }
    if (opts.mode === 'new') score = heat.temp * 0.2 + Math.max(0, 60 - (now - new Date(p.date).getTime()) / (1000 * 60 * 60 * 24)) * 3;
    if (opts.mode === 'top') score = Math.log1p(p.reactions + ((s.heatCounts ?? {})[p.id] ?? 0)) * 2.4 + heat.score * 0.2;
    if (opts.mode === 'contested') {
      // contested = high velocity, low total — the fight is happening now
      score = heat.velocity * 3 - Math.log1p(heat.temp) * 0.6;
    }
    return { ...p, heat, heated: (s.heat ?? {})[p.id]?.level ?? 0, savedAt: (s.saved ?? {})[p.id], readPct: (s.reads ?? {})[p.id]?.pct ?? 0, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // --- semantic cliff truncation on the sorted logit curve --------------
  const logits = scored.map((x) => Math.log1p(Math.max(0, x.heat.temp)));
  const cliff = opts.tab === 'for-you' && opts.mode === 'heat' ? cliffIndex(logits) : logits.length;

  let list = scored;

  if (opts.tab === 'sparks') list = scored.filter((p) => p.kind === 'spark');
  else if (opts.tab === 'forges') list = scored.filter((p) => p.kind === 'forge');
  else if (opts.tab === 'following')
    list = scored.filter((p) => s.follows.includes(p.authorHandle) || p.authorHandle === s.me?.handle);
  else if (opts.tab === 'library')
    list = scored.filter((p) => s.saved[p.id] || (s.reads[p.id]?.pct ?? 0) > 0 || p.authorHandle === s.me?.handle);
  else if (opts.tab === 'tag' && opts.tag) list = scored.filter((p) => p.tags.includes(opts.tag!));
  else if (opts.tab === 'search' && opts.query) list = scored.filter((p) => matches(p, opts.query!));
  else if (opts.handle) list = scored.filter((p) => p.authorHandle === opts.handle);
  else list = list.slice(0, Math.max(6, Math.min(list.length, cliff + 8)));

  return { items: list, cliff, total: scored.length };
}

export function matches(p: Post, q: string) {
  const hay = `${p.title ?? ''} ${p.dek ?? ''} ${p.text ?? ''} ${p.tags.join(' ')} ${p.authorName} ${p.authorHandle}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((tok) => hay.includes(tok));
}

/* ------------------------------------------------------------------- explore */

export function trendingTags(posts: Post[], now = Date.now()) {
  const m = new Map<string, { tag: string; count: number; heat: number; delta: number }>();
  for (const p of posts) {
    const heat = p.heat ?? heatFor(p, {} as State);
    for (const t of p.tags) {
      const e = m.get(t) ?? { tag: t, count: 0, heat: 0, delta: 0 };
      e.count += 1;
      e.heat += heat.temp;
      const ageD = (now - new Date(p.date).getTime()) / 86400000;
      e.delta += ageD < 4 ? 1 : ageD < 10 ? 0.35 : 0.05;
      m.set(t, e);
    }
  }
  return [...m.values()]
    .map((e) => ({ ...e, heat: Math.round(e.heat), momentum: Math.round((e.delta / Math.max(1, e.count)) * 100) }))
    .sort((a, b) => b.heat - a.heat);
}

export function topAuthors(posts: Post[]) {
  const m = new Map<string, { handle: string; name: string; bio: string; heat: number; posts: number; mass: number; verified?: boolean; avatar?: string; traits?: string[] }>();
  for (const p of posts) {
    const u = p.author ?? getUser(p.authorHandle);
    const e =
      m.get(p.authorHandle) ??
      {
        handle: u.handle,
        name: u.name,
        bio: u.bio,
        heat: 0,
        posts: 0,
        mass: u.thermalMass,
        verified: u.verified,
        avatar: u.avatar,
        traits: u.traits,
      };
    e.heat += p.heat?.temp ?? heatFor(p, {} as State).temp;
    e.posts += 1;
    m.set(p.authorHandle, e);
  }
  return [...m.values()].sort((a, b) => b.heat * b.mass - a.heat * a.mass);
}

/* -------------------------------------------------- heat waveform per block */

/**
 * Deterministic crowd-heat curve for an article: each block gets a 0..1 value
 * derived from its type, position and the article's public reaction volume.
 * Real level-3 heats from this device are layered on top so your own
 * ignitions always show up on the spine.
 */
export function waveformFor(p: Post, s: State): number[] {
  const blocks = p.blocks?.length ?? Math.min(64, (p.markdown ?? '').split(/\n\s*\n/).length) ?? 12;
  const n = Math.max(6, blocks);
  const out: number[] = [];
  const seed = String(hash(p.id));
  for (let i = 0; i < n; i++) {
    const b = p.blocks?.[i];
    const typeW = b ? (b.t === 'code' ? 0.34 : b.t === 'quote' ? 0.72 : b.t === 'h' ? 0.3 : b.t === 'callout' ? 0.62 : b.t === 'links' ? 0.5 : 0.24) : 0.25;
    const pos = i / n;
    // crowd attention: U-curve (intro + payoff), spiked by reactions
    const shape = 0.28 + 0.9 * Math.pow(Math.abs(pos - 0.78), 1.6) + (pos > 0.86 ? 0.5 : 0);
    const base = Math.min(1, (typeW * 0.5 + shape * 0.65) * (0.7 + rand01(seed, i) * 0.7));
    out.push(Math.round(base * 100) / 100);
  }
  const mine = s.heat[`${p.id}:para`]?.level ?? 0;
  void mine;
  const total = p.reactions + (s.heatCounts[p.id] ?? 0);
  const amp = Math.min(1, 0.55 + Math.log1p(total) / 24);
  return out.map((v) => Math.max(0.04, Math.min(1, v * amp)));
}

/** stable key for paragraph-level heats */
export function paraKey(postId: string, i: number) {
  return `${postId}:p${i}`;
}

export function myParaHeats(s: State, postId: string): Record<number, HeatLevel> {
  const out: Record<number, HeatLevel> = {};
  for (const [k, v] of Object.entries(s.heat ?? {})) {
    if (k.startsWith(`${postId}:p`)) out[Number(k.slice(postId.length + 2))] = v.level;
  }
  return out;
}

/* --------------------------------------------------------------- digest fx */

export function dailyDigest(posts: Post[], s: State) {
  const ranked = posts.map((p) => ({ p, h: heatFor(p, s) })).sort((a, b) => b.h.temp - a.h.temp);
  const hottest = ranked[0];
  const cooling = ranked.filter((r) => r.h.velocity < 0.35).slice(0, 3);
  const contested = ranked.filter((r) => r.h.velocity > 1).slice(0, 3);
  const totalHeat = ranked.reduce((a, r) => a + r.h.temp, 0);
  return {
    hottest: hottest
      ? {
          id: hottest.p.id,
          title: hottest.p.title ?? hottest.p.text?.slice(0, 60) ?? '',
          temp: Math.round(hottest.h.temp),
          author: hottest.p.authorName,
          kind: hottest.p.kind,
          minutes: hottest.p.minutes,
        }
      : undefined,
    cooling: cooling.map((c) => ({ id: c.p.id, title: c.p.title ?? c.p.text?.slice(0, 40) ?? '' })),
    contested: contested.map((c) => ({ id: c.p.id, title: c.p.title ?? c.p.text?.slice(0, 40) ?? '' })),
    totalHeat: Math.round(totalHeat),
    items: ranked.length,
  };
}

export const WEIGHT_LEGEND = [
  { label: 'Ember (tap)', value: K.heatW[1] },
  { label: 'Blaze (hold)', value: K.heatW[2] },
  { label: 'Inferno (hold ×3)', value: K.heatW[3] },
  { label: 'Read-through', value: K.readW },
  { label: 'Library save', value: K.saveW },
  { label: 'Share', value: K.shareW },
];
