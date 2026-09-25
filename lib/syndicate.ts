'use client';
/* ============================================================================
   lib/syndicate — the client side of the zero-cost content pipeline.

   Resolution order for the wire feed:
     1. /api/feed (server, CDN-cached, SWR)
     2. direct Dev.to fetch from the browser (works when the API sends CORS)
     3. bundled snapshot (lib/seed/syndicated) — the app is never empty
   Article bodies resolve: client cache (24h) → /api/article → direct API →
   a designed offline state with attribution, never a redirect.
   ==========================================================================*/

import { SYNDICATED, type SyndicatedMeta } from './seed/syndicated';

export type WireItem = {
  id: string; // "dev-4652133"
  kind: 'forge';
  title: string;
  dek: string;
  author: string; // display name
  handle: string;
  org?: string;
  tags: string[];
  cover?: string;
  avatar?: string;
  date: string;
  minutes: number;
  reactions: number;
  comments: number;
  canonical: string;
  path: string;
  board: string;
  flare?: string;
  source: 'forem' | 'snapshot';
};

const WIRE_KEY = 'heatt-wire-v1';
const WIRE_TTL = 5 * 60 * 1000;
const BODY_KEY = 'heatt-bodies-v1';
const BODY_TTL = 24 * 60 * 60 * 1000;

function toWire(
  raw: {
    id: number;
    title: string;
    excerpt?: string;
    handle: string;
    author: string;
    org?: string;
    path: string;
    canonical: string;
    date: string;
    minutes?: number;
    reactions?: number;
    comments?: number;
    tags?: string[];
    cover?: string;
    avatar?: string;
    board?: string;
    flare?: string;
  },
  source: 'forem' | 'snapshot'
): WireItem {
  const canonical = /^https?:/.test(String(raw.canonical ?? ''))
    ? raw.canonical
    : `https://dev.to${raw.path ?? ''}`;
  return {
    id: `dev-${raw.id}`,
    kind: 'forge',
    title: raw.title ?? 'Untitled',
    dek: (raw.excerpt ?? '').replace(/\s+/g, ' ').trim(),
    author: raw.author ?? raw.handle,
    handle: raw.handle ?? 'dev',
    org: raw.org,
    tags: (raw.tags ?? []).filter(Boolean),
    cover: raw.cover,
    avatar: raw.avatar,
    date: raw.date,
    minutes: raw.minutes ?? 4,
    reactions: raw.reactions ?? 0,
    comments: raw.comments ?? 0,
    canonical,
    path: raw.path ?? '',
    board: raw.board ?? 'latest',
    flare: raw.flare,
    source,
  };
}

function snapshotItems(): WireItem[] {
  return SYNDICATED.map((s: SyndicatedMeta) =>
    toWire(
      {
        id: s.id,
        title: s.title,
        excerpt: s.excerpt,
        handle: s.handle,
        author: s.author,
        org: s.org,
        path: s.path,
        canonical: s.canonical,
        date: s.date,
        minutes: s.minutes,
        reactions: s.reactions,
        comments: s.comments,
        tags: s.tags,
        cover: s.cover,
        avatar: s.avatar,
        board: 'top',
        flare: s.flare,
      },
      'snapshot'
    )
  );
}

/** Mirrors app/api/feed BOARDS so the wire still has shape when the proxy is unreachable. */
const DIRECT_BOARDS: { key: string; qs: string }[] = [
  { key: 'top', qs: 'per_page=16&top=3' },
  { key: 'latest', qs: 'per_page=16' },
  { key: 'webdev', qs: 'per_page=10&tag=webdev' },
  { key: 'design', qs: 'per_page=8&tag=design' },
  { key: 'ai', qs: 'per_page=8&tag=ai' },
  { key: 'programming', qs: 'per_page=8&tag=programming' },
];

async function directForem(): Promise<WireItem[] | null> {
  try {
    const settled = await Promise.allSettled(
      DIRECT_BOARDS.map((b) =>
        fetch(`https://dev.to/api/articles?${b.qs}`, { signal: AbortSignal.timeout(6000) })
          .then((r) => (r.ok ? r.json() : []))
          .then((rows) => ({ board: b.key, rows }))
      )
    );
    const seen = new Set<string>();
    const flat: any[] = [];
    for (const res of settled) {
      if (res.status !== 'fulfilled' || !Array.isArray(res.value.rows)) continue;
      for (const a of res.value.rows) {
        const key = String(a.id ?? a.title);
        if (seen.has(key)) continue;
        seen.add(key);
        flat.push({ a, board: res.value.board });
      }
    }
    if (!flat.length) return null;
    return flat.map(({ a, board }) =>
      toWire(
        {
          id: a.id,
          title: a.title,
          excerpt: a.description,
          handle: a.user?.username,
          author: a.user?.name,
          org: a.organization?.name,
          path: a.path,
          canonical: a.canonical_url,
          date: a.published_at,
          minutes: a.reading_time_minutes,
          reactions: a.positive_reactions_count,
          comments: a.comments_count,
          tags: a.tag_list ?? [],
          cover: a.cover_image,
          avatar: a.user?.profile_image_90,
          board,
          flare: a.flare_tag?.name,
        },
        'forem'
      )
    );
  } catch {
    return null;
  }
}

export async function loadWire(force = false): Promise<{ items: WireItem[]; live: boolean; at: number }> {
  if (typeof window === 'undefined') return { items: snapshotItems(), live: false, at: Date.now() };

  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(WIRE_KEY) || 'null');
      if (cached?.items?.length && Date.now() - cached.at < WIRE_TTL) {
        return { items: cached.items, live: cached.live, at: cached.at };
      }
    } catch {/* fall through */}
  }

  let items: WireItem[] | null = null;
  let live = false;
  try {
    const r = await fetch('/api/feed', { signal: AbortSignal.timeout(9000) });
    if (r.ok) {
      const j = await r.json();
      if (j?.ok && Array.isArray(j.items) && j.items.length) {
        items = j.items.map((x: any) => toWire(x, 'forem'));
        live = true;
      }
    }
  } catch {/* try browser-direct */}

  if (!items) {
    items = await directForem();
    live = !!items?.length;
  }

  if (!items?.length) {
    // keep whatever cached wire we have, else bundled snapshot
    try {
      const cached = JSON.parse(localStorage.getItem(WIRE_KEY) || 'null');
      if (cached?.items?.length) return { items: cached.items, live: false, at: cached.at };
    } catch {/* noop */}
    return { items: snapshotItems(), live: false, at: Date.now() };
  }

  // always merge snapshot items that are missing (guarantees seed variety)
  const ids = new Set(items.map((i) => i.id));
  const merged = [...items, ...snapshotItems().filter((s) => !ids.has(s.id))];
  try {
    localStorage.setItem(WIRE_KEY, JSON.stringify({ items: merged, live, at: Date.now() }));
  } catch {/* quota */}
  return { items: merged, live, at: Date.now() };
}

/* ------------------------------------------------------------------ bodies */

type BodyCache = Record<string, { markdown: string; at: number; title: string; author?: string }>;

function readBodies(): BodyCache {
  try {
    return JSON.parse(localStorage.getItem(BODY_KEY) || '{}');
  } catch {
    return {};
  }
}

export function clearBodies() {
  try {
    localStorage.removeItem(BODY_KEY);
  } catch {/* noop */}
}

export function bodyCacheSize() {
  return Object.keys(readBodies()).length;
}

export type ArticleBody = {
  ok: boolean;
  markdown?: string;
  title?: string;
  author?: { name: string; handle: string; avatar?: string; website?: string };
  org?: string;
  canonical?: string;
  date?: string;
  tags?: string[];
  minutes?: number;
  cover?: string;
  offline?: boolean;
};

export async function fetchBody(devId: string, fallback?: WireItem): Promise<ArticleBody> {
  const id = devId.replace(/^dev-/, '');
  const cache = readBodies();
  const hit = cache[id];
  if (hit && Date.now() - hit.at < BODY_TTL && hit.markdown) {
    return { ok: true, markdown: hit.markdown, title: hit.title, offline: false };
  }

  const tryUrls = [`/api/article?id=${id}`, `https://dev.to/api/articles/${id}`];
  for (const u of tryUrls) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const j = await r.json();
      const a = j.article ?? j; // server route wraps, direct API does not
      const markdown: string = a.body_markdown ?? a.markdown ?? '';
      if (!markdown) continue;
      cache[id] = { markdown, at: Date.now(), title: a.title };
      try {
        localStorage.setItem(BODY_KEY, JSON.stringify(cache));
      } catch {/* quota */}
      return {
        ok: true,
        markdown,
        title: a.title,
        author: a.user
          ? { name: a.user.name, handle: a.user.username, avatar: a.user.profile_image_90, website: a.user.website_url }
          : a.author
            ? { name: a.author.name, handle: a.author.handle, avatar: a.author.avatar, website: a.author.website }
            : undefined,
        org: a.organization?.name ?? a.org,
        canonical: a.canonical_url ?? a.canonical ?? fallback?.canonical,
        date: a.published_at ?? a.date,
        tags: a.tag_list ?? a.tags ?? [],
        minutes: a.reading_time_minutes ?? a.minutes,
        cover: a.cover_image ?? a.cover,
      };
    } catch {/* next candidate */}
  }

  return {
    ok: false,
    offline: true,
    markdown: undefined,
    title: fallback?.title,
    canonical: fallback?.canonical,
    date: fallback?.date,
    tags: fallback?.tags,
    minutes: fallback?.minutes,
    cover: fallback?.cover,
    author: fallback ? { name: fallback.author, handle: fallback.handle, avatar: fallback.avatar } : undefined,
    org: fallback?.org,
  };
}
