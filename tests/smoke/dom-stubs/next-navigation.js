/* Fake `next/navigation` for the jsdom harness. The harness mutates __state to
 * drive route params and reads __nav to assert programmatic navigation. */
const React = require('react');

const __state = { path: '/feed', params: {}, query: '' };
const __nav = [];

function router() {
  return {
    push: (href) => {
      __nav.push({ kind: 'push', href });
      __state.path = String(href).split('?')[0];
    },
    replace: (href) => {
      __nav.push({ kind: 'replace', href });
      __state.path = String(href).split('?')[0];
    },
    back: () => __nav.push({ kind: 'back', href: null }),
    forward: () => {},
    refresh: () => {},
    prefetch: () => Promise.resolve(),
  };
}

module.exports = {
  __state,
  __nav,
  __reset() {
    __nav.length = 0;
    __state.path = '/feed';
    __state.params = {};
    __state.query = '';
  },
  useRouter: router,
  usePathname: () => __state.path,
  useParams: () => __state.params,
  useSearchParams: () => new URLSearchParams(__state.query),
  useSelectedLayoutSegment: () => null,
  useSelectedLayoutSegments: () => [],
  useLayoutSegments: () => [],
  redirect: (href) => {
    __nav.push({ kind: 'redirect', href });
  },
  permanentRedirect: (href) => {
    __nav.push({ kind: 'redirect', href });
  },
  notFound: () => null,
  ReadonlyURLSearchParams: URLSearchParams,
  useHref: (href) => href,
};
