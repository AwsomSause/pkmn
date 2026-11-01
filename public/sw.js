// Offline support (W12 F213). Plain, small and safe:
// - the page and its files are cached as they are fetched (network first for pages, so updates show up);
// - everything under assets/ is cache first (art and sound never change under the same name within a build);
// - only complete 200 answers are cached (audio range requests are passed through).
// The build id comes from the registration URL (sw.js?b=...), so each build gets its own cache and old ones are deleted.
const BUILD = new URL(self.location.href).searchParams.get('b') || 'dev';
const CACHE = `pkr-${BUILD}`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pkr-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.endsWith('/version.json')) return;
  const isAsset = url.pathname.includes('/assets/');
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (isAsset && hit) return hit;
      try {
        const res = await fetch(req);
        if (res.status === 200) cache.put(req, res.clone());
        return res;
      } catch (err) {
        if (hit) return hit;
        throw err;
      }
    })(),
  );
});
