// Are We A Match? service worker — scopé à /AreWeAMatch/, indépendant des SW
// d'Aperolympics et de QuizzMaster.
//
// RÉSEAU D'ABORD, cache en repli. L'ancienne version servait app.js et
// style.css depuis le cache EN PRIORITÉ, sous un nom de cache figé (am-v1) :
// un téléphone qui avait déjà ouvert l'app gardait l'ancien code à vie,
// quelle que soit la version déployée. Désormais, chaque chargement en ligne
// prend le fichier du serveur (revalidé : le cache HTTP est contourné) et
// rafraîchit le cache ; le cache ne sert qu'hors ligne, ou si le serveur ne
// répond pas. Le nom de cache change tout de même (am-v2) : à l'activation,
// les anciens caches sont purgés.

const CACHE = "am-v2";
const SHELL = [
  "/AreWeAMatch/", "/AreWeAMatch/index.html", "/AreWeAMatch/app.js", "/AreWeAMatch/style.css",
  "/AreWeAMatch/manifest.webmanifest",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("am-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord (cache HTTP contourné pour être sûr d'avoir la dernière
// version) ; si ça répond, on met le cache à jour ; sinon, le cache — et pour
// une navigation, la coquille index.html.
function networkFirst(e, fallbackUrl) {
  const url = e.request.url;
  // Une Request en mode "navigate" ne peut pas être reconstruite avec des
  // options : on repart de l'URL.
  const req = e.request.mode === "navigate"
    ? new Request(url, { cache: "no-cache", credentials: "same-origin" })
    : new Request(e.request, { cache: "no-cache" });
  return fetch(req)
    .then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(url, copy)).catch(() => {});
      }
      return res;
    })
    .catch(() => caches.match(url).then((r) => r || (fallbackUrl ? caches.match(fallbackUrl) : undefined)));
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/socket.io/")) return;
  // Ne gère que notre propre coquille (et ses icônes).
  if (!url.pathname.startsWith("/AreWeAMatch") && !url.pathname.startsWith("/icons/")) return;
  e.respondWith(networkFirst(e, e.request.mode === "navigate" ? "/AreWeAMatch/index.html" : null));
});
