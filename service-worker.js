const CACHE_NAME = 'flashcard-pwa-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/styles/main.css',
  '/styles/components.css',
  '/styles/utilities.css',
  '/src/main.js',
  '/src/app.js',
  // Dependencies loaded via CDN are not directly managed by this service worker's precache
  // as they are external resources. They will be fetched from network if not in browser cache.
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching app shell');
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Ensure that the service worker takes control of the page immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Prevent caching of CSV data requests
  if (event.request.url.includes('.csv') || event.request.url.includes('spreadsheets')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response; // Cache hit - return response
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache new resources as they are fetched
        return caches.open(CACHE_NAME).then((cache) => {
          // Do not cache non-GET requests, non-http(s) schemes, or responses with status not 200
          const scheme = new URL(event.request.url).protocol;
          if (event.request.method === 'GET' && networkResponse.status === 200 && (scheme === 'http:' || scheme === 'https:')) {
             cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      });
    })
  );
});

// Logic for showing "Update Available" banner (optional, and usually implemented in the main app)
// self.addEventListener('controllerchange', () => {
//   // This event fires when the service worker controlling this page changes
//   // E.g., when a new service worker has activated and taken control.
//   // You might want to dispatch a custom event here to notify the app.
//   console.log('Service Worker: New service worker activated, app update available.');
//   // Example: window.location.reload() for immediate update, or show a banner
// });
