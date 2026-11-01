const CACHE = 'hydrant-map-v3';
const ASSETS = [
  './', './index.html', './tiles.js', './markers.js',
  './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const isTiles = e.request.url.endsWith('tiles.js');
  if (isTiles) {
    // 圖磚 13.5MB 固定 → cache-first，不重下載
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).catch(() => cached))
    );
    return;
  }
  // 其餘（index.html / markers.js / manifest / icons）→ network-first：有網抓最新（UI 改動立刻生效），離線回退快取
  e.respondWith(
    fetch(e.request).then((resp) => {
      const clone = resp.clone();
      caches.open(CACHE).then((c) => c.put(e.request, clone));
      return resp;
    }).catch(() => caches.match(e.request))
  );
});
