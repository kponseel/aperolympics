// QuizzMaster — 20 persistent rooms (2 modes × 10 themes).
//
// Each room owns one engine instance (quiz.js or quiz_solo.js) wired to the
// theme's question bank. Lifecycle per room:
//
//   idle   ──Démarrer (any player)──▶  prerace (15 s countdown)
//          ◀──── 60 s timeout, 2+ players ────  (auto-start)
//   prerace ──countdown elapsed──▶ racing (engine.onAdvance)
//   racing ──engine.phase=="finished"──▶ podium (8 s display)
//   podium ──8 s elapsed──▶ idle (engine.onReset, players' scores cleared)
//
// Late-joins during `racing` see a spectator UI (handled client-side from
// the room snapshot).

const quizMod = require("../games/quiz");
const quizSoloMod = require("../games/quiz_solo");
const themes = require("./themes");
const leaderboard = require("./leaderboard");

const PRERACE_MS = Number(process.env.QM_PRERACE_MS) > 0 ? Number(process.env.QM_PRERACE_MS) : 15000;
const PODIUM_MS = Number(process.env.QM_PODIUM_MS) > 0 ? Number(process.env.QM_PODIUM_MS) : 8000;
const AUTO_START_AFTER_MS = Number(process.env.QM_AUTOSTART_MS) > 0 ? Number(process.env.QM_AUTOSTART_MS) : 60000;
const MODES = [
  { id: "quiz",      name: "Speed Quiz",         emoji: "🧠", module: quizMod,     scoreLabel: "pts" },
  { id: "quiz_solo", name: "Contre-la-montre",   emoji: "🔢", module: quizSoloMod, scoreLabel: "s" },
];

function makeRoom(modeDef, themeDef) {
  const id = modeDef.id + ":" + themeDef.id;
  const engine = modeDef.module.create({ bank: themeDef.bank });
  const players = new Map();   // cid -> { cid, name, socketId, score, answered, voteTarget, answer }
  let state = "idle";          // "idle" | "prerace" | "racing" | "podium"
  let preraceEndAt = 0;
  let podiumEndAt = 0;
  let lastIdleSince = Date.now();
  let lastRaceSummary = null;  // kept on screen during podium phase

  // Shim that mimics the Aperolympics `room` API expected by the engines.
  const roomShim = {
    code: id,
    players,
    activePlayers: () => [...players.values()].filter((p) => p.socketId),
    hostName: () => {
      const active = roomShim.activePlayers();
      return active.length ? active[0].name : "";
    },
  };

  function clearPlayerRoundState() {
    players.forEach((p) => {
      p.answered = false;
      p.voteTarget = null;
      p.answer = -1;
    });
  }

  function addPlayer(cid, name, socketId) {
    if (!cid || !name) return null;
    let p = players.get(cid);
    if (p) {
      p.name = name;
      p.socketId = socketId;
    } else {
      p = { cid, name, socketId, score: 0, answered: false, voteTarget: null, answer: -1 };
      players.set(cid, p);
    }
    return p;
  }

  function removePlayer(cid) {
    players.delete(cid);
    if (state === "idle" && roomShim.activePlayers().length === 0) {
      lastIdleSince = Date.now();
    }
  }

  function trigger(now) {
    if (state !== "idle") return false;
    if (roomShim.activePlayers().length === 0) return false;
    state = "prerace";
    preraceEndAt = now + PRERACE_MS;
    return true;
  }

  function recordScoresToLeaderboard() {
    const active = roomShim.activePlayers();
    active.forEach((p) => {
      let value, displayValue;
      if (modeDef.id === "quiz_solo") {
        // p.score = max(0, 60000 - bestMs). Convert back to ms.
        if (!p.score || p.score <= 0) return; // never finished
        const ms = 60000 - p.score;
        if (ms <= 0 || ms >= 60000) return;
        value = ms;
        displayValue = (ms / 1000).toFixed(2) + " s";
      } else {
        // Speed Quiz: p.score is the accumulated points.
        if (!p.score || p.score <= 0) return;
        value = p.score;
        displayValue = String(p.score) + " pts";
      }
      leaderboard.record(id, modeDef.id, {
        cid: p.cid, name: p.name, value, displayValue, at: Date.now(),
      });
    });
  }

  function captureSummary() {
    const round = engine.serializeRound ? engine.serializeRound(roomShim) : {};
    return {
      mvp: round.mvp || null,
      extras: round.extras || [],
      progress: round.progress || null,
      players: roomShim.activePlayers().map((p) => ({
        name: p.name, score: p.score,
      })),
    };
  }

  function tick(now) {
    let dirty = false;

    // Engine internal timer (countdown for quiz_solo, question timeout for quiz).
    if (engine.tick && engine.tick(roomShim, now)) dirty = true;

    if (state === "prerace" && now >= preraceEndAt) {
      engine.onAdvance(roomShim);
      state = "racing";
      dirty = true;
    }

    if (state === "racing" && engine.phase() === "finished") {
      recordScoresToLeaderboard();
      lastRaceSummary = captureSummary();
      state = "podium";
      podiumEndAt = now + PODIUM_MS;
      dirty = true;
    }

    if (state === "podium" && now >= podiumEndAt) {
      if (engine.onReset) engine.onReset(roomShim);
      clearPlayerRoundState();
      players.forEach((p) => { p.score = 0; });
      lastRaceSummary = null;
      state = "idle";
      lastIdleSince = now;
      dirty = true;
    }

    // Auto-start: 2+ active players sitting idle for AUTO_START_AFTER_MS.
    if (state === "idle"
        && roomShim.activePlayers().length >= 2
        && now - lastIdleSince >= AUTO_START_AFTER_MS) {
      trigger(now);
      dirty = true;
    }

    return dirty;
  }

  function handleMessage(cid, msg) {
    const p = players.get(cid);
    if (!p) return false;
    if (msg && msg.t === "demarrer") return trigger(Date.now());
    // Forward to engine
    if (engine.onMessage) {
      engine.onMessage(roomShim, p, msg || {});
      return true; // even if no-op, caller broadcasts anyway
    }
    return false;
  }

  function snapshot() {
    const active = roomShim.activePlayers();
    const now = Date.now();
    const round = engine.serializeRound ? engine.serializeRound(roomShim) : {};
    return {
      id, mode: modeDef.id, theme: themeDef.id,
      mode_name: modeDef.name, mode_emoji: modeDef.emoji, theme_name: themeDef.name, theme_emoji: themeDef.emoji,
      state,
      prerace_remaining_ms: state === "prerace" ? Math.max(0, preraceEndAt - now) : 0,
      podium_remaining_ms: state === "podium" ? Math.max(0, podiumEndAt - now) : 0,
      auto_start_in_ms: (state === "idle" && active.length >= 2)
        ? Math.max(0, AUTO_START_AFTER_MS - (now - lastIdleSince)) : 0,
      engine_phase: engine.phase(),
      round,
      players: active.map((p) => ({ cid: p.cid, name: p.name, score: p.score, answered: !!p.answered })),
      top: leaderboard.top(id),
      last_summary: state === "podium" ? lastRaceSummary : null,
    };
  }

  function lobbyCard() {
    const now = Date.now();
    return {
      id, mode: modeDef.id, theme: themeDef.id,
      mode_name: modeDef.name, mode_emoji: modeDef.emoji, theme_name: themeDef.name, theme_emoji: themeDef.emoji,
      state,
      player_count: roomShim.activePlayers().length,
      prerace_remaining_ms: state === "prerace" ? Math.max(0, preraceEndAt - now) : 0,
      podium_remaining_ms: state === "podium" ? Math.max(0, podiumEndAt - now) : 0,
    };
  }

  return {
    id, mode: modeDef.id, theme: themeDef.id,
    addPlayer, removePlayer, handleMessage, tick, snapshot, lobbyCard,
    hasPlayer: (cid) => players.has(cid),
  };
}

function buildAll() {
  const list = [];
  MODES.forEach((mode) => {
    Object.values(themes).forEach((theme) => {
      list.push(makeRoom(mode, theme));
    });
  });
  return list;
}

module.exports = {
  buildAll,
  MODES,
  THEMES: themes,
  PRERACE_MS, PODIUM_MS, AUTO_START_AFTER_MS,
};
