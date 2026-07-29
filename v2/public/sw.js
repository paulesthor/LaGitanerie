const CACHE = 'gitanerie-v34';

// Assets à pré-cacher à l'installation
const PRECACHE = [
  '/',
  '/index.html',
  '/lobbypyramide.html',
  '/loupgarou.html',
  '/loupwait.html',
  '/loupnight.html',
  '/join.html',
  '/game.html',
  '/game2.html',
  '/memorize.html',
  '/end.html',
  '/login.html',
  '/profile.html',
  '/css/main.css',
  '/js/firebase-config.js',
  '/js/logger.js',
  '/js/presence.js',
  '/js/game/utils.js',
  '/js/game/avatar.js',
  '/js/game/loup.js',
  '/manifest.json',
  '/icons/hedgehog.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// CDN dont on veut mettre en cache les réponses
const CDN_ORIGINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'www.gstatic.com',
  'cdn.jsdelivr.net',
];

// Domaines Firebase à ne JAMAIS mettre en cache (données temps réel)
const BYPASS = [
  'firebasedatabase.app',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  let hostname;
  try { hostname = new URL(req.url).hostname; } catch { return; }

  // Bypass Firebase realtime / auth
  if (BYPASS.some(d => hostname.includes(d))) return;

  // CDN (fonts, FA, Firebase SDK, confetti) — cache-first
  if (CDN_ORIGINS.some(d => hostname.includes(d))) {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // Nos assets (HTML, CSS, JS, images) — stale-while-revalidate
  // → réponse immédiate depuis le cache, mise à jour silencieuse en arrière-plan
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});
