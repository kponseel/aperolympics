// Aperolympics + QuizzMaster — single admin panel served at /admin.
//
// AUTHENTICATION: HTTP Basic Auth keyed on the ADMIN_PASSWORD env var.
// If ADMIN_PASSWORD is not set, every route returns 503 — fail-safe by default,
// so a brand-new deploy never accidentally exposes an open admin. Once the env
// var is set on the host (Hostinger panel → Node.js → Environment variables),
// the admin page becomes reachable and credentials are required.
//
// The HTML page is `public/admin.html` (no JS framework, vanilla). It calls the
// JSON endpoints under /admin/api/*, which are guarded by the same Basic Auth.

const path = require("path");
const express = require("express");

function constantTimeEquals(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function basicAuth(req, res, next) {
  const password = process.env.ADMIN_PASSWORD || "";
  if (!password) {
    return res.status(503).type("text/plain")
      .send("Admin panel disabled — set ADMIN_PASSWORD on the host to enable.");
  }
  const auth = req.headers.authorization || "";
  if (!auth.toLowerCase().startsWith("basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Aperolympics Admin", charset="UTF-8"');
    return res.status(401).type("text/plain").send("Authentication required.");
  }
  let decoded;
  try { decoded = Buffer.from(auth.slice(6).trim(), "base64").toString("utf8"); }
  catch (e) { decoded = ""; }
  const supplied = decoded.includes(":") ? decoded.slice(decoded.indexOf(":") + 1) : "";
  if (!constantTimeEquals(supplied, password)) {
    res.set("WWW-Authenticate", 'Basic realm="Aperolympics Admin", charset="UTF-8"');
    return res.status(401).type("text/plain").send("Wrong password.");
  }
  next();
}

function mount({ app, io, rooms }) {
  const qmPlayers = require("./quizzmaster/players");
  const amPlayers = require("./match/players");

  // === HTML page ===
  app.get("/admin", basicAuth, (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "admin.html"));
  });

  // === JSON API ===
  const api = express.Router();
  api.use(basicAuth);
  api.use(express.json({ limit: "16kb" }));

  // -- Stockage --------------------------------------------------------------
  // Où les comptes sont réellement écrits, et si l'écriture fonctionne. C'est
  // le premier endroit à regarder quand « il n'y a plus aucun compte ».
  api.get("/storage", (_req, res) => {
    const s = require("./storage").describeAll();
    const counts = { quizzmaster: qmPlayers.adminList().length, match: amPlayers.adminList().length };
    res.json({ storage: s, counts });
  });

  // -- Aperolympics rooms ----------------------------------------------------
  api.get("/rooms", (_req, res) => {
    const list = rooms.all().map((r) => ({
      code: r.code,
      visibility: r.visibility,
      gameId: r.gameId,
      phase: r.game ? r.game.phase() : "lobby",
      createdAt: r.createdAt,
      emptySince: r.emptySince,
      activeCount: r.activePlayers().length,
      totalCount: r.players.size,
      players: [...r.players.values()].map((p) => ({
        name: p.name, active: !!p.active, score: p.score | 0,
        host: p.active && p.name === r.hostName(),
      })),
    }));
    res.json({ rooms: list });
  });

  api.post("/rooms/delete", (req, res) => {
    const code = String((req.body && req.body.code) || "").toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ ok: false, error: "room_not_found" });
    // Tell the connected clients first, so their UI bounces to the landing
    // screen cleanly (their client treats `room_gone` as "drop session").
    io.to(room.code).emit("error_msg", {
      msg: "La salle a été fermée par un administrateur.",
      code: "room_gone",
    });
    rooms.delete(code);
    res.json({ ok: true });
  });

  // -- QuizzMaster players ---------------------------------------------------
  api.get("/qm/players", (_req, res) => {
    res.json({ players: qmPlayers.adminList() });
  });

  api.post("/qm/delete", (req, res) => {
    const name = String((req.body && req.body.name) || "").trim();
    if (!name) return res.status(400).json({ ok: false, error: "missing_name" });
    const ok = qmPlayers.adminDelete(name);
    if (!ok) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true });
  });

  api.post("/qm/reset-pin", (req, res) => {
    const name = String((req.body && req.body.name) || "").trim();
    if (!name) return res.status(400).json({ ok: false, error: "missing_name" });
    const ok = qmPlayers.adminResetPin(name);
    if (!ok) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true });
  });

  // -- Are We A Match? banques de questions ---------------------------------
  // Lecture seule : voir l'intégralité d'un pack, tel qu'il sera posé en jeu.
  api.get("/match/packs", (_req, res) => {
    const packs = require("./match/packs");
    res.json({
      packs: Object.values(packs).map((p) => ({
        id: p.id, name: p.name, emoji: p.emoji, tagline: p.tagline, count: p.bank.length,
      })),
    });
  });

  api.get("/match/questions", (req, res) => {
    const packs = require("./match/packs");
    const id = String(req.query.pack || "");
    const pack = packs[id];
    if (!pack) return res.status(404).json({ ok: false, error: "unknown_pack" });
    res.json({
      pack: { id: pack.id, name: pack.name, emoji: pack.emoji, tagline: pack.tagline },
      // ctx (scène + critère de classement) est optionnel : undefined disparaît
      // à la sérialisation, la clé n'apparaît que pour les packs qui l'ont.
      questions: pack.bank.map((q) => ({ id: q.id, q: q.q, ctx: q.ctx || undefined, o: q.o.slice() })),
    });
  });

  // -- Are We A Match? players --------------------------------------------
  api.get("/match/players", (_req, res) => {
    res.json({ players: amPlayers.adminList() });
  });

  api.post("/match/delete", (req, res) => {
    const name = String((req.body && req.body.name) || "").trim();
    if (!name) return res.status(400).json({ ok: false, error: "missing_name" });
    const ok = amPlayers.adminDelete(name);
    if (!ok) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true });
  });

  api.post("/match/reset-pin", (req, res) => {
    const name = String((req.body && req.body.name) || "").trim();
    if (!name) return res.status(400).json({ ok: false, error: "missing_name" });
    const ok = amPlayers.adminResetPin(name);
    if (!ok) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true });
  });

  app.use("/admin/api", api);
}

module.exports = mount;
