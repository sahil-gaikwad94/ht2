/* ============================================================================
   heatt — "Heat Diffusion" ranking engine (spec §8)

   Models the platform as a bipartite graph of users ↔ content. Every
   engagement action injects temperature into a content node; temperature
   then obeys Newton's law of cooling and diffuses across the graph through
   the thermal mass (reputation) of the interacting users.

   T(t) = Σᵢ w·mᵢ·e^(-(t-tᵢ)/τ)  +  κ·∇²T  —  rank = log(T) · velocity^β

   `semanticCliffTruncate()` finds the steepest local drop in the sorted
   logit curve and demotes everything past it, so the feed only surfaces
   content that is still actively burning.
   ==========================================================================*/

import type { HeatLevel } from './types';

export const K = {
  /** Newton cooling time constant, hours */
  tau: 9,
  /** fast decay used for the "still burning" velocity signal, hours */
  tauFast: 2.6,
  /** weight of a heat action by level */
  heatW: [0, 1, 2.6, 6.5] as const,
  /** weight of a read completion */
  readW: 0.9,
  /** weight of a bookmark (intent to return = stored energy) */
  saveW: 1.3,
  /** weight of a share (heat export) */
  shareW: 2.2,
  /** weight of a reply (conductance, per level) */
  replyW: 1.15,
  /** graph diffusion coupling */
  kappa: 0.22,
  /** velocity exponent */
  beta: 0.55,
  /** recency floor to stop division blowups */
  floor: 1e-4,
};

const HOUR = 3600_000;

export function cool(hoursElapsed: number, tau = K.tau) {
  return Math.exp(-Math.max(0, hoursElapsed) / tau);
}

export type HeatSignals = {
  /** raw public counters from the source */
  reactions?: number;
  comments?: number;
  reposts?: number;
  saves?: number;
  reads?: number;
  /** the local user's own engagement */
  mine?: { level: HeatLevel; at?: number; read?: boolean; saved?: boolean; shared?: number };
  /** ISO publish date */
  date?: string | number;
  /** author reputation multiplier */
  thermalMass?: number;
  /** deterministic jitter seed so equal items don't tie */
  seed?: string;
};

/** fractional hash → 0..1, used for stable micro-jitter */
function jit(s = '') {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export type HeatResult = {
  /** absolute temperature in "kelvin", 0..~120 */
  temp: number;
  /** 0..100 normalized heat for gauges */
  heat: number;
  /** d(temperature)/d(time) proxy — is it still climbing? */
  velocity: number;
  /** final rank score */
  score: number;
  /** human-readable breakdown for the "why am I seeing this" trace */
  trace: { label: string; value: number; hint: string }[];
  /** 7-day sparkline of temperature */
  trend: number[];
};

export function computeHeat(sig: HeatSignals, now = Date.now()): HeatResult {
  const t0 = sig.date ? new Date(sig.date).getTime() : now - 12 * HOUR;
  const ageH = Math.max(0, (now - t0) / HOUR);
  const mass = sig.thermalMass ?? 1;

  /* --- crowd term: public counters, cooled by Newton's law -------------
     Each counter is an *average over many events with their own arrival
     times*, and a sum of exponentials with spread tᵢ decays slower than a
     single one — so the aggregate uses a 3× longer effective constant than
     the per-event τ. A heat you gave yourself cools at 1.6τ for the same
     reason (it is one event you keep re-reading, not a fresh spark). */
  const crowd =
    ((sig.reactions ?? 0) * 0.55 +
      (sig.comments ?? 0) * K.replyW +
      (sig.reposts ?? 0) * K.shareW +
      (sig.saves ?? 0) * K.saveW) *
    cool(ageH, K.tau * 3);

  // --- local term: my own heat, weighted by hold level ------------------
  const lvl = sig.mine?.level ?? 0;
  const sinceH = sig.mine?.at ? (now - sig.mine.at) / HOUR : 0;
  const local = K.heatW[lvl] * 2.4 * cool(sinceH, K.tau * 1.6);
  const read = sig.mine?.read ? K.readW : 0;
  const saved = sig.mine?.saved ? K.saveW : 0;
  const shared = (sig.mine?.shared ?? 0) * K.shareW;

  // --- graph diffusion: heat flows through the author's thermal mass ----
  const injected = (local + read + saved + shared) * mass;
  const conduct = K.kappa * Math.log1p(crowd) * (mass - 1) * 0.35;

  const temp = Math.max(
    K.floor,
    crowd + injected + conduct + jit(sig.seed) * 0.35
  );

  // velocity: compare slow-decay vs fast-decay energy (recent-weighted)
  const velocity =
    (crowd * cool(ageH, K.tauFast)) / Math.max(K.floor, crowd * cool(ageH, K.tau) + 1) +
    (injected * cool(sinceH, 1.2)) / 8;

  const score = Math.log1p(temp) * Math.pow(1 + Math.max(0, velocity), K.beta);

  const heat = Math.max(0, Math.min(100, Math.round(100 * (1 - Math.exp(-temp / 26)))));

  // 7-day synthetic temperature curve, shaped by decay + today's engagement
  const trend: number[] = [];
  for (let d = 6; d >= 0; d--) {
    const dh = ageH + d * 24;
    const base = (crowd + injected) * cool(dh, K.tau * 3.4);
    trend.push(Math.round(base * 10) / 10);
  }

  return {
    temp: Math.round(temp * 100) / 100,
    heat,
    velocity: Math.round(velocity * 100) / 100,
    score,
    trend,
    trace: [
      { label: 'Crowd energy', value: crowd, hint: 'cooled reactions · replies · reposts' },
      { label: 'Your heat', value: injected, hint: `hold-level ${lvl}/3 × thermal mass ${mass.toFixed(2)}` },
      { label: 'Graph conductance', value: conduct, hint: 'diffusion through author reputation' },
      { label: 'Velocity', value: velocity, hint: 'fast decay ÷ slow decay — still climbing?' },
    ],
  };
}

/** One discrete Laplacian pass: content nodes exchange heat with neighbours. */
export function diffuse(nodes: { id: string; temp: number; neighbors: string[] }[], passes = 1) {
  const byId = new Map(nodes.map((n) => [n.id, n.temp]));
  let out = byId;
  for (let p = 0; p < passes; p++) {
    const next = new Map<string, number>();
    for (const n of nodes) {
      const nb = n.neighbors.map((x) => out.get(x) ?? 0);
      const avg = nb.length ? nb.reduce((a, b) => a + b, 0) / nb.length : 0;
      const laplacian = avg - (out.get(n.id) ?? 0);
      next.set(n.id, Math.max(0, (out.get(n.id) ?? 0) + 0.18 * laplacian));
    }
    out = next;
  }
  return out;
}

/**
 * Semantic cliff detection (§8.2): given the sorted engagement logits,
 * find where the curve falls off a cliff with position-weighted decay and
 * truncate there. Returns the number of items to keep (min 3).
 */
export function cliffIndex(logits: number[]): number {
  const n = logits.length;
  if (n < 6) return n;
  let best = -Infinity;
  let idx = Math.min(n, Math.max(4, Math.round(n * 0.55)));
  for (let i = 3; i < n - 2; i++) {
    const gap = logits[i - 1] - logits[i];
    const slope = logits[1] - logits[0];
    const weighted = gap / (Math.abs(slope) + 1e-6) - 0.02 * i; // position-weighted
    if (weighted > best) {
      best = weighted;
      idx = i;
    }
  }
  return Math.max(4, Math.min(n, idx + 1));
}

export function tempLabel(temp: number): { label: string; color: string; emojiless: string } {
  if (temp >= 60) return { label: 'Incandescent', color: '#FFF6E8', emojiless: 'white hot' };
  if (temp >= 38) return { label: 'Molten', color: '#FFC978', emojiless: 'molten' };
  if (temp >= 22) return { label: 'Burning', color: '#FFB454', emojiless: 'burning' };
  if (temp >= 10) return { label: 'Warm', color: '#F59A2B', emojiless: 'warm' };
  if (temp >= 4) return { label: 'Smouldering', color: '#EFCB8B', emojiless: 'smouldering' };
  return { label: 'Cold', color: '#63D8F5', emojiless: 'cold' };
}

/** Kelvin-ish display value used across the UI */
export function kelvin(temp: number) {
  return `${Math.round(273 + temp * 9.4)}K`;
}

export const LEVEL_META: Record<
  number,
  { name: string; hold: number; ring: string; copy: string; boost: number }
> = {
  0: { name: 'Cold', hold: 0, ring: '#63D8F5', copy: 'Cooled down', boost: 0 },
  1: { name: 'Ember', hold: 0, ring: '#F59A2B', copy: 'Ember lit', boost: 1 },
  2: { name: 'Blaze', hold: 1150, ring: '#FFB454', copy: 'Blaze — heat doubled', boost: 2.6 },
  3: { name: 'Inferno', hold: 2450, ring: '#FFC978', copy: 'IGNITED', boost: 6.5 },
};

/** hold times in ms to reach level 2 / level 3 */
export const HOLD_MS = [0, 0, 1150, 2450];
