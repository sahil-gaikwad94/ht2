/* ============================================================================
   scripts/palette-sweep.mjs — one-shot migration of the accent system.

   heatt v1 shipped an electric-emerald accent. That read as "fintech neon":
   high-chroma green on black is the single most over-used dark-UI accent and
   it fights the actual metaphor — a platform whose data model is temperature
   should look like a forge, not a terminal.

   The replacement is a two-tone thermal system on the same charcoal rooms:

     accent  →  molten amber   (active, ignition, "this is happening")
     counter →  ice cyan        (cooled, archived, "this settled")

   Amber is the warm end of the blackbody ramp and the only accent that reads
   as *heat* without turning into a fire emoji; ice cyan keeps the cold half of
   the metaphor legible and gives the palette a real complement instead of two
   greens arguing. Values below are the ones now declared in globals.css and
   tailwind.config.ts — this script exists so the migration is auditable and
   repeatable rather than a pile of hand edits.
   ==========================================================================*/

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIRS = ['app', 'components', 'lib'];
const EXT = /\.(tsx?|css)$/;

/* hex migrations -------------------------------------------------------- */
const HEX = [
  // the accent ramp: green → molten amber
  ['#EAFFF7', '#FFF8ED'],
  ['#C6FFE7', '#FFEFD4'],
  ['#8AFFD0', '#FFDFAC'],
  ['#4BF7B3', '#FFCB7D'],
  ['#00E5A0', '#FFB454'],
  ['#00C98C', '#F59A2B'],
  ['#00A876', '#D97B12'],
  ['#067F5C', '#A85C0B'],
  ['#0A5440', '#6E3C08'],
  ['#062E23', '#3A2104'],
  ['#7CFFD0', '#FFC978'],
  ['#B8FFE3', '#FFE3B0'],
  ['#F2FFFA', '#FFF6E8'],
  ['#2EF2A6', '#EFCB8B'],
  // ink printed *on* an accent fill: black-green → black-amber
  ['#04140E', '#1A0E02'],
  // the cold counterweight stays cold, retuned to sit under amber
  ['#3DDCFF', '#63D8F5'],
  ['#7AA2FF', '#8AA6FF'],
  ['#B07CFF', '#B98CFF'],
];

/* the same values in rgb(), for rgba() glass and glow shadows ---------- */
const RGB = [
  ['0, 229, 160', '255, 180, 84'],
  ['0,229,160', '255,180,84'],
  ['0, 201, 140', '245, 154, 43'],
  ['0,201,140', '245,154,43'],
  ['184, 255, 227', '255, 227, 176'],
  ['184,255,227', '255,227,176'],
  ['61, 220, 255', '99, 216, 245'],
  ['61,220,255', '99,216,245'],
  ['122, 162, 255', '138, 166, 255'],
  ['122,162,255', '138,166,255'],
  ['176, 124, 255', '185, 140, 255'],
  ['176,124,255', '185,140,255'],
  ['242, 255, 250', '255, 246, 232'],
  ['242,255,250', '255,246,232'],
  ['138, 255, 208', '255, 223, 172'],
  ['138,255,208', '255,223,172'],
  ['200, 255, 236', '255, 240, 214'],
  ['200,255,236', '255,240,214'],
  ['4, 20, 14', '26, 14, 2'],
  ['4,20,14', '26,14,2'],
  ['0, 168, 118', '217, 123, 18'],
  ['0,168,118', '217,123,18'],
];

/* hsl hue families used by the procedural avatar/cover generators.
   v1 spanned 146-212 (green → cyan). Swap to amber/gold → ice/steel. */
const HSL = [
  ['hsl(${hue} 55% ', 'hsl(${hue} 42% '],
  ['146 + ((h >> i) % 66)', 'AMBER_HUE_EXPR'],
];

const files = [];
function walk(dir) {
  for (const e of readdirSync(dir)) {
    if (e.startsWith('.') || e === 'node_modules' || e === '.next' || e === '.tmp-client') continue;
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (EXT.test(e)) files.push(p);
  }
}
for (const d of DIRS) walk(path.join(ROOT, d));
files.push(path.join(ROOT, 'tailwind.config.ts'));

let touched = 0;
let edits = 0;
for (const f of files) {
  let src = readFileSync(f, 'utf8');
  const before = src;
  for (const [from, to] of HEX) src = src.split(from).join(to);
  for (const [from, to] of RGB) src = src.split(from).join(to);
  void HSL;
  if (src !== before) {
    writeFileSync(f, src);
    touched++;
    for (const [from] of [...HEX, ...RGB]) {
      edits += before.split(from).length - 1;
    }
  }
}
console.log(`palette-sweep: ${edits} substitutions across ${touched} files`);
