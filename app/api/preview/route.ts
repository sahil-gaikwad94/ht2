import { NextResponse } from 'next/server';

/* ============================================================================
   GET /api/preview?url=… — edge link-preview engine (spec §7.1)

   Fetches the target and parses ONLY the <head> byte-stream, aborting the
   connection the moment </head> is seen. That avoids downloading the <body>
   (often hundreds of KB) for a job that needs ~4 meta tags, keeping latency in
   the tens of milliseconds and memory flat.
   ==========================================================================*/

export const revalidate = 86400;

const MAX_HEAD_BYTES = 128_000; // safety cap for pathological pages

function pick(html: string, res: RegExp[]): string | undefined {
  for (const r of res) {
    const m = html.match(r);
    const v = m?.[1] ?? m?.[2];
    if (v && v.trim()) return decode(v.trim());
  }
  return undefined;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

function abs(u: string | undefined, base: string) {
  if (!u) return undefined;
  try {
    return new URL(u, base).toString();
  } catch {
    return undefined;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ ok: false, error: 'bad url' }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(6500),
      headers: {
        'user-agent': 'heattBot/1.0 (+https://heatt.app; link preview)',
        accept: 'text/html,application/xhtml+xml',
      },
      next: { revalidate: 86400 },
    });

    const controller = new AbortController();
    let head = '';
    let done = false;

    if (res.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder('utf-8', { fatal: false });
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        head += dec.decode(value, { stream: true });
        const close = head.search(/<\/head>/i);
        if (close > -1 || head.length > MAX_HEAD_BYTES) {
          done = true;
          await reader.cancel().catch(() => controller.abort());
        }
      }
    } else {
      head = (await res.text()).slice(0, MAX_HEAD_BYTES);
    }

    const title = pick(head, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ]);
    const desc = pick(head, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
      /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i,
    ]);
    const image = abs(
      pick(head, [
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
        /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
      ]),
      url
    );
    const site = pick(head, [
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i,
    ]);

    let favicon: string | undefined;
    const iconMatch = head.match(/<link[^>]+rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i);
    if (iconMatch) favicon = abs(iconMatch[1], url);

    const host = new URL(url).hostname.replace(/^www\./, '');

    return NextResponse.json(
      {
        ok: true,
        preview: {
          url,
          host: site ?? host,
          hostname: host,
          title,
          desc,
          image,
          favicon,
          truncated: head.length >= MAX_HEAD_BYTES,
        },
      },
      { headers: { 'cache-control': 's-maxage=86400, stale-while-revalidate=604800' } }
    );
  } catch (e) {
    const host = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch {
        return url;
      }
    })();
    return NextResponse.json(
      { ok: false, preview: { url, host, hostname: host, title: host }, error: (e as Error).message },
      { status: 200, headers: { 'cache-control': 'no-store' } }
    );
  }
}
