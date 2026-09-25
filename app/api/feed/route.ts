import { NextResponse } from 'next/server';

/* ============================================================================
   GET /api/feed — zero-cost syndication engine (spec §6 + §9.2)

   Pulls free, public long-form articles from the Forem (Dev.to) REST API and
   normalises them into heatt "wire" items. The list endpoint intentionally
   omits bodies (we never store third-party text) — the reader fetches a body
   per view and renders it natively.

   Everything is cached with stale-while-revalidate so the CDN absorbs reads
   and the origin is hit once per revalidate window.
   ==========================================================================*/

export const revalidate = 600;
export const dynamic = 'force-dynamic'; // keep ISR semantics via revalidate, no full static

const SWR = 's-maxage=600, stale-while-revalidate=86400';

type ForemArticle = {
  id: number;
  title: string;
  description?: string;
  slug?: string;
  path?: string;
  url?: string;
  canonical_url?: string;
  published_at?: string;
  reading_time_minutes?: number;
  positive_reactions_count?: number;
  public_reactions_count?: number;
  comments_count?: number;
  tag_list?: string[];
  tags?: string;
  cover_image?: string;
  social_image?: string;
  user?: { name?: string; username?: string; profile_image_90?: string; website_url?: string };
  organization?: { name?: string; username?: string; profile_image_90?: string };
  flare_tag?: { name?: string };
};

const BOARDS: { key: string; params: Record<string, string> }[] = [
  { key: 'top', params: { per_page: '20', top: '3' } },
  { key: 'latest', params: { per_page: '20' } },
  { key: 'webdev', params: { per_page: '12', tag: 'webdev' } },
  { key: 'design', params: { per_page: '10', tag: 'design' } },
  { key: 'ai', params: { per_page: '10', tag: 'ai' } },
  { key: 'programming', params: { per_page: '10', tag: 'programming' } },
];

function norm(a: ForemArticle, board: string) {
  const u = a.user ?? {};
  return {
    board,
    id: a.id,
    title: (a.title ?? 'Untitled').trim(),
    excerpt: (a.description ?? '').trim(),
    handle: u.username ?? 'dev',
    author: u.name ?? u.username ?? 'Author',
    org: a.organization?.name,
    avatar: u.profile_image_90,
    path: a.path ?? `/${u.username}/${a.slug}`,
    canonical: a.canonical_url ?? `https://dev.to${a.path ?? ''}`,
    date: a.published_at ?? new Date().toISOString(),
    minutes: a.reading_time_minutes ?? 4,
    reactions: a.positive_reactions_count ?? a.public_reactions_count ?? 0,
    comments: a.comments_count ?? 0,
    tags: a.tag_list ?? (a.tags ? a.tags.split(',').map((t) => t.trim()) : []),
    cover: a.cover_image ?? a.social_image,
    flare: a.flare_tag?.name,
  };
}

async function grab(params: Record<string, string>) {
  const url = new URL('https://dev.to/api/articles');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url.toString(), {
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(7000),
    headers: { accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`forem ${r.status}`);
  return (await r.json()) as ForemArticle[];
}

export async function GET() {
  const results = await Promise.allSettled(BOARDS.map((b) => grab(b.params).then((rows) => rows.map((r) => norm(r, b.key)))));
  const merged: ReturnType<typeof norm>[] = [];
  const seen = new Set<number>();
  for (const res of results) {
    if (res.status === 'fulfilled') {
      for (const item of res.value) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        merged.push(item);
      }
    }
  }
  const anyOk = merged.length > 0;
  return NextResponse.json(
    {
      ok: anyOk,
      at: Date.now(),
      source: anyOk ? 'forem' : 'unreachable',
      items: merged,
    },
    { headers: { 'cache-control': SWR, 'x-heatt-origin': anyOk ? 'forem' : 'offline' } }
  );
}
