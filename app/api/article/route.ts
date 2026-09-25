import { NextResponse } from 'next/server';

/* ============================================================================
   GET /api/article?id=4652133 — on-demand body proxy for the in-app reader.

   Returns the article's Markdown (plus attribution metadata) so heatt can
   render the full piece natively: no redirect to the publisher, images and
   links intact. Bodies are never persisted server-side; the client keeps an
   ephemeral 24h cache that a user can clear in one action.
   ==========================================================================*/

export const revalidate = 3600;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  }
  try {
    const r = await fetch(`https://dev.to/api/articles/${id}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
      headers: { accept: 'application/json' },
    });
    if (!r.ok) throw new Error(`forem ${r.status}`);
    const a = await r.json();
    return NextResponse.json(
      {
        ok: true,
        article: {
          id: a.id,
          title: a.title,
          markdown: a.body_markdown ?? '',
          html: a.body_html ?? '',
          date: a.published_at,
          tags: a.tag_list ?? [],
          minutes: a.reading_time_minutes,
          reactions: a.public_reactions_count,
          comments: a.comments_count,
          cover: a.cover_image,
          canonical: a.canonical_url,
          path: a.path,
          author: {
            name: a.user?.name,
            handle: a.user?.username,
            avatar: a.user?.profile_image_90,
            website: a.user?.website_url,
          },
          org: a.organization?.name,
          flare: a.flare_tag?.name,
          description: a.description,
        },
      },
      { headers: { 'cache-control': 's-maxage=3600, stale-while-revalidate=86400' } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, id: Number(id) },
      { status: 502, headers: { 'cache-control': 'no-store' } }
    );
  }
}
