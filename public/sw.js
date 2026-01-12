// BYD Stats Service Worker
const CACHE_NAME = 'byd-stats-v1.1.2';

// Install event - don't skip waiting automatically
self.addEventListener('install', (event) => {
    console.log('[SW] Install - new version ready');
    // Force skipWaiting for this version to ensure update
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('[SW] Activate');
    event.waitUntil(clients.claim());
});

// Listen for skip waiting message from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Skip waiting requested');
        self.skipWaiting();
    }
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip chrome-extension and other non-http requests
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Clone and cache successful responses
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Fallback to cache
                return caches.match(event.request);
            })
    );
});

// Handle Share Target POST requests
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'POST') return;

    const url = new URL(event.request.url);
    if (url.pathname === '/' || url.pathname === '/index.html') {
        event.respondWith(handleShareTarget(event.request));
    }
});

async function handleShareTarget(request) {
    try {
        const formData = await request.formData();
        const files = formData.getAll('file');

        if (files.length > 0) {
            // Store the file in IndexedDB for the app to pick up
            const file = files[0];
            const buffer = await file.arrayBuffer();

            // Store in IndexedDB
            const db = await openDB();
            const tx = db.transaction('shared-files', 'readwrite');
            const store = tx.objectStore('shared-files');
            await store.put({
                id: 'latest',
                name: file.name,
                type: file.type,
                size: file.size,
                data: buffer,
                timestamp: Date.now()
            });

            console.log('[SW] File stored:', file.name, file.size);
        }

        // Redirect to the app with a flag
        return Response.redirect('/?shared=true', 303);
    } catch (e) {
        console.error('[SW] Share Target error:', e);
        return Response.redirect('/', 303);
    }
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('byd-stats-sw', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('shared-files')) {
                db.createObjectStore('shared-files', { keyPath: 'id' });
            }
        };
    });
}
