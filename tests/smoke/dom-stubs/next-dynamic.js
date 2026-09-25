/* `next/dynamic` that resolves in the same tick, so lazily imported overlays
 * (palette, composer, share studio, intro) actually mount under jsdom. */
const React = require('react');

module.exports = {
  __esModule: true,
  default: function dynamic(loader) {
    const Cache = new Map();
    function DynamicComponent(props) {
      const [C, setC] = React.useState(() => Cache.get('m') || null);
      React.useEffect(() => {
        if (C) return;
        let alive = true;
        Promise.resolve(loader())
          .then((m) => {
            const res = (m && m.__esModule && m.default) || m;
            Cache.set('m', res);
            if (alive) setC(() => res);
          })
          .catch((e) => console.error('[smoke] dynamic load failed:', e && e.message));
        return () => {
          alive = false;
        };
      }, [C]);
      if (!C) return null;
      return React.createElement(C, props);
    }
    return DynamicComponent;
  },
  noSSR: (x) => x,
};
