/* ============================================================================
   tests/smoke/harness.cjs — jsdom environment for driving the real app.

   Nothing here is Next-aware: we compile the client tree with
   `tsconfig.smoke.json`, redirect `next/navigation|dynamic|link` to local
   stubs, resolve `@/*` into the compiled output, and mount pages with
   react-dom/client under React.act. The point is to execute effects, pointer
   handlers, canvas painting and unmount cleanup — the code a build cannot see.
   ==========================================================================*/
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, '.tmp-client');
const STUBS = path.join(__dirname, 'dom-stubs');

/* ------------------------------------------------------------ module graph */
const STUB_MAP = {
  'next/navigation': path.join(STUBS, 'next-navigation.js'),
  'next/dynamic': path.join(STUBS, 'next-dynamic.js'),
  'next/link': path.join(STUBS, 'next-link.js'),
  'next/image': path.join(STUBS, 'next-link.js'),
};

function resolveLocal(base) {
  for (const cand of [base + '.js', path.join(base, 'index.js')]) {
    if (fs.existsSync(cand)) return cand;
  }
  throw new Error(`smoke: cannot resolve ${base} (did tsc emit it?)`);
}

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (STUB_MAP[request]) return STUB_MAP[request];
  if (request.startsWith('@/')) return resolveLocal(path.join(OUT, request.slice(2)));
  if (request.startsWith('./globals.css') || request.endsWith('.css')) {
    return path.join(__dirname, 'dom-stubs', 'empty.js');
  }
  return origResolve.call(this, request, parent, isMain, options);
};

fs.writeFileSync(path.join(STUBS, 'empty.js'), 'module.exports = {};\n');

/* ------------------------------------------------------- 2D canvas recorder */
function makeCtx(canvas) {
  const calls = [];
  const noop = (name) => (...args) => {
    calls.push([name, args.length]);
  };
  const base = {
    canvas,
    save: noop('save'),
    restore: noop('restore'),
    beginPath: noop('beginPath'),
    closePath: noop('closePath'),
    moveTo: noop('moveTo'),
    lineTo: noop('lineTo'),
    arc: noop('arc'),
    arcTo: noop('arcTo'),
    ellipse: noop('ellipse'),
    rect: noop('rect'),
    roundRect: noop('roundRect'),
    fill: noop('fill'),
    stroke: noop('stroke'),
    clip: noop('clip'),
    fillRect: noop('fillRect'),
    strokeRect: noop('strokeRect'),
    clearRect: noop('clearRect'),
    fillText: noop('fillText'),
    strokeText: noop('strokeText'),
    drawImage: noop('drawImage'),
    translate: noop('translate'),
    rotate: noop('rotate'),
    scale: noop('scale'),
    transform: noop('transform'),
    setTransform: noop('setTransform'),
    resetTransform: noop('resetTransform'),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => null,
    measureText: (t) => ({ width: String(t).length * 7.2 }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }),
    putImageData: noop('putImageData'),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }),
    quadraticCurveTo: noop('quadraticCurveTo'),
    bezierCurveTo: noop('bezierCurveTo'),
    setLineDash: noop('setLineDash'),
  };
  base.__calls = calls;
  return new Proxy(base, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'string' && /^(width|height|onload|onerror|style|parentNode|classList)$/.test(k)) return undefined;
      // unknown method → count it, so a typo in the paint code is visible in stats
      calls.push([`unknown:${String(k)}`, 0]);
      return undefined;
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
}

/* ----------------------------------------------------------------- jsdom up */
const { JSDOM, VirtualConsole } = require('jsdom');

const consoleErrors = [];
const consoleWarns = [];
let activeLabel = 'boot';

function install({ url = 'http://localhost:3000/feed' } = {}) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    if (/Could not parse CSS|Not implemented/.test(e.message)) return;
    consoleErrors.push(`[jsdom:${activeLabel}] ${e.message}`);
  });

  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
    url,
    pretendToBeVisual: true,
    virtualConsole: vc,
  });

  const { window } = dom;
  global.IS_REACT_ACT_ENVIRONMENT = true;

  /* URL + Blob must come from the jsdom realm, otherwise Node's
     URL.createObjectURL rejects a jsdom Blob and the download path looks broken
     in the harness while working fine in a browser. */
  const gp = ['URL', 'URLSearchParams', 'window', 'document', 'navigator', 'location', 'history', 'HTMLElement', 'HTMLAnchorElement', 'HTMLCanvasElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Element', 'Node', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'Blob', 'File', 'ClipboardItem', 'Image', 'getComputedStyle', 'localStorage', 'sessionStorage', 'DOMParser', 'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver'];
  for (const k of gp) {
    if (window[k] === undefined) continue;
    try {
      Object.defineProperty(global, k, { value: window[k], writable: true, configurable: true });
    } catch {
      /* some Node globals (navigator) are getter-only; window already provides them */
    }
  }
  /* framer-motion (and friends) reach for DOM constructors as bare globals */
  for (const name of ['SVGElement','SVGSVGElement','PointerEvent','FocusEvent','InputEvent','WheelEvent','DragEvent','AnimationEvent','TransitionEvent','Text','Comment','DocumentFragment','ShadowRoot','Range','NodeList','HTMLCollection','DOMRect','DOMMatrix','CSS','FileList','DataTransfer','PopStateEvent','UIEvent','MouseEvent','TouchEvent','ScrollEvent','StorageEvent']) {
    if (window[name] === undefined) continue;
    try { Object.defineProperty(global, name, { value: window[name], writable: true, configurable: true }); } catch {}
  }
  Object.defineProperty(globalThis, 'self', { value: window, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true, writable: true });

  /* polyfills jsdom lacks (all are standard in browsers) */
  class RO {
    constructor(cb) {
      this.cb = cb;
    }
    observe(el) {
      this.cb([{ target: el, contentRect: { width: el && el.clientWidth ? el.clientWidth : 640 } }], this);
    }
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = global.ResizeObserver = RO;
  window.IntersectionObserver = global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  if (!window.matchMedia) {
    window.matchMedia = (q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
  }
  global.matchMedia = window.matchMedia;
  window.scrollTo = global.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.Element.prototype.scrollBy = function () {};
  window.Element.prototype.scrollTo = function () {};
  window.HTMLElement.prototype.scrollBy = function () {};
  window.HTMLElement.prototype.scrollTo = function () {};
  window.Element.prototype.setPointerCapture = function () {};
  window.Element.prototype.releasePointerCapture = function () {};
  window.Element.prototype.hasPointerCapture = () => false;
  window.document.fonts = { load: () => Promise.resolve([]), ready: Promise.resolve(), check: () => true };

  /* canvas: record instead of rasterise, so paint code really executes */
  window.HTMLCanvasElement.prototype.getContext = function (kind) {
    if (kind === '2d') {
      if (!this.__ctx) this.__ctx = makeCtx(this);
      return this.__ctx;
    }
    return null; // WebGL unsupported → exercises the documented fallback
  };
  window.HTMLCanvasElement.prototype.toBlob = function (cb, type) {
    // must be the *window* realm's Blob or jsdom's ClipboardItem rejects it
    setTimeout(() => cb(new window.Blob(['\x89PNG-stub'], { type: type || 'image/png' })), 0);
  };
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,c3R1Yg==';

  /* remote images fail to load in jsdom → exercise the fallback branch */
  const RealImage = window.Image;
  window.Image = global.Image = class FakeImage {
    constructor() {
      this.width = 0;
      this.height = 0;
      this.complete = false;
      this.crossOrigin = null;
    }
    set src(v) {
      this._src = v;
      setTimeout(() => this.onerror && this.onerror(new window.Event('error')), 0);
    }
    get src() {
      return this._src;
    }
    addEventListener(t, f) {
      if (t === 'error') this.onerror = f;
    }
    decode() {
      return Promise.reject(new Error('nope'));
    }
  };
  if (RealImage) void 0;

  /* jsdom has no object-URL store; the download path only needs a stable URL */
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => `blob:heatt/${Math.random().toString(36).slice(2)}`;
    window.URL.revokeObjectURL = () => {};
  }

  /* clipboard + share + vibrate */
  const clip = { written: [], items: [], shared: [] };
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: (t) => {
        clip.written.push(t);
        return Promise.resolve();
      },
      readText: () => Promise.resolve(''),
      write: (data) => {
        clip.items.push(data);
        return Promise.resolve();
      },
    },
  });
  Object.defineProperty(window.navigator, 'share', {
    configurable: true,
    value: (payload) => {
      clip.shared.push(payload);
      return Promise.resolve();
    },
  });
  window.ClipboardItem = global.ClipboardItem = class FakeClipboardItem {
    constructor(items) {
      this.items = items;
      clip.items.push(items);
    }
  };
  Object.defineProperty(window.navigator, 'canShare', { configurable: true, value: () => true });
  Object.defineProperty(window.navigator, 'vibrate', { configurable: true, value: () => true });
  global.clipboardStub = clip;

  /* network: the app must degrade to its bundled library with no wire */
  global.fetch = window.fetch = (input) => {
    clip.lastFetch = String(input);
    return Promise.reject(new TypeError('fetch failed (smoke: offline)'));
  };

  /* React 19 act + scheduler flushing */
  const React = require('react');
  const act = React.act;

  const flush = async (rounds = 4) => {
    for (let i = 0; i < rounds; i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    }
  };

  const root = window.document.getElementById('root');
  let current = null;

  const mount = async (el) => {
    const { createRoot } = require('react-dom/client');
    if (current) await act(async () => current.unmount());
    current = createRoot(root);
    await act(async () => {
      current.render(el);
    });
    await flush();
    return current;
  };

  const unmount = async () => {
    if (!current) return;
    await act(async () => current.unmount());
    current = null;
  };

  /* capture uncaught errors from effects/handlers that React would rethrow */
  window.addEventListener('error', (e) => consoleErrors.push(`[window:${activeLabel}] ${e.message}`));
  window.addEventListener('unhandledrejection', (e) => consoleErrors.push(`[rejection:${activeLabel}] ${(e.reason && e.reason.message) || e.reason}`));
  process.on('unhandledRejection', (r) =>
    consoleErrors.push(`[node-rejection:${activeLabel}] ${(r && r.message) || r}\n${(r && r.stack) || ''}`.split('\n').slice(0, 6).join('\n'))
  );

  const origWarn = console.warn;
  console.error = (...a) => {
    const msg = a.map((x) => (x instanceof Error ? x.stack || x.message : typeof x === 'object' ? JSON.stringify(x).slice(0, 240) : String(x))).join(' ');
    if (/not wrapped in act|ReactDOMTestUtils|useLayoutEffect does nothing on the server/.test(msg)) return;
    consoleErrors.push(`[${activeLabel}] ${msg}`);
  };
  console.warn = (...a) => {
    const msg = a.map((x) => String(x)).join(' ');
    if (!/Not implemented|Could not parse CSS/.test(msg)) consoleWarns.push(`[${activeLabel}] ${msg}`);
  };

  return { window, dom, act, flush, mount, unmount, root, setLabel: (l) => (activeLabel = l) };
}

/* --------------------------------------------------------------- utilities */
const H = (doc) => ({
  /* textContent glues adjacent elements ('Choose'+'the'+'name'), which breaks
     regexes; walk text nodes and rejoin with single spaces instead. */
  words: (el) => {
    const target = el || doc.body;
    if (!target) return '';
    const out = [];
    const it = doc.createTreeWalker(target, 4 /* SHOW_TEXT */, null);
    while (it.nextNode()) out.push(it.currentNode.nodeValue);
    return out.join(' ').replace(/\s+/g, ' ').trim();
  },
  q: (sel) => doc.querySelector(sel),
  qa: (sel) => [...doc.querySelectorAll(sel)],
  text: (sel) => (doc.querySelector(sel) ? doc.querySelector(sel).textContent : null),
  byText: (sel, re) => [...doc.querySelectorAll(sel)].find((n) => re.test(n.textContent || '')) || null,
  allByText: (sel, re) => [...doc.querySelectorAll(sel)].filter((n) => re.test(n.textContent || '')),
  click: async (el, opts = {}) => {
    if (!el) throw new Error('click: element missing');
    const win = el.ownerDocument.defaultView;
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      el.dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, view: win, button: 0, ...opts }));
    }
  },
  pointer: (el, type, opts = {}) => {
    const win = el.ownerDocument.defaultView;
    el.dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, view: win, ...opts }));
  },
  type: async (el, value) => {
    if (!el) throw new Error('type: element missing');
    const win = el.ownerDocument.defaultView;
    const proto = el.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : el.tagName === 'INPUT' ? win.HTMLInputElement.prototype : win.Element.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new win.Event('input', { bubbles: true }));
    el.dispatchEvent(new win.Event('change', { bubbles: true }));
  },
  key: async (target, key, opts = {}) => {
    const win = target === window || target?.defaultView === target ? window : (target.ownerDocument || target.document)?.defaultView || window;
    const ev = new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
    target.dispatchEvent(ev);
    if (opts.up !== false) target.dispatchEvent(new win.KeyboardEvent('keyup', { key, bubbles: true, cancelable: true, ...opts }));
  },
});

module.exports = { install, H, OUT, ROOT, consoleErrors, consoleWarns };
