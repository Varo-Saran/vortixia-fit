const CACHE_NAME = 'vortixia-fit-cache-v1';

// Install event: cache essential files
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event: network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests
  if (event.request.method !== 'GET') return;
  // Skip caching cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;
  // Skip API or Supabase requests
  if (event.request.url.includes('/supabase.co') || event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache valid responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request);
      })
  );
});
