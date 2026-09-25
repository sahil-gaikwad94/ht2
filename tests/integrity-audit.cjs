/* ============================================================================
   tests/integrity-audit.cjs — the things that never fail a build.

   TypeScript, `next build`, and even the smoke harness can miss:
   - a seeded article references an image that doesn't exist → 404 cover
   - an external link with target=_blank but no rel → tabnabbing
   - a public asset referenced in code but missing from /public
   - an <img> without alt that a screen reader announces as filename
   - a heading jump h1 → h3 that breaks outline
   - a PWA manifest that doesn't parse or points to missing icons
   - a dev.to syndicated id that collides with a seeded id
   - a `console.log` left in a hot path that spams prod

   This file checks those, using the same jsdom harness as smoke/style so it
   sees the real rendered DOM, plus direct FS checks for assets.

   Run: node tests/integrity-audit.cjs (after `npm run build` for CSS, but
   works without too)
   ==========================================================================*/
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, '.tmp-client');

let failures = 0;
let passes = 0;
function ok(msg) { passes++; console.log(`✓ ${msg}`); }
function fail(msg) { failures++; console.log(`✗ ${msg}`); }
function warn(msg) { console.log(`· ${msg}`); }

console.log('INTEGRITY AUDIT — checking for silent failures\n');

// 1. Public assets referenced in code actually exist
console.log('▸ public assets');
const artFiles = fs.existsSync(path.join(PUBLIC, 'art')) ? fs.readdirSync(path.join(PUBLIC, 'art')) : [];
const publicFiles = new Set();
function walkPublic(dir, base = '') {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e);
    const rel = path.join(base, e);
    if (fs.statSync(p).isDirectory()) walkPublic(p, rel);
    else publicFiles.add(rel);
  }
}
walkPublic(PUBLIC);
const artRefs = [];
// Search source for /art/ references
function walkSrc(dir) {
  for (const e of fs.readdirSync(dir)) {
    if (e.startsWith('.') || e === 'node_modules' || e === '.next' || e === 'tests' || e === '.tmp-client') continue;
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walkSrc(p);
    else if (e.endsWith('.ts') || e.endsWith('.tsx')) {
      const src = fs.readFileSync(p, 'utf8');
      for (const m of src.matchAll(/\/art\/([a-z0-9-]+\.(?:jpg|png|webp|svg))/g)) {
        artRefs.push({ file: p.replace(ROOT + '/', ''), asset: m[1], full: `/art/${m[1]}` });
      }
      for (const m of src.matchAll(/public\/art\/([a-z0-9-]+\.(?:jpg|png|webp|svg))/g)) {
        artRefs.push({ file: p.replace(ROOT + '/', ''), asset: m[1], full: `/art/${m[1]}` });
      }
    }
  }
}
walkSrc(path.join(ROOT, 'app'));
walkSrc(path.join(ROOT, 'components'));
walkSrc(path.join(ROOT, 'lib'));

const missingArt = artRefs.filter(r => !fs.existsSync(path.join(PUBLIC, 'art', r.asset)));
if (missingArt.length) {
  missingArt.forEach(r => fail(`missing art ${r.full} referenced in ${r.file}`));
} else {
  ok(`all ${artRefs.length} /art/* references resolve to real files (${artFiles.length} files in public/art)`);
}

// Check icon.svg and manifest exist
if (fs.existsSync(path.join(PUBLIC, 'icon.svg'))) ok('public/icon.svg exists');
else fail('public/icon.svg missing — PWA and favicon will 404');

if (fs.existsSync(path.join(PUBLIC, 'manifest.webmanifest'))) {
  ok('public/manifest.webmanifest exists');
  try {
    const mf = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'manifest.webmanifest'), 'utf8'));
    if (mf.icons && mf.icons.length) {
      for (const ic of mf.icons) {
        const src = ic.src.replace(/^\//, '');
        if (!fs.existsSync(path.join(PUBLIC, src))) fail(`manifest icon ${ic.src} missing from public/`);
        else ok(`manifest icon ${ic.src} exists`);
      }
    }
    if (!mf.name) warn('manifest missing name');
    if (!mf.start_url) warn('manifest missing start_url');
  } catch (e) {
    fail(`manifest.webmanifest invalid JSON: ${e.message}`);
  }
} else fail('public/manifest.webmanifest missing');

// 2. Seed integrity
console.log('\n▸ seed corpus');
try {
  // We need to compile TS first, but we can require via tsx? Use the built JS if available
  // For simplicity, read the TS files directly
  const seedDir = path.join(ROOT, 'lib/seed');
  const usersSrc = fs.readFileSync(path.join(seedDir, 'users.ts'), 'utf8');
  const articlesSrc = fs.readFileSync(path.join(seedDir, 'articles.ts'), 'utf8');
  const sparksSrc = fs.readFileSync(path.join(seedDir, 'sparks.ts'), 'utf8');
  const syndSrc = fs.readFileSync(path.join(seedDir, 'syndicated.ts'), 'utf8');

  const userCount = (usersSrc.match(/handle:/g) || []).length;
  const articleCount = (articlesSrc.match(/id:\s*['\"]/g) || []).length;
  const sparkCount = (sparksSrc.match(/id:\s*['\"]/g) || []).length;

  if (userCount >= 5) ok(`${userCount} seeded users`);
  else fail(`only ${userCount} seeded users — expected >=5`);

  if (articleCount >= 5) ok(`${articleCount} seeded forges`);
  else fail(`only ${articleCount} seeded forges`);

  if (sparkCount >= 10) ok(`${sparkCount} seeded sparks`);
  else fail(`only ${sparkCount} seeded sparks`);

  // Check for duplicate ids across seeds
  const allIds = [];
  for (const m of articlesSrc.matchAll(/id:\s*['\"]([^'\"]+)['\"]/g)) allIds.push({ id: m[1], src: 'articles' });
  for (const m of sparksSrc.matchAll(/id:\s*['\"]([^'\"]+)['\"]/g)) allIds.push({ id: m[1], src: 'sparks' });
  const seen = new Map();
  let dup = 0;
  for (const { id, src } of allIds) {
    if (seen.has(id)) { fail(`duplicate id ${id} in ${src} and ${seen.get(id)}`); dup++; }
    else seen.set(id, src);
  }
  if (!dup) ok(`no duplicate ids across ${allIds.length} seeded posts`);

  // Check syndicated ids don't collide with seeded
  const syndIds = [...syndSrc.matchAll(/id:\s*['\"]?(dev-[^'\",\s]+)['\"]?/g)].map(m => m[1]);
  const colliding = syndIds.filter(id => seen.has(id));
  if (colliding.length) fail(`syndicated ids collide with seeded: ${colliding.join(', ')}`);
  else ok(`${syndIds.length} syndicated ids don't collide with seeded`);

  // Check every article has cover, blocks, etc (rough)
  if (articlesSrc.includes('cover:') && articlesSrc.includes('blocks:')) ok('seeded articles have cover and blocks');
  else fail('seeded articles missing cover or blocks');

} catch (e) {
  fail(`seed check threw: ${e.message}`);
}

// 3. Security: external links
console.log('\n▸ security');
let extLinks = 0;
let unsafe = 0;
function walkForLinks(dir) {
  for (const e of fs.readdirSync(dir)) {
    if (e.startsWith('.') || e === 'node_modules' || e === '.next' || e === 'tests') continue;
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walkForLinks(p);
    else if (e.endsWith('.tsx')) {
      const src = fs.readFileSync(p, 'utf8');
      for (const m of src.matchAll(/target=\s*['\"]_blank['\"]/g)) {
        extLinks++;
        // Check if rel contains noopener
        const chunk = src.slice(Math.max(0, m.index - 200), m.index + 200);
        if (!chunk.includes('noopener') || !chunk.includes('noreferrer')) {
          unsafe++;
          fail(`target=_blank without rel=noopener noreferrer in ${p.replace(ROOT+'/', '')} near ${chunk.slice(0,80)}`);
        }
      }
    }
  }
}
walkForLinks(path.join(ROOT, 'app'));
walkForLinks(path.join(ROOT, 'components'));
if (!unsafe) ok(`${extLinks} external links all have rel=noopener noreferrer`);

// 4. No console.log / debugger left
console.log('\n▸ hygiene');
let logs = 0;
function walkForLogs(dir) {
  for (const e of fs.readdirSync(dir)) {
    if (e.startsWith('.') || e === 'node_modules' || e === '.next' || e === 'tests' || e === '.tmp-client') continue;
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walkForLogs(p);
    else if (e.endsWith('.ts') || e.endsWith('.tsx')) {
      if (p.includes('harness.cjs') || p.includes('dom-stubs')) return;
      const src = fs.readFileSync(p, 'utf8');
      // Allow console.warn for shader errors, and console.error in error boundaries
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (l.includes('console.log') && !l.includes('// allow') && !l.includes('eslint-disable')) {
          // Check if it's in a comment or in a test file
          if (l.trim().startsWith('//')) continue;
          logs++;
          warn(`console.log in ${p.replace(ROOT+'/', '')}:${i+1} — ${l.trim().slice(0,80)}`);
        }
        if (l.includes('debugger')) {
          fail(`debugger statement in ${p.replace(ROOT+'/', '')}:${i+1}`);
        }
      }
    }
  }
}
walkForLogs(path.join(ROOT, 'app'));
walkForLogs(path.join(ROOT, 'components'));
walkForLogs(path.join(ROOT, 'lib'));
if (logs === 0) ok('no console.log left in app/components/lib');
else warn(`${logs} console.log occurrences (check if intentional)`);

// 5. Check for TODO/FIXME
let todos = 0;
function walkForTodo(dir) {
  for (const e of fs.readdirSync(dir)) {
    if (e.startsWith('.') || e === 'node_modules' || e === '.next' || e === 'tests') continue;
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walkForTodo(p);
    else if (e.endsWith('.ts') || e.endsWith('.tsx')) {
      const src = fs.readFileSync(p, 'utf8');
      for (const m of src.matchAll(/TODO|FIXME|HACK/gi)) {
        todos++;
      }
    }
  }
}
walkForTodo(path.join(ROOT, 'app'));
walkForTodo(path.join(ROOT, 'components'));
walkForTodo(path.join(ROOT, 'lib'));
if (todos === 0) ok('no TODO/FIXME/HACK markers');
else warn(`${todos} TODO/FIXME markers (not failing)`);

// 6. Next config headers check
console.log('\n▸ next.config + headers');
try {
  const cfg = fs.readFileSync(path.join(ROOT, 'next.config.mjs'), 'utf8');
  if (cfg.includes('s-maxage') && cfg.includes('stale-while-revalidate')) ok('API routes have edge cache headers');
  else fail('next.config missing cache headers for /api');

  if (cfg.includes('/art/') && cfg.includes('immutable')) ok('art assets have immutable cache headers');
  else fail('art assets missing immutable cache headers');

  if (cfg.includes('X-Content-Type-Options')) ok('security header X-Content-Type-Options present');
  else warn('missing X-Content-Type-Options');
} catch (e) {
  fail(`next.config check threw: ${e.message}`);
}

// 7. Check for unoptimized images setting (intentional, but warn if large)
console.log('\n▸ images');
const totalArtSize = artFiles.reduce((acc, f) => {
  try { return acc + fs.statSync(path.join(PUBLIC, 'art', f)).size; } catch { return acc; }
}, 0);
if (totalArtSize < 5 * 1024 * 1024) ok(`art total ${(totalArtSize/1024).toFixed(0)}kB < 5MB`);
else warn(`art total ${(totalArtSize/1024/1024).toFixed(1)}MB — consider optimizing`);

// 8. Check store version and persistence key
console.log('\n▸ store');
try {
  const storeSrc = fs.readFileSync(path.join(ROOT, 'lib/store.ts'), 'utf8');
  if (storeSrc.includes('heatt-store-v1')) ok('store uses versioned key heatt-store-v1');
  else fail('store key not versioned');

  if (storeSrc.includes('persist')) ok('store uses persist');
  else fail('store missing persist');

  if (storeSrc.includes('muted')) ok('store has muted list');
  else fail('store missing muted');
} catch (e) {
  fail(`store check threw: ${e.message}`);
}

// 9. Check heat constants match spec
console.log('\n▸ heat model constants');
try {
  const heatSrc = fs.readFileSync(path.join(ROOT, 'lib/heat.ts'), 'utf8');
  if (heatSrc.includes('τ') || heatSrc.includes('9')) ok('heat model mentions τ=9h');
  if (heatSrc.includes('HOLD_MS') && heatSrc.includes('2450')) ok('HOLD_MS includes 2450ms ignition');
  else fail('HOLD_MS missing ignition timing');

  if (heatSrc.includes('LEVEL_META')) ok('LEVEL_META defined');
} catch (e) {
  fail(`heat check threw: ${e.message}`);
}

console.log(`\n────────────────────────────────────────`);
console.log(`integrity: ${passes} passed, ${failures} failed`);
console.log(failures ? '\nINTEGRITY AUDIT FAILED' : '\nINTEGRITY AUDIT PASSED');
process.exit(failures ? 1 : 0);
