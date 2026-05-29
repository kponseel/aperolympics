// "Quiz contre-la-montre" — solo survival quiz (1 player). The 60 s timer and
// scoring run client-side, but the QUESTIONS come from the server (single
// source of truth: reuses Speed Quiz's 150-question bank) so we don't duplicate
// the bank in the browser. The server picks a fresh shuffled subset at start
// and ships it once via serializeRound; sending `correct` is fine here because
// there is no opponent to cheat against. See public/games/quiz_solo.js.

const { QUESTION_BANK } = require("./quiz");
const POOL_SIZE = 40; // plenty for a 60 s run

function create() {
  let phase = "lobby";
  let questions = [];

  function pick() {
    const arr = QUESTION_BANK.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    questions = arr.slice(0, Math.min(POOL_SIZE, arr.length))
      .map((q) => ({ q: q.text, choices: q.options.slice(), correct: q.correct }));
  }

  return {
    phase: () => phase,
    onSelect: () => { phase = "lobby"; questions = []; },
    onStart: () => { pick(); phase = "playing"; },
    onAdvance: () => { if (phase === "lobby") { pick(); phase = "playing"; } },
    onReset: () => { phase = "lobby"; questions = []; },
    serializeRound: () => ({ solo: true, questions }),
    tick: () => false,
  };
}

module.exports = {
  id: "quiz_solo",
  name: "Quiz Contre-la-montre",
  emoji: "🔢",
  desc: "Solo : un max de bonnes réponses en 60 secondes.",
  create,
};
