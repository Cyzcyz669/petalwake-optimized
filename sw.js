// Keeps a copy of the island on the device. The heavy, rarely changed files (assets/, vendor/) are
// served from the copy once fetched; the code and the page are fetched fresh when there is a
// network and from the copy when there is not. Bump VERSION when the assets change.
const VERSION = 'v2-2';
const HEAVY = `petalwake-assets-${VERSION}`, CODE = `petalwake-code-${VERSION}`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('petalwake-') && k !== HEAVY && k !== CODE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || req.headers.has('range')) return;
  const scope = new URL(self.registration.scope);
  const rel = url.pathname.slice(scope.pathname.length);
  if (/^(assets|vendor)\//.test(rel)) e.respondWith(heavy(req));
  else e.respondWith(code(req));
});

async function heavy(req) {
  const cache = await caches.open(HEAVY);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  // A cloned large response can be buffered twice while the game consumes it.
  // Only cache known-small assets; leave very large or unknown-size responses un-cloned.
  const bytes = Number(res.headers.get('content-length'));
  if (res.ok && res.status === 200 && bytes > 0 && bytes <= 8 * 1024 * 1024) cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function code(req) {
  const cache = await caches.open(CODE);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok && res.status === 200) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}
