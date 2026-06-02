// QuizzMaster — 10 persistent rooms (one per theme), single "Blitz 60 s" mode.
//
// Lifecycle per room (the room owns ALL timing; the blitz engine is a pure
// pool + scorer):
//
//   idle      ──Démarrer (n'importe quel joueur)──▶  countdown (3 s : 3-2-1-GO)
//             ◀──── 60 s timeout, 2+ joueurs ────  (démarrage auto)
//   countdown ──fin du décompte──▶  playing (60 s de blitz)
//   playing   ──60 s écoulées──▶  podium (résumé + stats, 10 s)
//   podium    ──10 s──▶  idle  (scores remis à zéro)
//
// Les retardataires pendant `playing` voient un écran spectateur (géré côté
// client à partir de l'état).

const themes = require("./themes");
const blitz = require("./blitz");
const players = require("./players");

const COUNTDOWN_MS = Number(process.env.QM_COUNTDOWN_MS) > 0 ? Number(process.env.QM_COUNTDOWN_MS) : 3000;
const BLITZ_MS = Number(process.env.QM_BLITZ_MS) > 0 ? Number(process.env.QM_BLITZ_MS) : 60000;
const PODIUM_MS = Number(process.env.QM_PODIUM_MS) > 0 ? Number(process.env.QM_PODIUM_MS) : 10000;
const AUTO_START_AFTER_MS = Number(process.env.QM_AUTOSTART_MS) > 0 ? Number(process.env.QM_AUTOSTART_MS) : 60000;

function makeRoom(themeDef) {
  const id = themeDef.id;
  const engine = blitz.create(themeDef.bank);
  const playerMap = new Map();   // cid -> { cid, name, socketId, score }
  let state = "idle";          // "idle" | "countdown" | "playing" | "podium"
  let goAt = 0;                // absolute Date.now() of GO (countdown end)
  let endAt = 0;               // absolute end of the 60 s blitz
  let podiumEndAt = 0;
  let lastIdleSince = Date.now();
  let lastSummary = null;

  function activePlayers() { return [...playerMap.values()].filter((p) => p.socketId); }

  function addPlayer(cid, name, socketId) {
    if (!cid || !name) return null;
    let p = playerMap.get(cid);
    if (p) { p.name = name; p.socketId = socketId; }
    else { p = { cid, name, socketId, score: 0 }; playerMap.set(cid, p); }
    return p;
  }

  function removePlayer(cid) {
    playerMap.delete(cid);
    if (state === "idle" && activePlayers().length === 0) lastIdleSince = Date.now();
  }

  function trigger(now) {
    if (state !== "idle") return false;
    if (activePlayers().length === 0) return false;
    state = "countdown";
    goAt = now + COUNTDOWN_MS;
    endAt = goAt + BLITZ_MS;
    return true;
  }

  function recordResults() {
    engine.standings().forEach((r) => {
      const p = [...playerMap.values()].find((x) => x.name === r.name && x.socketId);
      if (!p) return;
      players.recordGame(p.name, p.cid, themeDef.id, {
        score: r.score, correct: r.correct, wrong: r.wrong, skipped: r.skipped,
      });
    });
  }

  function tick(now) {
    let dirty = false;

    if (state === "countdown" && now >= goAt) {
      engine.begin(activePlayers());
      state = "playing";
      dirty = true;
    }

    if (state === "playing" && now >= endAt) {
      lastSummary = engine.summary();
      recordResults();
      state = "podium";
      podiumEndAt = now + PODIUM_MS;
      dirty = true;
    }

    if (state === "podium" && now >= podiumEndAt) {
      engine.reset();
      playerMap.forEach((p) => { p.score = 0; });
      lastSummary = null;
      state = "idle";
      lastIdleSince = now;
      dirty = true;
    }

    // Démarrage auto : 2+ joueurs qui attendent depuis AUTO_START_AFTER_MS.
    if (state === "idle" && activePlayers().length >= 2 && now - lastIdleSince >= AUTO_START_AFTER_MS) {
      trigger(now);
      dirty = true;
    }

    return dirty;
  }

  function handleMessage(cid, msg) {
    const p = playerMap.get(cid);
    if (!p) return false;
    if (msg && msg.t === "demarrer") return trigger(Date.now());
    if (msg && msg.t === "progress" && state === "playing") {
      return engine.report(p.name, msg);
    }
    return false;
  }

  function snapshot() {
    const now = Date.now();
    const active = activePlayers();
    const snap = {
      id, theme: themeDef.id, theme_name: themeDef.name, theme_emoji: themeDef.emoji,
      state,
      // Absolute timestamps so clients can compute remaining locally between
      // broadcasts (no need for the server to re-emit every 250 ms during a
      // 3-second countdown).
      go_at_ms: state === "countdown" ? goAt : 0,
      end_at_ms: state === "playing" ? endAt : 0,
      podium_end_at_ms: state === "podium" ? podiumEndAt : 0,
      server_now_ms: now,
      // Compatibility values (initial snapshot is correct; clients should
      // prefer the absolute timestamps above for live countdowns).
      countdown_remaining_ms: state === "countdown" ? Math.max(0, goAt - now) : 0,
      time_left_ms: state === "playing" ? Math.max(0, endAt - now) : 0,
      blitz_total_ms: BLITZ_MS,
      podium_remaining_ms: state === "podium" ? Math.max(0, podiumEndAt - now) : 0,
      auto_start_in_ms: (state === "idle" && active.length >= 2) ? Math.max(0, AUTO_START_AFTER_MS - (now - lastIdleSince)) : 0,
      players: active.map((p) => ({ cid: p.cid, name: p.name })),
      standings: (state === "playing" || state === "podium") ? engine.standings() : [],
      top: players.themeTop(themeDef.id),
      summary: state === "podium" ? lastSummary : null,
    };
    if (state === "countdown" || state === "playing") snap.questions = engine.questions();
    return snap;
  }

  function lobbyCard() {
    const now = Date.now();
    return {
      id, theme: themeDef.id, theme_name: themeDef.name, theme_emoji: themeDef.emoji,
      state,
      player_count: activePlayers().length,
      go_at_ms: state === "countdown" ? goAt : 0,
      end_at_ms: state === "playing" ? endAt : 0,
      podium_end_at_ms: state === "podium" ? podiumEndAt : 0,
      server_now_ms: now,
      countdown_remaining_ms: state === "countdown" ? Math.max(0, goAt - now) : 0,
      time_left_ms: state === "playing" ? Math.max(0, endAt - now) : 0,
      podium_remaining_ms: state === "podium" ? Math.max(0, podiumEndAt - now) : 0,
    };
  }

  return {
    id, theme: themeDef.id,
    addPlayer, removePlayer, handleMessage, tick, snapshot, lobbyCard,
    hasPlayer: (cid) => playerMap.has(cid),
  };
}

function buildAll() {
  return Object.values(themes).map((theme) => makeRoom(theme));
}

module.exports = { buildAll, THEMES: themes, COUNTDOWN_MS, BLITZ_MS, PODIUM_MS, AUTO_START_AFTER_MS };
