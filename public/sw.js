// TRANA PWA Service Worker (Network-First with offline capability)
const CACHE_NAME = 'trana-pwa-v1';
const PRECACHE_ASSETS = [
  '/',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests, pass through POST / PUT / Supabase / WebSocket
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass service worker cache for external APIs and Supabase realtime
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('onrender.com') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Network-first strategy: always fetch fresh from network, fall back to cache if offline
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // If navigating to a page while offline, return root shell if cached
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});

