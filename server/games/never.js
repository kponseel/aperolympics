// "Je n'ai jamais" — anonymous binary vote (have / never). Ported from
// esp32-hub/src/games/never.cpp. answer: 0 = "J'ai deja", 1 = "Jamais".

const PROMPTS = [
  "Je n'ai jamais fume une cigarette",
  "Je n'ai jamais menti a un parent",
  "Je n'ai jamais saute un cours",
  "Je n'ai jamais chante en public sobre",
  "Je n'ai jamais oublie un anniversaire important",
  "Je n'ai jamais envoye un message a la mauvaise personne",
  "Je n'ai jamais pleure devant un film d'animation",
  "Je n'ai jamais danse seul devant un miroir",
  "Je n'ai jamais menti sur mon age",
  "Je n'ai jamais fait semblant d'etre malade pour eviter quelque chose",
  "Je n'ai jamais google mon propre nom",
  "Je n'ai jamais embrasse quelqu'un que je connaissais a peine",
  "Je n'ai jamais oublie de souhaiter un anniversaire et fait semblant de m'en souvenir",
  "Je n'ai jamais menti sur mon CV",
  "Je n'ai jamais regarde 3 episodes de serie d'affilee a 3h du matin",
  "Je n'ai jamais fait semblant de connaitre une chanson en chantant 'na na na'",
  "Je n'ai jamais conduit sans permis",
  "Je n'ai jamais fait semblant d'avoir lu un livre celebre",
  "Je n'ai jamais reve d'un(e) collegue/camarade",
  "Je n'ai jamais lu les CGU avant d'accepter",
  "Je n'ai jamais pirate un film ou une serie",
  "Je n'ai jamais menti pour eviter d'aller a une fete",
  "Je n'ai jamais blame un pet sur quelqu'un d'autre",
  "Je n'ai jamais fait pipi dans la piscine",
  "Je n'ai jamais danse sur une table",
];

function create() {
  let phase = "lobby";
  let currentIdx = -1;

  function clearRound(room) { room.players.forEach((p) => { p.answered = false; p.answer = -1; }); }
  function startRound(room, idx) { currentIdx = idx; phase = "playing"; clearRound(room); }
  function allVoted(room) { const a = room.activePlayers(); return a.length > 0 && a.every((p) => p.answered); }
  function countWith(room, which) {
    let n = 0;
    room.players.forEach((p) => { if (p.name && p.answered && p.answer === which) n++; });
    return n;
  }
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
      if (msg.t !== "answer") return;
      const v = msg.value;
      if (v !== 0 && v !== 1) return;
      p.answered = true;
      p.answer = v;
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
        r.have = countWith(room, 0);
        r.never = countWith(room, 1);
      }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "never",
  name: "Je n'ai jamais",
  emoji: "🙊",
  desc: "Anonyme : j'ai deja ou jamais ? On voit le score.",
  create,
};
