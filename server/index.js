// Aperolympics server: serves the PWA (public/) and runs the realtime layer.
//
// Transport = Socket.IO. On managed/shared hosting that blocks INCOMING
// WebSockets (e.g. Hostinger Business), Socket.IO falls back to HTTP
// long-polling automatically, so the game still works. One single Node process
// serves both the static SPA and the realtime endpoint, and holds room state in
// memory (the process is persistent).

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const rooms = require("./rooms");
const registry = require("./games/registry");

const PORT = process.env.PORT || 3000;
// A dropped socket isn't treated as "left" until this grace elapses, so a
// transient blip (wifi handoff, tab backgrounded, page refresh) doesn't thrash
// the host crown or reassign turns. Kept short so a *real* mid-round departure
// only freezes the round briefly before the game reacts. A reconnect within the
// window is seamless.
const DISCONNECT_GRACE_MS = 3000;

const app = express();
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR));

// Join-by-link: /r/CODE serves the SPA, which reads the code from the URL.
app.get("/r/:code", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

const server = http.createServer(app);
const io = new Server(server, {
  // Keep both transports; on hosts that block the WS upgrade it stays on polling.
  transports: ["polling", "websocket"],
});

// --- helpers ---------------------------------------------------------------
function buildState(room) {
  const hostName = room.hostName();
  const phase = room.game ? room.game.phase() : "lobby";
  const players = [];
  room.players.forEach((p) => {
    if (!p.name) return;
    // Public per-player payload: deliberately does NOT include `answer` —
    // anonymous vote games (never.js) would otherwise leak per-prompt choices
    // to anyone listening on the socket. Games that need to show a player
    // THEIR OWN answer expose it via serializePrivate (e.g. quiz's my_correct).
    players.push({
      id: p.name,
      name: p.name,
      score: p.score,
      connected: p.active,
      host: p.active && p.name === hostName,
      answered: p.answered,
    });
  });
  return {
    t: "state",
    room: room.code,
    phase,
    game: room.gameId,
    hostId: hostName,
    players,
    round: room.game && room.game.serializeRound ? room.game.serializeRound(room) : {},
    history: room.history || [],
  };
}

// Match history: snapshot a game's standings once, when it ends or when the
// host moves on from it. Lets players review past games (📜). histRecorded is
// reset whenever a new game instance is selected.
//
// We also snapshot the per-game session payoff (`mvp`, `winner_banner`) so
// the overlay can replay the rich end-of-game info, not just the scores —
// crucial for the 8 non-scored games where the headline IS the MVP.
function recordHistory(room) {
  if (!room.game || !room.gameId || room.histRecorded) return;
  const standings = [];
  room.players.forEach((p) => { if (p.name) standings.push({ name: p.name, score: p.score || 0 }); });
  standings.sort((a, b) => (b.score - a.score) || (a.name < b.name ? -1 : 1));
  const round = room.game.serializeRound ? room.game.serializeRound(room) : {};
  const entry = { game: room.gameId, at: Date.now(), standings };
  if (round && round.mvp) entry.mvp = round.mvp;
  if (round && round.winner_banner) entry.winner_banner = round.winner_banner;
  room.history.push(entry);
  if (room.history.length > 30) room.history.shift();
  room.histRecorded = true;
}

function broadcast(room) {
  if (room.game && room.game.phase() === "finished") recordHistory(room);
  else room.histRecorded = false; // re-arm: a replayed/new game can be logged again when it ends
  io.to(room.code).emit("state", buildState(room));
  if (room.game && room.game.serializePrivate) {
    room.players.forEach((p) => {
      if (!p.active) return;
      const priv = room.game.serializePrivate(room, p);
      if (priv && Object.keys(priv).length) {
        const s = io.sockets.sockets.get(p.socketId);
        if (s) s.emit("private", { t: "private", round: priv });
      }
    });
  }
}

function playerOf(socket, room) {
  return room ? room.players.get(socket.data.playerKey) : undefined;
}
function isHost(socket, room) {
  const p = playerOf(socket, room);
  return !!(p && p.name === room.hostName());
}

function joinRoom(socket, room, rawName) {
  const name = String(rawName || "Joueur").trim().slice(0, 16) || "Joueur";
  const key = name.toLowerCase();
  let p = room.players.get(key);
  // Pseudo collision: an active player with no pending disconnect is already
  // holding this name from a different socket. Silently overwriting them would
  // orphan their tab; reject and let the joiner pick another name.
  if (p && p.active && !p.disconnectedAt && p.socketId !== socket.id) {
    socket.emit("error_msg", { msg: "Ce pseudo est déjà pris dans cette salle." });
    return;
  }
  if (!p) {
    p = { name, score: 0, answered: false, answer: -1, answerMs: 0, joinedAt: Date.now(), active: true, socketId: socket.id, disconnectedAt: 0 };
    room.players.set(key, p);
  } else {
    p.active = true;
    p.socketId = socket.id;
    p.name = name;
    p.disconnectedAt = 0; // a reconnect cancels any pending soft-disconnect
  }
  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.playerKey = key;
  if (room.game && room.game.onPlayerJoin) room.game.onPlayerJoin(room, p);
  broadcast(room);
}

// --- realtime --------------------------------------------------------------
io.on("connection", (socket) => {
  socket.on("msg", (m) => {
    if (!m || typeof m.t !== "string") return;

    if (m.t === "create") {
      const room = rooms.create();
      joinRoom(socket, room, m.name);
      return;
    }
    if (m.t === "join") {
      const room = rooms.get(m.room);
      if (!room) { socket.emit("error_msg", { msg: "Partie introuvable" }); return; }
      joinRoom(socket, room, m.name);
      return;
    }

    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const player = playerOf(socket, room);

    if (m.t === "select_game") {
      if (!isHost(socket, room)) return;
      const id = m.id || "";
      recordHistory(room); // snapshot the game we're leaving (if any, not already logged)
      // A new game starts with a fresh leaderboard: scoring games reset their
      // own scores in onSelect, but non-scoring games never touch p.score, so
      // a prior quiz's medals would otherwise leak into the next game's podium.
      room.players.forEach((p) => { p.score = 0; });
      if (!id) { room.gameId = null; room.game = null; room.histRecorded = false; }
      else {
        const g = registry.get(id);
        if (g) { room.gameId = id; room.game = g.create(); room.histRecorded = false; if (room.game.onSelect) room.game.onSelect(room); }
      }
      broadcast(room);
    } else if (m.t === "next" || m.t === "start") {
      if (isHost(socket, room) && room.game) { room.game.onAdvance(room); broadcast(room); }
    } else if (m.t === "reset") {
      if (isHost(socket, room) && room.game) { room.game.onReset(room); broadcast(room); }
    } else if (m.t === "end") {
      // Host stops a loop-only game and surfaces its session stats: the game
      // implements `onEndSession` to flip phase to "finished" and emit its MVP.
      if (isHost(socket, room) && room.game && room.game.onEndSession) { room.game.onEndSession(room); broadcast(room); }
    } else if (room.game && room.game.onMessage && player) {
      room.game.onMessage(room, player, m);
      broadcast(room);
    }
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const p = playerOf(socket, room);
    // Soft-disconnect: keep the player active and just stamp the time. The tick
    // promotes it to a real leave once the grace elapses; a reconnect before
    // then clears the stamp (joinRoom), so a blip/refresh is seamless.
    if (p && p.socketId === socket.id) p.disconnectedAt = Date.now();
  });
});

// Per-room timers (quiz countdown, bomb, etc.) + room housekeeping.
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.all()) {
    let dirty = false;
    // Promote expired soft-disconnects to real leaves. Mark them ALL inactive
    // first, then fire onPlayerLeave — so a turn/host reassignment never lands
    // on a player who is also leaving in this same tick.
    var left = [];
    room.players.forEach((p) => {
      if (p.active && p.disconnectedAt && now - p.disconnectedAt >= DISCONNECT_GRACE_MS) {
        p.active = false; p.disconnectedAt = 0; left.push(p); dirty = true;
      }
    });
    left.forEach((p) => { if (room.game && room.game.onPlayerLeave) room.game.onPlayerLeave(room, p); });
    if (room.game && room.game.tick && room.game.tick(room, now)) dirty = true;
    if (dirty) broadcast(room);
  }
  rooms.sweep();
}, 500);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Aperolympics] up on :${PORT} — ${registry.list().length} game(s) registered`);
});
