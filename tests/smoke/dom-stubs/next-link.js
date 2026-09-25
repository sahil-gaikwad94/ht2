/* `next/link` → a plain <a> so clicks hit our handlers (harness intercepts nav). */
const React = require('react');
const NEXT_ONLY = new Set(['legacyBehavior', 'passHref', 'prefetch', 'scroll', 'shallow', 'replace', 'locale', 'className']);
module.exports = {
  __esModule: true,
  default: function Link({ href, children, as, onNavigate, scroll, ...rest }) {
    for (const k of NEXT_ONLY) delete rest[k];
  const target = typeof href === 'string' ? href : (href && href.pathname) || '#';
    return React.createElement('a', { href: target, 'data-next-link': '', ...rest }, children);
  },
  preload: () => {},
  prefetch: () => {},
};
