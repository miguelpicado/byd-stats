// Service Worker for BYD Stats Debug
// Handles share target and file receiving

const CACHE_NAME = 'byd-debug-v1';

// Install
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(clients.claim());
});

// Fetch - Handle share target POST
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Check if this is a share target POST
  if (event.request.method === 'POST' && url.pathname === '/prueba/') {
    console.log('[SW] Share target POST received!');
    
    event.respondWith((async () => {
      const formData = await event.request.formData();
      
      // Get shared file
      const file = formData.get('file');
      const title = formData.get('title');
      const text = formData.get('text');
      const sharedUrl = formData.get('url');
      
      console.log('[SW] Shared data:', { file, title, text, url: sharedUrl });
      
      // Store in IndexedDB for the page to retrieve
      if (file) {
        const db = await openDB();
        const tx = db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        
        const arrayBuffer = await file.arrayBuffer();
        await store.put({
          id: 'shared-file',
          name: file.name,
          type: file.type,
          size: file.size,
          data: arrayBuffer,
          timestamp: Date.now()
        });
        
        console.log('[SW] File stored in IndexedDB');
      }
      
      // Redirect to the page with a flag
      const redirectUrl = new URL('/prueba/', self.location.origin);
      redirectUrl.searchParams.set('shared', '1');
      if (file) redirectUrl.searchParams.set('filename', file.name);
      if (title) redirectUrl.searchParams.set('title', title);
      if (text) redirectUrl.searchParams.set('text', text);
      
      return Response.redirect(redirectUrl.toString(), 303);
    })());
  }
});

// IndexedDB helper
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('byd-debug', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    };
  });
}

// Message handler for communication with page
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'GET_SHARED_FILE') {
    event.waitUntil((async () => {
      const db = await openDB();
      const tx = db.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      const file = await new Promise((resolve, reject) => {
        const request = store.get('shared-file');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      event.source.postMessage({
        type: 'SHARED_FILE',
        file: file
      });
    })());
  }
});
