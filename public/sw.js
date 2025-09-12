const CACHE_NAME = 'nisan-albumu-v6';
const API_CACHE_NAME = 'nisan-api-cache-v4';
const OFFLINE_CACHE = 'nisan-offline-v3';

// Önbelleğe alınacak kritik kaynaklar
const urlsToCache = [
  '/',
  '/src/main.jsx',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.5/purify.min.js'
];

// Offline sayfası için kaynaklar
const OFFLINE_URLS = [
  '/',
  '/offline.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)),
      caches.open(OFFLINE_CACHE).then(cache => cache.addAll(OFFLINE_URLS))
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME && cacheName !== OFFLINE_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // API istekleri için optimized cache stratejisi
  if (event.request.url.includes('script.google.com')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(cache => {
        return fetch(event.request.clone()).then(response => {
          // 5 dakika cache'le
          if (response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => {
          return cache.match(event.request).then(cachedResponse => {
            return cachedResponse || new Response(JSON.stringify({ error: "Offline mode" }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        });
      })
    );
    return;
  }

  // Strateji: Ağdan getir, başarısız olursa önbellekten
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Her zaman ağ isteğini dene
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // Geçerli yanıtı önbelleğe al
        if (networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Ağ hatası durumunda önbellekten getir veya offline sayfasını göster
        if (cachedResponse) {
          return cachedResponse;
        }
        
        if (event.request.destination === 'document') {
          return caches.match('/offline.html');
        }
        
        return new Response('Offline', { status: 200 });
      });
      
      return cachedResponse || fetchPromise;
    })
  );
});