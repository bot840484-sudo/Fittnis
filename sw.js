/**
 * Fittnis Service Worker
 * Provides offline support, caching, and background sync
 */
const CACHE_NAME = 'fittnis-v2.0.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/css/styles.css',
  '/src/js/app.js',
  '/src/js/utils/storage.js',
  '/src/js/utils/store.js',
  '/src/js/utils/i18n.js',
  '/src/js/utils/api.js',
  '/src/js/utils/auth.js',
  '/src/js/views/ViewBase.js',
  '/src/js/views/AuthView.js',
  '/src/js/views/TodayView.js',
  '/src/js/views/LogView.js',
  '/src/js/views/RunView.js',
  '/src/js/views/FoodView.js',
  '/src/js/views/SettingsView.js',
  '/src/js/views/LeaderboardView.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

const CACHE_STRATEGIES = {
  // Cache first for static assets
  static: 'cache-first',
  // Network first for API calls
  api: 'network-first',
  // Stale while revalidate for HTML
  html: 'stale-while-revalidate'
};

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.map(url => {
          // Handle cross-origin requests
          if (url.startsWith('http')) {
            return new Request(url, { mode: 'cors', credentials: 'omit' });
          }
          return url;
        }));
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Install failed:', err))
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Supabase API calls (let them go to network with auth)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Skip AI API calls
  if (url.hostname.includes('api.openai.com') || url.hostname.includes('generativelanguage.googleapis.com')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Handle static assets - cache first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Handle HTML - stale while revalidate
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default: network first
  event.respondWith(networkFirst(request));
});

// Cache-first strategy (for static assets)
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.error('[SW] Cache-first fetch failed:', err);
    return new Response('Offline', { status: 503 });
  }
}

// Network-first strategy (for API calls)
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale-while-revalidate (for HTML)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// Check if URL is a static asset
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
  const pathname = url.pathname.toLowerCase();
  return staticExtensions.some(ext => pathname.endsWith(ext)) ||
         pathname.includes('/src/') ||
         pathname === '/manifest.json';
}

// Background sync for offline data
self.addEventListener('sync', event => {
  if (event.tag === 'sync-workouts') {
    event.waitUntil(syncWorkouts());
  } else if (event.tag === 'sync-runs') {
    event.waitUntil(syncRuns());
  } else if (event.tag === 'sync-food') {
    event.waitUntil(syncFood());
  }
});

// Sync functions (called from app when online)
async function syncWorkouts() {
  const db = await openDB();
  const tx = db.transaction('workouts', 'readonly');
  const store = tx.objectStore('workouts');
  const pending = await store.getAll();

  for (const workout of pending) {
    try {
      await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workout)
      });
      await deleteFromDB('workouts', workout.id);
    } catch (e) {
      console.error('[SW] Sync workout failed:', e);
    }
  }
}

async function syncRuns() {
  const db = await openDB();
  const tx = db.transaction('runs', 'readonly');
  const store = tx.objectStore('runs');
  const pending = await store.getAll();

  for (const run of pending) {
    try {
      await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(run)
      });
      await deleteFromDB('runs', run.id);
    } catch (e) {
      console.error('[SW] Sync run failed:', e);
    }
  }
}

async function syncFood() {
  const db = await openDB();
  const tx = db.transaction('food', 'readonly');
  const store = tx.objectStore('food');
  const pending = await store.getAll();

  for (const food of pending) {
    try {
      await fetch('/api/food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(food)
      });
      await deleteFromDB('food', food.id);
    } catch (e) {
      console.error('[SW] Sync food failed:', e);
    }
  }
}

// IndexedDB helpers for offline storage
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FittnisOffline', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('workouts')) {
        db.createObjectStore('workouts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('runs')) {
        db.createObjectStore('runs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('food')) {
        db.createObjectStore('food', { keyPath: 'id' });
      }
    };
  });
}

function deleteFromDB(storeName, id) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

// Push notifications
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Fittnis dan yangi xabar',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: true,
    tag: data.tag || 'fittnis-notification'
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Fittnis', options)
  );
});

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'workout') {
    event.waitUntil(
      clients.openWindow('/#log?action=add')
    );
  } else {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'refresh-leaderboard') {
    event.waitUntil(refreshLeaderboard());
  }
});

async function refreshLeaderboard() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'LEADERBOARD_REFRESH' });
    });
  } catch (e) {
    console.error('[SW] Periodic sync failed:', e);
  }
}

console.log('[SW] Service Worker loaded');