const CACHE_NAME = 'asset-tracker-shell-v1';

const SHELL_ASSETS = [
    '/index.html',
    '/login.html',
    '/scan.html',
    '/asset.html',
    '/assets.html',
    '/manifest.json',
    '/css/style.css',
    '/css/bootstrap.min.css',
    '/js/common.js',
    '/js/auth.js',
    '/js/dashboard.js',
    '/js/scan.js',
    '/js/asset.js',
    '/js/assets-list.js',
    '/js/offline-queue.js',
    '/icons/icon.svg',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Network-first for API calls: always try the network so data stays fresh,
    // only fall back to a generic offline response if the request fails.
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request).catch(() =>
                new Response(JSON.stringify({ error: 'Offline' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' },
                })
            )
        );
        return;
    }

    // Cache-first for the app shell (static assets, including cross-origin CDN libs).
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request)
                .then((response) => {
                    if (response.ok && request.method === 'GET') {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => cached);
        })
    );
});
