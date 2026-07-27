// Offline cache, same strategy as grandstand:
//   vendor/ + icons/  -> cache-first (immutable, versioned by CACHE bump)
//   everything else (shell, app/) -> network-first, fallback to cache
const CACHE = "tally-v1";

const PRECACHE = [
  "./",
  "./index.html",
  "./app/styles.css",
  "./app/main.js",
  "./app/store.js",
  "./app/ui.js",
  "./app/games/euchre.js",
  "./app/games/ohhell.js",
  "./app/games/gin.js",
  "./app/games/cribbage.js",
  "./app/games/sheepshead.js",
  "./app/games/rook.js",
  "./app/games/bridge.js",
  "./app/games/mahjong.js",
  "./vendor/preact/preact.module.js",
  "./vendor/preact/hooks.module.js",
  "./vendor/htm/htm.module.js",
  "./vendor/htm/preact.module.js",
  "./vendor/fonts/bricolage-var.woff2",
  "./vendor/fonts/jetbrains-mono-var.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("tally-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  const cacheFirst = url.pathname.includes("/vendor/") || url.pathname.includes("/icons/");
  if (cacheFirst) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html"))),
  );
});
