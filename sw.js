// No-op service worker: the site now redirects to sovereignmind.online.
// Deletes any previously cached HermesBrain shell so stale content is never served.
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
