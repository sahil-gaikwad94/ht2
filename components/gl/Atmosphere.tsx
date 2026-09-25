/* ============================================================================
   components/gl/Atmosphere — the room tone of heatt.

   Deliberately *not* a full-bleed animated lava field. Two soft glows over a
   deep near-black base, one barely-visible grid, and a whisper of noise. The
   only motion is a single ~52s drift, so the environment feels alive without
   ever pulling attention off the content. Pure CSS — no canvas, no rAF.
   ==========================================================================*/

export function Atmosphere({ variant = 'app' }: { variant?: 'app' | 'public' }) {
  /* two light sources: molten amber (warm) and ice cyan (cool). The public
     variant runs hotter because there is no content to compete with. */
  const warm = variant === 'public' ? 0.14 : 0.085;
  const cool = variant === 'public' ? 0.18 : 0.1;
  return (
    <div className="ht-atmos" aria-hidden>
      <div
        className="ht-atmos-glow ht-atmos-glow-warm"
        style={{ background: `radial-gradient(circle, rgba(255,180,84,${warm}), transparent 68%)` }}
      />
      <div
        className="ht-atmos-glow ht-atmos-glow-cool"
        style={{ background: `radial-gradient(circle, rgba(99,216,245,${cool}), transparent 68%)` }}
      />
      <div className="ht-atmos-grid" />
      <div className="ht-atmos-noise" />
    </div>
  );
}
