/* ============================================================================
   tests/style-audit.cjs — does every class the app actually renders compile?

   Tailwind v3 silently drops anything it does not recognise — a colour modifier
   whose opacity step is missing from the scale (`bg-ember-500/12` emitted
   nothing at all), a typo'd token, a `.ht-*` primitive referenced before it is
   defined. None of those fail a build, a typecheck or a test that only checks
   text. So: render every surface in jsdom, read the class attribute off the
   real DOM, and look for a matching rule in the compiled production CSS.

   Ground truth from the DOM (not regex over source) means state-only styling —
   the ignited card, the open modal, the expanded heat grid — is covered too,
   because this file drives into those states first.

   The compiled CSS is parsed by extracting selector blocks and unescaping
   Tailwind's escaped class names (e.g. `.bg-\[linear-gradient\(140deg\2c \#FFD...\`
   → `bg-[linear-gradient(140deg,#FFD...)]`), so arbitrary values like
   `text-[clamp(...)]` and `bottom-[max(...)]` are correctly recognised.
   ==========================================================================*/
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { install, H } = require('./smoke/harness.cjs');
const React = require('react');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.tmp-client');
const CSS_DIR = path.join(ROOT, '.next/static/css');

const env = install();
const { window, act, mount, flush } = env;
const doc = window.document;
const U = H(doc);
const nav = require('./smoke/dom-stubs/next-navigation.js');

const { useStore } = require('@/lib/store');
const ShellProviders = require('@/components/boot/ShellProviders').ShellProviders;
const BootLayer = require('@/components/boot/BootLayer').BootLayer;
const ShellLayout = require(path.join(OUT, 'app/(shell)/layout.js')).default;
const page = (rel) => require(path.join(OUT, rel)).default;

const wait = (ms = 60) => act(async () => new Promise((r) => setTimeout(r, ms)));
const btn = (re, sel = 'button') => U.allByText(sel, re)[0] || null;

const tokens = new Map(); // class -> Set of surfaces it appeared on
let surface = 'boot';
function harvest() {
  for (const el of doc.querySelectorAll('*')) {
    const cls = el.getAttribute && el.getAttribute('class');
    if (!cls) continue;
    for (const t of cls.split(/\s+/)) {
      if (!t) continue;
      if (!tokens.has(t)) tokens.set(t, new Set());
      tokens.get(t).add(surface);
    }
  }
}

async function visit(label, rel, opts = {}) {
  surface = label;
  if (rel) {
    nav.__state.path = opts.path || '/' + label.split(' ')[0].replace(/[^a-z]/gi, '');
    if (opts.params) nav.__state.params = opts.params;
    await mount(
      React.createElement(ShellProviders, null,
        React.createElement(BootLayer, null,
          React.createElement(ShellLayout, null, React.createElement(page(rel)))))
    );
    await flush(3);
  }
  if (opts.after) await opts.after();
  harvest();
}

function unescapeCss(s) {
  return s
    .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\(.)/g, '$1');
}

function extractCompiledClasses(cssText) {
  const classes = new Set();
  // Split into rule blocks: selector { body }
  const ruleRe = /([^{}]+)\{[^{}]*\}/g;
  let m;
  while ((m = ruleRe.exec(cssText)) !== null) {
    const selectorBlock = m[1];
    const selectors = selectorBlock.split(',');
    for (let sel of selectors) {
      sel = sel.trim();
      // Extract class names from selector.
      // Tailwind escapes special chars, so we need to allow \hex and \char
      // Class name pattern: dot + (escaped or allowed chars) repeating
      // Allowed chars in Tailwind class: alphanum, -, _, :, [, ], /, (, ), #, %, !, ., +, etc
      // We also need to handle variant colons which are escaped as \:
      const classRe = /\.((?:\\[0-9a-fA-F]{1,6}\s?|\\.|[A-Za-z0-9\-_:\[\]\/\(\)#%!.,+])+)/g;
      let cm;
      while ((cm = classRe.exec(sel)) !== null) {
        const raw = cm[1];
        let unesc = unescapeCss(raw);
        // Tailwind's placeholder variant emits .placeholder\:text-...::placeholder and ::-moz-placeholder
        // Strip those first, otherwise the later pseudo-stripping loop mangles them.
        unesc = unesc.replace(/::?-moz-placeholder$/, '');
        unesc = unesc.replace(/::(before|after|marker|selection|file|placeholder|backdrop|first-letter|first-line)$/, '');
        // Then strip single-colon pseudos appended for hover/focus etc: hover:bg-red-500:hover -> hover:bg-red-500
        const pseudos = [
          'hover','focus','focus-visible','focus-within','active','visited','disabled',
          'checked','first','last','odd','even','first-child','last-child','only-child',
          'empty','before','after','marker','selection','file','placeholder','backdrop',
          'open','default','required','valid','invalid','in-range','out-of-range',
          'read-only','placeholder-shown','autofill','first-of-type','last-of-type',
          'only-of-type'
        ];
        for (let i = 0; i < 3; i++) {
          const lastColon = unesc.lastIndexOf(':');
          if (lastColon === -1) break;
          const after = unesc.slice(lastColon + 1);
          const isPseudo = pseudos.some(p => after === p || after.startsWith(p + '(') || after.startsWith(p + ':'));
          if (isPseudo && unesc.split(':').length > 1) {
            unesc = unesc.slice(0, lastColon);
            continue;
          }
          break;
        }
        // Final safety: single-colon before/after that survived
        unesc = unesc.replace(/:(before|after|marker|selection|file|placeholder|backdrop)$/, (m, p) => {
          return unesc.split(':').length > 1 ? '' : m;
        });
        if (unesc) classes.add(unesc);
      }
    }
  }
  return classes;
}

(async () => {
  if (!fs.existsSync(CSS_DIR)) {
    console.error('no compiled CSS — run `npm run build` first (the audit diffs against production CSS)');
    process.exit(2);
  }
  /* css may live at .next/static/css/<name>.css (prod) or .next/static/css/app/layout.css (dev) */
  const cssFiles = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
      else if (e.name.endsWith('.css')) cssFiles.push(path.join(dir, e.name));
    }
  };
  walk(CSS_DIR);
  if (!cssFiles.length) {
    console.error('no compiled CSS found — run `npm run build` first');
    process.exit(2);
  }
  const css = cssFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const globals = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
  const twConfig = fs.readFileSync(path.join(ROOT, 'tailwind.config.ts'), 'utf8');

  const compiledFromCss = extractCompiledClasses(css);
  // Also include classes defined in globals.css (ht- primitives are there, but also in compiled css)
  const compiledFromGlobals = extractCompiledClasses(globals);
  const compiled = new Set([...compiledFromCss, ...compiledFromGlobals]);

  useStore.setState({
    introSeen: true,
    onboarded: true,
    me: { handle: 'auditor', name: 'Style Auditor', bio: 'Checking that the CSS exists.', avatar: null, tags: [], followers: 12, following: 3, thermalMass: 1.1 },
    heat: { 'sp-01': { level: 2, at: Date.now() } },
    saved: { 'orig-heat-diffusion': Date.now() },
    reads: { 'orig-heat-diffusion': { pct: 62, at: Date.now() } },
    follows: ['nyra'],
    notifications: [{ id: 'n1', type: 'ignite', actor: 'nyra', text: 'ignited your spark', at: Date.now() - 3600e3, read: false }],
    activity: { [new Date().toISOString().slice(0, 10)]: { reads: 3, heats: 5, ignites: 2, posts: 1, minutes: 12 } },
  });

  /* ---------------------------------------------------- every app surface */
  await visit('feed', 'app/(shell)/feed/page.js', {
    path: '/feed',
    async after() {
      const temp = U.q('[aria-label="Toggle the heat trace"]') || U.q('.ht-card [aria-label*="trace" i]');
      if (temp) await U.click(temp);
      const menu = U.q('[aria-label="Post options"]');
      if (menu) await U.click(menu);
      await wait(120);
      if (menu) await U.click(U.q('body'));
    },
  });

  await visit('igniting card', 'app/(shell)/feed/page.js', {
    path: '/feed',
    async after() {
      const hb = U.q('.ht-heat-btn');
      if (!hb) return;
      U.pointer(hb, 'pointerdown');
      await wait(1200);
      U.pointer(hb, 'pointermove');
      await wait(1400);
      U.pointer(hb, 'pointerup');
      await wait(200);
    },
  });

  await visit('reader', 'app/(shell)/read/[id]/page.js', {
    path: '/read/orig-heat-diffusion',
    params: { id: 'orig-heat-diffusion' },
    async after() {
      const ctrl = U.q('[aria-label="Reading controls"]');
      if (ctrl) await U.click(ctrl);
      await wait(120);
    },
  });

  await visit('offline reader', 'app/(shell)/read/[id]/page.js', {
    path: '/read/dev-4652133',
    params: { id: 'dev-4652133' },
    async after() {
      await wait(500);
    },
  });

  await visit('explore', 'app/(shell)/explore/page.js', { path: '/explore' });
  await visit('library', 'app/(shell)/library/page.js', { path: '/library' });
  await visit('notifications', 'app/(shell)/notifications/page.js', { path: '/notifications' });
  await visit('settings', 'app/(shell)/settings/page.js', { path: '/settings' });
  await visit('heatmap', 'app/(shell)/heatmap/page.js', {
    path: '/heatmap',
    async after() {
      const grid = U.q('[aria-label="Daily heat activity grid"]');
      if (grid) await U.click(grid.querySelector('rect') || grid);
      await wait(120);
    },
  });
  await visit('profile', 'app/(shell)/u/[handle]/page.js', {
    path: '/u/auditor',
    params: { handle: 'auditor' },
    async after() {
      const edit = U.byText('button', /Edit profile/i);
      if (edit) {
        await U.click(edit);
        await wait(200);
      }
    },
  });
  await visit('other profile', 'app/(shell)/u/[handle]/page.js', {
    path: '/u/nyra',
    params: { handle: 'nyra' },
    async after() {
      const follow = U.byText('button', /^Follow$/);
      if (follow) await U.click(follow);
      await wait(80);
    },
  });
  await visit('landing', 'app/page.js', { path: '/' });

  /* ------------------------------------------------------- global overlays */
  surface = 'palette';
  await visit('feed again', 'app/(shell)/feed/page.js', {
    path: '/feed',
    async after() {
      await U.key(window, 'k', { metaKey: true });
      await wait(200);
      harvest();
      await U.key(doc, 'Escape');
      await wait(100);

      surface = 'composer';
      const compose = U.q('[aria-label="Compose"]');
      if (compose) {
        await U.click(compose);
        await wait(220);
        const poll = U.byText('button', /^poll$/i);
        if (poll) await U.click(poll);
        await wait(120);
        harvest();
        const close = U.byText('button', /✕|Close|Discard/i);
        if (close) await U.click(close);
        await wait(120);
      }

      surface = 'share studio';
      const share = U.q('[aria-label="Make a share poster"]');
      if (share) {
        await U.click(share);
        await wait(320);
        harvest();
        const fmt = U.byText('button', /Link 16:9/i);
        if (fmt) await U.click(fmt);
        await wait(200);
        harvest();
      }

      surface = 'thread sheet';
      const reply = U.q('[aria-label^="Reply to"]');
      if (reply) {
        await U.click(reply);
        await wait(240);
        harvest();
      }
    },
  });

  /* ------------------------------------------------------ onboarding + intro */
  surface = 'onboarding';
  useStore.setState({ introSeen: true, onboarded: false });
  await mount(React.createElement(ShellProviders, null, React.createElement(BootLayer, null, React.createElement('div', null, 'app'))));
  await flush(4);
  harvest();
  for (let i = 0; i < 5; i++) {
    const next = btn(/Continue|Ignite feed/);
    if (!next || next.disabled) break;
    await U.click(next);
    await wait(220);
    harvest();
  }

  surface = 'intro';
  useStore.setState({ introSeen: false, onboarded: false });
  await mount(React.createElement(ShellProviders, null, React.createElement(BootLayer, null, React.createElement('div', null, 'app'))));
  await flush(6);
  harvest();

  /* --------------------------------------------------------------- verdict */
  const htDefined = new Set([...globals.matchAll(/\.ht-[a-z0-9-]+/g)].map((m) => m[0].slice(1)));
  for (const st of doc.querySelectorAll('style')) {
    for (const m of (st.textContent || '').matchAll(/\.(ht-[a-z0-9-]+)/g)) htDefined.add(m[1]);
  }

  // Marker classes that are valid but don't need a CSS rule
  const isMarker = (t) => {
    if (t === 'group' || t === 'peer') return true;
    if (/^(group|peer)\//.test(t)) return true; // group/blk, peer/foo, group-hover/..., etc handled via compiled set
    if (/^(group|peer)-/.test(t)) return true; // group-hover, peer-focus etc as base? Actually group-hover is variant, not base
    if (/^language-/.test(t)) return true; // hljs
    if (/^hljs/.test(t)) return true;
    if (t.startsWith('data-')) return true;
    return false;
  };

  const missingUtility = [];
  const missingHt = [];
  for (const [tok, where] of tokens) {
    if (tok.startsWith('ht-')) {
      const base = tok.split('--')[0];
      if (!htDefined.has(base) && !htDefined.has(tok) && !compiled.has(tok) && !compiled.has(base)) {
        missingHt.push([tok, [...where].join(',')]);
      }
      continue;
    }
    if (isMarker(tok)) continue;
    // Tailwind arbitrary variants like group-hover/act:-translate-y-[1px] are in compiled set as full string
    // So check compiled set, and also check if token is a variant that would be covered by group
    if (!compiled.has(tok)) {
      // For tokens like "group/blk" we already skipped, but for "group-hover/act:-translate-y-[1px]" we should have it
      // Also handle tokens that are like "2xl:right-10" etc - they should be in compiled
      // If not found, try to see if it's a responsive variant that might be in compiled with same name
      // Final check: is it a known Tailwind marker that doesn't emit CSS?
      missingUtility.push([tok, [...where].join(',')]);
    }
  }

  const keyframeRefs = [...globals.matchAll(/animation:\s*([a-zA-Z][a-zA-Z0-9-]*)/g)].map((m) => m[1]);
  const keyframesDef = new Set([...globals.matchAll(/@keyframes\s+([a-zA-Z0-9-]+)/g)].map((m) => m[1]));
  const missingKeyframes = [...new Set(keyframeRefs)].filter((k) => !keyframesDef.has(k) && !twConfig.includes(`${k}:`));

  console.log(`rendered surfaces: ${new Set([...tokens.values()].flatMap((s) => [...s])).size}`);
  console.log(`class tokens seen in the DOM: ${tokens.size} · selectors compiled: ${compiled.size} · css ${css.length} bytes`);
  console.log('');
  if (missingUtility.length) {
    console.log(`✗ ${missingUtility.length} utility class(es) render with no compiled rule:`);
    for (const [t, w] of missingUtility.sort()) console.log(`   ${t}   (${w})`);
  } else console.log('✓ every rendered utility class has a compiled rule');
  console.log('');
  if (missingHt.length) {
    console.log(`✗ ${missingHt.length} .ht-* class(es) rendered but never defined:`);
    for (const [t, w] of missingHt.sort()) console.log(`   .${t}   (${w})`);
  } else console.log('✓ every rendered .ht-* primitive is defined in globals.css');
  console.log('');
  if (missingKeyframes.length) console.log(`✗ animation references a missing @keyframes: ${missingKeyframes.join(', ')}`);
  else console.log('✓ every animation shorthand resolves to a real @keyframes');

  const bad = missingUtility.length + missingHt.length + missingKeyframes.length;
  console.log(bad ? `\nSTYLE AUDIT FAILED (${bad})` : '\nSTYLE AUDIT PASSED');
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.log(`HARNESS THREW: ${e.stack.split('\n').slice(0, 8).join('\n   ')}`);
  process.exit(2);
});
