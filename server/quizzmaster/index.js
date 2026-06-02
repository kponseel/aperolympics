// QuizzMaster — sub-app wired into the main Aperolympics server.
//   - Express static at /quizz/* (SPA fallback to index.html)
//   - Socket.IO namespace /qm
//   - 10 persistent rooms (one per theme), single "Blitz 30 s" mode
//   - JSON leaderboard persisted to server/quizzmaster/scores.json
//
// Wire-up: at the bottom of server/index.js, call
//   require("./quizzmaster")({ app, io });

const path = require("path");
const roomsModule = require("./rooms");
const leaderboard = require("./leaderboard");

const TICK_MS = 500;

function mount({ app, io }) {
  const allRooms = roomsModule.buildAll();
  const roomById = new Map(allRooms.map((r) => [r.id, r]));
  const allRoomIds = allRooms.map((r) => r.id);

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
      global_top: leaderboard.globalTop(allRoomIds),
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
    sessions.set(socket.id, { cid: null, name: null, roomId: null, inLobby: false });

    socket.on("set_identity", (m) => {
      const sess = sessions.get(socket.id);
      if (!sess) return;
      const cid = String((m && m.cid) || "").slice(0, 64);
      const name = String((m && m.name) || "").trim().slice(0, 16);
      if (!cid || !name) { socket.emit("error_msg", { msg: "bad_identity" }); return; }
      sess.cid = cid;
      sess.name = name;
      socket.emit("identity_ok", { cid, name });
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
