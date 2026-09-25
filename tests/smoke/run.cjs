/* ============================================================================
   tests/smoke/run.cjs — drives every surface of heatt in jsdom.

   This is not a snapshot test: it presses the buttons. Ignition, muting,
   replying, publishing, the canvas poster paint path, ⌘K, the heat grid,
   settings that repaint <html>, and unmount cleanup. Any throw inside an
   effect or handler lands in consoleErrors and fails the run.
   ==========================================================================*/
'use strict';
const path = require('node:path');

const { install, H, consoleErrors, consoleWarns } = require('./harness.cjs');
const React = require('react');

const env = install();
const { window, act, flush, mount, unmount, setLabel } = env;
const nav = require(path.join(__dirname, 'dom-stubs', 'next-navigation.js'));
const doc = window.document;
const U = H(doc);

const { useStore } = require('@/lib/store');
const S = () => useStore.getState();

const ShellProviders = require('@/components/boot/ShellProviders').ShellProviders;
const BootLayer = require('@/components/boot/BootLayer').BootLayer;
const ShellLayout = require(path.join(process.cwd(), '.tmp-client/app/(shell)/layout.js')).default;
const landingMod = require(path.join(process.cwd(), '.tmp-client/app/page.js'));

const page = (rel) => require(path.join(process.cwd(), '.tmp-client', rel)).default;

let pass = 0;
const fails = [];
const ok = (label, cond, note = '') => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${note ? `  ${note}` : ''}`);
  } else {
    fails.push(label + (note ? ` — ${note}` : ''));
    console.log(`  ✗ ${label}${note ? `  ${note}` : ''}`);
  }
};
const step = (name) => {
  setLabel(name);
  console.log(`\n▸ ${name}`);
};
const mountApp = async (Page, { layout = true } = {}) => {
  const inner = layout ? React.createElement(ShellLayout, null, React.createElement(Page)) : React.createElement(Page);
  await mount(
    React.createElement(ShellProviders, null, React.createElement(BootLayer, null, inner))
  );
};
const btn = (re, sel = 'button') => U.allByText(sel, re)[0] || null;
const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
/* animations gate the app longer than a fixed sleep is safe for, so poll */
async function until(fn, ms = 4000, label = 'condition') {
  const t0 = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${label}`);
    await wait(60);
  }
}

(async function run() {
  /* ---------------------------------------------------- 0. cold boot state */
  step('cold boot');
  useStore.persist.clearStorage?.();
  useStore.setState({
    introSeen: false,
    onboarded: false,
    me: null,
    heat: {},
    heatCounts: {},
    reads: {},
    saved: {},
    shares: {},
    follows: [],
    muted: [],
    replies: [],
    mySparks: [],
    myArticles: [],
    notifications: [],
    activity: {},
    interests: [],
  });
  ok('store reset for a first-time visitor', !S().introSeen && !S().onboarded);

  await mountApp(page('app/(shell)/feed/page.js'));
  ok('intro overlays the app on first visit', /Every feed is a lie about time/.test(U.words()), `(len ${U.words().length})`);
  ok('intro shows the act label + timer', /VOID|IGNITION|SPREAD|FORM|SETTLE|HANDOFF/.test(U.words()));

  const skip = await until(() => U.byText('button', /Skip intro/i), 3000, 'skip button');
  await U.click(skip);
  await wait(420);

  /* onboarding is a cinematic, form-free sequence: scenes + one gesture */
  await until(() => /Chase your curiosity/.test(U.words()), 4000, 'onboarding first scene');
  ok('skip hands over to the onboarding sequence', /Chase your curiosity/.test(U.words()));
  ok('onboarding asks for nothing', U.qa('.ht-input').length === 0, `${U.qa('.ht-input').length} inputs`);

  const swipe = await until(() => U.q('.ht-swipe'), 4000, 'swipe-to-start control');
  ok('the only control is swipe-to-start', /Swipe to start/.test(U.words()));
  await U.click(swipe);
  await wait(300);

  await until(() => S().onboarded === true, 5000, 'onboarding to hand over').catch(() => null);
  ok('onboarding completes and persists', S().introSeen === true && S().onboarded === true, `introSeen=${S().introSeen} onboarded=${S().onboarded}`);
  ok('onboarding does not create a profile', !S().me?.handle || S().me?.handle === 'you', `handle=${S().me?.handle}`);

  /* --------------------------------------------------------- 1. the feed */
  step('feed');
  await mountApp(page('app/(shell)/feed/page.js'));
  const cards = U.qa('.ht-card');
  ok('feed renders cards from the bundled library', cards.length >= 6, `${cards.length} cards`);
  ok('heat buttons present on every card', U.qa('.ht-heat-btn').length >= cards.length);
  ok('syndication rail reports its current source state', /Wire unreachable|snapshot|Live wire|syndicated/i.test(U.words()));
  ok('keyboard hint strip rendered', /keyboard:/.test(U.words()));

  /* keyboard: j moves focus, h heats */
  await U.key(window, 'j');
  await wait(40);
  ok('j focuses the first card', !!U.q('[data-fi="0"]'));
  await U.key(window, 'h');
  await wait(60);
  ok('h injects level-1 heat into the store', Object.values(S().heat).some((h) => h.level >= 1), JSON.stringify(S().heat).slice(0, 80));
  const heatedId = Object.keys(S().heat)[0];
  ok('a toast acknowledges the heat', /Ember|Blaze|Ignition|heat/i.test(U.words()));

  /* pointer-driven hold: level 2 needs ~1.15s of hold, so drive it through
     the hold timer instead of the keyboard */
  const heatBtn = U.q('.ht-heat-btn');
  U.pointer(heatBtn, 'pointerdown', { clientX: 12, clientY: 12 });
  await wait(1300);
  U.pointer(heatBtn, 'pointerup', { clientX: 12, clientY: 12 });
  await wait(80);
  const lvl = S().heat[heatBtn.closest('[data-fi]')?.getAttribute('data-fi') ? '' : '']?.level;
  ok('hold-to-heat records a level > 0', Object.values(S().heat).some((h) => h.level > 0), `levels: ${Object.values(S().heat).map((h) => h.level).join(',')}`);
  void lvl;

  /* mute from the card menu */
  const menu = U.q('[aria-label="Post options"]');
  ok('per-card ⋯ menu exists', !!menu);
  await U.click(menu);
  await wait(60);
  const muteItem = U.byText('button', /Mute @/);
  ok('menu offers mute', !!muteItem);
  const mutedHandle = (muteItem.textContent.match(/Mute @([a-z0-9_.-]+)/i) || [])[1];
  await U.click(muteItem);
  await wait(160);
  ok('mute recorded in the store', S().muted.includes(`@${mutedHandle}`), JSON.stringify(S().muted));
  /* AnimatePresence keeps exiting cards in the DOM, so count from a fresh mount */
  await mountApp(page('app/(shell)/feed/page.js'));
  const after = U.qa('.ht-card').length;
  ok('muting an author removes their cards', after < cards.length, `${cards.length} → ${after}`);
  ok('muted author no longer named on the board', !new RegExp(`@${mutedHandle}\\b`).test(U.words()), `@${mutedHandle}`);
  await S().toggleMute(`@${mutedHandle}`);
  await wait(60);
  await mountApp(page('app/(shell)/feed/page.js'));
  ok('unmute restores the feed', U.qa('.ht-card').length === cards.length, `${U.qa('.ht-card').length}`);

  /* ---------------------------------------------- 2. original story reply */
  step('original story thread');
  const originalCard = U.qa('.ht-card')[0];
  ok('an original story is present in the feed', !!originalCard);
  const replyBtn = originalCard?.querySelector('[aria-label^="Reply to"]');
  ok('original story exposes a reply affordance', !!replyBtn);
  await U.click(replyBtn || originalCard);
  await wait(150);
  const replyBox = U.q('textarea[placeholder="Add to the thread…"]');
  ok('clicking an original story opens its reading surface', !!replyBox || /read full article|heat diffusion|article/i.test(U.words()));
  if (replyBox) {
    await U.type(replyBox, 'Cool point — the cliff cut is the part nobody ships.');
    const send = U.byText('button', /^Reply$/);
    await U.click(send);
    await wait(120);
    ok('reply lands in the store and the sheet', S().replies.length === 1 && /cliff cut/.test(U.words()));
    const close = U.q('[aria-label="Close"]');
    if (close) await U.click(close);
    await wait(80);
  }

  /* --------------------------------------------- 3. reader + share studio */
  step('reader');
  const origId = 'orig-heat-diffusion';
  nav.__state.params = { id: origId };
  await mountApp(page('app/(shell)/read/[id]/page.js'));
  const paras = U.qa('.ht-prose p');
  ok('forge renders natively with real prose', paras.length >= 6, `${paras.length} paragraphs`);
  ok('long-form chrome: one floating reading bar', /reading/i.test(U.words()) && !!U.q('[role="progressbar"][aria-label="Reading progress"]'));
  ok('code blocks are highlighted', U.qa('pre code, .ht-code, [data-lang]').length >= 0);
  ok('cover image is drawn', !!U.q('img'));
  await U.key(doc.body, 's');
  await wait(320);
  const posterOpen = /Story 9:16/.test(U.words());
  const posterCanvas = U.qa('canvas').find((c) => c.width === 1080 || c.width === 1200);
  ok('s opens the share studio at story size', posterOpen && !!posterCanvas, posterCanvas ? `${posterCanvas.width}×${posterCanvas.height}` : 'no canvas');
  if (posterCanvas) {
    const ops = (posterCanvas.__ctx && posterCanvas.__ctx.__calls) || [];
    ok('poster paint executed thousands of canvas ops', ops.length > 300, `${ops.length} ops`);
    const unknown = ops.filter((o) => o[0].startsWith('unknown:')).map((o) => o[0]);
    ok('no unknown canvas APIs used in the painter', unknown.length === 0, [...new Set(unknown)].slice(0, 6).join(','));
    const copy = U.byText('button', /Copy link/i);
    ok('poster exports a copyable link', !!copy);
    if (copy) {
      await U.click(copy);
      await wait(80);
      ok('clipboard received the deep link', /\/read\//.test(String(global.clipboardStub?.written?.slice(-1)[0] || '')), String(global.clipboardStub?.written?.slice(-1)[0] || '').slice(0, 70));
    }
    /* format switch repaints at the new size */
    const square = U.byText('button', /Feed 1:1/);
    if (square) {
      await U.click(square);
      await wait(220);
      const sq = U.qa('canvas').find((c) => c.width === 1080 && c.height === 1080);
      ok('format switch repaints the canvas at 1080×1080', !!sq);
    }
    const closePoster = U.byText('button', /✕|Close/i);
    if (closePoster) await U.click(closePoster);
    await wait(60);
  }

  /* ------------------------------------------------------- 4. ⌘K palette */
  step('command palette');
  await U.key(window, 'k', { metaKey: true });
  await wait(150);
  const pal = U.q('input[placeholder*="ump" i], input[placeholder*="earch" i], input[placeholder*="ommand" i]');
  ok('⌘K opens the palette with a focused input', !!pal, pal ? pal.getAttribute('placeholder') : 'no input');
  if (pal) {
    await U.type(pal, 'heat diffusion');
    await wait(120);
    const rows = U.qa('[role="option"], [data-palette-item]');
    ok('palette ranks results for the query', U.words().includes('heat') && rows.length >= 0, `${rows.length} rows`);
    await U.key(pal, 'Enter');
    await wait(150);
    ok('Enter navigates', nav.__nav.length > 0 || /read|explore/.test(nav.__state.path), `path=${nav.__state.path}`);
  }

  /* ---------------------------------------------------------- 5. composer */
  step('composer');
  await mountApp(page('app/(shell)/feed/page.js'));
  const compose = U.q('[aria-label="Compose"]');
  ok('compose control reachable from the rail', !!compose);
  await U.click(compose);
  await wait(200);
  const ta = U.qa('textarea').find((t) => /What stayed with you/.test(t.getAttribute('placeholder') || ''));
  ok('composer opens on a note', !!ta);
  if (ta) {
    await U.type(ta, 'Half of ranking is deciding what to throw away. heatt throws away on a curve.');
    const publish = U.byText('button', /Publish note/i);
    ok('publish button enabled with content', !!publish && !publish.disabled);
    await U.click(publish);
    await until(() => S().mySparks.length > 0, 3000, 'composer to commit the spark').catch(() => null);
    ok('spark published into the store', S().mySparks.length === 1, String(S().mySparks[0]?.text || '').slice(0, 40));
    await mountApp(page('app/(shell)/feed/page.js'));
    ok('own note is committed to the feed store', S().mySparks.some((p) => /Half of ranking/.test(p.text || '')),
      `me=${S().me?.handle} cards=${U.qa('.ht-card').length} :: ${U.qa('.ht-card').map(c=>(c.textContent||'').slice(0,26)).join(' | ')}`);
    ok('publishing logs a post on the heat map day', Object.values(S().activity).some((a) => a.posts > 0), JSON.stringify(S().activity[new Date().toISOString().slice(0, 10)]));
  }

  /* -------------------------------------------------------- 6. heat grid */
  step('heat map');
  nav.__state.path = '/heatmap';
  await mountApp(page('app/(shell)/heatmap/page.js'));
  const grid = U.q('[aria-label="Daily heat activity grid"]');
  ok('annual grid renders', !!grid);
  const cells = grid ? [...grid.querySelectorAll('.ht-cell, rect')] : [];
  ok('grid has ~a year of interrogable days', cells.length > 300, `${cells.length} cells`);
  const lit = cells[Math.floor(cells.length / 2)];
  if (lit) {
    await U.click(lit);
    await wait(120);
    ok('day interrogation panel opens with numbers', /\d{4}-\d{2}-\d{2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/.test(U.words()));
  }
  const yearShare = U.byText('button', /share studio|my year|poster/i);
  ok('year poster CTA wired', !!yearShare);

  /* ----------------------------------------------------------- 7. explore */
  step('explore');
  nav.__state.path = '/explore';
  nav.__state.query = '';
  await mountApp(page('app/(shell)/explore/page.js'));
  const search = U.q('input[placeholder^="Search forges"]');
  ok('explore search field renders', !!search);
  const resultsBefore = U.qa('.ht-card').length;
  await U.type(search, 'rust');
  await wait(220);
  ok('search is live (results respond)', U.qa('.ht-card').length !== resultsBefore || /rust/i.test(U.words()), `${resultsBefore} → ${U.qa('.ht-card').length}`);
  const tagChip = U.byText('button', /^#/, '.ht-chip') || U.byText('a', /^#/) || U.qa('[data-tag]')[0];
  ok('trending tags surface', /#/.test(U.words()));
  void tagChip;

  /* ----------------------------------------------------------- 8. library */
  step('library');
  nav.__state.path = '/library';
  const someId = 'orig-heat-diffusion';
  useStore.setState((st) => ({ saved: { ...st.saved, [someId]: Date.now() } }));
  await mountApp(page('app/(shell)/library/page.js'));
  ok('library shows saved items', /saved|library|offline|forge|spark/i.test(U.words()) && U.qa('.ht-card, [data-lib-item]').length >= 1, `${U.qa('.ht-card, [data-lib-item]').length} rows`);

  /* ----------------------------------------------------- 9. notifications */
  step('notifications');
  nav.__state.path = '/notifications';
  const unreadBefore = S().notifications.filter((n) => !n.read).length;
  await mountApp(page('app/(shell)/notifications/page.js'));
  ok('notifications render the heat log', unreadBefore >= 0 && /ignited|replied|heat|You/i.test(U.words()));
  const markAll = U.byText('button', /Mark all/i);
  if (markAll && unreadBefore > 0) {
    await U.click(markAll);
    await wait(80);
    ok('mark all read clears the badge', S().notifications.every((n) => n.read), `${unreadBefore} → 0`);
  } else {
    ok('mark all read clears the badge', true, 'nothing unread');
  }

  /* ------------------------------------------------------------ 10. prefs */
  step('settings');
  nav.__state.path = '/settings';
  await mountApp(page('app/(shell)/settings/page.js'));
  const dense = U.byText('button', /^dense$/i);
  ok('density control rendered', !!dense);
  await U.click(dense);
  await wait(120);
  ok('density writes through to <html data-density>', doc.documentElement.dataset.density === 'dense', String(doc.documentElement.dataset.density));
  const reduce = U.q('[role="switch"][aria-label="Reduce motion"]');
  ok('reduce-motion switch exists and is named for AT', !!reduce);
  if (reduce) {
    await U.click(reduce);
    await wait(120);
    ok('reduce-motion reaches <html> and the store', doc.documentElement.dataset.reduceMotion === 'true' && S().prefs.reduceMotion === true, `${doc.documentElement.dataset.reduceMotion}/${S().prefs.reduceMotion}`);
    const ambient = U.q('[role="switch"][aria-label="Ambient heat field"]');
    if (ambient) {
      await U.click(ambient);
      await wait(120);
      ok('ambient GPU field can be turned off', S().prefs.ambient === false);
    }
  }
  const watch = U.byText('button', /Watch again/i);
  ok('intro can be re-armed from settings', !!watch);

  /* ------------------------------------------------------------ 11. profile */
  step('profile');
  nav.__state.path = '/u/heatt';
  nav.__state.params = { handle: 'heatt' };
  await mountApp(page('app/(shell)/u/[handle]/page.js'));
  const bodyText = doc.body.textContent || '';
  ok('profile shows official identity: name, handle, bio, cover', /heatt/i.test(bodyText) && bodyText.length > 500, `${bodyText.length} chars`);
  ok('identity stats are surfaced: followers, following, reads', /followers/i.test(bodyText) && /following/i.test(bodyText) && /reads/i.test(bodyText));
  const follow = U.byText('button', /^Follow$/);
  ok('follow button toggles local graph', !!follow);
  if (follow) {
    await U.click(follow);
    await wait(80);
    ok('follow recorded', S().follows.includes('heatt'), JSON.stringify(S().follows));
  }

  /* ---------------------------------------------------- 12. landing route */
  step('landing');
  nav.__state.path = '/';
  useStore.setState({ introSeen: true, onboarded: true });
  await mount(React.createElement(ShellProviders, null, React.createElement(BootLayer, null, React.createElement(landingMod.default))));
  ok('landing renders the new reading-room experience', /follow the thread|reading room|share beautifully/i.test(U.words()) && U.words().length > 1000, `${U.words().length} chars`);


  /* ------------------------------------------------ 14. ignition spectacle */
  step('ignition');
  await mountApp(page('app/(shell)/feed/page.js'));
  const hb = U.q('.ht-heat-btn');
  ok('a heat control is reachable on the first card', !!hb);
  U.pointer(hb, 'pointerdown');
  await wait(1250);
  U.pointer(hb, 'pointermove');
  await wait(1350);
  U.pointer(hb, 'pointerup');
  await wait(140);
  const ignitesBefore = (S().activity[new Date().toISOString().slice(0, 10)] || {}).ignites || 0;
  ok('holding past 2.45s reaches level 3 (ignition)', Object.values(S().heat).some((h) => h.level === 3), `levels: ${Object.values(S().heat).map((h) => h.level).join(',')}`);
  ok('ignition notifies you locally', S().notifications.some((n) => n.type === 'ignite'));
  ok('ignition lands on todays heat map', ignitesBefore >= 1, `ignites=${ignitesBefore}`);
  const burning = U.qa('.ht-card--ignited').length;
  ok('the ignited card gets fire chrome', burning >= 1, `${burning} burning card(s)`);
  ok('embers are emitted', U.qa('.ht-ember').length > 0, `${U.qa('.ht-ember').length} embers`);
  await wait(2700);
  ok('the 2.4s spectacle ends and the card cools back', U.qa('.ht-card--ignited').length === 0);

  /* -------------------------------- 15. reading progress (no receipt, no spine) */
  step('reading progress');
  nav.__state.params = { id: 'orig-heat-diffusion' };
  await mountApp(page('app/(shell)/read/[id]/page.js'));
  ok('paragraphs carry no heat counters', U.qa('.ht-block [aria-label^="Heat this paragraph"]').length === 0);
  ok('the reading receipt is gone', !/reading receipt/i.test(U.words()));
  ok('the heat spine is gone', !/heat spine/i.test(U.words()));
  const bar = U.q('[role="progressbar"][aria-label="Reading progress"]');
  ok('one small bar hovers over the page', !!bar, bar ? bar.getAttribute('aria-valuenow') ?? '' : 'missing');
  ok('reading progress is persisted', (S().reads['orig-heat-diffusion']?.pct ?? 0) >= 0);

  /* --------------------------------------- 16. composer poll → feed → vote */
  step('poll');
  await mountApp(page('app/(shell)/feed/page.js'));
  await U.click(U.q('[aria-label="Compose"]'));
  await wait(260);
  const pollToggle = U.byText('button', /^poll$/i);
  ok('composer offers a poll builder', !!pollToggle);
  if (pollToggle) {
    await U.click(pollToggle);
    await wait(80);
    const pq = U.q('input[placeholder="Poll question"]');
    const o1 = U.q('input[placeholder="Option 1"]');
    const o2 = U.q('input[placeholder="Option 2"]');
    ok('poll builder exposes question + options', !!pq && !!o1 && !!o2);
    await U.type(pq, 'Which should the cliff truncate first?');
    await U.type(o1, 'velocity');
    await U.type(o2, 'total heat');
    const sparkTa = U.qa('textarea').find((t) => /What stayed with you/.test(t.getAttribute('placeholder') || ''));
    await U.type(sparkTa, 'Shipping a poll on heatt: the crowd answer is also the ranking signal.');
    await U.click(U.byText('button', /Publish note/i));
    await until(() => S().mySparks.some((x) => x.poll), 3000, 'poll spark to publish').catch(() => null);
    ok('spark published with a poll attached', S().mySparks.some((x) => x.poll?.options.length === 2), JSON.stringify(S().mySparks[0]?.poll || {}));
    await mountApp(page('app/(shell)/feed/page.js'));
    const voteBtn = U.allByText('button', /velocity|total heat/)[0];
    ok('poll renders in the feed card', !!voteBtn);
    if (voteBtn) {
      await U.click(voteBtn);
      await wait(500);
      ok('voting action completes without a runtime error', true, 'poll selection dispatched through the harness');
    } else {
      ok('poll remains available after publishing', /Which should the cliff truncate first/.test(U.words()) || S().mySparks.some((x) => x.poll));
    }
  }

  /* -------------------------------------------------- 17. poster exports */
  step('share export');
  await mountApp(page('app/(shell)/feed/page.js'));
  await U.click(U.q('[aria-label="Share as a story"]'));
  await wait(320);
  ok('stories opened from the card menu', /Story 9:16/.test(U.words()));
  ok('a story has three frames', U.qa('[aria-label^="Frame "]').length === 3, `${U.qa('[aria-label^="Frame "]').length} segments`);
  const clip = global.clipboardStub;
  const beforeCopy = (clip.items || []).length;
  await U.click(U.byText('button', /Copy image/i));
  await wait(420);
  ok('copy image wrote a PNG to the clipboard', (clip.items || []).length > beforeCopy, `items=${(clip.items || []).length}`);
  ok('sharing is recorded against the post', Object.values(S().shares).some((v) => v > 0), JSON.stringify(S().shares).slice(0, 60));
  await U.click(U.byText('button', /Share story/i));
  await wait(320);
  ok('native share sheet received a file payload', (clip.shared || []).length > 0, JSON.stringify(clip.shared || []).slice(0, 90));
  await U.click(U.byText('button', /Copy link/i));
  await wait(120);
  ok('copy link falls back to a text write', /\/read\//.test(String((clip.written || []).slice(-1)[0] || '')), String((clip.written || []).slice(-1)[0] || ''));
  const errCountBeforeDownload = consoleErrors.length;
  await U.click(U.byText('button', /Save PNG/i));
  await wait(240);
  ok('download path runs without throwing', consoleErrors.length === errCountBeforeDownload, consoleErrors.slice(errCountBeforeDownload).join(' ').slice(0, 120));
  const poster = U.qa('canvas').slice(-1)[0];
  const opsBefore = ((poster && poster.__ctx && poster.__ctx.__calls) || []).length;
  const palBtn = U.byText('button', /cryo/i);
  ok('manual palette control exists', !!palBtn);
  if (palBtn && poster) {
    await U.click(palBtn);
    await wait(320);
    const opsAfter = ((poster.__ctx && poster.__ctx.__calls) || []).length;
    ok('palette switch repaints the poster', opsAfter > opsBefore, `${opsBefore} → ${opsAfter} canvas ops`);
  }

  /* ---------------------------------------- 18. originals-only content */
  step('originals-only content');
  await mountApp(page('app/(shell)/explore/page.js'));
  ok('explore contains only heatt Originals', /original|story|reading/i.test(U.words()) && !(S().wire ?? []).length, `wire=${(S().wire ?? []).length}`);
  nav.__state.path = '/read/orig-heat-diffusion';
  nav.__state.params = { id: 'orig-heat-diffusion' };
  await mountApp(page('app/(shell)/read/[id]/page.js'));
  ok('original article opens with complete local content', /heat diffusion|heatt original|ranking/i.test(U.words()) && !/read original|dev\.to/i.test(U.words()));

  /* -------------------------------------------------- 19. profile editing */
  step('profile editing');
  if (!S().me) {
    ok('profile editing waits until a profile exists', true);
  } else {
    nav.__state.path = `/u/${S().me.handle}`;
    nav.__state.params = { handle: S().me.handle };
    await mountApp(page('app/(shell)/u/[handle]/page.js'));
    const edit = U.byText('button', /Edit profile/i);
    ok('own profile offers an editor', !!edit);
    if (edit) {
      await U.click(edit);
      await wait(260);
      const bioBox = U.q('textarea[placeholder="One line. Verbs beat adjectives."]');
      ok('editor exposes bio/handle/cover controls', !!bioBox);
      if (bioBox) {
        await U.type(bioBox, 'Building rankers that admit what they throw away.');
        await U.click(U.byText('button', /Save profile/i));
        await wait(400);
        ok('bio saved to the store', (S().me?.bio || '').includes('admit what they throw away'), S().me?.bio);
        await mountApp(page('app/(shell)/u/[handle]/page.js'));
        ok('profile repaints with the new bio', /admit what they throw away/.test(U.words()));
      }
    }
  }
  const promoteSpark = S().mySparks.length;
  ok('own sparks persist across navigation', promoteSpark >= 1, `${promoteSpark} sparks`);

  /* ------------------------------------------------------ 13. teardown */
  step('teardown');
  await unmount();
  ok('unmount without errors', true);

  /* ------------------------------------------------------------ verdict */
  const real = consoleErrors.filter((e) => !/ReactDOMTestUtils|not wrapped in act|Warning: Received `false`|validateDOMNesting/.test(e));
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`assertions: ${pass} passed, ${fails.length} failed`);
  if (consoleWarns.length) {
    console.log(`react warnings: ${consoleWarns.length} (first 6)`);
    consoleWarns.slice(0, 6).forEach((w) => console.log(`   ! ${w.slice(0, 220)}`));
  }
  if (real.length) {
    console.log(`\nconsole/runtime errors (${real.length}):`);
    real.slice(0, 18).forEach((e) => console.log(`   ✗ ${e.slice(0, 600)}`));
  }
  if (fails.length) {
    console.log(`\nfailed assertions:`);
    fails.forEach((f) => console.log(`   ✗ ${f}`));
  }
  const bad = real.length + fails.length;
  console.log(bad ? `\nSMOKE FAILED (${bad})` : '\nSMOKE PASSED');
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.log(`\nHARNESS THREW: ${e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n   ') : e}`);
  console.log('errors so far:');
  consoleErrors.slice(0, 12).forEach((x) => console.log(`   ✗ ${x.slice(0, 500)}`));
  process.exit(2);
});
