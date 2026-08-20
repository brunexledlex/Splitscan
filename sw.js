/* Slitscan — offline shell.

   Strategy matters here: a plain cache-first worker pins the app to the
   first version it ever saw, so a rebuilt page never reaches the phone.
     · the page itself  → network-first, cache fallback  (updates land,
                          and it still opens with no network at all)
     · icons / manifest → cache-first                    (they don't change)

   GitHub Pages serves EVERYTHING with `Cache-Control: max-age=600` — it has
   no way to say "always revalidate" for sw.js or the pages. That means the
   plain `fetch(req)` below was being satisfied by the browser's own 10-minute
   HTTP cache, not a real network hit: "network-first" was actually
   "whatever's-in-the-HTTP-cache-for-10-minutes-first". `{cache:'no-store'}`
   is what actually forces a live request. See registration in v2.html/
   index.html for the matching fix on the sw.js file itself. */
const CACHE = 'slitscan-v10';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-180.png',
  './assets/favicon.jpg',
  './assets/placeholder.jpg',
  './assets/carro.svg',
  './assets/logo.svg',
  './assets/mode-swipe.svg',
  './assets/mode-burst.svg',
  './assets/mode-strip.svg',
  './assets/blank-roll.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // 'reload' for the same reason as above: addAll's default fetch would
      // happily accept a stale copy straight out of the 10-minute HTTP cache
      .then(c => c.addAll(ASSETS.map(u => new Request(u, {cache: 'reload'}))))
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
      fetch(req, {cache: 'no-store'})   // bypass the HTTP cache, not just this worker's
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
