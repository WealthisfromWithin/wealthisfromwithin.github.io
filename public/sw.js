// Offline shell for Sovereign Command. Bump CACHE on each deploy.
const CACHE = 'sovereign-v2';
const APP_SHELL = '/index.html';
const ASSETS = ['/', APP_SHELL, '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const request = e.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // SPA navigations always resolve to the app shell so deep links work offline.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(APP_SHELL, copy))
            .catch(() => {});
          return response;
        })
        .catch(() => caches.match(APP_SHELL).then((m) => m || caches.match('/'))),
    );
    return;
  }

  e.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches
          .open(CACHE)
          .then((c) => c.put(request, copy))
          .catch(() => {});
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
