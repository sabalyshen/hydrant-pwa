const CACHE = 'hydrant-map-v4';
// 只預先快取小檔案（安裝快、可靠）；tiles.js 13.5MB 改為首次使用才下載快取，避免 addAll 失敗卡住安裝
const PRECACHE = ['./', './index.html', './markers.js', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
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
  if (e.request.url.endsWith('tiles.js')) {
    // 圖磚 13.5MB 固定 → cache-first，首次使用才 fetch 並快取
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).then((resp) => {
        const clone = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return resp;
      }))
    );
    return;
  }
  // 其餘（index.html / markers.js / manifest / icons）→ network-first：有網抓最新，離線回退快取
  e.respondWith(
    fetch(e.request).then((resp) => {
      const clone = resp.clone();
      caches.open(CACHE).then((c) => c.put(e.request, clone));
      return resp;
    }).catch(() => caches.match(e.request))
  );
});
