const CACHE = 'kg-english-v-clean-audit-1';
const ASSETS = [
  "./index.html",
  "./kg1.html",
  "./kg2.html",
  "./class.html",
  "./certificate.html",
  "./admin.html",
  "./play.html",
  "./homework.html",
  "./parent.html",
  "./style.css",
  "./remove-empty-box.css",
  "./manifest.json",
  "./js/app-core.js",
  "./js/admin-extra.js",
  "./js/play-main.js",
  "./student-cloud-client.js",
  "./homework.js",
  "./parent.js",
  "./assets/icons/dreamers-192.png",
  "./assets/icons/dreamers-192-maskable.png",
  "./assets/icons/dreamers-512.png",
  "./assets/icons/dreamers-512-maskable.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/img/dreamers-logo.png",
  "./assets/grades/play-dr-tarek.png",
  "./assets/grades/homework.png",
  "./assets/grades/kg1.png",
  "./assets/grades/kg2.png"
];
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).catch(() => {}));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const networkFirst = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('.json');
  if (networkFirst) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }
  event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
    return res;
  })));
});
