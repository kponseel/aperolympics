// Are We A Match? service worker — met en cache la coquille, scopé à
// /AreWeAMatch/. Indépendant des SW d'Aperolympics et de QuizzMaster.
// Versioning : `am-vN`.

const CACHE = "am-v1";
const ASSETS = [
  "/AreWeAMatch/", "/AreWeAMatch/index.html", "/AreWeAMatch/app.js", "/AreWeAMatch/style.css",
  "/AreWeAMatch/manifest.webmanifest",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("am-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/socket.io/")) return;
  // Ne gère que notre propre scope.
  if (!url.pathname.startsWith("/AreWeAMatch")) return;

  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/AreWeAMatch/index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
