'use client';
/* ============================================================================
   /read/[id] — deep-linkable reader. The same ArticleReader the overlay uses,
   mounted as a page so a shared URL opens straight into the text.
   ==========================================================================*/

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '@/lib/app';
import { ArticleReader } from '@/components/reader/Reader';
import { ORIGINALS } from '@/lib/seed/articles';
import { getUser } from '@/lib/seed/users';
import type { Post } from '@/lib/feed';
import { heatFor } from '@/lib/feed';
import { useStore } from '@/lib/store';

export default function ReadPage() {
  const params = useParams<{ id: string }>();
  const app = useApp();
  const router = useRouter();
  const s = useStore();
  const id = decodeURIComponent(params?.id ?? '');

  const post = React.useMemo<Post | null>(() => {
    const found = app.posts.find((p) => p.id === id);
    if (found) return { ...found, heat: found.heat ?? heatFor(found, s as any) };
    const o = ORIGINALS.find((a) => a.id === id);
    if (o) {
      const u = getUser('heatt');
      return {
        id: o.id,
        kind: 'forge',
        origin: 'original',
        authorHandle: 'heatt',
        authorName: 'heatt Originals',
        authorAvatar: u.avatar,
        author: u,
        date: o.date,
        tags: o.tags,
        reactions: o.reactions ?? 0,
        comments: o.comments ?? 0,
        title: o.title,
        dek: o.dek,
        cover: o.cover,
        minutes: o.minutes,
        blocks: o.blocks,
        heat: heatFor({ id: o.id, reactions: o.reactions ?? 0, comments: o.comments ?? 0, date: o.date, author: u } as any, s as any),
      } as Post;
    }
    return null;
  }, [id, app.posts, s]);

  React.useEffect(() => {
    if (!post) router.replace('/feed');
  }, [post, router]);

  if (!post) return null;
  return (
    <ArticleReader
      post={post}
      onClose={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back();
        else router.replace('/feed');
      }}
    />
  );
}
