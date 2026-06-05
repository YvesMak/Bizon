/* Service worker Bizon — installation PWA + cache hors-ligne de la coquille.
 * Stratégies :
 *  - navigation (HTML)      → réseau d'abord, repli sur le cache (offline).
 *  - assets statiques (GET) → cache d'abord, mise à jour en arrière-plan.
 *  - API (/api/...)         → réseau uniquement (jamais mis en cache).
 */
const VERSION = 'bizon-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

// Coquille minimale mise en cache à l'installation.
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function isApi(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // ressources tierces : laisser passer
  if (isApi(url)) return; // API / médias dynamiques : toujours réseau

  // Navigation (chargement de page) : réseau d'abord, repli cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  // Assets statiques : cache d'abord, réseau en repli + mise à jour.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Permet à la page de forcer l'activation d'un SW mis à jour.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ---------- Notifications push ----------
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const title = payload.title || 'Bizon';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag,
    renotify: !!payload.tag,
    data: payload.data || {},
    vibrate: [80, 40, 80]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) { client.focus(); return; }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
