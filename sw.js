// Offline cache, same strategy as grandstand:
//   vendor/ + icons/  -> cache-first (immutable, versioned by CACHE bump)
//   everything else (shell, app/) -> network-first, fallback to cache
// Bump CACHE on every deploy that touches precached files.
const CACHE = "tally-v8";

// Manual list — nothing derives this from the filesystem. Every shipped file
// under app/, app/games/, vendor/, and icons/ must be added here by hand,
// or the app silently breaks offline for anyone who installed it.
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./app/styles.css",
  "./app/main.js",
  "./app/store.js",
  "./app/ui.js",
  "./app/rivalry.js",
  "./app/rivalry.data.js",
  "./app/games/euchre.js",
  "./app/games/euchre.rules.js",
  "./app/games/ohhell.js",
  "./app/games/ohhell.rules.js",
  "./app/games/gin.js",
  "./app/games/gin.rules.js",
  "./app/games/cribbage.js",
  "./app/games/cribbage.rules.js",
  "./app/games/cribbage.board.js",
  "./app/games/sheepshead.js",
  "./app/games/sheepshead.rules.js",
  "./app/games/rook.js",
  "./app/games/rook.rules.js",
  "./app/games/bridge.js",
  "./app/games/bridge.rules.js",
  "./app/games/mahjong.js",
  "./app/games/mahjong.rules.js",
  "./vendor/preact/preact.module.js",
  "./vendor/preact/hooks.module.js",
  "./vendor/htm/htm.module.js",
  "./vendor/htm/preact.module.js",
  "./vendor/fonts/bricolage-var.woff2",
  "./vendor/fonts/jetbrains-mono-var.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
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
      .catch(() =>
        caches.match(e.request).then((hit) => {
          if (hit) return hit;
          // only navigations fall back to the shell; a missing asset must fail
          // as itself, not come back as HTML pretending to be a JS module
          if (e.request.mode === "navigate") return caches.match("./index.html");
          return Response.error();
        }),
      ),
  );
});
