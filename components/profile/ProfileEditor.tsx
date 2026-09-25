'use client';
/* ============================================================================
   components/profile/ProfileEditor — change handle, name, avatar, cover, bio,
   location, site, and the interests that drive your ranking weights.
   Files are downscaled on-canvas to keep localStorage tiny (avatar 512²,
   cover 1280×420) and everything is validated before it touches the store.
   ==========================================================================*/

import * as React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useApp } from '@/lib/app';
import { avatarDataUri, cls, coverDataUri } from '@/lib/util';

const COVERS = ['/art/hero-forge.jpg', '/art/molten-ui.jpg', '/art/graphite-lattice.jpg', '/art/cold-type.jpg', '/art/deep-read.jpg', '/art/ember-signal.jpg', '/art/shader-flames.jpg', '/art/story-canvas.jpg'];
const TAGS = ['design', 'typography', 'webgl', 'engineering', 'ai', 'frontend', 'reading', 'habits', 'postgres', 'product', 'motion', 'career', 'dark-ui', 'perf', 'research'];

export function ProfileEditor({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const app = useApp();
  const me = s.me ?? { handle: 'you', name: 'You', bio: '', joined: new Date().toISOString().slice(0, 10), followers: 0, following: 0, thermalMass: 1 };

  const [handle, setHandle] = React.useState(me.handle);
  const [name, setName] = React.useState(me.name);
  const [bio, setBio] = React.useState(me.bio);
  const [location, setLocation] = React.useState(me.location ?? '');
  const [site, setSite] = React.useState(me.site ?? '');
  const [avatar, setAvatar] = React.useState(me.avatar);
  const [cover, setCover] = React.useState(me.cover ?? COVERS[0]);
  const [interests, setInterests] = React.useState<string[]>(me.traits ?? s.interests ?? []);
  const [dragOver, setDragOver] = React.useState<'avatar' | 'cover' | null>(null);
  const [avatarChanged, setAvatarChanged] = React.useState(false);
  const [coverChanged, setCoverChanged] = React.useState(false);

  const handleOk = /^[a-z0-9_.-]{2,20}$/.test(handle);
  const dirty =
    handle !== me.handle || name !== me.name || bio !== me.bio || (location || '') !== (me.location ?? '') || (site || '') !== (me.site ?? '') || avatar !== me.avatar || cover !== me.cover || interests.join() !== (me.traits ?? []).join();

  const save = () => {
    if (!handleOk) {
      app.toast('Handle: 2–20 chars, a-z 0-9 . _ - only', 'cool');
      return;
    }
    s.updateMe({ handle, name: name || handle, bio, location: location || undefined, site: site || undefined, avatar, cover, traits: interests });
    useStore.setState({ interests });
    app.toast('Profile updated — your heat history followed the handle', 'heat');
    onClose();
  };

  const readFile = (file: File, kind: 'avatar' | 'cover') => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = kind === 'avatar' ? 512 : 1280;
      const h = kind === 'avatar' ? 512 : 420;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (ctx) {
        const srcRatio = img.width / img.height;
        const dstRatio = w / h;
        let sw = img.width;
        let sh = img.height;
        if (srcRatio > dstRatio) sw = img.height * dstRatio;
        else sh = img.width / dstRatio;
        ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
        const out = c.toDataURL(kind === 'avatar' ? 'image/jpeg' : 'image/jpeg', kind === 'avatar' ? 0.86 : 0.72);
        if (kind === 'avatar') {
          setAvatar(out);
          setAvatarChanged(true);
        } else {
          setCover(out);
          setCoverChanged(true);
        }
        app.toast(kind === 'avatar' ? 'Avatar resized to 512²' : 'Cover cropped to 1280×420', 'cool');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-xl" onClick={onClose}>
      <motion.div
        initial={{ y: 22, opacity: 0, scale: 0.985, filter: 'blur(10px)' }}
        animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ y: 14, opacity: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="ht-glass my-6 w-full max-w-[620px] overflow-hidden rounded-[26px]"
      >
        <header className="flex items-center justify-between border-b border-white/[.07] px-5 py-3.5">
          <div>
            <span className="ht-label">identity</span>
            <h2 className="ht-title text-[19px]">Edit your profile</h2>
          </div>
          <button onClick={onClose} className="ht-btn ht-btn--ghost !px-2.5">✕</button>
        </header>

        {/* cover dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver('cover');
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(null);
            const f = e.dataTransfer.files?.[0];
            if (f) readFile(f, 'cover');
          }}
          className="relative h-[150px] overflow-hidden"
          style={{ outline: dragOver === 'cover' ? '2px dashed rgba(255,180,84,.6)' : 'none', outlineOffset: -6 }}
        >
          <img src={cover} alt="" className={cls('h-full w-full object-cover profile-cover-preview', coverChanged && 'profile-cover-preview--changed')} />
          <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.2),rgba(0,0,0,.9))' }} />
          <div className="absolute inset-x-4 bottom-3 flex flex-wrap items-center gap-2">
            {COVERS.slice(0, 5).map((c) => (
              <button key={c} onClick={() => { setCover(c); setCoverChanged(true); }} className={cls('h-9 w-14 overflow-hidden rounded-[8px] border transition-all', cover === c ? 'border-ember-400 shadow-heat' : 'border-white/15 hover:border-white/40')}>
                <img src={c} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
            <label className="ht-btn !py-1.5 !text-[11.5px] cursor-pointer !bg-black/50 backdrop-blur-md">
              Upload cover
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], 'cover')} />
            </label>
            <button onClick={() => { setCover(coverDataUri(handle + Date.now()) as unknown as string); setCoverChanged(true); }} className="ht-btn !py-1.5 !text-[11.5px] !bg-black/50 backdrop-blur-md">
              Generate
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-start gap-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver('avatar');
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const f = e.dataTransfer.files?.[0];
                if (f) readFile(f, 'avatar');
              }}
              className="relative shrink-0 rounded-full"
              style={{ outline: dragOver === 'avatar' ? '2px dashed rgba(255,180,84,.7)' : 'none', outlineOffset: 4 }}
            >
              <img src={avatar ?? avatarDataUri(name || 'you', handle)} alt="" className={cls('h-[76px] w-[76px] rounded-full border border-white/10 object-cover profile-avatar-preview', avatarChanged && 'profile-avatar-preview--changed')} />
              <label className="absolute inset-x-0 -bottom-1 mx-auto w-max cursor-pointer rounded-full border border-white/12 bg-[#0d0d0d] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-dim hover:text-ember-300">
                pfp
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], 'avatar')} />
              </label>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <Row label="Display name">
                <input value={name} maxLength={26} onChange={(e) => setName(e.target.value)} className="ht-input" />
              </Row>
              <Row label="Handle" hint={handleOk ? 'available' : 'invalid'} hintTone={handleOk ? 'ok' : 'bad'}>
                <div className="flex items-center overflow-hidden rounded-[12px] border border-white/[.09] bg-white/[.035] focus-within:border-ember-500/55">
                  <span className="pl-3 text-[14px] font-bold text-ember-400">@</span>
                  <input value={handle} onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase())} className="ht-input !border-0 !bg-transparent focus:!shadow-none" />
                </div>
              </Row>
            </div>
          </div>

          <Row label="Bio" hint={`${bio.length}/160`}>
            <textarea value={bio} maxLength={160} rows={3} onChange={(e) => setBio(e.target.value)} className="ht-input resize-none" placeholder="One line. Verbs beat adjectives." />
          </Row>

          <div className="grid gap-3 sm:grid-cols-2">
            <Row label="Location">
              <input value={location} maxLength={30} onChange={(e) => setLocation(e.target.value)} className="ht-input" placeholder="Lagos · GMT+1" />
            </Row>
            <Row label="Site">
              <input value={site} maxLength={44} onChange={(e) => setSite(e.target.value)} className="ht-input" placeholder="you.dev" />
            </Row>
          </div>

          <Row label="Interests — these are ranking multipliers" hint={`${interests.length} selected`}>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((tg) => {
                const on = interests.includes(tg);
                return (
                  <button
                    key={tg}
                    onClick={() => setInterests((p) => (on ? p.filter((x) => x !== tg) : [...p, tg]))}
                    className="rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-all"
                    style={{
                      borderColor: on ? 'rgba(245,154,43,.42)' : 'var(--ht-line)',
                      color: on ? 'var(--ht-whitehot)' : 'var(--ht-ink-mute)',
                      background: on ? 'linear-gradient(120deg,rgba(255,180,84,.2),rgba(255,203,120,.07))' : 'transparent',
                    }}
                  >
                    #{tg}
                  </button>
                );
              })}
            </div>
          </Row>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/[.07] px-5 py-3.5">
          <span className="text-[11.5px] text-ink-faint">
            {dirty ? 'Unsaved changes' : 'Everything saved locally · nothing leaves this device'}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="ht-btn ht-btn--ghost">
              Cancel
            </button>
            <button onClick={save} disabled={!dirty} className="ht-btn ht-btn--heat disabled:opacity-40">
              Save profile
            </button>
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
}

function Row({ label, hint, hintTone, children }: { label: string; hint?: string; hintTone?: 'ok' | 'bad'; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between">
        <span className="ht-label">{label}</span>
        {hint && <span className={cls('text-[11px] font-semibold', hintTone === 'bad' ? 'text-magma' : hintTone === 'ok' ? 'text-cryo-teal' : 'text-ink-faint')}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}
