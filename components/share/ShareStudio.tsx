'use client';
/* ============================================================================
   components/share/ShareStudio — stories.

   A share that behaves like the ones Apple Music and Medium ship: a full-screen
   story you step through — cover, the line worth reading out loud, signature —
   with segmented progress, tap/hold, and a glass action row. The frames are
   drawn on canvas at real export resolution (1080×1920 story, 1080×1080 feed,
   1200×675 link card) so what you preview is exactly the PNG you post.

   Export: download PNG, copy to clipboard, native share sheet (Web Share
   Level 2 with a File), or copy the deep link.
   ==========================================================================*/

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@/components/ui/primitives';
import { useApp } from '@/lib/app';
import { useStore } from '@/lib/store';
import { avatarDataUri, cls, compact, plain } from '@/lib/util';

/* A story is three frames, always. */
const SLIDES = ['Cover', 'The line', 'Signature'] as const;

type Fmt = 'story' | 'square' | 'card';
const DIMS: Record<Fmt, [number, number]> = { story: [1080, 1920], square: [1080, 1080], card: [1200, 675] };
type Palette = 'ember' | 'cryo' | 'mono' | 'ash';
const PAL: Record<Palette, { a: string; b: string; c: string; text: string; sub: string }> = {
  ember: { a: '#D6F3E8', b: '#8EDDD0', c: '#F0DFA5', text: '#FCFBF5', sub: 'rgba(238,247,242,.72)' },
  cryo: { a: '#C9D6FF', b: '#8D91E8', c: '#BFF5EB', text: '#F5F6FF', sub: 'rgba(231,234,255,.7)' },
  mono: { a: '#6E7A86', b: '#AEB8C3', c: '#F3F4F0', text: '#FFFFFF', sub: 'rgba(255,255,255,.62)' },
  ash: { a: '#F2D9B0', b: '#CA9F78', c: '#F9EED4', text: '#FFF8ED', sub: 'rgba(255,246,232,.68)' },
};

export function ShareStudio() {
  const app = useApp();
  const s = useStore();
  const id = app.shareId;
  const open = !!id;
  const isYear = id === 'year';
  const isProfile = !!id && id.startsWith('profile:');
  const profHandle = isProfile ? id.slice('profile:'.length) : null;
  const post = id && !isYear && !isProfile ? app.posts.find((p) => p.id === id) : null;
  const [fmt, setFmt] = React.useState<Fmt>('story');
  const [pal, setPal] = React.useState<Palette>('ember');
  const [showCover, setShowCover] = React.useState(true);
  const [autoPal, setAutoPal] = React.useState(true);
  const [slide, setSlide] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  /* The Modal mounts its children a frame after `open` flips, so an effect that
     depends only on `open` would run against a null canvas and never repaint —
     a silently blank poster. Attaching the node is what triggers the first draw. */
  const [canvasReady, setCanvasReady] = React.useState(false);
  const attachCanvas = React.useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    setCanvasReady((v) => (v === !!el ? v : !!el));
  }, []);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [reaction, setReaction] = React.useState<'Resonated' | 'Challenged' | 'Useful' | 'Revisit'>('Resonated');
  const [shareNote, setShareNote] = React.useState('');

  // The palette can follow the piece's own standing (how much it has been
  // liked and shared) instead of being picked by hand.
  const act = s.activity;
  const yearHeats = Object.values(act).reduce((a, d) => a + d.heats, 0);
  const yearIgnites = Object.values(act).reduce((a, d) => a + d.ignites, 0);
  const warmth = isProfile
    ? Math.min(96, 26 + yearHeats * 0.5 + yearIgnites * 2 + app.streak.current * 4)
    : isYear
      ? Math.min(96, 30 + yearHeats * 0.35 + app.streak.current * 3)
      : post?.heat?.temp ?? 42;
  const effectivePal: Palette = autoPal ? (warmth > 34 ? 'ember' : warmth > 14 ? 'ash' : 'cryo') : pal;

  React.useEffect(() => {
    if (!open || !canvasReady) return;
    void draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canvasReady, fmt, effectivePal, showCover, slide, id, reaction, shareNote]);

  /* story playback: one frame every 7s, paused while the user is deciding */
  React.useEffect(() => {
    if (!open) return;
    setSlide(0);
    setProgress(0);
    setPaused(false);
    setReaction('Resonated');
    setShareNote('');
  }, [open, id]);

  React.useEffect(() => {
    if (!open || paused) return;
    const t0 = Date.now();
    const id_ = window.setInterval(() => {
      const v = (Date.now() - t0) / 7000;
      setProgress(Math.min(1, v));
      if (v >= 1) {
        setProgress(0);
        setSlide((n) => (n + 1) % SLIDES.length);
      }
    }, 80);
    return () => window.clearInterval(id_);
  }, [open, paused, slide]);

  const next = React.useCallback(() => setSlide((n) => (n + 1) % SLIDES.length), []);
  const prev = React.useCallback(() => setSlide((n) => (n - 1 + SLIDES.length) % SLIDES.length), []);

  async function draw() {
    const [W, H] = DIMS[fmt];
    const c = canvasRef.current;
    if (!c || !id) return;
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const p = PAL[effectivePal];

    // wait for variable fonts so the poster uses the real type, not a fallback
    try {
      await Promise.all([
        document.fonts.load('700 96px "Bricolage Grotesque Variable"'),
        document.fonts.load('400 40px "Newsreader Variable"'),
        document.fonts.load('800 26px "Inter Variable"'),
        document.fonts.ready,
      ]);
    } catch {/* fonts may be mid-load; carry on */}

    /* ---------------------------------------------------------- background */
    ctx.fillStyle = '#070B10';
    ctx.fillRect(0, 0, W, H);

    // layered editorial field: soft mint/lilac light behind the reading object
    const seedNum = [...(id ?? '')].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    const blobs = 4;
    for (let i = 0; i < blobs; i++) {
      const t = (seedNum * (i + 3)) % 100;
      const x = W * (0.08 + ((t * 7.3) % 84) / 100);
      const y = fmt === 'card' ? H * (0.2 + ((t * 3.1) % 60) / 100) : H * (0.52 + ((t * 2.7) % 40) / 100);
      const r = (fmt === 'card' ? 0.5 : 0.72) * Math.min(W, H) * (0.42 + ((t * 1.7) % 46) / 100);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const col = i % 3 === 0 ? p.a : i % 3 === 1 ? p.b : p.c;
      g.addColorStop(0, hexA(col, 0.4));
      g.addColorStop(0.45, hexA(col, 0.12));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // heat haze at the base + top scrim for legibility
    const base = ctx.createLinearGradient(0, H * 0.55, 0, H);
    base.addColorStop(0, 'rgba(0,0,0,0)');
    base.addColorStop(1, hexA(p.a, 0.28));
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    const scrim = ctx.createLinearGradient(0, 0, 0, H * 0.6);
    scrim.addColorStop(0, 'rgba(3,8,12,.92)');
    scrim.addColorStop(1, 'rgba(3,8,12,0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, H * 0.6);

    // sparse light flecks, used as atmosphere rather than decoration
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 90; i++) {
      const x = ((seedNum * (i + 11) * 37) % W) as number;
      const y = ((seedNum * (i + 5) * 71) % H) as number;
      const r = 1 + ((i * 7) % 5) * 0.9;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
      g.addColorStop(0, hexA(p.c, 0.9));
      g.addColorStop(1, hexA(p.b, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // fine grain
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `rgba(222,247,240,${Math.random() * 0.035})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);
    }

    /* ------------------------------------------------------------- content */
    const pad = fmt === 'card' ? 56 : 72;
    const innerW = W - pad * 2;
    let y = pad;

    // lockup
    drawLockup(ctx, pad, y + 10, p, fmt === 'card' ? 26 : 34);
    y += fmt === 'card' ? 62 : 88;

    const data = payload();

    // a small honest chip — what it is and how long it takes
    const chipTxt = data.chip.toUpperCase();
    ctx.font = `800 ${fmt === 'card' ? 20 : 26}px "Inter Variable", sans-serif`;
    const cw = ctx.measureText(chipTxt).width + 44;
    roundRect(ctx, pad, y, cw, fmt === 'card' ? 40 : 54, 999);
    ctx.fillStyle = hexA(p.b, 0.2);
    ctx.fill();
    ctx.strokeStyle = hexA(p.c, 0.6);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = p.text;
    ctx.textBaseline = 'middle';
    ctx.fillText(chipTxt, pad + 24, y + (fmt === 'card' ? 21 : 28));
    ctx.textBaseline = 'alphabetic';
    y += (fmt === 'card' ? 40 : 54) + 30;

    if (slide === 0) {
      /* frame one — the cover */
      if (showCover && data.cover && fmt !== 'card') {
        try {
          const img = await loadImg(data.cover);
          const ch = fmt === 'story' ? H * 0.3 : H * 0.32;
          ctx.save();
          roundRect(ctx, pad, y, innerW, ch, 28);
          ctx.clip();
          drawCover(ctx, img, pad, y, innerW, ch);
          ctx.restore();
          ctx.strokeStyle = 'rgba(255,255,255,.14)';
          ctx.lineWidth = 2;
          roundRect(ctx, pad, y, innerW, ch, 28);
          ctx.stroke();
          y += ch + 34;
        } catch {
          /* cross-origin or 404: fall through, the frame still reads */
        }
      }

      if (!data.cover && fmt !== 'card') {
        const artH = fmt === 'story' ? H * 0.24 : H * 0.28;
        ctx.save();
        roundRect(ctx, pad, y, innerW, artH, 34);
        const art = ctx.createLinearGradient(pad, y, pad + innerW, y + artH);
        art.addColorStop(0, hexA(p.b, 0.42));
        art.addColorStop(0.52, hexA(p.a, 0.18));
        art.addColorStop(1, 'rgba(10,18,24,.92)');
        ctx.fillStyle = art;
        ctx.fill();
        ctx.clip();
        const glow = ctx.createRadialGradient(pad + innerW * .72, y + artH * .18, 0, pad + innerW * .72, y + artH * .18, artH * .82);
        glow.addColorStop(0, hexA(p.c, .6));
        glow.addColorStop(1, hexA(p.c, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(pad, y, innerW, artH);
        ctx.font = `700 ${artH * .72}px "Newsreader Variable", Georgia, serif`;
        ctx.fillStyle = hexA(p.text, .94);
        ctx.fillText('h', pad + innerW * .1, y + artH * .72);
        ctx.font = `800 ${fmt === 'story' ? 20 : 17}px "Inter Variable", sans-serif`;
        ctx.fillStyle = hexA(p.text, .72);
        ctx.fillText('A thought worth carrying', pad + innerW * .1, y + artH * .88);
        ctx.restore();
        y += artH + 34;
      }

      const titleSize = fmt === 'story' ? 92 : fmt === 'square' ? 72 : 48;
      ctx.font = `700 ${titleSize}px "Newsreader Variable", Georgia, serif`;
      ctx.fillStyle = p.text;
      ctx.textBaseline = 'alphabetic';
      const lines = wrap(ctx, data.title, innerW, fmt === 'card' ? 5 : fmt === 'story' ? 6 : 4);
      lines.forEach((ln, i) => ctx.fillText(ln, pad, y + titleSize * 1.04 * i + titleSize * 0.82));
      y += lines.length * titleSize * 1.04 + 18;

      const dekSize = fmt === 'card' ? 21 : 27;
      ctx.font = `500 ${dekSize}px "Inter Variable", sans-serif`;
      ctx.fillStyle = p.sub;
      const dekLines = wrap(ctx, data.dek, innerW, fmt === 'story' ? 4 : 3);
      dekLines.forEach((ln, i) => ctx.fillText(ln, pad, y + dekSize * 1.42 * i + dekSize));
    } else if (slide === 1) {
      /* frame two — the line you would read out loud */
      const qSize = fmt === 'card' ? 30 : fmt === 'square' ? 38 : 46;
      const lineH = qSize * 1.36;
      ctx.font = `400 italic ${qSize}px "Newsreader Variable", Georgia, serif`;
      ctx.fillStyle = p.text;
      const ql = wrap(ctx, `“${data.quote}”`, innerW - 34, fmt === 'story' ? 11 : 7);
      ctx.strokeStyle = hexA(p.b, 0.85);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(pad, y + 6);
      ctx.lineTo(pad, y + 6 + ql.length * lineH);
      ctx.stroke();
      ql.forEach((ln, i) => ctx.fillText(ln, pad + 34, y + qSize * 0.94 + i * lineH));
      y += ql.length * lineH + 46;
      ctx.font = `700 ${fmt === 'card' ? 20 : 25}px "Inter Variable", sans-serif`;
      ctx.fillStyle = p.sub;
      ctx.fillText(data.author, pad + 34, y);
      if ('reaction' in data && (data.reaction || data.note)) {
        y += fmt === 'card' ? 38 : 54;
        ctx.font = `800 ${fmt === 'card' ? 18 : 23}px "Inter Variable", sans-serif`;
        ctx.fillStyle = hexA(p.c, 0.95);
        ctx.fillText(`◦ ${data.reaction}`, pad + 34, y);
        if (data.note) {
          y += fmt === 'card' ? 28 : 36;
          ctx.font = `400 ${fmt === 'card' ? 18 : 24}px "Newsreader Variable", Georgia, serif`;
          ctx.fillStyle = p.sub;
          wrap(ctx, `“${data.note}”`, innerW - 34, fmt === 'story' ? 5 : 3).forEach((ln, i) => ctx.fillText(ln, pad + 34, y + i * (fmt === 'card' ? 26 : 34)));
        }
      }
    } else {
      /* frame three — signature: who wrote it, and where to read it */
      const titleSize = fmt === 'story' ? 72 : fmt === 'square' ? 60 : 42;
      ctx.font = `700 ${titleSize}px "Newsreader Variable", Georgia, serif`;
      ctx.fillStyle = p.text;
      const lines = wrap(ctx, data.title, innerW, 5);
      lines.forEach((ln, i) => ctx.fillText(ln, pad, y + titleSize * 1.04 * i + titleSize * 0.82));
      y += lines.length * titleSize * 1.04 + 30;

      ctx.font = `400 ${fmt === 'card' ? 22 : 28}px "Newsreader Variable", Georgia, serif`;
      ctx.fillStyle = p.sub;
      const dl = wrap(ctx, data.dek, innerW, 5);
      dl.forEach((ln, i) => ctx.fillText(ln, pad, y + 22 + i * 40));
    }

    /* ------------------------------------------------------------- footer */
    const fy = fmt === 'card' ? H - pad - 6 : H - pad - 4;
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, fy - (fmt === 'card' ? 22 : 34));
    ctx.lineTo(W - pad, fy - (fmt === 'card' ? 22 : 34));
    ctx.stroke();

    try {
      const av = await loadImg(data.avatar);
      const r = fmt === 'card' ? 26 : 34;
      ctx.save();
      ctx.beginPath();
      ctx.arc(pad + r, fy - r * 0.2, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(av, pad, fy - r * 1.2, r * 2, r * 2);
      ctx.restore();
      ctx.strokeStyle = hexA(p.c, 0.8);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pad + r, fy - r * 0.2, r, 0, Math.PI * 2);
      ctx.stroke();
    } catch {/* procedural fallback already drawn by loadImg */}

    ctx.font = `700 ${fmt === 'card' ? 20 : 25}px "Inter Variable", sans-serif`;
    ctx.fillStyle = p.text;
    ctx.fillText(data.author, pad + (fmt === 'card' ? 64 : 84), fy - (fmt === 'card' ? 12 : 18));
    ctx.font = `500 ${fmt === 'card' ? 15 : 19}px "Inter Variable", sans-serif`;
    ctx.fillStyle = p.sub;
    ctx.fillText(data.handleLine, pad + (fmt === 'card' ? 64 : 84), fy + (fmt === 'card' ? 8 : 12));

    // CTA
    ctx.textAlign = 'right';
    ctx.font = `800 ${fmt === 'card' ? 17 : 21}px "Inter Variable", sans-serif`;
    ctx.fillStyle = hexA(p.c, 0.95);
    ctx.fillText(data.cta, W - pad, fy - 4);
    ctx.textAlign = 'left';

    setBusy(false);
  }

  function payload() {
    if (isYear) {
      const days = Object.values(act);
      const reads = days.reduce((a, d) => a + d.reads, 0);
      const written = days.reduce((a, d) => a + d.posts, 0);
      return {
        title: 'Your year on heatt',
        dek: `${days.length} days you showed up, ${reads} pieces finished, ${written} written.`,
        quote: 'The good part was never how much you got through. It was the three pieces that stayed with you.',
        chip: `@${s.me?.handle ?? 'you'} · ${days.length} active days`,
        author: s.me?.name ?? 'You',
        handleLine: `@${s.me?.handle ?? 'you'} · heatt`,
        avatar: s.me?.avatar ?? avatarDataUri(s.me?.name ?? 'you', s.me?.handle ?? 'you'),
        cover: '/art/graphite-lattice.jpg',
        cta: 'heatt.app — where ideas burn',
      };
    }
    if (isProfile) {
      const user = s.me && profHandle === s.me.handle ? s.me : null;
      const name = user?.name ?? profHandle ?? 'someone';
      const bio = user?.bio ?? 'Reading more than posting, and posting more than they should.';
      const mine = app.posts.filter((p) => p.authorHandle === profHandle);
      return {
        title: name,
        dek: bio,
        quote: bio.slice(0, 200),
        chip: `${mine.length} ${mine.length === 1 ? 'piece' : 'pieces'} · @${profHandle}`,
        author: name,
        handleLine: `@${profHandle} · heatt`,
        avatar: user?.avatar ?? avatarDataUri(name, profHandle ?? 'you'),
        cover: '/art/story-canvas.jpg',
        cta: 'Follow on heatt →',
      };
    }
    const p = post!;
    const prose =
      p.kind === 'forge'
        ? (p.blocks ?? [])
            .filter((b) => b.t === 'p')
            .map((b) => ('text' in b ? b.text : ''))
            .join(' ') ||
          plain(p.markdown ?? '') ||
          p.dek ||
          ''
        : p.text ?? '';
    return {
      title: p.kind === 'forge' ? p.title ?? 'A piece on heatt' : `${p.authorName} on heatt`,
      dek: p.kind === 'forge' ? p.dek ?? '' : (p.text ?? '').slice(0, 240),
      quote: prose.replace(/\s+/g, ' ').trim().slice(0, 200),
      chip: p.kind === 'forge' ? `long read · ${p.minutes ?? 6} min` : 'spark',
      author: p.authorName,
      handleLine: `@${p.authorHandle} · ${p.kind === 'forge' ? `${p.minutes ?? 6} min read` : 'spark'}`,
      avatar: p.authorAvatar ?? avatarDataUri(p.authorName, p.authorHandle),
      cover: p.cover,
      cta: 'Read it in heatt →',
      reaction,
      note: shareNote,
    };
  }

  async function exportPng(): Promise<Blob | null> {
    const c = canvasRef.current;
    if (!c) return null;
    return await new Promise((res) => c.toBlob((b) => res(b), 'image/png', 0.96));
  }

  const download = async () => {
    const blob = await exportPng();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heatt-${fmt}-${(id ?? 'card').replace(/[^a-z0-9-]/gi, '')}.png`;
    a.click();
    URL.revokeObjectURL(url);
    record('downloaded');
  };

  const copy = async () => {
    const blob = await exportPng();
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      record('copied to clipboard');
    } catch {
      record('clipboard blocked — download instead', true);
    }
  };

  const nativeShare = async () => {
    const blob = await exportPng();
    if (!blob) return;
    const file = new File([blob], 'heatt-share.png', { type: 'image/png' });
    const text = isYear ? 'My heat map on heatt' : `${post?.title ?? post?.text ?? 'a post'} — on heatt`;
    const link = isYear ? 'https://heatt.app' : `https://heatt.app/read/${post?.id}`;
    try {
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean; share?: (d: unknown) => Promise<void> };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: 'heatt', text, url: link });
        record('shared');
        return;
      }
      if (nav.share) {
        await nav.share({ title: 'heatt', text: `${text}\n${link}` });
        record('shared');
        return;
      }
      record('no share sheet here — use download', true);
    } catch {
      record('share cancelled', true);
    }
  };

  const copyLink = async () => {
    const link = isYear ? location.href : `${location.origin}/read/${post?.id}`;
    try {
      await navigator.clipboard.writeText(link);
      record('link copied');
    } catch {
      record('copy blocked', true);
    }
  };

  function record(what: string, bad?: boolean) {
    setDone(what);
    if (!bad && post) useStore.getState().addShare(post.id);
    app.toast(`Card ${what}`, bad ? 'cool' : 'heat');
    window.setTimeout(() => setDone(null), 2200);
  }

  /* Preview is measured, not guessed: the poster scales to the room available
     so a 1080px-wide export never blows out a 360px phone screen. */
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const [stageW, setStageW] = React.useState(0);
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setStageW(e.contentRect.width));
    ro.observe(el);
    setStageW(el.clientWidth);
    return () => ro.disconnect();
  }, [open]);
  const scaleTarget = React.useMemo(() => {
    const room = Math.max(180, Math.min(stageW || 420, 640));
    return Math.max(0.14, Math.min(0.62, room / DIMS[fmt][0]));
  }, [stageW, fmt]);

  const frameW = DIMS[fmt][0] * scaleTarget;
  const frameH = DIMS[fmt][1] * scaleTarget;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="stories"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="share-sheet fixed inset-0 z-[170] overflow-y-auto bg-[#05070a]/96 backdrop-blur-2xl"
          aria-label="Share as a story"
        >
          {/* the piece's own cover, as the room light */}
          {post?.cover && (
            <img aria-hidden src={post.cover} alt="" className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-20 blur-3xl" />
          )}

          <div className="relative mx-auto flex min-h-full w-full max-w-[1180px] flex-col gap-5 px-4 pb-8 pt-4 sm:px-8 lg:flex-row lg:items-start lg:justify-center lg:gap-12 lg:py-10">
            <header className="absolute inset-x-4 top-4 z-10 flex items-center justify-between sm:inset-x-8 lg:inset-x-10">
              <div className="flex items-center gap-3">
                <span className="share-sheet__mark">h</span>
                <span className="text-[12px] font-semibold tracking-[.18em] text-white/55 uppercase">share a story</span>
              </div>
              <button onClick={() => app.setShare(null)} className="share-sheet__close" aria-label="Close share studio">×</button>
            </header>
            {/* ------------------------------------------------- the story */}
            <div ref={stageRef} className="share-stage min-w-0 flex-1 pt-14 lg:max-w-[520px] lg:pt-16">
              <div className="mb-3 flex items-center gap-2">
                {(SLIDES as readonly string[]).map((s, i) => (
                  <button
                    key={s}
                    onClick={() => { setSlide(i); setProgress(0); }}
                    aria-label={`Frame ${i + 1}: ${s}`}
                    className="group h-[4px] flex-1 overflow-hidden rounded-full bg-white/15"
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: i < slide ? '100%' : i === slide ? `${progress * 100}%` : '0%',
                        background: 'var(--ht-ember)',
                        transition: i === slide ? 'width .08s linear' : 'width .3s',
                      }}
                    />
                  </button>
                ))}
              </div>

              <div
                className="relative flex items-center justify-center"
                onPointerDown={() => setPaused(true)}
                onPointerUp={() => setPaused(false)}
                onPointerLeave={() => setPaused(false)}
              >
                <motion.div
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.12}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -40) next();
                    else if (info.offset.x > 40) prev();
                  }}
                  className="relative cursor-grab active:cursor-grabbing"
                  style={{ width: frameW, height: frameH }}
                >
                  <canvas
                    ref={attachCanvas}
                    className="share-poster rounded-[30px]"
                    style={{ width: DIMS[fmt][0], height: DIMS[fmt][1], boxShadow: '0 70px 150px -54px rgba(131,222,212,.45), 0 0 0 1px rgba(255,255,255,.14)' }}
                  />
                  {/* tap zones, like every story you have ever used */}
                  <button onClick={prev} aria-label="Previous frame" className="absolute inset-y-0 left-0 w-1/3" />
                  <button onClick={next} aria-label="Next frame" className="absolute inset-y-0 right-0 w-1/3" />
                </motion.div>
              </div>

              <div className="mt-3 flex items-center justify-center gap-2">
                {SLIDES.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => { setSlide(i); setProgress(0); }}
                    className={cls('text-[11.5px] font-semibold transition-colors', i === slide ? 'text-white' : 'text-ink-mute hover:text-ink-dim')}
                  >
                    {s}
                  </button>
                ))}
                <span className="ml-1 text-[11px] text-ink-faint">· swipe or tap</span>
              </div>
            </div>

            {/* ------------------------------------------------ the controls */}
            <div className="share-tray w-full shrink-0 lg:mt-16 lg:w-[340px]">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <span className="ht-kicker">shape the moment</span>
                  <h2 id="share-title" className="ht-title mt-2 text-[28px] text-white">
                    {isYear ? 'Your year, as a story' : 'Give it a life outside the feed'}
                  </h2>
                </div>
                <span className="share-sheet__counter">{slide + 1}/{SLIDES.length}</span>
              </div>
              <p className="mb-5 max-w-[34ch] text-[13px] leading-relaxed text-ink-dim">
                Start with the line, add your point of view, then export one beautiful card.
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {(Object.keys(DIMS) as Fmt[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFmt(f)}
                    className={cls('ht-chip !normal-case !tracking-normal', fmt === f && '!border-ember-500/50 !bg-ember-500/12 !text-ember-200')}
                  >
                    {f === 'story' ? 'Story 9:16' : f === 'square' ? 'Feed 1:1' : 'Link 16:9'}
                  </button>
                ))}
              </div>

              {!isYear && !isProfile && (
                <div className="mt-4 rounded-[16px] border border-white/[.07] bg-white/[.025] p-3">
                  <span className="ht-label !text-[9px]">add your context</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(['Resonated', 'Challenged', 'Useful', 'Revisit'] as const).map((x) => (
                      <button key={x} onClick={() => setReaction(x)} className={cls('ht-chip !normal-case !tracking-normal', reaction === x && '!border-ember-500/50 !bg-ember-500/12 !text-ember-200')}>
                        {x}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={shareNote}
                    onChange={(e) => setShareNote(e.target.value.slice(0, 160))}
                    placeholder="Why is this worth someone’s time? (optional)"
                    rows={2}
                    className="mt-2.5 w-full resize-none rounded-[12px] border border-white/[.08] bg-black/25 px-3 py-2 text-[12px] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-ember-500/50"
                  />
                  <div className="mt-1 text-right text-[10px] text-ink-faint">{shareNote.length}/160</div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-4 gap-1.5">
                {(Object.keys(PAL) as Palette[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => { setAutoPal(false); setPal(k); }}
                    aria-label={`Palette ${k}`}
                    className={cls('h-10 rounded-[12px] border transition-all', !autoPal && pal === k && '!border-white/70')}
                    style={{ background: `linear-gradient(140deg, ${PAL[k].a}, ${PAL[k].b} 55%, ${PAL[k].c})`, boxShadow: !autoPal && pal === k ? `0 10px 28px -10px ${PAL[k].b}` : undefined }}
                  >
                    <span className="sr-only">{k}</span>
                  </button>
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 text-[12px] text-ink-dim">
                <input type="checkbox" checked={autoPal} onChange={(e) => setAutoPal(e.target.checked)} className="accent-[var(--ht-ember)]" />
                Palette follows the piece
              </label>
              <div className="mt-3">
                <Check label="Include cover image" value={showCover} onChange={setShowCover} />
              </div>

              <div className="mt-5 grid gap-2">
                <button onClick={nativeShare} className="ht-btn ht-btn--heat !h-12 !justify-between !px-5 !text-[14px]">Share story <span aria-hidden>↗</span></button>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={download} className="share-tool">Save PNG</button>
                  <button onClick={copy} className="share-tool">Copy image</button>
                  <button onClick={copyLink} className="share-tool">Copy link</button>
                </div>
              </div>

              <AnimatePresence>
                {done && (
                  <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2.5 text-center text-[12px] text-ember-300">
                    {done}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="mt-4 flex items-center gap-2.5 rounded-[16px] border border-white/[.06] p-3">
                <Avatar name={isYear ? s.me?.name ?? 'You' : post?.authorName ?? ''} handle={isYear ? s.me?.handle ?? 'you' : post?.authorHandle} src={isYear ? s.me?.avatar : post?.authorAvatar} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-bold">{isYear ? 'Your year on heatt' : post?.kind === 'forge' ? post.title : post?.text?.slice(0, 44)}</div>
                  <div className="text-[11px] text-ink-mute">{isYear ? 'heatt.app' : `heatt.app/read/${post?.id}`}</div>
                </div>
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed text-ink-faint">
                Exported at {DIMS[fmt][0]}×{DIMS[fmt][1]} — sized for stories, feeds and link previews without re-cropping.
              </p>

              <button onClick={() => app.setShare(null)} className="mt-4 w-full text-center text-[12px] font-semibold text-ink-mute transition-colors hover:text-ink">Close share studio</button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ----------------------------------------------------------------- helpers */

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex w-full items-center justify-between rounded-[12px] border border-white/[.07] px-3 py-2 text-[13px] text-ink-dim transition-colors hover:border-white/20">
      {label}
      <span className="grid w-[18px] place-items-center rounded-[5px] border" style={{ borderColor: value ? 'var(--ht-flame)' : 'var(--ht-line)', background: value ? 'rgba(255,180,84,.16)' : 'transparent', height: 18 }}>
        {value && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ht-whitehot)" strokeWidth="3.4">
            <path d="m5 13 4.5 4.5L19 7" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </button>
  );
}

function drawLockup(ctx: CanvasRenderingContext2D, x: number, y: number, p: { a: string; b: string; c: string; text: string }, size: number) {
  const g = ctx.createLinearGradient(x, y, x + size * 0.9, y + size * 1.3);
  g.addColorStop(0, p.c);
  g.addColorStop(0.5, p.b);
  g.addColorStop(1, p.a);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.beginPath();
  ctx.moveTo(14.1, 1.6);
  ctx.bezierCurveTo(15.7, 5.9, 14.4, 8, 12.6, 10);
  ctx.bezierCurveTo(10.6, 12.3, 8.1, 14.3, 8.1, 18.5);
  ctx.bezierCurveTo(8.1, 22.6, 11.4, 25, 15, 25);
  ctx.bezierCurveTo(19, 25, 22, 22, 22, 17.8);
  ctx.bezierCurveTo(22, 14.4, 20, 12.1, 19.2, 8.9);
  ctx.bezierCurveTo(21.4, 11.5, 23, 14.4, 23, 18);
  ctx.bezierCurveTo(23, 24.6, 17.6, 30, 10.6, 30);
  ctx.bezierCurveTo(3.6, 30, -1, 24.6, -1, 17.7);
  ctx.bezierCurveTo(-1, 9.8, 6.5, 5.5, 11.6, 1.6);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.font = `700 ${size * 1.15}px "Bricolage Grotesque Variable", sans-serif`;
  ctx.fillStyle = p.text;
  ctx.textBaseline = 'middle';
  ctx.fillText('heatt', x + size * 1.35, y + size * 0.62);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const words = (text ?? '').split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > width && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    } else cur = test;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) {
    const used = lines.join(' ').length;
    const rest = text.slice(used).trim();
    if (rest) lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[,.;:]$/, '')}…`;
  }
  return lines.filter(Boolean);
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height;
  const r = w / h;
  let sw = img.width;
  let sh = img.height;
  if (ir > r) sw = img.height * r;
  else sh = img.width / r;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

const imgCache = new Map<string, Promise<HTMLImageElement>>();
function loadImg(src: string): Promise<HTMLImageElement> {
  const key = src;
  const hit = imgCache.get(key);
  if (hit) return hit;
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (/^https?:/.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // never let a remote image break the poster — fall back to procedural
      const fb = new Image();
      fb.onload = () => resolve(fb);
      fb.onerror = reject;
      fb.src = avatarDataUri('heatt', 'heatt');
    };
    img.src = src;
  });
  imgCache.set(key, p);
  return p;
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
