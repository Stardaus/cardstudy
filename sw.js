const CACHE_NAME = 'flashcard-fun-v10'; // Bumped version
const ASSETS = [
    './',
    './index.html',
    './config.json',
    './css/style.css',
    './js/app.js',
    './js/sound.js',
    './js/vendor/papaparse.min.js',
    './js/vendor/idb.js',
    './js/vendor/wrap-idb-value.js', // Added missing dependency
    './manifest.json',
    './assets/icon-192.png',
    './assets/icon-512.png'
];

// 1. Install: Cache assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

// 2. Activate: Clean up old caches
// (Handled below)

// 4. Handle skipWaiting message
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        // Delete old cache versions (e.g. v1, v2)
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim(); // Take control of all clients immediately
        })
    );
});

// 3. Fetch: Serve from Cache, fall back to Network
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(response => response || fetch(e.request))
    );
});