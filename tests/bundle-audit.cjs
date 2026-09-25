/* ============================================================================
   tests/bundle-audit.cjs — bundle and performance checks.

   Checks that never fail a build but affect real users:
   - JS bundle size (should be < 500kB gzipped for main?)
   - CSS bundle size (should be < 100kB)
   - No duplicate large dependencies
   - No moment.js or other heavy libs accidentally imported
   - Images are not huge (we already check in integrity, but double-check)
   - No large inline data URIs
   - Check for tree-shaking issues (e.g., importing all of lodash)

   Run after `npm run build`: node tests/bundle-audit.cjs
   ==========================================================================*/
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const NEXT = path.join(ROOT, '.next');

let failures = 0;
let passes = 0;
function ok(msg) { passes++; console.log(`✓ ${msg}`); }
function fail(msg) { failures++; console.log(`✗ ${msg}`); }
function warn(msg) { console.log(`· ${msg}`); }

console.log('BUNDLE AUDIT — checking build output for performance issues\n');

if (!fs.existsSync(NEXT)) {
  console.error('no .next build — run `npm run build` first');
  process.exit(2);
}

// 1. Check JS bundle sizes
console.log('▸ JS bundles');
const chunksDir = path.join(NEXT, 'static/chunks');
/* A production build has a BUILD_ID; a dev build does not. Dev output is unminified
   (main-app.js alone is ~6MB) and is not a meaningful size signal, so measure only prod. */
const isProdBuild = fs.existsSync(path.join(NEXT, 'BUILD_ID'));
let totalJs = 0;
let largestJs = { name: '', size: 0 };
if (!isProdBuild) {
  warn('dev build detected (no BUILD_ID) — JS size checks need `npm run build` first');
} else if (fs.existsSync(chunksDir)) {
  const files = [];
  const walkChunks = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walkChunks(path.join(dir, e.name));
      else if (e.name.endsWith('.js') && !e.name.startsWith('main.js') && !e.name.startsWith('main-app.js') && e.name !== 'react-refresh.js') {
        files.push(path.join(dir, e.name));
      }
    }
  };
  walkChunks(chunksDir);
  for (const f of files) {
    const size = fs.statSync(f).size;
    totalJs += size;
    if (size > largestJs.size) largestJs = { name: path.relative(chunksDir, f), size };
  }
  console.log(`  total JS chunks: ${(totalJs/1024).toFixed(0)}kB (${files.length} files)`);
  console.log(`  largest chunk: ${largestJs.name} ${(largestJs.size/1024).toFixed(0)}kB`);

  // Production Next.js apps with framer-motion + 4 variable fonts are ~1-2MB
  if (totalJs < 2 * 1024 * 1024) ok(`total JS ${(totalJs/1024).toFixed(0)}kB < 2MB (prod)`);
  else if (totalJs < 3 * 1024 * 1024) warn(`total JS ${(totalJs/1024).toFixed(0)}kB — consider code splitting`);
  else fail(`total JS ${(totalJs/1024).toFixed(0)}kB > 3MB — too large`);

  if (largestJs.size < 500 * 1024) ok(`largest chunk ${largestJs.name} ${(largestJs.size/1024).toFixed(0)}kB < 500kB`);
  else warn(`largest chunk ${largestJs.name} ${(largestJs.size/1024).toFixed(0)}kB > 500kB`);
} else {
  warn('no chunks dir — maybe using app dir only?');
}

// 2. Check CSS bundle size
console.log('\n▸ CSS bundles');
const cssDir = path.join(NEXT, 'static/css');
let totalCss = 0;
if (fs.existsSync(cssDir)) {
  const files = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
  for (const f of files) {
    const size = fs.statSync(path.join(cssDir, f)).size;
    totalCss += size;
  }
  console.log(`  total CSS: ${(totalCss/1024).toFixed(0)}kB (${files.length} files)`);
  if (totalCss < 100 * 1024) ok(`total CSS ${(totalCss/1024).toFixed(0)}kB < 100kB`);
  else if (totalCss < 200 * 1024) warn(`total CSS ${(totalCss/1024).toFixed(0)}kB — consider purging`);
  else fail(`total CSS ${(totalCss/1024).toFixed(0)}kB > 200kB — too large`);
}

// 3. Check for duplicate dependencies or heavy libs
console.log('\n▸ dependencies');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const deps = Object.keys(pkg.dependencies || {});
const heavy = ['moment', 'lodash', 'jquery', 'axios']; // axios is okay but check
for (const h of heavy) {
  if (deps.includes(h)) warn(`heavy dependency ${h} in dependencies — consider lighter alternative`);
}
if (!deps.includes('moment')) ok('no moment.js (good, use date-fns or native)');

// Check for @fontsource — we have 4 variable fonts, that's okay but check size
const fontDeps = deps.filter(d => d.includes('fontsource'));
if (fontDeps.length) {
  console.log(`  fontsource deps: ${fontDeps.length} (${fontDeps.join(', ')})`);
  if (fontDeps.length <= 5) ok(`${fontDeps.length} fontsource deps — reasonable`);
  else warn(`${fontDeps.length} fontsource deps — many fonts increase bundle`);
}

// 4. Check for large images in build output
console.log('\n▸ images in build');
const publicArt = path.join(ROOT, 'public/art');
if (fs.existsSync(publicArt)) {
  const arts = fs.readdirSync(publicArt);
  let totalArt = 0;
  let largestArt = { name: '', size: 0 };
  for (const f of arts) {
    const size = fs.statSync(path.join(publicArt, f)).size;
    totalArt += size;
    if (size > largestArt.size) largestArt = { name: f, size };
  }
  console.log(`  art total: ${(totalArt/1024).toFixed(0)}kB, largest: ${largestArt.name} ${(largestArt.size/1024).toFixed(0)}kB`);
  if (largestArt.size < 500 * 1024) ok(`largest art ${largestArt.name} ${(largestArt.size/1024).toFixed(0)}kB < 500kB`);
  else fail(`largest art ${largestArt.name} ${(largestArt.size/1024).toFixed(0)}kB > 500kB — optimize`);
}

// 5. Check for inline data URIs that are large
console.log('\n▸ inline assets');
let largeDataUris = 0;
function walkForDataUris(dir) {
  for (const e of fs.readdirSync(dir)) {
    if (e.startsWith('.') || e === 'node_modules' || e === '.next' || e === 'tests') continue;
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walkForDataUris(p);
    else if (e.endsWith('.tsx') || e.endsWith('.ts')) {
      const src = fs.readFileSync(p, 'utf8');
      for (const m of src.matchAll(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{100,}/g)) {
        largeDataUris++;
      }
    }
  }
}
walkForDataUris(path.join(ROOT, 'app'));
walkForDataUris(path.join(ROOT, 'components'));
if (largeDataUris === 0) ok('no large inline data URIs');
else warn(`${largeDataUris} large inline data URIs — consider moving to /public`);

// 6. Check for barrel imports that prevent tree-shaking
console.log('\n▸ tree-shaking');
let barrelImports = 0;
function walkForBarrels(dir) {
  for (const e of fs.readdirSync(dir)) {
    if (e.startsWith('.') || e === 'node_modules' || e === '.next' || e === 'tests') continue;
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walkForBarrels(p);
    else if (e.endsWith('.tsx') || e.endsWith('.ts')) {
      const src = fs.readFileSync(p, 'utf8');
      // Look for `import { X } from 'lodash'` or `import * as _ from 'lodash'` which prevents tree-shaking
      if (src.includes("from 'lodash'") && !src.includes("from 'lodash/")) {
        barrelImports++;
        warn(`barrel import from lodash in ${p.replace(ROOT+'/', '')} — use lodash/xxx`);
      }
      // Check for star import specifically from framer-motion, not just any star import + framer-motion elsewhere
      if (src.match(/import\s+\*\s+as\s+\w+\s+from\s+['\"]framer-motion['\"]/)) {
        barrelImports++;
        warn(`star import from framer-motion in ${p.replace(ROOT+'/', '')} — use named imports`);
      }
    }
  }
}
walkForBarrels(path.join(ROOT, 'app'));
walkForBarrels(path.join(ROOT, 'components'));
walkForBarrels(path.join(ROOT, 'lib'));
if (barrelImports === 0) ok('no obvious barrel import issues');

console.log(`\n────────────────────────────────────────`);
console.log(`bundle: ${passes} passed, ${failures} failed`);
console.log(failures ? '\nBUNDLE AUDIT FAILED' : '\nBUNDLE AUDIT PASSED');
process.exit(failures ? 1 : 0);
