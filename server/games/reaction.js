// "Réflexe" — solo skill game (1 player). 100 % client-side: the server only
// holds a phase so the hub → lobby → game-area flow works. There is no shared
// round state and no winner; each player runs their own attempts locally and
// keeps a personal best in localStorage. See public/games/reaction.js.

function create() {
  let phase = "lobby"; // lobby -> playing (stays; client owns the rest)
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
  id: "reaction",
  name: "Réflexe",
  emoji: "⚡",
  desc: "Solo : tape dès que l'écran passe au vert.",
  create,
};
