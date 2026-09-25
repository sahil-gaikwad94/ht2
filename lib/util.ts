import type { HeatLevel, User } from './types';

/* ============================================================================
   heatt — formatting + deterministic visual identity helpers
   ==========================================================================*/

export function timeAgo(iso: string | number, now = Date.now()): string {
  const t = typeof iso === 'number' ? iso : new Date(iso).getTime();
  const s = Math.max(1, Math.floor((now - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function prettyDate(iso: string | number): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function compact(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 100_000 ? 1 : 0)}K`.replace('.0K', 'K');
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export const HEAT_VERB: Record<HeatLevel, string> = {
  0: 'heat',
  1: 'heated',
  2: 'blazing',
  3: 'ignited',
};

/** Deterministic 0..2^32 hash */
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rand01(str: string, salt = 0): number {
  const h = hash(`${salt}:${str}`);
  return (h % 100000) / 100000;
}

export function initialsOf(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/);
  if (!parts[0]) return 'he';
  if (parts.length === 1) return parts[0].slice(0, 2).toLowerCase();
  return (parts[0][0] + parts[1][0]).toLowerCase();
}

/**
 * Procedural heat avatar: a deterministic molten gradient + initials, encoded
 * as an inline SVG. Guarantees the app never shows a broken avatar — including
 * offline, and for syndicated authors whose CDN image fails.
 */
export function avatarDataUri(name: string, handle = name): string {
  const h = hash(handle);
  const c = ((h >> 16) % 90) + 12;
  /* Three hue families, all warm-metal or cold-metal: molten amber, ice steel,
     and a rare plasma violet. Green is deliberately absent — the app has no
     green anywhere, so a generated identity must not smuggle one in. */
  const fam = h % 6;
  const hue = fam === 0 ? 194 + (h % 20) : fam === 1 ? 258 + (h % 18) : 20 + (h % 24);
  const bg = `hsl(${hue} 28% ${4 + (h % 4)}%)`;
  const g1 = `hsl(${hue + 8} 74% ${48 + (h % 14)}%)`;
  const g2 = `hsl(${hue - 14} 66% ${32 + (c % 12)}%)`;
  const rot = (h >> 5) % 360;
  const initials = initialsOf(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
<defs>
<linearGradient id="g" gradientTransform="rotate(${rot} .5 .5)">
<stop offset="0" stop-color="${g1}"/><stop offset=".55" stop-color="${g2}"/><stop offset="1" stop-color="#1A0E02"/>
</linearGradient>
<radialGradient id="r" cx=".5" cy=".15" r=".9">
<stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
</radialGradient>
<filter id="b"><feGaussianBlur stdDeviation="14"/></filter>
</defs>
<rect width="160" height="160" fill="${bg}"/>
<g filter="url(#b)" opacity=".92"><circle cx="${30 + (h % 90)}" cy="${120 + (c % 30)}" r="46" fill="${g1}" opacity=".75"/></g>
<rect width="160" height="160" fill="url(#g)" opacity=".55"/>
<rect width="160" height="160" fill="url(#r)"/>
<text x="80" y="80" text-anchor="middle" dominant-baseline="central"
 font-family="Inter,system-ui,sans-serif" font-size="62" font-weight="700"
 letter-spacing="-3" fill="#1A0E02" opacity=".92">${initials}</text>
<text x="80" y="80" text-anchor="middle" dominant-baseline="central"
 font-family="Inter,system-ui,sans-serif" font-size="62" font-weight="700"
 letter-spacing="-3" fill="#fff" opacity=".16" transform="translate(0 -2)">${initials}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Procedural cover: molten mesh gradient, deterministic per handle/id. */
export function coverDataUri(seed: string): string {
  const h = hash(seed);
  const blobs = Array.from({ length: 5 }, (_, i) => {
    const x = (hash(`${seed}x${i}`) % 1000) / 10;
    const y = (hash(`${seed}y${i}`) % 1000) / 10;
    const r = 24 + ((hash(`${seed}r${i}`) % 400) / 10);
    /* molten amber for most blobs, ice cyan for the rest — the same two-tone
       thermal system the profile covers use. */
    const hue = i % 3 === 2 ? 190 + ((h >> i) % 22) : 16 + ((h >> i) % 32);
    return `<circle cx="${x}%" cy="${y}%" r="${r}%" fill="hsl(${hue} 86% ${14 + (i * 7) % 28}%)" opacity=".82"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">
<defs><filter id="bl"><feGaussianBlur stdDeviation="70"/></filter>
<linearGradient id="v" x1="0" x2="0" y1="0" y2="1">
<stop offset="0" stop-color="#050505" stop-opacity=".1"/><stop offset="1" stop-color="#000000" stop-opacity=".95"/>
</linearGradient></defs>
<rect width="1200" height="400" fill="#0a0a0a"/>
<g filter="url(#bl)">${blobs}</g>
<rect width="1200" height="400" fill="url(#v)"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function userAvatar(u?: Pick<User, 'name' | 'handle'> & { avatar?: string }): string {
  if (u?.avatar) return u.avatar;
  return avatarDataUri(u?.name ?? 'heatt', u?.handle ?? 'heatt');
}

export function cls(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function uid(prefix = 'ht') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** strip markdown syntax for previews without importing a parser */
export function plain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function readMinutes(words: number) {
  return Math.max(1, Math.round(words / 225));
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
