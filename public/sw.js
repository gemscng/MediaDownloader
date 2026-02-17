const CACHE_NAME = 'mediadl-v1';
const SHELL_URLS = [
  '/',
  '/css/style.css',
  '/js/app.js',
  '/js/i18n.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Only cache GET requests for shell assets
  if (e.request.method !== 'GET') return;
  // Network-first for API calls, cache-first for shell
  if (url.pathname.startsWith('/download') || url.pathname.startsWith('/info') ||
      url.pathname.startsWith('/status/') || url.pathname.startsWith('/file/') ||
      url.pathname.startsWith('/files') || url.pathname.startsWith('/upload')) {
    return; // Don't cache API calls
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
