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
const roomsModule = require("./rooms");
const players = require("./players");
const packs = require("./packs");

const TICK_MS = 250;              // le compte à rebours doit être fluide
const MAX_PIN_ATTEMPTS = 5;

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
  const sessions = new Map(); // socket.id -> { cid, name, roomId, inLobby, pinFails }

  function snapshotLobby() {
    return { rooms: allRooms.map((r) => r.lobbyCard()) };
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
  function broadcastRoom(room) {
    const snap = room.snapshot();
    ns.to("room:" + room.id).emit("room_state", snap);
    for (const [sid, sess] of sessions) {
      if (sess.roomId !== room.id || !sess.cid) continue;
      const priv = room.privateFor({ cid: sess.cid, name: sess.name });
      if (priv && Object.keys(priv).length) {
        const s = ns.sockets.get(sid);
        if (s) s.emit("private_state", priv);
      }
    }
  }

  function leaveCurrentRoom(socket) {
    const sess = sessions.get(socket.id);
    if (!sess || !sess.roomId) return;
    const room = roomById.get(sess.roomId);
    if (!room) { sess.roomId = null; return; }
    room.removePlayer(sess.cid);
    socket.leave("room:" + room.id);
    sess.roomId = null;
    broadcastRoom(room);
    broadcastLobby();
  }

  ns.on("connection", (socket) => {
    sessions.set(socket.id, { cid: null, name: null, roomId: null, inLobby: false, pinFails: {} });

    socket.on("set_identity", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess) return;
      const cid = String((m && m.cid) || "").slice(0, 64);
      const name = String((m && m.name) || "").trim().slice(0, 16);
      const pin = m && m.pin != null ? String(m.pin).trim() : "";
      if (!cid || !name) { socket.emit("error_msg", { msg: "bad_identity" }); return; }

      const k = name.toLowerCase();
      if ((sess.pinFails[k] || 0) >= MAX_PIN_ATTEMPTS) { socket.emit("identity_locked", { name }); return; }

      const res = players.authenticate(name, cid, pin);
      if (res.ok) {
        sess.cid = cid;
        sess.name = res.account ? res.account.name : name;
        sess.pinFails[k] = 0;
        socket.emit("identity_ok", { cid, name: sess.name, protected: !!res.protected });
        return;
      }
      if (res.reason === "pin_required") { socket.emit("pin_required", { name }); return; }
      if (res.reason === "pin_wrong") {
        sess.pinFails[k] = (sess.pinFails[k] || 0) + 1;
        const left = Math.max(0, MAX_PIN_ATTEMPTS - sess.pinFails[k]);
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
      if (sess.roomId && sess.roomId !== rid) leaveCurrentRoom(socket);
      room.addPlayer(sess.cid, sess.name, socket.id);
      sess.roomId = rid;
      socket.join("room:" + rid);
      broadcastRoom(room);
      broadcastLobby();
    });

    socket.on("leave_room", () => leaveCurrentRoom(socket));

    // Profil / matchs historiques d'un joueur (public : rien de secret).
    socket.on("get_profile", (m) => {
      const name = String((m && m.name) || "").trim().slice(0, 16);
      if (!name) { socket.emit("profile", { ok: false, reason: "bad_name" }); return; }
      const prof = players.profile(name, PACKS_META);
      if (!prof) { socket.emit("profile", { ok: false, name, reason: "no_account" }); return; }
      const packId = String((m && m.pack) || "") || null;
      const historic = packId ? players.historicMatches(name, packId, { minShared: 5 }) : [];
      socket.emit("profile", { ok: true, profile: prof, historic, pack: packId });
    });

    // Messages de jeu (demarrer / skip / rank) transmis à la salle courante.
    socket.on("msg", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.roomId) return;
      const room = roomById.get(sess.roomId);
      if (!room) return;
      const changed = room.handleMessage(sess.cid, m || {});
      if (changed !== false) { broadcastRoom(room); broadcastLobby(); }
    });

    socket.on("disconnect", () => {
      leaveCurrentRoom(socket);
      sessions.delete(socket.id);
    });
  });

  // --- Boucle de tick ------------------------------------------------------
  setInterval(() => {
    const now = Date.now();
    const dirty = [];
    for (const r of allRooms) { if (r.tick(now)) dirty.push(r); }
    if (dirty.length) { dirty.forEach(broadcastRoom); broadcastLobby(); }
  }, TICK_MS);

  console.log(`[AreWeAMatch] mounted: /AreWeAMatch + ns /match (${allRooms.length} packs)`);
}

module.exports = mount;
