'use strict';
// Minimal stand-in for express.Router(): records routes so the sandbox can
// dispatch fetch-like calls to the real route handlers inside the browser.
function Router() {
  const routes = [];
  const add = method => (path, ...handlers) => { routes.push({ method, path, handlers }); };
  return {
    routes,
    get: add('GET'), post: add('POST'), put: add('PUT'), delete: add('DELETE'),
    use: (...handlers) => { routes.push({ method: '*', path: null, handlers }); }
  };
}
module.exports = { Router };
