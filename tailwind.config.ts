import type { Config } from 'tailwindcss';

/* ============================================================================
   heatt — design tokens

   Two ideas, one system:

   1. THE ROOM IS BLACK. #000000 for OLED depth, #050505 for the floor, and a
      charcoal stack (#121212 → #1A1A1A → #1E1E1E) that only ever rises with
      real elevation. Every surface is frosted glass so light from the layer
      beneath bleeds through the edge — that is what makes a dark UI read as
      *deep* instead of flat.

   2. ONE ACCENT, AND IT MEANS HEAT. `ember` is molten amber — the warm end of
      the blackbody ramp, used only for things that are actually happening
      (active state, ignition, live numbers). `cryo` is ice cyan and marks the
      cold half of the same metaphor: cooled, archived, settled. There is no
      second decorative hue, and no neon green: a glow that means nothing is
      what makes a dark theme look cheap.
   ==========================================================================*/

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /* Full 0-100 opacity scale so any /NN colour modifier compiles
         (Tailwind's default scale omits steps like 12, 35, 45, 55…). */
      opacity: Object.fromEntries(
        Array.from({ length: 101 }, (_, i) => [String(i), (i / 100).toString()])
      ) as Record<string, string>,

      colors: {
        /* ---- the room -------------------------------------------------- */
        void: '#000000',
        base: '#050505',
        panel: '#121212',
        elev: '#1A1A1A',
        lift: '#1E1E1E',
        line: '#262626',

        /* ---- ink -------------------------------------------------------
           pure white for primary, #A0A0A0 silver for secondary, and two
           stepped-down greys for metadata that must recede. */
        ink: {
          DEFAULT: '#FFFFFF',
          dim: '#A0A0A0',
          mute: '#6F6F6F',
          faint: '#484848',
        },

        /* ---- THE accent: molten amber ----------------------------------
           Named `ember` so every heat semantic (ignition, temperature,
           active) keeps its class name from v1 — the whole app recolours
           from this one ramp. */
        ember: {
          50: '#FFF8ED',
          100: '#FFEFD4',
          200: '#FFDFAC',
          300: '#FFCB7D',
          400: '#FFB454', // the accent
          500: '#F59A2B',
          600: '#D97B12',
          700: '#A85C0B',
          800: '#6E3C08',
          900: '#3A2104',
        },
        magma: '#FFC978',
        flare: '#FFE3B0',
        whitehot: '#FFF6E8',
        copper: '#C9743A', // deepest ember — used only in gradients
        opal: '#F6E7D2', // bone white, for display type on photography

        /* ---- the counterweight: ice ------------------------------------ */
        cryo: {
          ice: '#CFEFFF',
          teal: '#63D8F5',
          indigo: '#8AA6FF',
          violet: '#B98CFF',
        },
        /* champagne metal — badges, verified marks, "held" states */
        jade: '#EFCB8B',

        /* ---- the reading sheet ----------------------------------------
           Obsidian paper: long-form lifts onto a charcoal sheet with
           generous measure. Light-on-dark, never a white page. */
        paper: {
          DEFAULT: '#0B0B0B',
          soft: '#101010',
          ink: '#FFFFFF',
          dim: '#A0A0A0',
          line: '#1E1E1E',
        },
      },

      fontFamily: {
        sans: ['Inter Variable', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', 'Inter Variable', 'ui-sans-serif', 'sans-serif'],
        serif: ['Newsreader Variable', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      /* Fluid type — every step is bounded so hierarchy never collapses on a
         phone or floats away on an ultrawide. */
      fontSize: {
        micro: ['clamp(0.68rem,0.66rem+0.12vw,0.75rem)', { lineHeight: '1.5' }],
        tiny: ['clamp(0.75rem,0.72rem+0.15vw,0.83rem)', { lineHeight: '1.55' }],
        sm: ['clamp(0.83rem,0.8rem+0.16vw,0.92rem)', { lineHeight: '1.6' }],
        base: ['clamp(0.95rem,0.9rem+0.24vw,1.075rem)', { lineHeight: '1.7' }],
        lg: ['clamp(1.1rem,1rem+0.5vw,1.35rem)', { lineHeight: '1.5' }],
        xl: ['clamp(1.35rem,1.15rem+0.95vw,1.95rem)', { lineHeight: '1.3' }],
        '2xl': ['clamp(1.75rem,1.35rem+1.8vw,2.9rem)', { lineHeight: '1.12' }],
        '3xl': ['clamp(2.3rem,1.5rem+3.6vw,4.6rem)', { lineHeight: '1.02' }],
        hero: ['clamp(2.9rem,1.4rem+7.4vw,7.6rem)', { lineHeight: '0.94' }],
      },

      borderRadius: {
        sm: '10px',
        md: '14px',
        lg: '20px',
        xl: '26px',
        '2xl': '32px',
        '3xl': '40px',
      },

      /* Elevation on black can't be a drop shadow — there is no light to cast
         one. Every step is (1) a brighter inset top edge, (2) a wider ambient
         pool below, (3) an optional coloured bleed when the surface is hot. */
      boxShadow: {
        inset: '0 1px 0 rgba(255,255,255,.055) inset',
        panel: '0 1px 0 rgba(255,255,255,.05) inset, 0 30px 70px -40px rgba(0,0,0,.95)',
        glass: '0 1px 0 rgba(255,255,255,.06) inset, 0 40px 90px -50px rgba(0,0,0,1)',
        lift: '0 1px 0 rgba(255,255,255,.07) inset, 0 24px 56px -32px rgba(0,0,0,1)',
        paper: '0 44px 110px -56px rgba(0,0,0,1), 0 0 0 1px rgba(255,255,255,.06)',
        heat: '0 0 0 1px rgba(255,180,84,.3), 0 18px 50px -24px rgba(255,180,84,.42)',
        'heat-lg': '0 0 0 1px rgba(255,180,84,.45), 0 30px 80px -28px rgba(255,180,84,.5)',
        cryo: '0 0 0 1px rgba(99,216,245,.26), 0 18px 50px -26px rgba(99,216,245,.4)',
        glow: '0 0 40px -10px rgba(255,180,84,.45)',
      },

      backdropBlur: { xs: '4px', glass: '18px', heavy: '30px' },

      keyframes: {
        /* --- ambient life ------------------------------------------------ */
        'atmos-drift': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(2%,-1.5%,0) scale(1.05)' },
        },
        'float-slow': {
          '0%,100%': { transform: 'translate3d(0,0,0) rotate(0deg)' },
          '50%': { transform: 'translate3d(0,-6px,0) rotate(1.5deg)' },
        },
        'badge-drift': {
          '0%,100%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(0,-4px,0)' },
        },
        breath: {
          '0%,100%': { opacity: '.55', transform: 'scale(1)' },
          '50%': { opacity: '.9', transform: 'scale(1.04)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(.92)', opacity: '.7' },
          '70%': { transform: 'scale(1.35)', opacity: '0' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
        /* --- light ------------------------------------------------------- */
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        sheen: {
          '0%': { transform: 'translateX(-120%) skewX(-18deg)' },
          '100%': { transform: 'translateX(220%) skewX(-18deg)' },
        },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        flicker: {
          '0%,100%': { opacity: '.94', transform: 'scaleY(1)' },
          '25%': { opacity: '1', transform: 'scaleY(1.03)' },
          '50%': { opacity: '.9', transform: 'scaleY(.98)' },
          '75%': { opacity: '1', transform: 'scaleY(1.02)' },
        },
        'heat-pulse': {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(255,180,84,0)' },
          '50%': { boxShadow: '0 0 0 8px rgba(255,180,84,.06)' },
        },
        /* --- entrance ---------------------------------------------------- */
        rise: {
          from: { opacity: '0', transform: 'translate3d(0,14px,0)' },
          to: { opacity: '1', transform: 'translate3d(0,0,0)' },
        },
        'blur-in': {
          from: { opacity: '0', filter: 'blur(14px)' },
          to: { opacity: '1', filter: 'blur(0)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '35%': { opacity: '.9' },
          '100%': { transform: 'translateY(1200%)', opacity: '0' },
        },
        marquee: { to: { transform: 'translateX(-50%)' } },
      },

      animation: {
        'atmos-drift': 'atmos-drift 52s ease-in-out infinite',
        'float-slow': 'float-slow 9s ease-in-out infinite',
        'badge-drift': 'badge-drift 7s ease-in-out infinite',
        breath: 'breath 5.5s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.6s cubic-bezier(.22,1,.36,1) infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        sheen: 'sheen 6.5s cubic-bezier(.22,1,.36,1) infinite',
        'spin-slow': 'spin-slow 18s linear infinite',
        flicker: 'flicker 2.4s ease-in-out infinite',
        'heat-pulse': 'heat-pulse 2.2s ease-in-out infinite',
        rise: 'rise .7s cubic-bezier(.22,1,.36,1) both',
        'blur-in': 'blur-in 1.1s cubic-bezier(.22,1,.36,1) both',
        'scan-line': 'scan-line 6s cubic-bezier(.22,1,.36,1) infinite',
        marquee: 'marquee 34s linear infinite',
      },

      transitionTimingFunction: {
        ht: 'cubic-bezier(.22,1,.36,1)',
        heat: 'cubic-bezier(.16,.9,.2,1)',
      },
    },
  },
  plugins: [],
};

export default config;
