// Are We A Match? — sous-app branchée sur le serveur Aperolympics.
//   - Express statique sur /AreWeAMatch/* (fallback SPA vers index.html), plus
//     /AreWeAMatch/g/CODE : la page d'une partie, avec son aperçu de lien
//   - Namespace Socket.IO /match
//   - Comptes persistants (pseudo + PIN obligatoire + réponses) dans players.json
//   - Parties en différé (games.js) dans games.json
//
// v2 : plus de salle par pack ni de chrono. Un joueur crée une partie, partage
// son code, chacun répond quand il veut, les résultats poussent au fur et à
// mesure. Voir games.js pour les règles.
//
// Branchement : depuis server/index.js,
//   require("./match")({ app, io });

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const games = require("./games");
const players = require("./players");
const packs = require("./packs");
const { constantTimeEquals } = require("../admin");

const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;
// Anti-brute-force au niveau du MODULE, clé = pseudo en minuscules — pas de
// la session socket : sinon 5 essais par CONNEXION revenait à un PIN à 4
// chiffres cassable en rechargeant simplement la page entre les tentatives.
const pinFailsByName = new Map(); // name(lowercase) -> { count, lockedUntil }
function pinFailsFor(k) {
  const e = pinFailsByName.get(k);
  if (e && e.lockedUntil && Date.now() > e.lockedUntil) { pinFailsByName.delete(k); return null; }
  return e || null;
}

// Codes de partie inconnus : 20 par heure et par adresse, au-delà on ralentit.
// Le code fait 5 caractères sur 31 (28 millions) : ce n'est pas énumérable
// à ce rythme, et une partie ne contient rien de secret pour qui a le code.
//
// Deux précautions en plus du compteur par adresse :
//   - un plafond GLOBAL, parce que l'adresse vient de x-forwarded-for, que le
//     client peut inventer : sans lui, il suffisait d'en changer à chaque
//     requête pour repartir de zéro. Il est assez haut pour qu'un usage réel
//     ne le voie jamais, assez bas pour rendre le balayage inutile ;
//   - un ménage périodique, sinon une adresse inventée par requête ferait
//     grossir la table indéfiniment.
const UNKNOWN_CODE_MAX = 20, UNKNOWN_CODE_WINDOW_MS = 60 * 60 * 1000;
const UNKNOWN_CODE_GLOBAL_MAX = 500, UNKNOWN_IP_MAX_ENTRIES = 5000;
const unknownByIp = new Map(); // ip -> { count, since }
let unknownGlobal = { count: 0, since: Date.now() };
function sweepUnknown(now) {
  for (const [ip, e] of unknownByIp) if (now - e.since > UNKNOWN_CODE_WINDOW_MS) unknownByIp.delete(ip);
  if (unknownByIp.size > UNKNOWN_IP_MAX_ENTRIES) unknownByIp.clear();
}
// Compte une tentative sur un code INCONNU. Renvoie false quand l'adresse (ou
// le serveur entier) a dépassé son quota.
function unknownCodeHit(ip) {
  const now = Date.now();
  if (now - unknownGlobal.since > UNKNOWN_CODE_WINDOW_MS) unknownGlobal = { count: 0, since: now };
  unknownGlobal.count += 1;
  if (unknownGlobal.count > UNKNOWN_CODE_GLOBAL_MAX) return false;
  if (unknownByIp.size > UNKNOWN_IP_MAX_ENTRIES) sweepUnknown(now);
  const e = unknownByIp.get(ip);
  if (!e || now - e.since > UNKNOWN_CODE_WINDOW_MS) { unknownByIp.set(ip, { count: 1, since: now }); return true; }
  e.count += 1;
  return e.count <= UNKNOWN_CODE_MAX;
}
// Cette adresse a-t-elle déjà brûlé son quota ? (sans rien compter) — on
// s'en sert sur les codes VALIDES : sans ça, il suffisait de balayer jusqu'à
// tomber juste pour récolter quand même l'aperçu, et le quota ne servait à
// rien. Quelqu'un qui ouvre un lien reçu n'essaie qu'un code, valide : il ne
// touche jamais ce compteur.
function unknownCodeExhausted(ip) {
  const now = Date.now();
  if (unknownGlobal.count > UNKNOWN_CODE_GLOBAL_MAX && now - unknownGlobal.since <= UNKNOWN_CODE_WINDOW_MS) return true;
  const e = unknownByIp.get(ip);
  return !!(e && now - e.since <= UNKNOWN_CODE_WINDOW_MS && e.count > UNKNOWN_CODE_MAX);
}
// L'adresse vue derrière le proxy de l'hébergeur. Reste indicative : c'est
// pour ça que les compteurs ci-dessus ont tous un plafond global.
function reqIp(req) {
  const xf = req.headers["x-forwarded-for"];
  return (xf ? String(xf).split(",")[0].trim() : "") || req.ip || "?";
}

// --- Mode dev ---------------------------------------------------------------
// Une partie de test (bots qui ont déjà répondu à tout, rien dans les profils)
// pour relire les scènes et voir la page de résultats pleine, seul.
// Déverrouillée par le mot de passe admin (ADMIN_PASSWORD) — ou, en local
// seulement, par MATCH_DEV=1 (n'importe quel mot de passe).
const DEV_LOCAL = process.env.MATCH_DEV === "1";
const DEV_ENABLED = DEV_LOCAL || !!process.env.ADMIN_PASSWORD;
const DEV_TOKEN_MS = 12 * 60 * 60 * 1000;
const DEV_MAX_FAILS = 5, DEV_LOCK_MS = 15 * 60 * 1000, DEV_GLOBAL_MAX_FAILS = 30;
const devTokens = new Map();
const devFailsByIp = new Map();
let devGlobalFails = { count: 0, since: Date.now() };
function devPasswordOk(pw) {
  if (DEV_LOCAL) return true;
  const want = process.env.ADMIN_PASSWORD || "";
  return !!want && constantTimeEquals(String(pw || ""), want);
}
function devFailsFor(ip) {
  const e = devFailsByIp.get(ip);
  if (e && e.lockedUntil && Date.now() > e.lockedUntil) { devFailsByIp.delete(ip); return null; }
  return e || null;
}
function devGloballyLocked() {
  if (Date.now() - devGlobalFails.since > DEV_LOCK_MS) devGlobalFails = { count: 0, since: Date.now() };
  return devGlobalFails.count >= DEV_GLOBAL_MAX_FAILS;
}
function issueDevToken() {
  const t = crypto.randomBytes(16).toString("hex");
  devTokens.set(t, Date.now() + DEV_TOKEN_MS);
  return t;
}
function devTokenOk(t) {
  const key = String(t || "");
  const exp = devTokens.get(key);
  if (!exp) return false;
  if (Date.now() > exp) { devTokens.delete(key); return false; }
  return true;
}
function clientIp(socket) {
  const xf = socket.handshake.headers["x-forwarded-for"];
  return (xf ? String(xf).split(",")[0].trim() : "") || socket.handshake.address || "?";
}

const PACKS_META = Object.fromEntries(
  Object.values(packs).map((p) => [p.id, { name: p.name, emoji: p.emoji }])
);

function escHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function mount({ app, io }) {
  // --- Express : statique + page de partie + fallback SPA --------------------
  const PUBLIC_MATCH = path.join(__dirname, "..", "..", "public", "AreWeAMatch");
  app.use("/AreWeAMatch", express.static(PUBLIC_MATCH));
  app.get(/^\/(arewamatch|areweamatch|match)(\/.*)?$/i, (req, res, next) => {
    if (req.path.startsWith("/AreWeAMatch")) return next();
    res.redirect(302, "/AreWeAMatch/");
  });

  // La page d'une partie : le même index.html, avec le titre et l'aperçu de
  // lien (WhatsApp, iMessage…) de CETTE partie. Le chemin n'existe pas sur le
  // disque, donc le serveur frontal de l'hébergeur le laisse remonter à Node.
  const INDEX_HTML = fs.readFileSync(path.join(PUBLIC_MATCH, "index.html"), "utf8");
  function pageFor(g, req) {
    if (!g) return INDEX_HTML;
    const host = escHtml(g.hostName);
    const n = Object.keys(g.players).length;
    const title = `${host} t'invite · Are We A Match ?`;
    const desc = `${g.sceneIds.length} scènes à classer, quand tu veux. ${n} joueur${n > 1 ? "s" : ""} déjà. Réponds et découvre à quel point vous faites pareil.`;
    const url = `${req.protocol}://${req.get("host")}/AreWeAMatch/g/${g.code}`;
    const meta =
      `<meta property="og:title" content="${title}">` +
      `<meta property="og:description" content="${escHtml(desc)}">` +
      `<meta property="og:url" content="${escHtml(url)}">` +
      `<meta property="og:image" content="${escHtml(req.protocol + "://" + req.get("host") + "/icons/icon-512.png")}">` +
      `<meta name="twitter:card" content="summary">`;
    return INDEX_HTML.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`).replace("</head>", meta + "</head>");
  }
  app.get(/^\/AreWeAMatch\/g\/([A-Za-z0-9-]{3,12})\/?$/, (req, res) => {
    res.set("Cache-Control", "no-store");
    const g = games.getGame(req.params[0]);
    // Même quota que par socket : sans lui, cette route répondait
    // différemment selon qu'un code existe ou non, sans limite et sans
    // identité — de quoi balayer les codes et récolter les pseudos des hôtes
    // au passage, alors que l'autre porte d'entrée était verrouillée.
    const ip = reqIp(req);
    const blocked = g ? unknownCodeExhausted(ip) : !unknownCodeHit(ip);
    if (blocked) { res.type("html").send(INDEX_HTML); return; }
    res.type("html").send(pageFor(g, req));
  });
  // La version qui tourne, lisible sans ouvrir de session : le témoin de
  // déploiement (le fichier n'existe pas sur le disque, c'est bien Node qui
  // répond, pas le serveur frontal de l'hébergeur).
  app.get("/AreWeAMatch/version.json", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(Object.assign({}, require("./version"), { scenes: games.BANK_SIZE, scenes_per_game: games.SCENES_PER_GAME }));
  });
  app.get(/^\/AreWeAMatch(\/.*)?$/, (_req, res) => res.sendFile(path.join(PUBLIC_MATCH, "index.html")));

  // --- Socket.IO -----------------------------------------------------------
  const ns = io.of("/match");
  const sessions = new Map(); // socket.id -> { cid, name, dev, viewing }
  const APP_VERSION = require("./version");

  function stateFor(code, sess) { return games.state(code, sess && sess.name); }
  // Diffuse l'état d'une partie à ceux qui l'ont ouverte (personnalisé :
  // « me » n'est pas le même pour chacun), et prévient les autres joueurs de
  // la partie, où qu'ils soient dans l'app, que quelque chose a bougé.
  function broadcastGame(code) {
    for (const [sid, s] of sessions) {
      if (!s.name) continue;
      const sock = ns.sockets.get(sid);
      if (!sock) continue;
      if (s.viewing === code) sock.emit("game_state", stateFor(code, s));
      else if (games.isPlayer(code, s.name)) sock.emit("games_changed", { code });
    }
  }
  function leaveView(socket, sess) {
    if (sess.viewing) { socket.leave("game:" + sess.viewing); sess.viewing = null; }
  }
  function openGame(socket, sess, code) {
    leaveView(socket, sess);
    sess.viewing = code;
    socket.join("game:" + code);
    socket.emit("game_state", stateFor(code, sess));
  }

  ns.on("connection", (socket) => {
    sessions.set(socket.id, { cid: null, name: null, dev: false, viewing: null });

    // Identité : pseudo + PIN (obligatoire depuis la v2, voir players.js).
    socket.on("set_identity", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess) return;
      const cid = String((m && m.cid) || "").slice(0, 64);
      const name = String((m && m.name) || "").trim().slice(0, 16);
      const pin = m && m.pin != null && String(m.pin).trim() !== "" ? String(m.pin).trim() : null;
      if (!cid || !name) { socket.emit("error_msg", { msg: "bad_identity" }); return; }

      // Le verrou anti-brute-force porte sur le PSEUDO, pas sur l'appareil :
      // n'importe qui pouvait donc verrouiller le pseudo de quelqu'un d'autre
      // pendant 15 minutes en envoyant 5 mauvais PIN — y compris en bloquant
      // le propriétaire sur son propre téléphone, alors que lui n'a même pas
      // besoin de PIN. L'appareil propriétaire n'est jamais celui qui essaie
      // de deviner : il passe avant le verrou.
      const k = name.toLowerCase();
      const acc = players.getAccount(name);
      const isOwnerDevice = !!(acc && acc.ownerCid && acc.ownerCid === cid);
      const fails = pinFailsFor(k);
      if (!isOwnerDevice && fails && fails.count >= MAX_PIN_ATTEMPTS) { socket.emit("identity_locked", { name }); return; }

      const res = players.authenticate(name, cid, pin);
      if (res.ok) {
        sess.cid = cid;
        sess.name = res.account.name;
        pinFailsByName.delete(k);
        socket.emit("identity_ok", { cid, name: sess.name, protected: !!res.protected, needs_pin: !!res.needs_pin });
        return;
      }
      if (res.reason === "pin_needed") { socket.emit("pin_needed", { name }); return; }
      if (res.reason === "name_taken") { socket.emit("name_taken", { name }); return; }
      if (res.reason === "pin_required") { socket.emit("pin_required", { name }); return; }
      if (res.reason === "pin_wrong") {
        const cur = pinFailsByName.get(k) || { count: 0, lockedUntil: 0 };
        cur.count += 1;
        if (cur.count >= MAX_PIN_ATTEMPTS) cur.lockedUntil = Date.now() + PIN_LOCK_MS;
        pinFailsByName.set(k, cur);
        const left = Math.max(0, MAX_PIN_ATTEMPTS - cur.count);
        if (left <= 0) socket.emit("identity_locked", { name });
        else socket.emit("pin_wrong", { name, attempts_left: left });
        return;
      }
      socket.emit("error_msg", { msg: res.reason || "bad_identity" });
    });

    socket.on("set_pin", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.cid || !sess.name) { socket.emit("error_msg", { msg: "no_identity" }); return; }
      const pin = m && m.pin != null ? String(m.pin).trim() : "";
      if (!players.PIN_RE.test(pin)) { socket.emit("error_msg", { msg: "bad_pin" }); return; }
      const acc = players.getAccount(sess.name);
      if (acc && acc.ownerCid && acc.ownerCid !== sess.cid) { socket.emit("error_msg", { msg: "not_owner" }); return; }
      players.setPin(sess.name, pin);
      socket.emit("pin_set", { name: sess.name });
    });

    // --- Mes parties ---
    socket.on("my_games", () => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.name) { socket.emit("error_msg", { msg: "no_identity" }); return; }
      leaveView(socket, sess);
      socket.emit("games_list", { games: games.listFor(sess.name), app: APP_VERSION, dev_enabled: DEV_ENABLED, scene_count: games.SCENES_PER_GAME });
    });

    socket.on("create_game", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.name) { socket.emit("error_msg", { msg: "no_identity" }); return; }
      const r = games.createGame({ hostName: sess.name, title: m && m.title });
      if (!r.ok) { socket.emit("error_msg", { msg: r.reason }); return; }
      socket.emit("game_created", { code: r.game.code });
      openGame(socket, sess, r.game.code);
    });

    // Ouvrir une partie (joueur ou pas encore) : l'état public, jamais une réponse.
    socket.on("open_game", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.name) { socket.emit("error_msg", { msg: "no_identity" }); return; }
      const code = games.normCode(m && m.code);
      const g = code && games.getGame(code);
      const ip = clientIp(socket);
      if (!g) {
        if (!unknownCodeHit(ip)) { socket.emit("error_msg", { msg: "slow_down" }); return; }
        socket.emit("error_msg", { msg: "unknown_game", code });
        return;
      }
      // Balayer les codes jusqu'à tomber juste ne doit pas payer non plus ici.
      if (unknownCodeExhausted(ip)) { socket.emit("error_msg", { msg: "slow_down" }); return; }
      openGame(socket, sess, g.code);
    });
    socket.on("close_view", () => { const sess = sessions.get(socket.id); if (sess) leaveView(socket, sess); });

    socket.on("join_game", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.name) { socket.emit("error_msg", { msg: "no_identity" }); return; }
      const r = games.joinGame(m && m.code, sess.name);
      if (!r.ok) { socket.emit("error_msg", { msg: r.reason }); return; }
      openGame(socket, sess, r.game.code);
      broadcastGame(r.game.code);
    });

    // Répondre à une scène : accusé explicite, avec le reveal de la scène si
    // c'est accepté. Puis tout le monde est prévenu (progression).
    socket.on("answer", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.name) { socket.emit("answer_ack", { ok: false, reason: "no_identity" }); return; }
      const code = games.normCode(m && m.code);
      const r = games.answer(code, sess.name, String((m && m.qid) || ""), m && m.ranking);
      socket.emit("answer_ack", Object.assign({ qid: m && m.qid }, r));
      if (r.ok) broadcastGame(code);
    });

    socket.on("get_reveal", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.name) return;
      socket.emit("scene_reveal", { code: games.normCode(m && m.code), reveal: games.reveal(m && m.code, sess.name, String((m && m.qid) || "")) });
    });
    socket.on("get_reveals", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.name) return;
      socket.emit("scene_reveals", { code: games.normCode(m && m.code), reveals: games.revealsFor(m && m.code, sess.name) || [] });
    });

    socket.on("game_results", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.name) return;
      const r = games.results(m && m.code, sess.name);
      socket.emit("game_results", r || { code: games.normCode(m && m.code), error: "not_in_game" });
    });

    // --- Hôte / joueur ---
    socket.on("close_game", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.name) return;
      const code = games.normCode(m && m.code);
      const r = games.closeGame(code, sess.name);
      socket.emit("game_closed", Object.assign({ code }, r));
      if (r.ok && r.deleted) { ns.to("game:" + code).emit("game_gone", { code, reason: "closed" }); return; }
      if (r.ok) broadcastGame(code);
    });
    socket.on("remove_player", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.name) return;
      const code = games.normCode(m && m.code);
      const r = games.removePlayer(code, sess.name, m && m.name);
      socket.emit("player_removed", Object.assign({ code, name: m && m.name }, r));
      if (r.ok) {
        // Le joueur retiré est prévenu s'il a la partie ouverte.
        for (const [sid, s] of sessions) {
          if (s.name && s.name.toLowerCase() === String(m.name || "").trim().toLowerCase() && s.viewing === code) {
            const sock = ns.sockets.get(sid); if (sock) sock.emit("game_gone", { code, reason: "removed" });
          }
        }
        broadcastGame(code);
      }
    });
    socket.on("hide_game", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.name) return;
      const r = games.hideGame(m && m.code, sess.name);
      socket.emit("game_hidden", Object.assign({ code: games.normCode(m && m.code) }, r));
    });

    // Profil : STRICTEMENT le sien (donnée personnelle).
    socket.on("get_profile", (m) => {
      const sess = sessions.get(socket.id);
      const name = String((m && m.name) || "").trim().slice(0, 16);
      if (!name) { socket.emit("profile", { ok: false, reason: "bad_name" }); return; }
      if (!sess || !sess.name || sess.name.toLowerCase() !== name.toLowerCase()) {
        socket.emit("profile", { ok: false, name, reason: "not_yours" });
        return;
      }
      const prof = players.profile(name, PACKS_META);
      if (!prof) { socket.emit("profile", { ok: false, name, reason: "no_account" }); return; }
      const packId = String((m && m.pack) || "") || null;
      const historic = packId ? players.historicMatches(name, packId, { minShared: 5 }) : [];
      socket.emit("profile", { ok: true, profile: prof, historic, pack: packId });
    });

    // --- Mode dev ---
    socket.on("dev_unlock", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess) return;
      if (!DEV_ENABLED) { socket.emit("dev_state", { enabled: false }); return; }
      const token = m && m.token ? String(m.token) : "";
      const ip = clientIp(socket);
      let ok = false;
      if (token) ok = devTokenOk(token);
      else {
        const fails = devFailsFor(ip);
        if ((fails && fails.count >= DEV_MAX_FAILS) || devGloballyLocked()) {
          socket.emit("dev_state", { enabled: true, ok: false, reason: "locked" });
          return;
        }
        ok = devPasswordOk(m && m.password);
        if (ok) devFailsByIp.delete(ip);
        else {
          const cur = devFailsByIp.get(ip) || { count: 0, lockedUntil: 0 };
          cur.count += 1;
          if (cur.count >= DEV_MAX_FAILS) cur.lockedUntil = Date.now() + DEV_LOCK_MS;
          devFailsByIp.set(ip, cur);
          devGlobalFails.count += 1;
        }
      }
      if (!ok) { socket.emit("dev_state", { enabled: true, ok: false, reason: token ? "bad_token" : "bad_password" }); return; }
      sess.dev = true;
      socket.emit("dev_state", { enabled: true, ok: true, token: token || issueDevToken(), max_bots: games.MAX_BOTS, bank_size: games.BANK_SIZE, scene_count: games.SCENES_PER_GAME });
    });
    socket.on("dev_start", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.dev) { socket.emit("error_msg", { msg: "dev_locked" }); return; }
      if (!sess.name) { socket.emit("error_msg", { msg: "no_identity" }); return; }
      const r = games.createTestGame(sess.name, m && m.bots != null ? Number(m.bots) : 2);
      if (!r.ok) { socket.emit("error_msg", { msg: r.reason }); return; }
      socket.emit("game_created", { code: r.game.code, test: true });
      openGame(socket, sess, r.game.code);
    });

    socket.on("disconnect", () => { sessions.delete(socket.id); });
  });

  // Les parties de test du mode dev ne vivent pas longtemps.
  const purge = setInterval(() => {
    for (const code of games.purgeTestGames(Date.now())) ns.to("game:" + code).emit("game_gone", { code, reason: "expired" });
  }, 10 * 60 * 1000);
  if (purge.unref) purge.unref();

  console.log(`[AreWeAMatch] mounted: /AreWeAMatch + ns /match (v${APP_VERSION.version}, ${games.BANK_SIZE} scènes, ${games.SCENES_PER_GAME} par partie${DEV_ENABLED ? ", mode dev disponible" : ""})`);
}

module.exports = mount;
