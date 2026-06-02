// QuizzMaster — sub-app wired into the main Aperolympics server.
//   - Express static at /quizz/* (SPA fallback to index.html)
//   - Socket.IO namespace /qm
//   - 10 persistent rooms (one per theme), single "Blitz 60 s" mode
//   - Persistent players (accounts + PIN + lifetime stats) in players.json
//
// Wire-up: at the bottom of server/index.js, call
//   require("./quizzmaster")({ app, io });

const path = require("path");
const roomsModule = require("./rooms");
const players = require("./players");
const themes = require("./themes");

// Lightweight map used to enrich playerStats with display name + emoji.
const THEMES_META = Object.fromEntries(
  Object.values(themes).map((t) => [t.id, { name: t.name, emoji: t.emoji }])
);

const TICK_MS = 500;
const MAX_PIN_ATTEMPTS = 5;

function mount({ app, io }) {
  const allRooms = roomsModule.buildAll();
  const roomById = new Map(allRooms.map((r) => [r.id, r]));

  // --- Express static + SPA fallback at /quizz ---
  const PUBLIC_QUIZZ = path.join(__dirname, "..", "..", "public", "quizz");
  app.use("/quizz", require("express").static(PUBLIC_QUIZZ));
  // SPA fallback so deep links (/quizz/anything) still load index.html.
  app.get(/^\/quizz(\/.*)?$/, (_req, res) => res.sendFile(path.join(PUBLIC_QUIZZ, "index.html")));

  // --- Socket.IO namespace ---
  const ns = io.of("/qm");

  // Per-socket session state: { cid, name, roomId?, inLobby }
  const sessions = new Map(); // socket.id -> session

  function snapshotLobby() {
    return {
      rooms: allRooms.map((r) => r.lobbyCard()),
      global_top: players.globalRanking(),
    };
  }

  function broadcastRoom(room) {
    // Send room_state to every socket currently bound to this room.
    const snap = room.snapshot();
    ns.to("room:" + room.id).emit("room_state", snap);
  }

  function broadcastLobby() {
    if (lobbyChannelHasListeners()) {
      ns.to("lobby").emit("lobby_state", snapshotLobby());
    }
  }

  function lobbyChannelHasListeners() {
    const r = ns.adapter.rooms.get("lobby");
    return r && r.size > 0;
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

      const key = name.toLowerCase();
      // Per-name lockout once the player has burned all attempts this session.
      if ((sess.pinFails[key] || 0) >= MAX_PIN_ATTEMPTS) {
        socket.emit("identity_locked", { name });
        return;
      }

      const res = players.authenticate(name, cid, pin);
      if (res.ok) {
        sess.cid = cid;
        sess.name = res.account ? res.account.name : name;
        sess.pinFails[key] = 0;
        socket.emit("identity_ok", { cid, name: sess.name, protected: !!res.protected });
        return;
      }
      if (res.reason === "pin_required") {
        socket.emit("pin_required", { name });
        return;
      }
      if (res.reason === "pin_wrong") {
        sess.pinFails[key] = (sess.pinFails[key] || 0) + 1;
        const left = Math.max(0, MAX_PIN_ATTEMPTS - sess.pinFails[key]);
        if (left <= 0) socket.emit("identity_locked", { name });
        else socket.emit("pin_wrong", { name, attempts_left: left });
        return;
      }
      socket.emit("error_msg", { msg: res.reason || "bad_identity" });
    });

    // Owner sets/updates a PIN on their currently-identified name.
    socket.on("set_pin", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.cid || !sess.name) { socket.emit("error_msg", { msg: "no_identity" }); return; }
      const pin = m && m.pin != null ? String(m.pin).trim() : "";
      if (!players.PIN_RE.test(pin)) { socket.emit("error_msg", { msg: "bad_pin" }); return; }
      const acc = players.getAccount(sess.name);
      // Only the owner device may set/replace the PIN.
      if (acc && acc.ownerCid && acc.ownerCid !== sess.cid) { socket.emit("error_msg", { msg: "not_owner" }); return; }
      players.setPin(sess.name, pin);
      socket.emit("pin_set", { name: sess.name });
    });

    // Rename the currently-identified account. The new name must be free and
    // we must be the account's owner (same cid). Stats, PIN and theme bests
    // are carried over.
    socket.on("rename", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.cid || !sess.name) { socket.emit("error_msg", { msg: "no_identity" }); return; }
      const newName = String((m && m.name) || "").trim().slice(0, 16);
      if (!newName) { socket.emit("rename_failed", { reason: "bad_name" }); return; }
      const res = players.rename(sess.name, newName, sess.cid);
      if (!res.ok) { socket.emit("rename_failed", { reason: res.reason }); return; }
      sess.name = res.account.name;
      socket.emit("rename_ok", { name: sess.name, protected: !!res.account.pinHash });
      broadcastLobby();
      if (sess.roomId) {
        const room = roomById.get(sess.roomId);
        if (room) {
          // Reflect the new name inside the room as well — re-add the player.
          room.addPlayer(sess.cid, sess.name, socket.id);
          broadcastRoom(room);
        }
      }
    });

    // Profile card request — any client can ask for any name's stats (it's a
    // public leaderboard; nothing secret in here). Replies with `stats` or
    // `stats` { ok: false } if the name doesn't exist yet.
    socket.on("get_stats", (m) => {
      const name = String((m && m.name) || "").trim().slice(0, 16);
      if (!name) { socket.emit("stats", { ok: false, reason: "bad_name" }); return; }
      const s = players.playerStats(name, THEMES_META);
      if (!s) { socket.emit("stats", { ok: false, name, reason: "no_account" }); return; }
      socket.emit("stats", { ok: true, stats: s });
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
      const id = String((m && m.id) || "");
      const room = roomById.get(id);
      if (!room) { socket.emit("error_msg", { msg: "unknown_room" }); return; }
      // If already in another room, leave it first.
      if (sess.roomId && sess.roomId !== id) leaveCurrentRoom(socket);
      room.addPlayer(sess.cid, sess.name, socket.id);
      sess.roomId = id;
      socket.join("room:" + id);
      broadcastRoom(room);
      broadcastLobby();
    });

    socket.on("leave_room", () => leaveCurrentRoom(socket));

    // Generic game message — anything not handled above is forwarded to the
    // engine in the player's current room.
    socket.on("msg", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess || !sess.roomId) return;
      const room = roomById.get(sess.roomId);
      if (!room) return;
      const changed = room.handleMessage(sess.cid, m || {});
      if (changed !== false) {
        broadcastRoom(room);
        broadcastLobby();
      }
    });

    socket.on("disconnect", () => {
      leaveCurrentRoom(socket);
      sessions.delete(socket.id);
    });
  });

  // --- Tick loop ---
  setInterval(() => {
    const now = Date.now();
    const dirtyRooms = [];
    for (const r of allRooms) {
      if (r.tick(now)) dirtyRooms.push(r);
    }
    if (dirtyRooms.length) {
      dirtyRooms.forEach(broadcastRoom);
      broadcastLobby();
    }
  }, TICK_MS);

  console.log(`[QuizzMaster] mounted: /quizz + ns /qm (${allRooms.length} rooms)`);
}

module.exports = mount;
