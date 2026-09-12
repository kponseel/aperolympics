// Le serveur : ce qu'il sert, ce qu'il protège, et ce qu'il ne dit pas.
//
// Aucun navigateur ici : on parle à Express en HTTP, et à Socket.IO en
// long-polling brut. C'est ce qui permet à cette suite de tourner en CI.

const { get, pause } = require("../lib/harness");
const http = require("http");

exports.titre = "Le serveur et ses garde-fous";

exports.run = async (t) => {
  const srv = await t.serveur({ ADMIN_PASSWORD: "s3cr3t-de-test" });
  const B = srv.base;

  t.section("Les routes du jeu");
  for (const [chemin, attendu] of [
    ["/AreWeAMatch/", 200],
    ["/AreWeAMatch/app.js", 200],
    ["/AreWeAMatch/style.css", 200],
    ["/AreWeAMatch/sw.js", 200],
    ["/AreWeAMatch/vendor/qrcode.min.js", 200],
    ["/AreWeAMatch/version.json", 200],
    ["/socket.io/socket.io.js", 200],
  ]) {
    const r = await get(B + chemin);
    t.check(chemin + " → " + attendu, r.status === attendu, "reçu " + r.status);
  }

  t.section("Le reste de la plateforme n'a pas bougé");
  // Are We A Match ? est une sous-app : on ne doit jamais casser les voisines.
  for (const chemin of ["/", "/quizz/", "/quizz/app.js", "/manifest.webmanifest"]) {
    const r = await get(B + chemin);
    t.check(chemin + " répond toujours", r.status === 200, "reçu " + r.status);
  }

  t.section("Le lien d'invitation atteint bien Node");
  // /AreWeAMatch/g/CODE n'existe pas sur le disque : s'il tombait en 404, tous
  // les liens partagés seraient morts. Un code inconnu rend la page normale,
  // c'est le client qui explique.
  const inv = await get(B + "/AreWeAMatch/g/ZZZZZ");
  t.check("/AreWeAMatch/g/CODE sert la page du jeu", inv.status === 200 && /Are We A Match/.test(inv.text), String(inv.status));
  const res = await get(B + "/AreWeAMatch/g/ZZZZZ?r=1");
  t.check("… avec le paramètre ?r=1 aussi", res.status === 200);

  t.section("Le manifeste vient de Node, pas du disque");
  // L'hébergeur rendait le .webmanifest en text/plain et son CDN le gardait en
  // cache : l'installation sur l'écran d'accueil échouait sans rien dire.
  const man = await get(B + "/AreWeAMatch/app.webmanifest");
  t.check("Il répond", man.status === 200);
  t.check("… avec le bon type MIME", /application\/manifest\+json/.test(man.headers["content-type"] || ""),
    man.headers["content-type"]);
  t.check("… et sans mise en cache", /no-store/.test(man.headers["cache-control"] || ""), man.headers["cache-control"]);
  t.check("… en annonçant bien l'application", man.json && man.json.id === "/AreWeAMatch/", JSON.stringify(man.json && man.json.id));
  // Les icônes portent la marque de version, sinon le CDN sert l'ancienne.
  t.check("Les icônes du manifeste portent ?v=", man.json && man.json.icons.every((i) => /\?v=/.test(i.src)),
    JSON.stringify(man.json && man.json.icons.map((i) => i.src)));

  t.section("La version annoncée est celle qui tourne");
  // /admin.html est servi par l'hébergeur sans passer par Node : version.json
  // est le seul témoin fiable qu'un déploiement a bien pris.
  const v = await get(B + "/AreWeAMatch/version.json");
  t.check("version.json est du JSON", !!v.json, v.text.slice(0, 60));
  t.check("… avec une version, une date et le nombre de scènes",
    v.json && /^\d+\.\d+$/.test(v.json.version) && /^\d{4}-\d{2}-\d{2}$/.test(v.json.date) && v.json.scenes > 100,
    JSON.stringify(v.json));

  t.section("L'administration est fermée");
  for (const chemin of ["/admin", "/admin/api/storage", "/admin/api/match/players", "/admin/api/match/games", "/admin/api/rooms"]) {
    const r = await get(B + chemin);
    t.check(chemin + " exige une authentification", r.status === 401, "reçu " + r.status);
  }
  // Une route qui n'existe pas doit répondre 401 et pas 404 : sinon on peut
  // cartographier l'API d'administration sans mot de passe.
  const fantome = await get(B + "/admin/api/nexistepas");
  t.check("Une route d'admin inconnue répond 401, pas 404", fantome.status === 401, "reçu " + fantome.status);

  const AUTH = { Authorization: "Basic " + Buffer.from("admin:s3cr3t-de-test").toString("base64") };
  const bon = await get(B + "/admin/api/match/players", { headers: AUTH });
  t.check("… et l'API s'ouvre avec le bon mot de passe", bon.status === 200, String(bon.status));
  const faux = await get(B + "/admin/api/match/players", { headers: { Authorization: "Basic " + Buffer.from("admin:pas-le-bon").toString("base64") } });
  t.check("… mais pas avec un mauvais", faux.status === 401, String(faux.status));
  const joueurs = await get(B + "/admin/api/match/players", { headers: AUTH });
  t.check("La liste des comptes ne contient ni empreinte ni sel",
    joueurs.json && !/"pinHash"|"salt"/.test(joueurs.text), joueurs.text.slice(0, 160));

  t.section("Les garde-fous du socket");
  // On parle le protocole Socket.IO en long-polling, sans bibliothèque : ça
  // évite d'ajouter une dépendance de test, et ça teste le vrai serveur.
  const sock = await ouvrirSocket(B, "/match");
  t.check("On peut ouvrir une session sur le namespace /match", !!sock.sid, JSON.stringify(sock.erreur || ""));

  // Sans identité, aucune action ne doit passer.
  const sansId = await emettre(B, sock, ["create_game", { title: "Pirate" }], 1200);
  t.check("Créer une partie sans s'être identifié ne crée rien",
    !sansId.some((m) => m[0] === "game_created"), JSON.stringify(sansId).slice(0, 160));

  // Un pseudo libre sans code : le serveur réclame un code, et ne crée rien.
  const sansPin = await emettre(B, sock, ["set_identity", { name: "Pirate", cid: "cid-pirate" }], 1500);
  const rep = sansPin.find((m) => m[0] === "identity_needs_pin" || m[0] === "pin_needed" || m[0] === "identity");
  t.check("Un pseudo libre sans code réclame un code (rien n'est créé)",
    !!rep && rep[0] !== "identity", JSON.stringify(sansPin).slice(0, 200));

  // Demander le profil de quelqu'un d'autre ne doit rien rendre.
  const profilAutrui = await emettre(B, sock, ["get_profile", { name: "Kevin" }], 1200);
  const p = profilAutrui.find((m) => m[0] === "profile");
  t.check("On n'obtient pas le profil d'un autre joueur",
    !p || p[1] == null || p[1].ok === false, JSON.stringify(p || "").slice(0, 160));
};

// ---------------------------------------------------------------- Socket.IO
// Poignée de main puis connexion au namespace, en long-polling.
async function ouvrirSocket(base, ns) {
  const hs = await get(base + "/socket.io/?EIO=4&transport=polling");
  const m = /"sid":"([^"]+)"/.exec(hs.text || "");
  if (!m) return { sid: null, erreur: hs.text };
  const sid = m[1];
  await poster(base, sid, "40" + ns + ",");
  await pause(150);
  await get(base + "/socket.io/?EIO=4&transport=polling&sid=" + sid);   // vide la file
  return { sid, ns };
}

// Émet un évènement et rend les messages reçus pendant `ms`.
async function emettre(base, sock, evenement, ms) {
  await poster(base, sock.sid, "42" + sock.ns + "," + JSON.stringify(evenement));
  const recus = [];
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const r = await get(base + "/socket.io/?EIO=4&transport=polling&sid=" + sock.sid);
    for (const bout of String(r.text || "").split("")) {
      const mm = /^42[^,]*,(.*)$/s.exec(bout);
      if (mm) { try { recus.push(JSON.parse(mm[1])); } catch (e) {} }
    }
    if (recus.length) break;
    await pause(120);
  }
  return recus;
}

function poster(base, sid, charge) {
  return new Promise((resolve) => {
    const u = new URL(base + "/socket.io/?EIO=4&transport=polling&sid=" + sid);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": Buffer.byteLength(charge) } },
      (res) => { res.resume(); res.on("end", resolve); });
    req.on("error", resolve);
    req.end(charge);
  });
}
