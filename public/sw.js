// Aperolympics service worker — caches the app shell so the PWA installs and
// opens instantly. Realtime traffic (/socket.io/) is never cached; gameplay
// still requires a connection.

const CACHE = "apero-v39";
const GAMES = [
  "quiz", "most_likely", "superlatives", "would_rather", "never", "bluff",
  "quips", "picolo", "dares", "kings", "bomb", "paranoia",
  "spyfall", "undercover", "wolves",
  "reaction", "roulette", "simon", "quiz_solo",
  "mind_meld", "dare_duel", "buzzer", "higher_lower", "defuse",
];
const ASSETS = [
  "/", "/index.html", "/style.css", "/app.js",
  "/manifest.webmanifest", "/icons/icon.svg",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-180.png", "/icons/icon-512-maskable.png",
].concat(GAMES.map((g) => "/games/" + g + ".js"));

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Only handle our own GETs; let Socket.IO and cross-origin pass straight through.
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/socket.io/")) return;

  // Navigations (incl. /r/CODE): try network, fall back to cached shell offline.
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/index.html")));
    return;
  }
  // Static assets: cache-first.
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
