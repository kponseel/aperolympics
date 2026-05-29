// "Mémoire / Simon" — solo skill game (1 player). 100 % client-side: the
// server only holds a phase. Sequence/scoring/audio all live in the client;
// personal best is kept in localStorage. See public/games/simon.js.

function create() {
  let phase = "lobby";
  return {
    phase: () => phase,
    onSelect: () => { phase = "lobby"; },
    onStart: () => { phase = "playing"; },
    onAdvance: () => { if (phase === "lobby") phase = "playing"; },
    onReset: () => { phase = "lobby"; },
    serializeRound: () => ({ solo: true }),
    tick: () => false,
  };
}

module.exports = {
  id: "simon",
  name: "Simon",
  emoji: "🧩",
  desc: "Solo : mémorise la séquence de couleurs qui s'allonge.",
  create,
};
