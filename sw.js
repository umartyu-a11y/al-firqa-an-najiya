const VERSION = 'affn-offline-v5';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const SCOPE_URL = new URL('./', self.location.href);
const SCOPE_PATH = SCOPE_URL.pathname;
const MAX_RUNTIME_CACHE_BYTES = 10 * 1024 * 1024;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './precache-manifest.json',
  './favicon.svg',
  './logo-icon.png',
  './logo-full.png',
  './logo-mark.png',
  './transcripts/problema-zla.txt'
];
const CACHEABLE_FILE = /\.(?:css|js|mjs|json|webmanifest|svg|png|webp|jpe?g|gif|pdf|txt|woff2?)$/i;
const MEDIA_FILE = /\.(?:mp3|m4a|wav|ogg|flac|mp4|webm|mov)$/i;

const offlinePage = async (request) => await caches.match(request)
  || await caches.match(new URL('./', SCOPE_URL))
  || await caches.match(new URL('./index.html', SCOPE_URL));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(APP_SHELL);

    const manifestResponse = await fetch(new URL('./precache-manifest.json', SCOPE_URL), { cache: 'no-store' });
    if (!manifestResponse.ok) throw new Error('Не удалось загрузить список ресурсов для офлайн-кэша.');
    const manifest = await manifestResponse.json();
    const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
    await cache.addAll([...new Set([...APP_SHELL, ...assets])]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('affn-offline-') && ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

const cacheIfSmall = async (cacheName, request, response) => {
  if (!response || response.status !== 200 || response.type === 'opaque') return;
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_RUNTIME_CACHE_BYTES) return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch {
    // При нехватке места сохраняем сетевой ответ и не прерываем работу сайта.
  }
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH)) return;
  if (url.pathname.includes('/api/') || request.destination === 'audio' || MEDIA_FILE.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(new Request(request, { cache: 'no-cache' }));
        if (response.ok) {
          await cacheIfSmall(RUNTIME_CACHE, request, response);
          return response;
        }
        return await offlinePage(request) || response;
      } catch {
        return await offlinePage(request);
      }
    })());
    return;
  }

  if (!CACHEABLE_FILE.test(url.pathname)) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (!response.ok) return await caches.match(request) || response;
      await cacheIfSmall(RUNTIME_CACHE, request, response);
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
