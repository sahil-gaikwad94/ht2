# heatt — design system

A dark UI is a **light model**, not a black background. This is the whole system: what the light is,
where it comes from, and what it is allowed to mean.

---

## 1. Colour

### The room

| token | value | use |
| --- | --- | --- |
| `--ht-void` | `#000000` | true black, OLED depth. Nothing is drawn on it directly. |
| `--ht-base` | `#050505` | the floor everything readable sits above |
| `--ht-panel` | `#121212` | first elevation: frosted glass |
| `--ht-elev` | `#1A1A1A` | raised surfaces, nav rail, modals |
| `--ht-lift` | `#1E1E1E` | hover / active elevation, control tops |
| `--ht-raise` | `#242424` | the top of a gradient, never a flat fill |
| `--ht-line` | `rgba(255,255,255,.08)` | hairlines, borders |
| `--ht-line-strong` | `rgba(255,255,255,.16)` | edges that must be read at a glance |

### Ink

| token | value | use |
| --- | --- | --- |
| `--ht-ink` | `#FFFFFF` | primary text, and only primary |
| `--ht-ink-dim` | `#A0A0A0` | secondary: standfirsts, body of a card, descriptions |
| `--ht-ink-mute` | `#6F6F6F` | metadata: handles, timestamps, counts |
| `--ht-ink-faint` | `#484848` | whispers: legal, "newest first", footer |

Four steps, deliberately. A dark UI that uses one grey for everything secondary reads as flat no
matter how good the layout is.

### Signal — two colours, not five

**Molten amber** is the accent. It is reserved for things that are *actually happening*: active state,
ignition, live numbers, the one button that commits an action.

| token | value |
| --- | --- |
| `--ht-ember-50 … 900` | `#FFF8ED` → `#FFEFD4` → `#FFDFAC` → `#FFCB7D` → `#FFB454` → `#F59A2B` → `#D97B12` → `#A85C0B` → `#6E3C08` → `#3A2104` |
| `--ht-ember` | `#FFB454` — **the accent** |
| `--ht-flame` | `#F59A2B` — burning |
| `--ht-magma` | `#FFC978` — ignition |
| `--ht-flare` | `#FFE3B0` — peak |
| `--ht-whitehot` | `#FFF6E8` — incandescent / read to the end |
| `--ht-copper` | `#C9743A` — gradients only |

**Ice cyan** is the counterweight — cooled, settled, archived, unread. Cold means *nothing has
happened to this yet*; warm means *something is happening now*.

| token | value |
| --- | --- |
| `--ht-cryo-ice` | `#CFEFFF` |
| `--ht-cryo-teal` | `#63D8F5` |
| `--ht-cryo-indigo` | `#8AA6FF` — archived |
| `--ht-cryo-violet` | `#B98CFF` — decayed |
| `--ht-jade` | `#EFCB8B` — champagne metal: verified, held, saved |

**No green. Anywhere.** High-chroma green on black is the most worn-out accent in dark UI, and it
fights the product's own metaphor — heatt ranks by temperature, so its palette should look like a
forge, not a terminal. The ramps are also carried into the *generated* content: procedural avatars and
cover art draw from amber / ice / plasma-violet hue families, so a user cannot accidentally smuggle a
green identity into the board.

### Every colour is data

| temperature | label | colour |
| --- | --- | --- |
| ≥ 60 | Incandescent | `#FFF6E8` |
| ≥ 38 | Molten | `#FFC978` |
| ≥ 22 | Burning | `#FFB454` |
| ≥ 10 | Warm | `#F59A2B` |
| ≥ 4 | Smouldering | `#EFCB8B` |
| < 4 | Cold | `#63D8F5` |

---

## 2. Light & elevation

A drop shadow has nothing to cast on black, so elevation is expressed three other ways:

1. **Value step** — `#000` → `#050505` → `#121212` → `#1A1A1A` → `#1E1E1E`, a couple of percent of
   luminance apart, enough to read at arm's length.
2. **A lit top edge** — `0 1px 0 rgba(255,255,255,.055) inset`. This single line does more for
   perceived depth than any blur.
3. **An ambient pool** — a wide, very soft dark shadow below (`0 30px 70px -40px #000`) plus a
   coloured bleed *only* when the surface is hot: `0 0 0 1px rgba(255,180,84,.3)`.

Glass comes in three densities and one blur each: `--glass-1` (thin chrome), `--glass-2` (cards,
default), `--glass-3` (sheets, modals). Blur is capped at 30px and no more than six blurred surfaces
are ever on screen at once — a blurred surface costs a compositor pass and buys depth only when
there's something behind it worth obscuring.

---

## 3. Type

| role | face | notes |
| --- | --- | --- |
| display | Bricolage Grotesque Variable | `letter-spacing:-.045em`, `line-height:.9`, `text-wrap:balance` |
| UI | Inter Variable | 15px base, `-0.005em`, tabular numerals for all data |
| reading | Newsreader Variable | `line-height:1.78`, 65–75ch measure |
| data | JetBrains Mono Variable | code, token values |

A single fluid scale (`clamp()`) does all the work — `micro → tiny → sm → base → lg → xl → 2xl → 3xl
→ hero` — so hierarchy never snaps at a breakpoint and never collapses on a phone.

Three display treatments, used sparingly:
`ht-heat-text` (molten gradient, for the wordmark and one word per headline),
`ht-cryo-text` (ice, for cold states), `ht-metal-text` (brushed steel, for chrome).

---

## 4. Components

| primitive | what it is |
| --- | --- |
| `.ht-card` | content surface: glass, hairline top light, 2px lift on hover, amber border when hovered |
| `.ht-glass` / `--thin` / `--heavy` | the three glass densities |
| `.ht-btn` / `--heat` / `--ghost` / `--glass` | press = 1px drop + short amber bloom (no bounce) |
| `.ht-icon-btn` | 40px glass disc — every piece of chrome in the app is this shape |
| `.ht-chip` / `--heat` / `--cryo` | metadata vs. a live trait vs. a cooled one |
| `.ht-tabrail` / `.ht-tab` | pill filter rail with a masked fade at both ends |
| `.ht-avatar-ring` | conic sweep amber → copper → hairline → ice, black hairline outside |
| `.ht-badge` / `--hot` / `--cold` | brushed-metal badge; floats on a gyroscope, not a cartoon sticker |
| `.ht-stat` | number as the hero, label as a whisper |
| `.ht-masonry` | CSS-columns board (2 up on phones, 3 on tablet+) |
| `.ht-dock` / `.ht-dock-item` | floating translucent nav pill; active item slides via shared `layoutId` |
| `.ht-tile` | media tile: 1.06× image push on hover |
| `.ht-skeleton` | shimmer placeholder |
| `.ht-swipe` / `.ht-swipe-fill` | the onboarding control: capsule + amber fill + travelling sheen |

---

## 5. Motion

**Rules.** Two easing curves and one spring. Nothing is linear; nothing bounces except where an
element must *settle* (nav pill, layout morph). Duration scales with distance and mass, not with
importance. Anything that loops is ambient and ≥ 7s so it never pulses at reading speed. Exits are
always faster than entrances.

| token | value | use |
| --- | --- | --- |
| `EASE` | `cubic-bezier(.22,1,.36,1)` | the default |
| `EASE_HEAT` | `cubic-bezier(.16,.9,.2,1)` | press answers |
| `EASE_EXIT` | `cubic-bezier(.6,0,.2,1)` | everything leaving |
| `EASE_CINEMA` | `cubic-bezier(.16,1,.3,1)` | plates, headline reveals |
| `T.micro` 180ms | colour, border, icon swaps |
| `T.base` 320ms | chips, tabs, hovers, disclosures |
| `T.slow` 640ms | cards, sheets, section entrances |
| `T.cinema` 1100ms | plates, hero type, scene handovers |
| `T.spring` | `stiffness 420 · damping 34` | the nav dock pill |

**Primitives** (`components/ui/motion.tsx`): `Reveal` (in-view, IntersectionObserver-safe),
`SplitText` (word-by-word blur-out), `Parallax` (scroll-linked depth), `FloatingBadge` (gyro),
`Tilt` (3D pointer), `PressBloom` (amber bloom from the contact point), `CountUp`.

**The signature trick** — depth of field. Every cinematic frame is two plates: a heavily blurred far
layer drifting one way behind a sharp near layer drifting the other, both nudged by gyro/pointer. It
carries the intro, the onboarding and the hero, and it costs one transform each.

---

## 6. Screens

**Intro** (`components/intro/CinematicIntro.tsx`) — ~4.6s, three acts. `VOID`: a point of amber
ignites and blooms. `SPREAD`: the camera pushes through the keyhole plate behind letterbox bars, with
act ticks on a hairline timeline. `FORM`: the wordmark resolves letter by letter under a specular
pass and hands the room over. One rAF loop, no canvas. Skip = one click, one key, anywhere.

**Onboarding** (`components/onboarding/Onboarding.tsx`) — "the reel". Four scenes, each a full-bleed
depth-of-field stack plus a **live demonstration** rather than a screenshot: light through a gateway,
a reading sheet filling with ink, a hold-to-heat ring charging to ignition, a heat grid igniting cell
by cell. Type resolves word by word. The only control is `Swipe to start` — which also answers a
click, `↵`, `space` and `→`. **No form, no fields, no profile creation**: an identity is minted
locally and stays editable from the profile.

**Profile** (`app/(shell)/u/[handle]/page.tsx`) — the reference layout, rebuilt in obsidian. Floating
glass bar that densifies on scroll → parallax cover that cools as content rises → portrait in a conic
amber→ice ring with a slow orbit tick and gyro-drifting metal badges → name → **one divided stat row**
(followers · following · streak · reads) with animated counters → trait pills → masonry board behind
pill tabs. No scoreboard, ever.

**Feed** — ranked cards where a covered forge is *image first, details below*: title, a divided spec
row (`12 min · 340 reactions · 18 replies · 4 tags · 62° heat`), standfirst, then real prose fading
into the reader. Over-image glass discs for save/share, amber disc to open.

**Reader** — obsidian sheet within the black room, spec row in the byline, floating glass chrome, a
progress rail, paragraph heat in the margin.

**Library / Explore / Notifications / Settings** — all on the shared primitives: pill rails, eyebrow +
display-title headers, one card treatment.

**Landing** (`app/page.tsx`) — cinematic aurora hero with masked line reveals and a scroll-progress
rail, then the product argument in three moves, and finally `#system`: the real token ramps, live
component specimens, and the four principles. The design system is the claim, so it is documented
where people can see it.

---

## 7. Accessibility & performance

- Every decorative animation is `transform`/`opacity` only, and everything collapses to its final
  frame under `prefers-reduced-motion` **or** the in-app reduce-motion switch (`useMotionPrefs()`
  makes the call once, at the source).
- A reveal animation is never load-bearing: `useInViewSafe` treats a missing `IntersectionObserver`
  as "already visible", so text is never hidden because a browser API is absent.
- One focus ring for the whole product, in amber, never the default blue.
- Contrast: `#FFFFFF` on `#050505` (21:1) for primary, `#A0A0A0` on `#121212` (7.4:1) for secondary,
  and glowing accents never sit directly on true black — they sit on `#121212`+, so an accent reads
  as *light* rather than as a smudge.
- Caps: blur ≤ 30px, ≤ 6 blurred surfaces on screen, one rAF loop per animated surface.
- Verified by six suites (`npm test`): model, smoke (102 assertions driving real components in
  jsdom), style (every rendered class compiles), integrity, a11y, bundle.
