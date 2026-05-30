// "Quiz contre-la-montre" — race to 5 correct answers. Each player gets a
// random pool from Speed Quiz's 150-question bank; the stopwatch starts at 0
// and stops the moment they hit their 5th correct answer. Server tracks the
// per-player best time and broadcasts a sorted "classement de la salle"
// ranking — same pattern as Réflexe (parallel multiplayer). At 🏁 the
// fastest run takes the MVP card.

const { QUESTION_BANK } = require("./quiz");
const POOL_SIZE = 30;       // 30 random Qs per run (plenty of buffer to land 5 correct)
const TARGET_CORRECT = 5;   // how many right answers ends a run

function create() {
  let phase = "lobby";
  let perPlayerPool = {};   // name -> [{q,choices,correct}]
  let bestMs = {};          // name -> best time-to-5-correct in ms
  let lastMs = {};          // name -> most recent run time
  let runs = {};            // name -> # of completed runs

  function inversedScore(ms) { return ms > 0 ? Math.max(0, 60000 - ms) : 0; }
  function applyScores(room) {
    room.players.forEach((p) => { if (p.name) p.score = inversedScore(bestMs[p.name] || 0); });
  }

  function makePool() {
    const arr = QUESTION_BANK.slice();
    if (process.env.QUIZ_SOLO_NO_SHUFFLE !== "1") {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    }
    return arr.slice(0, Math.min(POOL_SIZE, arr.length))
      .map((q) => ({ q: q.text, choices: q.options.slice(), correct: q.correct }));
  }

  function poolFor(name) {
    if (!perPlayerPool[name]) perPlayerPool[name] = makePool();
    return perPlayerPool[name];
  }

  function topRuns(room) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    const list = [];
    for (const n in bestMs) {
      if (!bestMs[n]) continue;
      list.push({ name: n, best_ms: bestMs[n], last_ms: lastMs[n] || 0, runs: runs[n] || 0 });
    }
    list.sort((a, b) => a.best_ms - b.best_ms);
    return list;
  }

  function clearAll(room) {
    perPlayerPool = {}; bestMs = {}; lastMs = {}; runs = {};
    if (room && room.players) applyScores(room);
  }

  return {
    phase: () => phase,
    onSelect: (room) => { phase = "lobby"; clearAll(room); },
    onStart: (room) => { phase = "playing"; clearAll(room); },
    onAdvance: (room) => { if (phase === "lobby") { phase = "playing"; clearAll(room); } },
    onReset: (room) => { phase = "lobby"; clearAll(room); },
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onMessage: (room, p, msg) => {
      if (!p || !p.name || phase === "lobby") return;
      if (msg.t === "run_done") {
        // Client reports: { ms, correct } when they hit TARGET_CORRECT.
        const ms = Number(msg.ms);
        const correct = Number(msg.correct);
        if (!isFinite(ms) || ms <= 0 || ms > 600000) return;
        if (correct < TARGET_CORRECT) return; // only count completed runs
        lastMs[p.name] = ms;
        if (!bestMs[p.name] || ms < bestMs[p.name]) bestMs[p.name] = ms;
        runs[p.name] = (runs[p.name] || 0) + 1;
        // Hand them a fresh pool for the next run.
        perPlayerPool[p.name] = makePool();
        applyScores(room);
      }
    },
    // Public state: just the ranking. Each player's private pool of questions
    // is delivered via serializePrivate so peers don't get to peek at the
    // correct answer.
    serializeRound: (room) => {
      const top = topRuns(room);
      const r = { solo: true, target: TARGET_CORRECT, top: top };
      if (phase === "finished" && top.length) {
        r.mvp = { label: "Cerveau le plus rapide", emoji: "🧠", name: top[0].name, value: (top[0].best_ms / 1000).toFixed(2) + " s" };
        if (top.length > 1) {
          r.extras = [{ emoji: "🥈", label: "Vice-champion(ne) quiz", name: top[1].name, value: (top[1].best_ms / 1000).toFixed(2) + " s" }];
          if (top.length > 2) r.extras.push({ emoji: "🥉", label: "3ᵉ marche du podium", name: top[2].name, value: (top[2].best_ms / 1000).toFixed(2) + " s" });
        }
      }
      return r;
    },
    serializePrivate: (room, viewer) => {
      if (!viewer || !viewer.name || phase !== "playing") return {};
      return { questions: poolFor(viewer.name), target: TARGET_CORRECT };
    },
    tick: () => false,
  };
}

module.exports = {
  id: "quiz_solo",
  name: "Quiz Contre-la-montre",
  emoji: "🔢",
  desc: "Premier arrivé à 5 bonnes réponses gagne — questions tirées au hasard parmi 150.",
  create,
};
