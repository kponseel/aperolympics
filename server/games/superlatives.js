// "Superlatifs" — secret vote by category. Ported from
// esp32-hub/src/games/superlatives.cpp. Same shape as most_likely; different bank.

const PROMPTS = [
  "Le/la plus drole du groupe",
  "Le/la plus drama queen",
  "Le/la plus susceptible de devenir celebre",
  "Le/la meilleur(e) cuisinier(e)",
  "Le/la plus voyageur(e)",
  "Le/la plus style(e)",
  "Le/la plus organise(e)",
  "Le/la plus probable d'avoir un chat plus tard",
  "Le/la plus probable de courir un marathon",
  "Le/la plus probable de monter une startup",
  "Le/la plus loyal(e)",
  "Le/la plus chaotique en soiree",
  "Le/la plus calin(e)",
  "Le/la plus accro a son tel",
  "Le/la plus tete-en-l'air",
  "Le/la plus sportif/ive",
  "Le/la plus rapide pour repondre a un message",
  "Le/la plus susceptible de t'aider a 3h du matin",
  "Le/la plus mauvais(e) menteur/se",
  "Le/la plus prevenant(e)",
  "Le/la plus fanatique d'un sujet bizarre",
  "Le/la plus susceptible de finir en politique",
  "Le/la roi/reine des memes",
  "Le/la plus difficile a reveiller",
  "Le/la plus apte a survivre en pleine nature",
];

function create() {
  let phase = "lobby";
  let currentIdx = -1;
  let votes = {}; // canonical target name -> vote count

  function clearRound(room) {
    votes = {};
    room.players.forEach((p) => { p.answered = false; p.answer = -1; });
  }
  function startRound(room, idx) { currentIdx = idx; phase = "playing"; clearRound(room); }
  function allVoted(room) { const a = room.activePlayers(); return a.length > 0 && a.every((p) => p.answered); }
  function resetAll(room) { phase = "lobby"; currentIdx = -1; clearRound(room); }

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
  id: "superlatives",
  name: "Superlatifs",
  emoji: "🏆",
  desc: "Vote secret : qui est le/la plus X du groupe ?",
  create,
};
