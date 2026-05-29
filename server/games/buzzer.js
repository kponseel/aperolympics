// "Duel de rapidité" (buzzer) — a question + 4 choices appear for everyone at
// once; the FIRST to tap the correct answer wins the point. A wrong tap locks
// that player for the round. Reuses Speed Quiz's 150-question bank. Server is
// authoritative: `correct` is NEVER serialized before reveal (anti-cheat).

const { QUESTION_BANK } = require("./quiz");
const ROUND_TIME_MS = 12000;   // per-question window
const ROUNDS = 10;             // questions per match

function create() {
  let phase = "lobby";          // lobby | playing | reveal | finished
  let order = [];               // shuffled bank indices for this match
  let roundIdx = -1;            // 0-based round number
  let qStart = 0;
  let winner = null;            // name of first correct
  let locked = {};              // name -> true (wrong this round)
  let answeredCount = 0;

  function shuffle() {
    order = QUESTION_BANK.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  }
  function curQ() { return (roundIdx >= 0 && roundIdx < order.length) ? QUESTION_BANK[order[roundIdx]] : null; }

  function startRound(room) {
    roundIdx++;
    if (roundIdx >= ROUNDS || roundIdx >= order.length) { phase = "finished"; return; }
    phase = "playing";
    qStart = Date.now();
    winner = null; locked = {}; answeredCount = 0;
    room.players.forEach((p) => { p.answered = false; });
  }
  function toReveal() { if (phase === "playing") phase = "reveal"; }

  function resetAll(room) {
    phase = "lobby"; order = []; roundIdx = -1; winner = null; locked = {}; answeredCount = 0;
    room.players.forEach((p) => { p.score = 0; p.answered = false; });
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { resetAll(room); shuffle(); startRound(room); },
    onAdvance: (room) => {
      if (phase === "lobby") { resetAll(room); shuffle(); startRound(room); }
      else if (phase === "playing") { toReveal(); }   // host can cut the round short
      else if (phase === "reveal") { startRound(room); }
      else { resetAll(room); }
    },
    onReset: resetAll,
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || msg.t !== "answer") return;
      if (winner || locked[p.name] || p.answered) return;   // round decided / already acted
      const q = curQ(); if (!q) return;
      const choice = msg.choice;
      if (typeof choice !== "number" || choice < 0 || choice > 3) return;
      p.answered = true; answeredCount++;
      if (choice === q.correct) {
        winner = p.name; p.score = (p.score || 0) + 1;
        toReveal();
      } else {
        locked[p.name] = true;
        // If everyone present is now locked, end the round (nobody got it).
        const act = room.activePlayers();
        if (act.length > 0 && act.every((x) => locked[x.name])) toReveal();
      }
    },
    serializeRound: (room) => {
      const r = { total: ROUNDS };
      if (phase === "lobby") return r;
      const q = curQ();
      r.idx = roundIdx;
      if (q) { r.q = q.text; r.choices = q.options.slice(); }
      r.locked = Object.keys(locked);
      r.scores = {};
      room.players.forEach((p) => { if (p.name) r.scores[p.name] = p.score || 0; });
      if (phase === "playing") {
        const left = Math.max(0, ROUND_TIME_MS - (Date.now() - qStart));
        r.time_left_ms = left; r.time_total_ms = ROUND_TIME_MS;
        r.answered = answeredCount;
      } else if (phase === "reveal") {
        r.correct = q ? q.correct : -1;   // revealed only now
        r.winner = winner;                // name or null (timeout / all wrong)
      } else if (phase === "finished") {
        // Top scorer = fastest trigger. Filter to present players.
        const present = new Set(); room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
        let best = null;
        room.players.forEach((p) => { if (!p.name || !present.has(p.name)) return; if (!best || (p.score || 0) > (best.score || 0)) best = p; });
        if (best && (best.score || 0) > 0) r.mvp = { label: "Gâchette la plus rapide", emoji: "⚡", name: best.name, value: best.score + " manche" + (best.score > 1 ? "s" : "") };
      }
      return r;
    },
    tick: (room, now) => {
      if (phase !== "playing") return false;
      if (now - qStart >= ROUND_TIME_MS) { toReveal(); return true; }
      return true; // keep the countdown live
    },
  };
}

module.exports = {
  id: "buzzer",
  name: "Duel de rapidité",
  emoji: "🔔",
  desc: "Le premier à taper la bonne réponse rafle le point !",
  create,
};
