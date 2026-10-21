export type Route = 'generate' | 'saved';

const HASHES: Readonly<Record<Route, string>> = { generate: '#/generate', saved: '#/saved' };

/** Hash routing works under the GitHub Pages sub-path and offline without server rewrites (ADR-006). */
export function parseRoute(hash: string): Route {
  return hash === HASHES.saved ? 'saved' : 'generate';
}

export interface Router {
  go(route: Route): void;
  current(): Route;
}

/** `onChange(route, navigated)`: `navigated` is false for the initial render and true after the user moved. */
export function initRouter(onChange: (route: Route, navigated: boolean) => void): Router {
  window.addEventListener('hashchange', () => onChange(parseRoute(location.hash), true));
  onChange(parseRoute(location.hash), false);
  return {
    go(route) {
      if (parseRoute(location.hash) === route && location.hash === HASHES[route]) return;
      location.hash = HASHES[route];
    },
    current: () => parseRoute(location.hash),
  };
}
