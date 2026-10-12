// Service worker : l'app est téléchargée EN ENTIER à l'installation, puis fonctionne sans réseau.
// - installation : tous les fichiers du build (JS, CSS, polices, icônes) sont mis en cache d'un coup
//   (la liste et la version sont injectées par le plugin « precache » de vite.config.ts)
// - pages : réseau d'abord (pour recevoir les mises à jour), cache en secours
// - assets : cache d'abord
const BUILD = '__BUILD__';
const CACHE = 'gremlin-' + BUILD;
// ignoreVary : les modules ES envoient un en-tête Origin que le cache ne retrouverait pas sinon (Vary: Origin)
const MATCH = { ignoreVary: true };
const SHELL = ['/', ...JSON.parse('__PRECACHE__')];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // jamais d'API en cache

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/', MATCH)),
    );
    return;
  }

  e.respondWith(
    caches.match(req, MATCH).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

// --- Notifications (rappel quotidien, mots surprise) ---------------------------------
self.addEventListener('push', (e) => {
  let data = { title: 'GREmlin', body: '', url: '/', tag: 'gremlin' };
  try {
    data = { ...data, ...e.data.json() };
  } catch {
    /* message sans JSON : on garde les valeurs par défaut */
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      data: { url: data.url },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins[0];
      if (open) return open.focus().then(() => open.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
