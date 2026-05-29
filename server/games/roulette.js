// "Roulette russe (soft)" — solo / pass-the-phone party game (1 player). The
// randomness lives client-side; the server only holds a phase so the
// hub → lobby → game-area flow works. See public/games/roulette.js.

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
  id: "roulette",
  name: "Roulette russe",
  emoji: "🎯",
  desc: "Solo : 6 chambres, une piégée. Tu tentes ta chance ?",
  create,
};
