// "Quiz contre-la-montre" — synchronised race to 5 correct answers. Every
// player gets the SAME 30 random questions (drawn once per race from the
// 150-question bank), the host triggers a 3-2-1-GO countdown that fires on
// every screen at the same instant, and progress ("3/5", "5/5 — 7.42 s")
// streams live to the room. First to 5 wins; race stays open until everyone
// finishes or the host taps 🏁. v49.

const { QUESTION_BANK } = require("./quiz");
const POOL_SIZE = 30;       // 30 shared Qs per race (plenty of buffer past 5)
const TARGET_CORRECT = 5;   // how many right answers to win
const COUNTDOWN_MS = Number(process.env.QUIZ_SOLO_COUNTDOWN_MS) > 0
  ? Number(process.env.QUIZ_SOLO_COUNTDOWN_MS)
  : 3500;  // host taps Démarrer → 3-2-1-GO → race starts

function create({ bank = QUESTION_BANK } = {}) {
  let phase = "lobby";
  let questions = [];        // shared pool for the current race
  let progress = {};         // name -> correct count (live)
  let wrongCount = {};       // name -> wrong count (live)
  let finishedAt = {};       // name -> ms since race start when they hit 5
  let raceStartAt = 0;       // absolute Date.now() of the GO moment
  let winner = null;         // first to hit 5
  let eligibleNames = [];    // snapshot of names racing this round
  let bestMs = {};           // name -> best time-to-5 across the soirée (drives 🏆 score)

  function inversedScore(ms) { return ms > 0 ? Math.max(0, 60000 - ms) : 0; }
  function applyScores(room) {
    room.players.forEach((p) => { if (p.name) p.score = inversedScore(bestMs[p.name] || 0); });
  }

  function makePool() {
    const arr = bank.slice();
    if (process.env.QUIZ_SOLO_NO_SHUFFLE !== "1") {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    }
    return arr.slice(0, Math.min(POOL_SIZE, arr.length))
      .map((q) => ({ q: q.text, choices: q.options.slice(), correct: q.correct }));
  }

  function resetRace() {
    questions = []; progress = {}; wrongCount = {}; finishedAt = {};
    winner = null; eligibleNames = []; raceStartAt = 0;
  }

  function startCountdown(room) {
    resetRace();
    questions = makePool();
    eligibleNames = room.activePlayers().map((p) => p.name).filter(Boolean);
    eligibleNames.forEach((n) => { progress[n] = 0; wrongCount[n] = 0; });
    raceStartAt = Date.now() + COUNTDOWN_MS;
    phase = "countdown";
  }

  function progressList() {
    const list = eligibleNames.map((n) => ({
      name: n,
      correct: progress[n] || 0,
      wrong: wrongCount[n] || 0,
      finished_ms: finishedAt[n] != null ? finishedAt[n] : null,
    }));
    list.sort((a, b) => {
      const af = a.finished_ms == null ? Infinity : a.finished_ms;
      const bf = b.finished_ms == null ? Infinity : b.finished_ms;
      if (af !== bf) return af - bf;
      if (b.correct !== a.correct) return b.correct - a.correct;
      return a.name.localeCompare(b.name);
    });
    return list;
  }

  function allFinished() {
    if (!eligibleNames.length) return false;
    return eligibleNames.every((n) => finishedAt[n] != null);
  }

  return {
    phase: () => phase,
    onSelect: (room) => { phase = "lobby"; resetRace(); bestMs = {}; applyScores(room); },
    onAdvance: (room) => {
      if (phase === "lobby" || phase === "finished") {
        startCountdown(room);
        applyScores(room);
      }
    },
    onReset: (room) => { phase = "lobby"; resetRace(); bestMs = {}; applyScores(room); },
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onMessage: (room, p, msg) => {
      if (!p || !p.name) return;
      if (msg.t !== "answer_progress" || phase !== "playing") return;
      if (finishedAt[p.name] != null) return;        // already done
      if (eligibleNames.indexOf(p.name) < 0) return; // not in this race
      const c = Number(msg.correct);
      const w = Number(msg.wrong);
      if (!isFinite(c) || c < 0 || c > TARGET_CORRECT) return;
      if (!isFinite(w) || w < 0 || w > 200) return;
      progress[p.name] = c;
      wrongCount[p.name] = w;
      if (c >= TARGET_CORRECT) {
        const ms = Date.now() - raceStartAt;
        finishedAt[p.name] = ms > 0 ? ms : 1;
        if (!winner) winner = p.name;
        if (!bestMs[p.name] || finishedAt[p.name] < bestMs[p.name]) bestMs[p.name] = finishedAt[p.name];
        applyScores(room);
        if (allFinished()) phase = "finished";
      }
    },
    tick: (room, now) => {
      if (phase === "countdown" && now >= raceStartAt) { phase = "playing"; return true; }
      return false;
    },
    serializeRound: () => {
      const list = progressList();
      const r = {
        solo: true,
        phase: phase,
        target: TARGET_CORRECT,
        race_start_at: raceStartAt,
        progress: list,
        winner: winner,
      };
      if (phase === "countdown" || phase === "playing") r.questions = questions;
      if (phase === "finished") {
        const finishers = list.filter((x) => x.finished_ms != null);
        if (finishers.length) {
          const top = finishers[0];
          r.mvp = { label: "Cerveau le plus rapide", emoji: "🧠", name: top.name, value: (top.finished_ms / 1000).toFixed(2) + " s" };
          if (finishers.length > 1) {
            r.extras = [{ emoji: "🥈", label: "Vice-champion(ne) quiz", name: finishers[1].name, value: (finishers[1].finished_ms / 1000).toFixed(2) + " s" }];
            if (finishers.length > 2) r.extras.push({ emoji: "🥉", label: "3ᵉ marche du podium", name: finishers[2].name, value: (finishers[2].finished_ms / 1000).toFixed(2) + " s" });
          }
        } else if (list.length) {
          const top = list[0];
          r.mvp = { label: "Le plus avancé", emoji: "🧠", name: top.name, value: top.correct + " / " + TARGET_CORRECT };
        }
      }
      return r;
    },
  };
}

module.exports = {
  id: "quiz_solo",
  name: "Quiz Contre-la-montre",
  emoji: "🔢",
  desc: "Course synchronisée à 5 bonnes — mêmes questions, progression en direct.",
  create,
};
