'use client';
/* ============================================================================
   components/compose/Composer — the hybrid authoring surface.

   One box, two modalities, and a live "length gauge" that tells you which one
   you are writing: cross ~480 characters and the composer offers to promote
   the spark into a forge (the wall between the two is the thing we removed).

   • markdown for forges with live preview through the real reader pipeline
   • tags, link detection with edge OG preview, poll builder, image attach
   • heat projection: shows what your post's temperature would be at launch
   ==========================================================================*/

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/lib/app';
import { useStore } from '@/lib/store';
import { Modal } from '@/components/ui/primitives';
import { Markdown, parseMarkdown } from '@/lib/markdown';
import { LinkPreview } from '@/components/cards/LinkPreview';
import { cls, plain, uid } from '@/lib/util';

const SPARK_MAX = 700;
const FORGE_PROMPT = 480;

export function Composer() {
  const app = useApp();
  const s = useStore();
  const open = app.composerOpen;
  const seed = app.composerSeed;
  const [kind, setKind] = React.useState<'spark' | 'forge'>(seed.kind ?? 'spark');
  const [text, setText] = React.useState(seed.quote ? `Re: ${seed.quote}\n\n` : '');
  const [title, setTitle] = React.useState('');
  const [dek, setDek] = React.useState('');
  const [cover, setCover] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [link, setLink] = React.useState('');
  const [poll, setPoll] = React.useState<{ question: string; options: string[] } | null>(null);
  const [promoted, setPromoted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const areaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const attachArea = React.useCallback((el: HTMLTextAreaElement | null) => {
    areaRef.current = el;
    if (el) el.focus(); // the sheet mounts a frame after open, so focus on attach
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setKind(seed.kind ?? 'spark');
    if (seed.article) {
      setTitle(seed.article.title ?? '');
      setDek(seed.article.dek ?? '');
      setText(seed.article.markdown ?? '');
      setKind('forge');
    }
    areaRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const len = text.trim().length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.round(words / 225));
  const showPromote = kind === 'spark' && len > FORGE_PROMPT && !promoted;

  const found = React.useMemo(() => text.match(/https?:\/\/\S{6,}/)?.[0] ?? '', [text]);
  const close = () => app.setComposer(false);

  const submit = () => {
    if (!text.trim() && kind === 'spark') return;
    if (kind === 'forge' && !title.trim()) {
      app.toast('Forges need a headline', 'cool');
      return;
    }
    setBusy(true);
    window.setTimeout(() => {
      const linkUrl = found || link || undefined;
      if (kind === 'spark') {
        s.addSpark({
          author: s.me?.handle ?? 'you',
          text: text.trim(),
          tags,
          reactions: 0,
          comments: 0,
          link: linkUrl ? { url: linkUrl, title: linkUrl, site: new URL(linkUrl).hostname.replace(/^www\./, '') } : undefined,
          poll: poll ? { question: poll.question, options: poll.options.filter(Boolean).map((label) => ({ label, votes: 0 })) } : undefined,
        });
      } else {
        const article = s.addArticle({
          title: title.trim(),
          dek: dek.trim() || plain(text).slice(0, 150),
          author: s.me?.handle ?? 'you',
          tags: tags.length ? tags : ['draft'],
          markdown: text.trim(),
          cover: cover || undefined,
        });
        // the spark that announces it — the hybrid loop in one gesture
        s.addSpark({
          author: s.me?.handle ?? 'you',
          text: `New forge: ${article.title}\n\n${(dek || plain(text)).slice(0, 160)}`,
          tags,
          reactions: 0,
          comments: 0,
          longRef: article.id,
        });
      }
      setBusy(false);
      setText('');
      setTitle('');
      setDek('');
      setLink('');
      setCover('');
      setTags([]);
      setPoll(null);
      close();
      app.toast(kind === 'forge' ? 'Forge published — a spark announcing it is on the board' : 'Spark published', 'heat');
      app.go('/feed');
    }, 420);
  };

  const doc = React.useMemo(() => (kind === 'forge' && text ? parseMarkdown(text) : null), [kind, text]);

  return (
    <Modal open={open} onClose={close} wide labelledBy="compose-title">
      <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 id="compose-title" className="ht-title text-[17px]">
            {kind === 'forge' ? 'Write an essay' : 'Share a note'}
          </h2>
          <span className="ht-chip !normal-case !tracking-normal">@{s.me?.handle ?? 'you'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="mr-1 flex rounded-full border border-white/[.08] p-[3px]">
            {(['spark', 'forge'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cls('rounded-full px-3 py-1 text-[12px] font-bold capitalize transition-all', kind === k ? 'text-[#1A0E02]' : 'text-ink-mute hover:text-ink')}
                style={kind === k ? { background: 'linear-gradient(120deg,var(--ht-flare),var(--ht-ember))' } : undefined}
              >
                {k}
              </button>
            ))}
          </div>
          <button onClick={close} className="ht-btn ht-btn--ghost !px-2.5 !py-1.5">✕</button>
        </div>
      </div>

      <div className="grid max-h-[74vh] overflow-y-auto overscroll-contain md:grid-cols-[1.05fr_.95fr]">
        <div className="p-4">
          {kind === 'forge' && (
            <>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={110} placeholder="Headline — the promise in one line" className="ht-input !border-0 !bg-transparent !px-0 !text-[26px] !font-bold focus:!shadow-none ht-title" />
              <input value={dek} onChange={(e) => setDek(e.target.value)} maxLength={180} placeholder="Standfirst — why it matters, one sentence" className="ht-input mt-1 !border-0 !bg-transparent !px-0 !text-[15px] !text-ink-dim focus:!shadow-none" />
              <div className="ht-hairline my-3" />
            </>
          )}

          <textarea
            ref={attachArea}
            value={text}
            maxLength={kind === 'spark' ? SPARK_MAX : undefined}
            onChange={(e) => setText(e.target.value)}
            placeholder={kind === 'spark' ? 'What stayed with you? One observation, no preamble.' : 'Markdown welcome: ## headings, `code`, > quotes, ![]() images, tables.'}
            className={cls(
              'w-full resize-none bg-transparent outline-none placeholder:text-ink-faint focus:!shadow-none',
              kind === 'spark' ? 'text-[16px] leading-[1.6]' : 'ht-prose !text-[15px] font-mono !leading-[1.7]'
            )}
            style={{ minHeight: kind === 'spark' ? 128 : 260 }}
          />

          <AnimatePresence>
            {showPromote && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-2 flex items-center gap-3 rounded-[14px] border border-ember-500/35 bg-[linear-gradient(100deg,rgba(255,180,84,.09),transparent)] p-3"
              >
                <span className="text-[13px] leading-snug text-ink-dim">
                  This outgrew a note ({len} chars). Turn it into an <b className="text-ember-300">essay</b> so readers can follow the full thought?
                </span>
                <span className="flex-1" />
                <button onClick={() => setPromoted(true)} className="ht-btn ht-btn--ghost !py-1 !text-[11.5px]">
                  keep as note
                </button>
                <button
                  onClick={() => {
                    setKind('forge');
                    setTitle(title || plain(text).slice(0, 60));
                    setDek(plain(text).slice(0, 150));
                  }}
                  className="ht-btn ht-btn--heat !py-1.5 !text-[12px]"
                >
                  Promote →
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* attachments */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {found && (
              <span className="ht-chip !normal-case !tracking-normal">
                link: {found.replace(/^https?:\/\//, '').slice(0, 26)}
                <button onClick={() => setText((t) => t.replace(found, ''))} className="ml-1 text-ink-faint hover:text-ink">✕</button>
              </span>
            )}
            {!found && link && <span className="ht-chip !normal-case !tracking-normal">link: {link.slice(0, 30)}</span>}
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="+ tag" onKeyDown={(e) => { if (e.key === 'Enter' && tagInput.trim()) { setTags((t) => [...new Set([...t, tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')])]); setTagInput(''); } }} className="ht-input !w-[104px] !py-1.5 !text-[12px]" />
            {tags.map((t) => (
              <button key={t} onClick={() => setTags((x) => x.filter((y) => y !== t))} className="ht-chip !border-ember-500/40 !normal-case !tracking-normal">
                #{t} ✕
              </button>
            ))}
            <span className="flex-1" />
            {kind === 'forge' && (
              <label className="ht-btn !py-1.5 !text-[11.5px] cursor-pointer">
                cover
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setCover(String(r.result)); r.readAsDataURL(f); }} />
              </label>
            )}
            <button onClick={() => setPoll(poll ? null : { question: '', options: ['', ''] })} className={cls('ht-btn !py-1.5 !text-[11.5px]', poll && '!border-ember-500/45 !text-ember-200')}>
              poll
            </button>
          </div>

          {poll && (
            <div className="mt-3 rounded-[14px] border border-white/[.08] p-3">
              <input value={poll.question} onChange={(e) => setPoll({ ...poll, question: e.target.value })} placeholder="Poll question" className="ht-input !py-2 !text-[13px]" />
              <div className="mt-2 space-y-1.5">
                {poll.options.map((o, i) => (
                  <input key={i} value={o} onChange={(e) => setPoll({ ...poll, options: poll.options.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={`Option ${i + 1}`} className="ht-input !py-1.5 !text-[12.5px]" />
                ))}
                {poll.options.length < 4 && (
                  <button onClick={() => setPoll({ ...poll, options: [...poll.options, ''] })} className="ht-btn ht-btn--ghost !py-1 !text-[11.5px]">
                    + option
                  </button>
                )}
              </div>
            </div>
          )}

          {cover && <img src={cover} alt="" className="mt-3 w-full rounded-[14px] border border-white/[.07]" />}
        </div>

        {/* preview + meta */}
        <div className="border-t border-white/[.06] bg-black/25 p-4 md:border-l md:border-t-0">
          <div className="mb-2 flex items-center justify-between">
            <span className="ht-label">live preview</span>
            <span className="ht-num text-[11px] text-ink-mute">
              {kind === 'spark' ? `${len}/${SPARK_MAX}` : `${words} words · ${minutes} min`}
            </span>
          </div>

          <div className="ht-card p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-black" style={{ background: 'linear-gradient(140deg,#FFC978,#EFCB8B)', color: '#1A0E02' }}>
                {(s.me?.name ?? 'Y')[0]}
              </span>
              <span className="text-[13px] font-bold">{s.me?.name ?? 'You'}</span>
              <span className="text-[12px] text-ink-mute">@{s.me?.handle ?? 'you'}</span>
            </div>
            {kind === 'forge' ? (
              <>
                <h3 className="ht-title text-[19px] leading-tight">{title || 'Your headline appears here'}</h3>
                {dek && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">{dek}</p>}
                {cover ? (
                  <img src={cover} alt="" className="mt-2.5 aspect-[16/8] w-full rounded-[12px] object-cover" />
                ) : (
                  <div className="mt-2.5 grid aspect-[16/8] w-full place-items-center rounded-[12px] border border-white/[.06]" style={{ background: 'radial-gradient(80% 120% at 10% 110%,rgba(255,180,84,.16),transparent 62%),#0a0a0a' }}>
                    <span className="text-[11px] uppercase tracking-[0.2em] text-ink-faint">no cover</span>
                  </div>
                )}
                <div className="ht-prose mt-3 max-h-[280px] overflow-hidden">
                  {doc ? <Markdown doc={doc} opts={{ compact: true }} /> : <p className="text-[13px] text-ink-faint">Start typing — this is the real reader pipeline.</p>}
                </div>
              </>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-[14.5px] leading-[1.55] text-ink">{text || 'Your note preview.'}</p>
                {found && <LinkPreview url={found} seed={{ url: found, title: found, site: found.replace(/^https?:\/\//, '').split('/')[0] }} />}
                {poll && poll.question && (
                  <div className="mt-2.5 rounded-[12px] border border-white/[.08] p-2.5 text-[12.5px] text-ink-dim">
                    <b className="block text-ink">{poll.question}</b>
                    {poll.options.filter(Boolean).map((o) => (
                      <span key={o} className="mt-1.5 block rounded-[8px] border border-white/[.06] px-2 py-1">
                        {o}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* length gauge */}
          <div className="mt-3">
            <div className="mb-1 flex justify-between">
              <span className="ht-label !text-[9px]">modality gauge</span>
              <span className="text-[10px] text-ink-faint">{kind === 'spark' ? 'note ← → essay' : 'essay'}</span>
            </div>
            <span className="relative block h-[5px] overflow-hidden rounded-full bg-white/[.07]">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.min(100, (len / (kind === 'spark' ? FORGE_PROMPT : 2400)) * 100)}%`,
                  background: len > FORGE_PROMPT ? 'linear-gradient(90deg,var(--ht-ember),var(--ht-whitehot))' : 'linear-gradient(90deg,var(--ht-cryo-teal),var(--ht-flame))',
                  transition: 'width .4s cubic-bezier(.2,1,.3,1)',
                }}
              />
            </span>
          </div>

          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
            {kind === 'forge'
              ? 'An essay publishes as a complete piece — cover, body and all. Readers never leave heatt.'
              : 'Notes stay short. Keep writing past the line and heatt will offer to expand it into a full piece.'}
          </p>

          <button onClick={submit} disabled={busy || (!text.trim() && kind === 'spark') || (kind === 'forge' && !title.trim())} className="ht-btn ht-btn--heat mt-3 w-full !py-2.5 disabled:opacity-40">
            {busy ? 'Publishing…' : kind === 'forge' ? 'Publish essay + note' : 'Publish note'}
          </button>
          <p className="mt-2 text-center text-[10.5px] text-ink-faint">stored locally · nothing is uploaded · ⌘↵ to publish</p>
        </div>
      </div>

      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="optional link (also auto-detected from text)" className="ht-input mx-4 mb-4 !py-2 !text-[12.5px]" style={{ width: 'calc(100% - 32px)' }} />
    </Modal>
  );
}
