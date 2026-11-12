// Retirement worker for installations of earlier releases. It does not intercept any requests.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  await self.clients.claim();
  for (const key of await caches.keys()) if (key.startsWith('petalwake-')) await caches.delete(key);
  await self.registration.unregister();
})()));
