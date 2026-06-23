// QuizzMaster service worker — caches the shell, scoped to /quizz/.
// Independent of Aperolympics' SW. Versioning: `qm-vN`.

const CACHE = "qm-v13";
const ASSETS = [
  "/quizz/", "/quizz/index.html", "/quizz/app.js", "/quizz/style.css",
  "/quizz/manifest.webmanifest",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("qm-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/socket.io/")) return;
  // Only handle QuizzMaster's own scope.
  if (!url.pathname.startsWith("/quizz")) return;

  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/quizz/index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
