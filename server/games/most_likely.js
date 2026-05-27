// "Le plus susceptible" — secret vote. Ported from esp32-hub/src/games/most_likely.cpp.
//
// Each round everyone secretly votes for a target player; the reveal shows the
// tally. Same hook shape as quiz.js. Server is authoritative.

const PROMPTS = [
  "Qui est le plus susceptible de chanter au karaoke ?",
  "Qui est le plus susceptible d'oublier son anniversaire ?",
  "Qui est le plus susceptible de finir milliardaire ?",
  "Qui est le plus susceptible de devenir prof ?",
  "Qui est le plus susceptible de partir vivre a l'etranger ?",
  "Qui est le plus susceptible de finir le frigo a 3h du matin ?",
  "Qui est le plus susceptible de pleurer devant un Disney ?",
  "Qui est le plus susceptible d'envoyer un message a son ex ?",
  "Qui est le plus susceptible de se perdre dans son propre quartier ?",
  "Qui est le plus susceptible de rater son train ?",
  "Qui est le plus susceptible de tomber amoureux/se en vacances ?",
  "Qui est le plus susceptible de finir sur scene un jour ?",
  "Qui est le plus susceptible de mentir sur son age ?",
  "Qui est le plus susceptible d'oublier son tel quelque part ?",
  "Qui est le plus susceptible de gagner au loto et tout depenser ?",
  "Qui est le plus susceptible de devenir vegan ?",
  "Qui est le plus susceptible de se faire arnaquer en ligne ?",
  "Qui est le plus susceptible de finir tatoueur ?",
  "Qui est le plus susceptible d'avoir 5 enfants ?",
  "Qui est le plus susceptible de divorcer 3 fois ?",
  "Qui est le plus susceptible de passer un Noel seul a l'autre bout du monde ?",
  "Qui est le plus susceptible de devenir influenceur/euse ?",
  "Qui est le plus susceptible de se reveiller en retard a son mariage ?",
  "Qui est le plus susceptible de finir avec un emploi bizarre (testeur de matelas, mascotte) ?",
  "Qui est le plus susceptible de croire encore au pere Noel a 30 ans ?",
];

function create() {
  let phase = "lobby";
  let currentIdx = -1;
  let votes = {}; // canonical target name -> vote count

  function clearRound(room) {
    votes = {};
    room.players.forEach((p) => { p.answered = false; p.answer = -1; });
  }
  function startRound(room, idx) {
    currentIdx = idx;
    phase = "playing";
    clearRound(room);
  }
  function allVoted(room) {
    const a = room.activePlayers();
    return a.length > 0 && a.every((p) => p.answered);
  }
  function resetAll(room) {
    phase = "lobby";
    currentIdx = -1;
    clearRound(room);
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { if (PROMPTS.length) startRound(room, 0); },
    onAdvance: (room) => {
      if (phase === "lobby") { if (PROMPTS.length) startRound(room, 0); }
      else if (phase === "playing") { phase = "reveal"; }
      else if (phase === "reveal") {
        if (currentIdx + 1 < PROMPTS.length) startRound(room, currentIdx + 1);
        else phase = "finished";
      } else { resetAll(room); }
    },
    onReset: resetAll,
    onPlayerLeave: (room) => { if (phase === "playing" && allVoted(room)) phase = "reveal"; },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || p.answered) return;
      if (msg.t !== "vote") return;
      const target = room.players.get(String(msg.target_id || "").toLowerCase());
      if (!target || !target.name) return;
      p.answered = true;
      votes[target.name] = (votes[target.name] || 0) + 1;
      if (allVoted(room)) phase = "reveal";
    },
    serializeRound: (room) => {
      const r = { total: PROMPTS.length };
      if (currentIdx < 0) return r;
      r.idx = currentIdx;
      if (phase === "playing" || phase === "reveal") {
        r.prompt = PROMPTS[currentIdx];
        r.answered = room.activePlayers().filter((p) => p.answered).length;
      }
      if (phase === "reveal") {
        r.votes = Object.keys(votes)
          .filter((name) => votes[name] > 0)
          .map((name) => ({ name: name, count: votes[name] }));
      }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "most_likely",
  name: "Le plus susceptible",
  emoji: "😈",
  desc: "Vote secret : qui est le plus susceptible de... ?",
  create,
};
