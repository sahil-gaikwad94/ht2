'use client';
/* ============================================================================
   components/cards/LinkPreview — edge-rendered Open Graph card (spec §7)

   The client asks /api/preview, which streams only the target's <head> and
   aborts before the body downloads. While that resolves we render a skeleton
   from whatever the post author typed, so the card never reflows.
   ==========================================================================*/

import * as React from 'react';
import { motion } from 'framer-motion';

export type SeedLink = { url: string; title?: string; site?: string; desc?: string; image?: string };

export function LinkPreview({ url, seed }: { url: string; seed?: SeedLink }) {
  const [data, setData] = React.useState<null | (SeedLink & { hostname?: string; favicon?: string })>(
    seed ? { ...seed } : null
  );
  const [state, setState] = React.useState<'loading' | 'ok' | 'off'>('loading');
  const [imgOk, setImgOk] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState('loading');
    fetch(`/api/preview?url=${encodeURIComponent(url)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (!alive) return;
        if (j?.preview) {
          setData({
            url,
            title: j.preview.title ?? seed?.title,
            desc: j.preview.desc ?? seed?.desc,
            image: j.preview.image ?? seed?.image,
            site: j.preview.host ?? seed?.site,
            hostname: j.preview.hostname,
            favicon: j.preview.favicon,
          });
          setState(j.preview.title ? 'ok' : 'off');
        } else setState('off');
      })
      .catch(() => alive && setState('off'));
    return () => {
      alive = false;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const host = data?.hostname ?? url.replace(/^https?:\/\//, '').split('/')[0];
  const stateLabel = state === 'loading' ? 'checking source' : state === 'ok' ? 'preview · open original' : 'external source';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer ugc"
      onClick={(e) => {
        // heatt keeps the user in-app: previews open our in-app reader shell
        if (!data?.title) return;
        e.preventDefault();
        window.open(url, '_blank', 'noopener,noreferrer');
      }}
      className="mt-3 block overflow-hidden rounded-[16px] border border-white/[.08] bg-black/35 transition-all hover:border-ember-500/45 hover:bg-black/50"
    >
      {data?.image && imgOk ? (
        <div className="relative">
          <img
            src={data.image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgOk(false)}
            className="aspect-[16/7.4] w-full object-cover"
            style={{ filter: 'saturate(1.05)' }}
          />
          <span aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg,transparent 45%,rgba(6,6,7,.75))' }} />
        </div>
      ) : (
        <div
          className="relative flex aspect-[16/6] w-full items-end p-3"
          style={{ background: 'radial-gradient(80% 120% at 10% 110%, rgba(255,180,84,.16), transparent 62%), linear-gradient(140deg,#151a15,#0b0e0b)' }}
        >
          {state === 'loading' && (
            <motion.span
              aria-hidden
              className="absolute inset-0"
              style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)', backgroundSize: '200% 100%' }}
              animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </div>
      )}
      <div className="flex items-start gap-2.5 p-3">
        {data?.favicon ? (
          <img src={data.favicon} alt="" width={16} height={16} className="mt-[3px] rounded-[4px]" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
        ) : (
          <span className="mt-[3px] grid h-4 w-4 place-items-center rounded-[4px] border border-white/10 text-[8px] font-black text-ink-mute">{host[0]?.toUpperCase()}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 truncate text-[11px] uppercase tracking-[0.14em] text-ink-mute">
            <span className="truncate">{data?.site ?? host}</span>
            <span className="shrink-0 rounded-full border border-white/[.08] px-1.5 py-0.5 text-[8px] tracking-[0.12em] text-ink-faint">{stateLabel}</span>
          </div>
          <div className="mt-0.5 line-clamp-2 text-[14px] font-semibold leading-snug text-ink">
            {data?.title ?? (state === 'loading' ? 'Loading preview…' : host)}
          </div>
          {data?.desc && <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-dim">{data.desc}</p>}
        </div>
      </div>
    </a>
  );
}
