# heatt Product Strategy

## Executive direction

heatt should own the missing middle between social discovery and serious reading. It should feel like a calm, dark editorial room where a short note gives a story human context, the complete article opens in-app, and every worthwhile item can become a durable object in a personal or shared collection.

The advantage is not more content, louder engagement, or a larger social graph. The advantage is a **trusted link-to-reading-to-sharing loop** that preserves context, source attribution, and reader control. A new visitor should see a useful, beautiful product immediately, even before they follow anyone or publish anything.

> **Product thesis:** a short thought can open a deep read; a deep read can become a saved idea; a saved idea can become a story worth sharing.

## Product principles

### Reading is the destination

The feed is a hallway, not the product. A reader should reach complete, well-typeset content without being pushed to another website whenever the source permits it. Reading position, article structure, images, links, and attribution must survive the transition from discovery to reader.

### Context beats volume

heatt should prefer a smaller set of explainable recommendations over an infinite stream. A story is more valuable when the reader knows why it appeared, who shared it, and what they may gain from reading it.

### Intentional interaction

A tap should not be treated as a vote of equal meaning to a completed article, a save, or a thoughtful share. Reactions should remain constrained and legible. A useful starting vocabulary is **Resonated**, **Challenged**, **Useful**, and **Revisit**.

### Discovery may be ephemeral; meaning should be durable

A story teaser can leave the home feed. Its article, save state, reading progress, collection membership, and authored context should remain available. This preserves the immediacy of stories without losing the value of reading.

### Privacy is the default

Reading history, reactions, saved articles, and collections should be private unless a user deliberately publishes them. Public profiles should express taste and authorship without exposing an accidental intellectual diary.

## Competitive pattern summary

| Product | What it does especially well | What heatt should borrow | Where heatt can be meaningfully different |
| --- | --- | --- | --- |
| Medium | Layered discovery, sustained reading, highlights, responses, lists, and steerable recommendations [1] [2] | Separate discovery from reading; support save lists, passage context, and recommendation controls | Make short note + full article a first-class pair, not two unrelated content types |
| Substack | Networked discovery, subscriptions, saved posts, profiles, full posts, and creator-owned distribution [3] [4] | Home versus Read modes, durable saved queue, source/profile context, rich URL cards | Stay editorial rather than subscription-business-first; use a calmer, finite feed and richer reader-led sharing |
| Readwise Reader | Link capture, parsing, annotation, Library versus Feed, offline reading, search, and exports [5] [6] | Treat URLs as durable objects; preserve progress, tags, notes, and clean in-app reading | Make saved reading social and expressive without inheriting a power-user productivity interface |
| Instagram Stories | Fast visual sequencing, lightweight participation, audience controls, and Highlights [7] | Use a cinematic multi-frame story format for excerpts, quotes, and context | Keep the full article durable and native instead of sending readers to an external destination |
| Pinterest | Search-led visual discovery, persistent saves, boards, collaboration, and profile collections [8] | Use shelves, collections, sections, and save-first behavior | Make the saved object a complete readable article rather than a visual bookmark that redirects elsewhere |

## The heatt experience

### 1. Landing page

The landing page should communicate the product in one visual sentence: **short notes and full stories belong in the same room**. The current landing direction already uses a dark cinematic hero, a restrained amber accent, and a direct path into the board. The next product-level refinement is to make the three core actions explicit:

1. **Discover** a note, story, or link with clear source context.
2. **Read** the complete article in heatt with progress, typography, images, and links intact.
3. **Share** a selected line, reaction, or story sequence with one canonical deep link.

The page should avoid presenting ranking mechanics as the primary value proposition. The algorithm is a trust layer that supports the reading experience, not the headline.

### 2. Cinematic onboarding

Onboarding should be a short visual reel rather than a form. It should introduce the product through four scenes:

- **A room for ideas:** the app opens from near-black into a focused editorial environment.
- **A story becomes readable:** a cover, headline, and body resolve into the in-app reader.
- **A reaction has weight:** a deliberate hold creates a brief, tactile heat animation rather than a looping spectacle.
- **A story travels:** a quote, source, and share card assemble into a durable story link.

The current implementation already has cinematic scenes, pointer drift, scene progress, keyboard controls, and reduced-motion handling. It now avoids generating a profile during onboarding. The next iteration should add a single explicit interest step only if it improves the first queue; it must never block entry into the app.

### 3. First-run content

A new visitor must never encounter an empty product. heatt should ship with a curated starter library of complete, locally bundled articles across distinct categories:

- Design and visual systems
- Technology and engineering
- AI and tools
- Culture and media
- Writing and reading
- Product and human behavior
- Interaction and motion

Each article should include a cover, standfirst, author identity, reading time, structured headings, paragraphs, quotes, lists, code where appropriate, images, and a small set of real links. The app should render these blocks natively and preserve the article's complete body. External links should remain attributable and openable, but the reader should never need to leave heatt to finish a bundled article.

The current repository already ships seven structured originals and a syndicated snapshot fallback. The strongest next step is to expand the seeded library into a visibly categorized starter shelf and label the source state clearly: **heatt original**, **curated public article**, or **external article with in-app preview**.

### 4. Article reader

The reader should be a product environment, not a modal that happens to contain text. It needs:

- A cover and byline that establish source and authorship.
- A comfortable 65–75 character reading measure.
- Structured headings, images, links, code, quotes, lists, and callouts.
- Persistent reading position and a small floating progress rail.
- Save, share, type controls, and a clear return path.
- An explicit **Open original** action for content that cannot be legally or technically rendered in-app.
- A source-state label that distinguishes native, imported, syndicated, and external-only content.

The reader now removes receipt-style metadata and uses percentage progress. The next differentiation is to add passage highlights with an optional short note, then allow those highlights to become part of a story share.

### 5. Link previews

Every URL should become a first-class content object. The preview pipeline should:

1. Canonicalize the URL and deduplicate it.
2. Extract title, description, source, author, cover, favicon, publish date, and reading estimate.
3. Detect whether the article can be rendered fully in-app.
4. Show a stable rich preview while metadata loads.
5. Offer rich, compact, and plain-link presentations.
6. Preserve attribution and the original canonical URL.
7. Show an explicit access state: **Reads here**, **Preview only**, or **Open original**.

The current repository already has an edge preview route and a reusable `LinkPreview` component. The product gap is not basic metadata loading; it is making the in-app readability state visible and consistent across feed cards, composer previews, reader pages, and shared story cards.

### 6. Profile rhythm card

The profile should contain a small square activity card inspired by GitHub's contribution grid, but designed around reading and making rather than performance. Its compact state should show the last several weeks with a simple legend and no scoreboard framing.

When tapped, it should expand in place to show:

- A wider year view with month labels.
- Day-level marks for reads, saves, finished articles, and published pieces.
- A recent timeline of saved stories, reading sessions, and authored work.
- Small insights such as finished reads, published pieces, active days, and saved-for-later items.
- A selected-day narrative that explains activity in plain language.
- Optional sharing as a tasteful annual story, without exposing private reading history by default.

This behavior is now wired into the personal profile. The card expands to a full-year grid and shows timeline marks and insight tiles. The next refinement is to make each mark type visually distinguishable while keeping the palette restrained.

## Signature feature: story sharing

Story sharing should combine the sequential clarity of Instagram Stories, the durable collections of Pinterest, and the editorial context of Medium highlights without inheriting their weaknesses.

A shared story should have three to five frames:

1. **Cover:** source, title, cover art, reading time, and the sharer's name.
2. **The line:** one selected excerpt or highlighted sentence.
3. **The context:** the sharer's reaction and optional two-sentence note.
4. **The invitation:** a clear action to read in heatt, with source attribution.
5. **Optional signature:** profile, collection, or topic context.

The output should support vertical story, square post, and landscape link-card formats. The canonical link should open directly to the article or note in heatt and restore the recipient's reading context. The share must not flatten the source into an anonymous poster.

## Explainable ranking and recommendation algorithms

### Two-stage retrieval

Use separate systems for discovery and intentional reading:

- **Home retrieval:** candidates from followed topics, followed people, shared collections, editorial picks, similar completed articles, and controlled serendipity.
- **Read retrieval:** chronological, saved, unfinished, finished, and optionally filtered shelves.

The Home system may rank. The Read system should not silently reorder the user's intentional queue.

### Quality-weighted score

A candidate's quality score should favor reading depth and long-term value over raw taps:

```text
quality =
  0.28 * completionAdjustedDwell
+ 0.22 * savesAndRevisits
+ 0.16 * intentionalReactions
+ 0.14 * thoughtfulShares
+ 0.10 * returnToPosition
+ 0.06 * repliesWithSubstance
```

Each term should be normalized by article length and audience size. A three-minute piece should not automatically beat a forty-minute essay because it has a higher completion rate.

### Reason-coded candidates

Every recommended item should carry one internal reason code and expose a short human-readable explanation:

- Followed topic
- Shared by a trusted profile
- Similar to a finished article
- From a saved collection
- Editorial pick
- New source worth exploring
- Controlled serendipity

Readers should be able to remove a reason, mute a source, mute a topic, or request less like this. These controls are more valuable than an opaque “personalized for you” label.

### Diversity constraints

Apply constraints after retrieval and before final ordering:

- No more than two consecutive items from one source.
- No more than two items of the same format in a row.
- Reserve explicit slots for new authors and unfamiliar topics.
- Cap follower count as a ranking feature.
- Avoid repeating an item until a meaningful time window has passed.
- Include one controlled-serendipity slot for every six or seven ranked items.

### Reaction semantics

Treat reactions as separate signals rather than one aggregate counter:

- **Resonated:** increase related-topic and author affinity.
- **Challenged:** preserve the topic but broaden viewpoint candidates.
- **Useful:** increase resurfacing and reference recommendations.
- **Revisit:** place the item into a low-frequency reading queue.

A reaction should be reversible, privately visible by default, and never treated as a universal sentiment label.

### Cold-start strategy

Before personal signals exist, rank the bundled library with a hand-authored editorial prior, category diversity, and quality metadata. Then collect lightweight signals from the first three meaningful actions: opening a category, finishing a piece, and saving or reacting to a story. Do not require account creation or a follower graph before the feed becomes useful.

## Roadmap

### Phase 1: first-room quality

Ship the existing landing page, cinematic onboarding, seeded article library, native reader, link previews, heat animation, and compact-to-expanded profile rhythm card. Add category shelves and visible source-state labels. Success means a new visitor can discover, read, save, and share without publishing anything.

### Phase 2: durable reading

Add Read mode, unfinished and finished shelves, collection creation, full-text search, article deduplication, reading-history controls, and passage highlights with private notes.

### Phase 3: editorial identity

Add intentional reactions, public/private collections, reader-led story sharing, profile highlights, collection deep links, and recommendation explanations.

### Phase 4: trusted network effects

Add following of topics and sources, shared collections, collaborative shelves, source reputation based on completion and saves rather than follower count, and careful notification rules.

## Success metrics

heatt should measure whether discovery produces meaningful reading, not only whether people tap.

| Outcome | Metric |
| --- | --- |
| First value | Time from first open to first article opened; time to first meaningful read |
| Reading quality | Completion rate normalized by article length; return-to-position rate; median engaged reading time |
| Durable intent | Save rate; revisit rate; finished-to-saved ratio; collection creation rate |
| Context quality | Share-with-note rate; highlight rate; intentional reaction distribution |
| Discovery health | Source diversity; topic diversity; new-author completion rate; recommendation reason correction rate |
| Retention | Second-session return; unfinished-read return; seven-day reading continuity |
| Trust | External-link fallback clarity; preview accuracy; source attribution visibility; privacy-control usage |

## Risks and constraints

Article parsing, paywalls, robots restrictions, dynamic pages, copyright, and stale metadata can undermine the promise of in-app reading. The product must distinguish imported metadata from hosted content and provide a clear canonical source plus an open-original fallback.

A calm finite feed can become repetitive during cold start. Editorial seeding, category diversity, trusted public collections, and controlled serendipity are required before personal signals accumulate.

Collections, reactions, highlights, and reading history can expose sensitive intellectual interests. Private-by-default storage, item-level visibility, deletion, and export controls should be designed before public sharing is expanded.

The product can become too complex if it copies every competitor. The core roadmap should remain ordered around one loop: **discover → read → save → share**. Advanced annotation, collaboration, and automation should follow that loop rather than compete with it.

## Current implementation status

The repository already includes the following foundations:

- A cinematic landing page and intro sequence.
- A profile-free cinematic onboarding flow.
- Intentional hold-based heat animation.
- Seven bundled long-form originals with structured content blocks, images, code, quotes, lists, and links.
- Syndicated article metadata with bundled snapshot fallback.
- Native in-app reader with reading position and progress UI.
- Universal reusable link-preview cards backed by `/api/preview`.
- A compact personal rhythm card that expands into a yearly heatmap with timeline marks and reading insights.
- A dark shell with feed, explore, library, notifications, profile, and settings surfaces.

The immediate product gap is not a missing visual component. It is connecting these components into one coherent, explainable reading loop and making the source state of every article or link explicit.

## References

[1]: https://help.medium.com/hc/en-us/articles/115012586467 "Your Medium homepage"
[2]: https://help.medium.com/hc/en-us/articles/214993247 "Create and manage lists on Medium"
[3]: https://substack.com/features "Substack features"
[4]: https://support.substack.com/hc/en-us/articles/19291693034004 "Getting started on the Substack app"
[5]: https://readwise.io/read "Readwise Reader"
[6]: https://docs.readwise.io/reader/docs/faqs/adding-new-content "Adding new content to Readwise Reader"
[7]: https://about.instagram.com/features/stories "Instagram Stories"
[8]: https://help.pinterest.com/en/article/save-pins-on-pinterest "Save Pins on Pinterest"
[9]: https://help.medium.com/hc/en-us/articles/224488047 "Refine your Medium recommendations"
[10]: https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes "Highlights, tags, and notes in Readwise Reader"
[11]: https://help.pinterest.com/en/article/tune-your-home-feed "Tune your Pinterest home feed"
[12]: https://help.instagram.com/3257948324491837/ "Instagram Stories audience and sharing controls"
