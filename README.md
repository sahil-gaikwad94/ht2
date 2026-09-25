# heatt — where ideas burn

A hybrid microblogging + long-form platform. Short posts (**sparks**) and full articles
(**forges**) live in the same feed and the same reading surface — nothing is truncated into a
"keep reading elsewhere" wall. Cold-start supply comes from **syndicating Dev.to**, whose API
hands back real articles as Markdown, so heatt renders them natively instead of redirecting.

```
npm install && npm run dev        # http://localhost:3000
npm run build && npm start        # production
```

Zero-cost infra: Next.js App Router, static/ISR page output, client-side localStorage state,
edge-friendly proxy routes for caching. No database in the demo; the store is swappable.

---

## Why it looks like this ("obsidian")

True-black rooms (`#000000`) holding frosted charcoal glass (`#121212` → `#1E1E1E`), pure white for
primary text and silver (`#A0A0A0`) for everything secondary — and **two** signal colours, not five:

* **molten amber** (`#FFB454`) — the accent. Active states, ignition, live numbers, anything that is
  *happening right now*.
* **ice cyan** (`#63D8F5`) — the counterweight. Cooled, archived, unread, settled.

Temperature is the ranking model, so colour is data: the ramp walks from ice through amber to a warm
bone white ("read to the end"), and a glow always reports state. There is deliberately no neon green
— high-chroma green on black is the most tired accent in dark UI, and it fights the metaphor. The
palette is built like a forge, not a terminal.

| token | value | meaning |
| --- | --- | --- |
| `--ht-void` / `--ht-base` | `#000000` / `#050505` | the room |
| `--ht-panel` → `--ht-raise` | `#121212` → `#242424` | elevated surfaces, all frosted glass |
| `--ht-ink` / `--ht-ink-dim` | `#FFFFFF` / `#A0A0A0` | primary / secondary text |
| `--ht-ink-mute` / `--ht-ink-faint` | `#6F6F6F` / `#484848` | metadata, then whispers |
| `--ht-ember` / `--ht-magma` | `#FFB454` / `#FFC978` | active, ignition |
| `--ht-flame` / `--ht-flare` | `#F59A2B` / `#FFE3B0` | burning, peak |
| `--ht-whitehot` | `#FFF6E8` | incandescent |
| `--ht-copper` | `#C9743A` | the deepest ember, gradients only |
| `--ht-cryo-teal` / `--ht-cryo-ice` | `#63D8F5` / `#CFEFFF` | cooled, settled |
| `--ht-cryo-indigo/violet` | `#8AA6FF` / `#B98CFF` | archived, decayed |
| `--ht-jade` | `#EFCB8B` | champagne metal: verified, held, saved |
| `--ht-paper` / `--ht-paper-soft` | `#0B0B0B` / `#101010` | the long-form reading sheet |

Elevation on black cannot be a drop shadow — there is no light to cast one — so every surface step is
a 1px inset highlight on its top edge plus a wider ambient pool beneath, with frosted glass between
the two. That pair is what tells the eye an edge is nearer, and it is why the dark theme reads as
*deep* rather than flat.

One system, two depths: **the board is a black room, the page is an obsidian sheet** — forges and the
reader lift their body onto `ht-paper` / `ht-prose--paper`, a charcoal panel with generous measure and
silver secondary text, never a white page. The environment behind the app is `components/gl/Atmosphere`
— two soft glows and a single ~52s drift, pure CSS, no canvas: motion is punctuation, not wallpaper.

Type is fluid (`clamp()`), single-column at 65–75ch (`max-inline-size: 68ch`), with a display face
(Bricolage Grotesque), a reading face (Newsreader), a UI face (Inter) and JetBrains Mono for data.
Bodies sit at `line-height: 1.78`, headings at `1.14`, with `text-wrap: balance` on titles and
`pretty` on prose. Everything is `prefers-reduced-motion` aware, plus a user-level switch.

## The heat model

`lib/heat.ts` implements the ranking in the design doc — Newton's law of cooling over a bipartite
author↔reader graph instead of chronological or engagement-max ranking:

```
heat(article) = Σ_i  w(type_i) · T_0,i · e^(−Δt_i / τ)     · velocity bonus   (τ = 9h)
w(heat)=1 · w(blaze)=2.6 · w(ignite)=6.5 · w(save)=1.3 · w(share)=2.2 · w(reply)=1.15

Per-event τ is 9h. Aggregate counters (a post's public reaction total) cool at **3τ** and your own
re-read heat at **1.6τ** — a sum of exponentials whose events arrived at different times decays
slower than one event, so applying 9h to an aggregate would double-count age. `lib/heat.ts` says so
in the code, and `computeHeat()` returns a `trace[]` so the UI can show you the arithmetic.
score = heat + log(1+heat)·0.9 − age_h·0.35   (velocity bonus, then cliff truncation)
```

Cooling is a *promise*, not a punishment: a post never disappears, it slides into the Archive.
Feed rank modes are `heat · new · top · cliff`, and the cliff (the largest drop in crowd heat
inside the top 40) truncates the feed with an honest "the crowd went cold here" line.

Heat is a **spectrum you hold**, not a like you tap (`components/heat/HeatButton.tsx`):
0 → warm → blaze → ignition, at ~1.15s and ~2.45s of held pressure, with haptics, a shockwave,
and — at ignition — the whole card catching fire for 2.4s.

## What's in the app

- **Cinematic intro** (`components/intro/CinematicIntro.tsx`) — a ~4.6s title sequence in three acts.
  `VOID`: a single point of amber ignites in a black room and blooms. `SPREAD`: the camera pushes
  through the keyhole plate — a heavily blurred far layer panning against a sharp near layer, with
  horizontal light streaks building as it travels — under letterbox bars and a hairline timeline with
  act ticks. `FORM`: the wordmark resolves letter by letter with a specular pass, the frame blows out
  to amber, and the room hands over. No canvas, no WebGL, one rAF loop. Skip is always one click,
  one key, anywhere on the frame; it runs once (`introSeen`), and collapses to its final frame under
  `prefers-reduced-motion`.
- **Onboarding** (`components/onboarding/Onboarding.tsx`) — "the reel". Four cinematic scenes, each a
  full-bleed depth-of-field stack (blurred far plate drifting one way, sharp near plate the other,
  both answering pointer/gyro), type that resolves out of a blur word by word, and a **live
  demonstration** instead of a screenshot: light pushing through a gateway, a reading sheet filling
  with ink, a hold-to-heat ring charging to ignition, a heat grid igniting cell by cell. The only
  control is a glass **swipe to start** capsule with a travelling sheen and a progress hairline —
  which also answers a click, `↵`, `space` or `→`. **No form, no fields, no profile creation**; an
  identity is minted locally and stays editable from the profile, so nobody lands on a sign-up wall.
- **Feed** — ranked sparks + forges with inline covers, link previews, polls, "why am I seeing
  this?" transparency panel, digest cards, live syndication ticker, `j/k/h/l/↵` keyboard control.
- **Reader** (`components/reader/Reader.tsx`) — a *route* (`/read/[id]`), not a redirect: reading
  progress rail, per-paragraph **heat spine** (where the crowd re-read, lingered, heated), inline
  code with syntax highlighting, footnotes/references, blockquote treatment, cover, author strip,
  reply thread, "read original" attribution for syndicated pieces, adjustable serif/measure/
  density, and paragraph-level heating.
- **Explore** — search over posts/tags/authors with heat-ranked results, trending tags, tag/board
  histograms, source filters, top authors.
- **Profile** — the reference layout, rebuilt in obsidian: a floating glass bar that densifies on
  scroll, a full-bleed cover that parallaxes and cools as content rises over it, a centered portrait
  inside a conic amber→ice ring with a slow orbit tick, brushed-metal badges drifting on a
  gyroscope, one divided stat row (followers · following · streak · reads) with animated counters,
  trait pills, then the body of work as a CSS-columns masonry board behind pill tabs. Editable in
  place (`components/profile/ProfileEditor.tsx`).
- **Navigation** — a floating translucent `ht-dock` pill on phones where the active item slides
  between destinations via a shared `layoutId`, a rail with live badges on desktop, and the right
  rail (board is burning / streak / syndication) pushed to `xl`. Buttons answer a press with a short
  amber bloom; nothing animates for its own sake.
- **The design system is on the landing page** (`#system`) — the real token ramps, live component
  specimens and the four principles the UI is built on. It is the product's actual claim, so it is
  documented where people can see it rather than in a Figma file nobody opens.
- **Heat map** (`components/heat/Heatmap.tsx` + `/heatmap`) — GitHub-style annual grid, but scored
  on **thermal output** (heats given, ignitions, reads, writes). Collapsed square on the profile
  expands through a Framer Motion morph into the dashboard: day-level interrogation, 7-day
  micro-histogram, streak as a promise, narrative summaries. Empty cells are neutral, never red —
  and you are never ranked against another person.
- **Share studio** (`components/share/ShareStudio.tsx`) — poster-grade PNG drawn on canvas at
  1080×1920 / 1080×1080 / 1200×675, palette auto-matched to the post's temperature, with crowd
  waveform, "thermal passport" profile variant and a year-in-heat variant. Download, copy image
  (ClipboardItem), native share sheet (Web Share Level 2 with `File`), or copy link.
- **⌘K palette** — create, navigate, toggle, and jump to heat-ranked posts and tags.
- **Compose** — spark ↔ forge with a live "promotion gauge" that nudges a spark worth expanding
  into an article, and links/polls/cover picks.

## Cold-start supply (`lib/syndicate.ts`, `app/api/*`)

`/api/feed` merges Dev.to's public article list across the boards heatt cares about
(frontend, webdev, programming, javascript, typescript, rust, design) and returns metadata only —
title, excerpt, cover, tags, author, reactions, canonical URL. `s-maxage=600,
stale-while-revalidate=86400` keeps it at the edge; the client caches 24h in localStorage.
`/api/article` fetches `body_markdown` **per read** (never stored), which is then rendered through
`lib/markdown.tsx` with highlighting. `/api/preview` fetches a URL and streams back only the
`<head>` it needs for `og:image`/`og:title`/`twitter:card` before aborting, so link previews cost
kilobytes rather than full page loads. Syndicated items are labelled and attributed, and deep-link
to the canonical original.

When the network is unavailable (offline demo, blocked egress) the app degrades to the seeded
library — 7 fully written forges with structured blocks, 16 sparks, 8 profiles — and the wire
panel says so honestly instead of showing skeletons forever.

## Verification

Three suites, all headless, all run with `npm test`:

```bash
npm run test:model   # 56 assertions on heat math, ranker, store reducers, seed corpus
npm run test:smoke   # 100 assertions driving the real components in jsdom
npm run test:styles  # style audit: every class rendered in the DOM compiles to a rule
```

`test:model` compiles the pure-TS core and checks the physics against the spec
(`cool(9h) === e⁻¹`, ignite weight 6.5× ember, cliff detection, tab/handle/search
filters, streak and activity reducers, every seeded forge having real blocks).

`test:smoke` is the interesting one: it mounts `ShellProviders → BootLayer →
shell layout → page` with react-dom/client inside jsdom, stubs `next/navigation`,
`next/dynamic` and `next/link`, replaces `getContext('2d')` with a **canvas
recorder**, and then presses buttons — skip intro, walk onboarding, `j/k/h/l/↵`,
hold-to-heat through the real 2.45s timer including ignition (25 embers,
`activity.ignites`, fire chrome and its 2.4s expiry), mute from the ⋯ menu,
reply in a thread, publish a spark, build a poll → feed → vote, open a poster
and exercise every export (clipboard image, native share sheet, PNG download,
palette repaint via canvas op count ~3k→6k), offline syndicated body retry +
attribution, profile editing, ⌘K navigation, heat-grid day selection, and every
settings toggle reaching `<html>`. It fails on any console error, uncaught
rejection, or React warning.

`test:styles` renders every surface (feed, igniting card, reader, offline
reader, explore, library, notifications, settings, heatmap, profile, landing,
palette, composer, share studio, thread sheet, onboarding, intro) in jsdom,
collects every class token from the real DOM, extracts every selector from the
production CSS by unescaping Tailwind's escaped arbitrary values
(`bg-[linear-gradient(140deg,#FFD27D,#FF5C0A)]`, `text-[clamp(...)]`,
`bottom-[max(84px,calc(env(safe-area-inset-bottom)+84px))]`), and asserts that
every utility has a compiled rule and every `.ht-*` primitive is defined. It
catches the class of bug Tailwind silently drops — a typo'd token or an opacity
step not in the scale compiles to nothing.

Together they found eight bugs no build step could:

1. `useMemo` inside JSX after an early `return` in `BootLayer` — hook-order
   violation that crashed the first-visit boot.
2. Poster canvas painting a frame *before* the modal mounted its children — every
   share image would have been blank.
3. `muted` missing from the `posts` dependency list — muting did nothing until
   reload.
4. Own new posts falling below the semantic cliff — now a decaying findability
   boost for six hours.
5. `assemble()` not attaching heat — poster palette always fell back to 42° and
   `heat!.temp` threw on profile sort and reader end-card related rows.
6. `heat!` non-null assertions latent crashes for unranked lists.
7. `h-4.5` dead utility in `ShareStudio` — not in Tailwind's spacing scale, so it
   emitted no rule (height was saved by an inline style).
8. `ht-range2` duplicated inline `<style>` in landing + onboarding with different
   thumb sizes — now one `.ht-range` primitive in `globals.css`.

## Layout

```
app/                     routes (landing, feed, explore, library, notifications, settings,
   (shell)/…             heatmap, u/[handle], read/[id]) + api/{feed,article,preview}
components/gl/          Atmosphere (CSS room tone) + HeatField (WebGL, intro-only legacy)
components/heat/         HeatButton (hold-to-heat), FireOverlay (ignition), Heatmap
components/cards/        PostCard, LinkPreview, PollBlock
components/reader/       ArticleReader — the long-form surface
components/share/        ShareStudio — canvas poster export
lib/                     heat math, ranking/feed, store (zustand+persist), markdown, syndicate, seed
public/art/              generated cover art used by seeded forges and the landing page
```

State lives in one persisted zustand store (`heatt-store-v1`): heat given, reads, saves, shares,
follows, mutes, replies, your sparks/forges, notifications, per-day activity, prefs. `lib/app.tsx`
wraps it in an app context that owns navigation, the ignition queue (max 2 concurrent burns),
toasts and syndication refresh.

Everything is intentionally local-first: heat you give is real input to the ranker, the streak is
real, and the share cards are generated from that state.
