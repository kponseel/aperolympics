// Are We A Match? — sous-app branchée sur le serveur Aperolympics.
//   - Express statique sur /AreWeAMatch/* (fallback SPA vers index.html)
//   - Namespace Socket.IO /match
//   - 1 salle persistante par pack (Amis / Date / Piquant / Pop culture)
//   - Comptes persistants (pseudo + PIN optionnel + réponses) dans players.json
//
// Branchement : depuis server/index.js,
//   require("./match")({ app, io });

const path = require("path");
const express = require("express");
const crypto = require("crypto");
const roomsModule = require("./rooms");
const players = require("./players");
const packs = require("./packs");
const { constantTimeEquals } = require("../admin");

// --- Mode dev ---------------------------------------------------------------
// Une salle de test PRIVÉE (un humain + des bots, questions dans l'ordre du
// fichier, rien n'est enregistré) pour relire les questions et le jeu sans
// second téléphone. Déverrouillée par le mot de passe admin (ADMIN_PASSWORD)
// — ou, en local seulement, par MATCH_DEV=1 (n'importe quel mot de passe).
const DEV_LOCAL = process.env.MATCH_DEV === "1";
const DEV_ENABLED = DEV_LOCAL || !!process.env.ADMIN_PASSWORD;
const DEV_TOKEN_MS = 12 * 60 * 60 * 1000;      // le jeton mémorisé par le téléphone expire en 12 h
const DEV_MAX_FAILS = 5, DEV_LOCK_MS = 15 * 60 * 1000, DEV_GLOBAL_MAX_FAILS = 30;
const DEV_MAX_ROOMS = 10;
const devTokens = new Map();                   // token -> expiresAt
const devFailsByIp = new Map();                // ip -> { count, lockedUntil }
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
// Verrou global en plus du verrou par IP : le cid et l'IP sont contournables,
// mais 30 échecs en 15 min sur un mot de passe que seule une personne connaît
// ne sont jamais légitimes.
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

const TICK_MS = 250;              // le compte à rebours doit être fluide
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

const PACKS_META = Object.fromEntries(
  Object.values(packs).map((p) => [p.id, { name: p.name, emoji: p.emoji }])
);

function mount({ app, io }) {
  const allRooms = roomsModule.buildAll();
  const roomById = new Map(allRooms.map((r) => [r.id, r]));

  // --- Express : statique + fallback SPA -----------------------------------
  // Le dossier porte le nom de l'URL : le static racine d'Aperolympics le sert
  // déjà sur /AreWeAMatch, et on évite ainsi un alias parasite sur /match.
  const PUBLIC_MATCH = path.join(__dirname, "..", "..", "public", "AreWeAMatch");
  app.use("/AreWeAMatch", express.static(PUBLIC_MATCH));
  // Confort : les variantes de casse et le raccourci /match renvoient vers
  // l'URL canonique (les gens tapent rarement les majuscules au bon endroit).
  app.get(/^\/(arewamatch|areweamatch|match)(\/.*)?$/i, (req, res, next) => {
    if (req.path.startsWith("/AreWeAMatch")) return next();
    res.redirect(302, "/AreWeAMatch/");
  });
  app.get(/^\/AreWeAMatch(\/.*)?$/, (_req, res) => res.sendFile(path.join(PUBLIC_MATCH, "index.html")));

  // --- Socket.IO -----------------------------------------------------------
  const ns = io.of("/match");
  const sessions = new Map(); // socket.id -> { cid, name, roomId, inLobby, dev }
  const devRooms = new Map(); // id -> salle de test privée (mode dev), jamais dans le lobby

  // Version + date de dernière mise à jour du jeu, affichées en petit dans le
  // hall. Portées par lobby_state : c'est le premier message que le hall
  // reçoit, et il est minuscule.
  const APP_VERSION = require("./version");
  function snapshotLobby() {
    return { rooms: allRooms.map((r) => r.lobbyCard()), app: APP_VERSION, dev_enabled: DEV_ENABLED };
  }
  function lobbyHasListeners() {
    const r = ns.adapter.rooms.get("lobby");
    return r && r.size > 0;
  }
  function broadcastLobby() {
    if (lobbyHasListeners()) ns.to("lobby").emit("lobby_state", snapshotLobby());
  }

  // Diffuse l'état public puis le payload privé de CHAQUE joueur de la salle
  // (son propre classement, son meilleur match…). Même modèle que les rôles
  // secrets d'Aperolympics : rien de personnel ne transite dans l'état public.
  // privateFor ne prend QUE le cid : c'est la salle elle-même qui résout le
  // nom depuis son propre playerMap, jamais depuis ce que la session prétend.
  function broadcastRoom(room) {
    const snap = room.snapshot();
    ns.to("room:" + room.id).emit("room_state", snap);
    for (const [sid, sess] of sessions) {
      if (sess.roomId !== room.id || !sess.cid) continue;
      const priv = room.privateFor(sess.cid);
      if (priv && Object.keys(priv).length) {
        const s = ns.sockets.get(sid);
        if (s) s.emit("private_state", priv);
      }
    }
  }

  // Départ DÉLIBÉRÉ (bouton "Retour", ou changement de salle) : on retire
  // pour de vrai, tout de suite — le joueur ne va pas se reconnecter à une
  // salle qu'il vient de quitter volontairement.
  function leaveCurrentRoomForGood(socket) {
    const sess = sessions.get(socket.id);
    if (!sess || !sess.roomId) return;
    const room = roomById.get(sess.roomId);
    if (!room) { sess.roomId = null; return; }
    room.leaveForGood(sess.cid);
    socket.leave("room:" + room.id);
    sess.roomId = null;
    // Salle de test que son propriétaire quitte : elle disparaît avec lui.
    if (room.isDev && room.humanCount() === 0) { destroyDevRoom(room); return; }
    broadcastRoom(room);
    broadcastLobby();
  }
  // Détruit une salle de test : plus personne ne peut la rejoindre, et les
  // sessions qui y étaient encore attachées (autre onglet, fantôme) sont
  // détachées proprement.
  function destroyDevRoom(room) {
    devRooms.delete(room.id);
    roomById.delete(room.id);
    for (const [sid, s] of sessions) {
      if (s.roomId !== room.id) continue;
      s.roomId = null;
      const sock = ns.sockets.get(sid);
      if (sock) sock.leave("room:" + room.id);
    }
  }
  // Coupure de connexion (socket morte, ping perdu) : on marque juste absent,
  // avec un délai de grâce — un blip réseau ou un rechargement de page ne
  // doit ni coûter la couronne d'hôte ni la place dans la salle. Le socket
  // est passé pour ne retirer QUE si c'est bien lui le détenteur actuel :
  // sinon une vieille socket qui meurt après coup éjecterait la session qui
  // vient tout juste de se reconnecter avec une socket toute neuve.
  function dropCurrentRoomConnection(socket) {
    const sess = sessions.get(socket.id);
    if (!sess || !sess.roomId) return;
    const room = roomById.get(sess.roomId);
    if (!room) { sess.roomId = null; return; }
    room.removePlayer(sess.cid, socket.id);
    socket.leave("room:" + room.id);
    sess.roomId = null;
    broadcastRoom(room);
    broadcastLobby();
  }

  // Un pseudo est-il déjà tenu par une session VIVANTE d'un autre appareil,
  // en ce moment même ? Utilisé avant d'authentifier une nouvelle session :
  // sans ce garde, un pseudo non protégé (réclamable par conception) pouvait
  // être repris PENDANT qu'il servait encore ailleurs — le premier recevait
  // alors, sans le savoir, le classement privé et les réponses du second.
  // Une fois l'autre session partie (déconnexion), le nom redevient libre
  // immédiatement, exactement comme prévu pour un pseudo non protégé.
  function nameLiveElsewhere(name, cid, excludeSocketId) {
    const k = String(name || "").trim().toLowerCase();
    if (!k) return false;
    for (const [sid, s] of sessions) {
      if (sid === excludeSocketId) continue;
      if (s.cid && s.cid !== cid && s.name && s.name.toLowerCase() === k) return true;
    }
    return false;
  }

  ns.on("connection", (socket) => {
    sessions.set(socket.id, { cid: null, name: null, roomId: null, inLobby: false });

    socket.on("set_identity", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess) return;
      const cid = String((m && m.cid) || "").slice(0, 64);
      const name = String((m && m.name) || "").trim().slice(0, 16);
      const pin = m && m.pin != null ? String(m.pin).trim() : "";
      if (!cid || !name) { socket.emit("error_msg", { msg: "bad_identity" }); return; }

      const k = name.toLowerCase();
      const fails = pinFailsFor(k);
      if (fails && fails.count >= MAX_PIN_ATTEMPTS) { socket.emit("identity_locked", { name }); return; }

      // Une session vivante d'un AUTRE appareil tient déjà ce nom, là,
      // maintenant : on refuse plutôt que de laisser les deux se marcher
      // dessus (classement privé mélangé, prise de PIN en pleine partie
      // adverse). Dès que l'autre part, le nom redevient libre normalement.
      if (nameLiveElsewhere(name, cid, socket.id)) {
        socket.emit("error_msg", { msg: "name_live_elsewhere" });
        return;
      }

      const res = players.authenticate(name, cid, pin);
      if (res.ok) {
        sess.cid = cid;
        sess.name = res.account ? res.account.name : name;
        pinFailsByName.delete(k);
        socket.emit("identity_ok", { cid, name: sess.name, protected: !!res.protected });
        return;
      }
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

    socket.on("join_lobby", () => {
      const sess = sessions.get(socket.id);
      if (!sess) return;
      sess.inLobby = true;
      socket.join("lobby");
      socket.emit("lobby_state", snapshotLobby());
    });
    socket.on("leave_lobby", () => {
      const sess = sessions.get(socket.id);
      if (!sess) return;
      sess.inLobby = false;
      socket.leave("lobby");
    });

    socket.on("join_room", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.cid || !sess.name) { socket.emit("error_msg", { msg: "no_identity" }); return; }
      const rid = String((m && m.id) || "");
      const room = roomById.get(rid);
      if (!room) { socket.emit("error_msg", { msg: "unknown_room" }); return; }
      // Salle de test : privée, réservée à son propriétaire. Pour les autres
      // elle n'existe pas (même réponse qu'un id inconnu).
      if (room.ownerCid && room.ownerCid !== sess.cid) { socket.emit("error_msg", { msg: "unknown_room" }); return; }
      // Ce pseudo est-il déjà tenu par un AUTRE cid actif dans CETTE salle ?
      // Sans ce garde, deux joueurs sous le même nom d'affichage verraient
      // leurs réponses fusionner dans les résultats (indistinguables l'un de
      // l'autre pour le moteur, qui parle "pseudo").
      if (room.nameTakenBy(sess.name, sess.cid)) {
        socket.emit("error_msg", { msg: "name_taken_in_room" });
        return;
      }
      if (sess.roomId && sess.roomId !== rid) leaveCurrentRoomForGood(socket);
      room.addPlayer(sess.cid, sess.name, socket.id);
      sess.roomId = rid;
      socket.join("room:" + rid);
      broadcastRoom(room);
      broadcastLobby();
    });

    socket.on("leave_room", () => leaveCurrentRoomForGood(socket));

    // Profil / matchs historiques : STRICTEMENT le sien. C'est une donnée
    // personnelle (comparaisons nommées avec des personnes réelles) — rien
    // dans le client n'a jamais demandé le profil de quelqu'un d'autre,
    // seul le "tape sur ton propre pseudo" existe aujourd'hui.
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
    // Déverrouillage par mot de passe (ou par le jeton reçu la dernière fois,
    // mémorisé par le téléphone). Le mot de passe est celui de /admin.
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
      let existing = null;
      for (const r of devRooms.values()) if (sess.cid && r.ownerCid === sess.cid) existing = r.id;
      socket.emit("dev_state", {
        enabled: true, ok: true,
        token: token || issueDevToken(),
        packs: Object.values(packs).map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, bank_size: p.bank.length })),
        max_bots: roomsModule.MAX_BOTS,
        room: existing, // une salle de test encore en vie après un rechargement de page
      });
    });

    // Crée SA salle de test et y place le demandeur. Une seule par
    // propriétaire : la précédente est détruite. Le client reçoit d'abord
    // dev_room (l'id à afficher), puis room_state comme pour toute salle.
    socket.on("dev_start", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.dev) { socket.emit("error_msg", { msg: "dev_locked" }); return; }
      if (!sess.cid || !sess.name) { socket.emit("error_msg", { msg: "no_identity" }); return; }
      const packId = String((m && m.pack) || "");
      const packDef = packs[packId];
      if (!packDef) { socket.emit("error_msg", { msg: "unknown_pack" }); return; }
      const bank = packDef.bank.length;
      const order = (m && m.order === "random") ? "random" : "file";
      const startAt = Math.max(0, Math.min(bank - 1, (Number(m && m.start_at) || 1) - 1)); // 1-based côté client
      const count = Math.max(1, Math.min(bank, Number(m && m.count) || bank));
      const bots = Math.max(0, Math.min(roomsModule.MAX_BOTS, m && m.bots != null ? (Number(m.bots) || 0) : 2));
      for (const r of [...devRooms.values()]) if (r.ownerCid === sess.cid) destroyDevRoom(r);
      if (devRooms.size >= DEV_MAX_ROOMS) { socket.emit("error_msg", { msg: "dev_too_many_rooms" }); return; }
      if (sess.roomId) leaveCurrentRoomForGood(socket);
      const room = roomsModule.buildDev(packId, {
        id: "dev-" + crypto.randomBytes(6).toString("hex"), ownerCid: sess.cid,
        order, startAt, count, bots,
        // Plus de temps pour lire et juger chaque question ; reveal normal
        // (⏭️ pour aller plus vite) ; résultats gardés longtemps (on prend
        // des notes).
        questionMs: 60000, resultsMs: 10 * 60 * 1000,
      });
      devRooms.set(room.id, room);
      roomById.set(room.id, room);
      socket.emit("dev_room", { id: room.id });
      room.addPlayer(sess.cid, sess.name, socket.id);
      sess.roomId = room.id;
      sess.inLobby = false; socket.leave("lobby");
      socket.join("room:" + room.id);
      broadcastRoom(room);
    });

    // Messages de jeu (demarrer / skip / rank) transmis à la salle courante.
    // Toujours un accusé explicite à l'expéditeur : le client verrouille son
    // UI de façon optimiste dès l'envoi ("Classement envoyé ✅"), donc un
    // rejet resté muet la laissait mentir sans que rien ne le détrompe.
    socket.on("msg", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.roomId) { socket.emit("msg_ack", { t: m && m.t, ok: false, reason: "no_room" }); return; }
      const room = roomById.get(sess.roomId);
      if (!room) { socket.emit("msg_ack", { t: m && m.t, ok: false, reason: "no_room" }); return; }
      const res = room.handleMessage(sess.cid, m || {}) || { ok: false, reason: "unknown" };
      socket.emit("msg_ack", { t: m && m.t, ok: !!res.ok, reason: res.ok ? null : res.reason });
      if (res.ok) { broadcastRoom(room); broadcastLobby(); }
    });

    socket.on("disconnect", () => {
      dropCurrentRoomConnection(socket);
      sessions.delete(socket.id);
    });
  });

  // --- Boucle de tick ------------------------------------------------------
  setInterval(() => {
    const now = Date.now();
    const dirty = [];
    for (const r of allRooms) { if (r.tick(now)) dirty.push(r); }
    for (const r of [...devRooms.values()]) {
      if (r.tick(now)) dirty.push(r);
      // Plus aucun humain (parti, ou purgé après le délai de grâce) : la
      // salle de test n'a plus de raison d'exister, rien n'y est enregistré.
      if (r.humanCount() === 0) destroyDevRoom(r);
    }
    if (dirty.length) { dirty.forEach(broadcastRoom); broadcastLobby(); }
  }, TICK_MS);

  console.log(`[AreWeAMatch] mounted: /AreWeAMatch + ns /match (${allRooms.length} packs${DEV_ENABLED ? ", mode dev disponible" : ""})`);
}

module.exports = mount;
