/* Slitscan — offline shell.

   Strategy matters here: a plain cache-first worker pins the app to the
   first version it ever saw, so a rebuilt page never reaches the phone.
     · the page itself  → network-first, cache fallback  (updates land,
                          and it still opens with no network at all)
     · icons / manifest → cache-first                    (they don't change) */
const CACHE = 'slitscan-v3';
const ASSETS = [
  './',
  './index.html',
  './v2.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isPage = req =>
  req.mode === 'navigate' || (req.destination === 'document');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  if (isPage(req)){
    e.respondWith(
      fetch(req)
        .then(res => {
          // cache under the page's OWN url — keying every navigation to
          // index.html made visiting v2.html overwrite the offline v1
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req.url, copy));
          return res;
        })
        .catch(() => caches.match(req, {ignoreSearch: true})
          .then(hit => hit || caches.match('./index.html', {ignoreSearch: true})))
    );
    return;
  }

  e.respondWith(
    caches.match(req, {ignoreSearch: true}).then(hit =>
      hit || fetch(req).then(res => {
        if (res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
    )
  );
});
