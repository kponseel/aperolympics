// Le casse-cache, et pourquoi il n'est pas négociable.
//
// Le serveur frontal de l'hébergeur sert les fichiers présents sur le disque
// sans jamais passer par Node, et son CDN les garde dans son propre cache en
// IGNORANT Cache-Control : aucun en-tête posé depuis Express ne peut le faire
// relâcher un fichier. Après le déploiement de la 2.1, trois versions
// d'app.js étaient servies EN MÊME TEMPS selon l'edge touché — dont la v1,
// dont le client parlait un protocole que le serveur n'avait plus.
//
// Le seul levier est l'URL. D'où la règle : à chaque changement de VERSION,
// les ?v=… d'index.html et le V du service worker suivent, et le nom du cache
// du service worker change pour purger les téléphones. Cette suite est là
// pour qu'on ne puisse plus l'oublier.

const { lire } = require("../lib/harness");

exports.titre = "Version et casse-cache";

exports.run = async (t) => {
  const { version } = t.modules();
  const html = lire("public/AreWeAMatch/index.html");
  const sw = lire("public/AreWeAMatch/sw.js");
  const vjs = lire("server/match/version.js");

  const V = version.version;

  t.section("La version elle-même");
  t.check("VERSION est bien formée (ex. 2.9)", /^\d+\.\d+$/.test(V), V);
  t.check("version.js expose une date au format AAAA-MM-JJ", /^\d{4}-\d{2}-\d{2}$/.test(version.date), version.date);
  // La date vient du dernier commit touchant le jeu quand git est là : elle ne
  // peut donc pas être périmée même si on oublie de toucher le fichier.
  t.check("La source de la date est annoncée (git ou fichier)",
    version.source === "git" || version.source === "file", version.source);

  t.section("Les ?v= de la coquille suivent VERSION");
  const marques = html.match(/\?v=[\d.]+/g) || [];
  t.check("index.html porte au moins 5 marques ?v=", marques.length >= 5, String(marques.length));
  const mauvaises = [...new Set(marques.filter((m) => m !== "?v=" + V))];
  t.check("Toutes portent la version courante", mauvaises.length === 0,
    "trouvé " + mauvaises.join(" ") + " au lieu de ?v=" + V);

  // Les fichiers qui DOIVENT porter la marque : ce sont ceux que le CDN sert
  // depuis le disque et qu'un téléphone garderait sinon à vie.
  for (const f of ["app.js", "style.css", "sw.js", "vendor/qrcode.min.js"]) {
    t.check(f + " est appelé avec ?v=" + V, html.includes("/AreWeAMatch/" + f + "?v=" + V));
  }
  // index.html lui-même n'est PAS mis en cache par le CDN (DYNAMIC) : c'est ce
  // qui rend l'astuce fiable, et pourquoi il ne porte pas de marque.
  t.check("index.html ne s'auto-référence pas avec une marque", !/index\.html\?v=/.test(html));

  t.section("Le service worker suit aussi");
  const mV = /^const V = "([\d.]+)";/m.exec(sw);
  t.check("sw.js déclare un V", !!mV, sw.slice(0, 80));
  t.check("… égal à VERSION", mV && mV[1] === V, mV ? mV[1] + " vs " + V : "");
  const mC = /^const CACHE = "(am-v\d+)";/m.exec(sw);
  t.check("sw.js déclare un nom de cache am-vN", !!mC, "");
  // Le nom du cache doit changer avec la version, sinon un téléphone qui a
  // déjà ouvert l'app garde l'ancienne coquille : c'est le bug de la v1.
  // Trois faits indépendants plutôt qu'une seule expression fragile : il liste
  // les caches, ne garde que les siens sauf l'actuel, et supprime le reste.
  t.check("Le service worker purge les anciens caches à l'activation",
    /caches\.keys\(\)/.test(sw) && /startsWith\("am-"\)/.test(sw) && /!== CACHE/.test(sw) && /caches\.delete/.test(sw));
  t.check("Il va au réseau d'abord (le cache ne sert qu'hors ligne)",
    /cache: "no-cache"/.test(sw) && /networkFirst/.test(sw));

  t.section("Le garde-fou : la version a-t-elle bougé avec le code ?");
  // Si le jeu a changé depuis main mais que VERSION n'a pas bougé, le CDN et
  // les téléphones garderont l'ancien code. On le dit ici, à l'endroit où
  // quelqu'un le lira.
  const { execFileSync } = require("child_process");
  let diff = null;
  try {
    diff = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD", "--", "server/match", "public/AreWeAMatch"],
      { cwd: require("../lib/harness").RACINE, encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch (e) { /* pas de remote, pas de git : on ne peut pas juger */ }
  if (diff === null) {
    t.check("(comparaison avec main impossible ici — git ou origin/main absent)", true);
  } else if (!diff) {
    t.check("Le jeu n'a pas changé depuis main : rien à incrémenter", true);
  } else {
    let vMain = null;
    try {
      const src = execFileSync("git", ["show", "origin/main:server/match/version.js"],
        { cwd: require("../lib/harness").RACINE, encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] });
      const m = /^const VERSION = "([\d.]+)";/m.exec(src);
      vMain = m && m[1];
    } catch (e) {}
    t.check("Le jeu a changé depuis main, donc VERSION aussi",
      !vMain || vMain !== V,
      "VERSION vaut toujours " + V + " alors que ces fichiers ont changé :\n        " + diff.split("\n").join("\n        ") +
      "\n        → incrémenter VERSION dans server/match/version.js, les ?v= d'index.html et V/CACHE de sw.js");
  }

  t.section("Le commentaire d'avertissement est toujours là");
  // Il explique POURQUOI la règle existe. Sans lui, le prochain qui touche au
  // fichier retire la marque en trouvant qu'elle fait sale.
  t.check("version.js prévient que VERSION sert aussi de casse-cache", /casse-cache/i.test(vjs));
  t.check("index.html explique le problème du CDN", /CDN/.test(html) && /edge/i.test(html));
};
