const CACHE_NAME = 'easyeda-ipad-shell-v2';
const APP_SHELL = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

function isCacheableStaticRequest(request, url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return false;
  return url.pathname === '/manifest.webmanifest' || url.pathname.startsWith('/assets/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API/authenticated and WebSocket-adjacent requests must always stay network-only.
  if (url.origin === self.location.origin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/'))) {
    return;
  }

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(
      fetch(request).catch(async () => (
        (await caches.match('/'))
        ?? new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } })
      )),
    );
    return;
  }

  if (!isCacheableStaticRequest(request, url)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
        }
        return response;
      })
      .catch(async () => (
        (await caches.match(request))
        ?? new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } })
      )),
  );
});
