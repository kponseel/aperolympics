// "Tu preferes" — binary A/B vote with live tally. Ported from
// esp32-hub/src/games/would_rather.cpp.

const PROMPTS = [
  { a: "Pouvoir voler", b: "Pouvoir lire dans les pensees" },
  { a: "Pizza pour le restant de tes jours", b: "Plus jamais de fromage" },
  { a: "Vivre en ville", b: "Vivre a la campagne" },
  { a: "Trop chaud", b: "Trop froid" },
  { a: "Voir le futur", b: "Voir le passe" },
  { a: "Etre invisible", b: "Pouvoir devenir tres grand" },
  { a: "Vivre dans le passe", b: "Vivre dans le futur" },
  { a: "Voyager sans bagage", b: "Toujours en avoir trop" },
  { a: "Cuisiner pour 20", b: "Manger toujours seul" },
  { a: "Pouvoir parler toutes les langues", b: "Pouvoir parler aux animaux" },
  { a: "Plus jamais de cafe", b: "Plus jamais de chocolat" },
  { a: "Mer", b: "Montagne" },
  { a: "Chat", b: "Chien" },
  { a: "Etre celebre", b: "Etre riche anonyme" },
  { a: "Perdre tes photos", b: "Perdre tes contacts" },
  { a: "Lire toutes les pensees autour", b: "Que tout le monde lise les tiennes" },
  { a: "Vacances eternelles sans amis", b: "Boulot ideal entoure d'amis" },
  { a: "Pas de telephone pendant 1 an", b: "Pas de TV/streaming pendant 1 an" },
  { a: "Vivre dans une mega-ville", b: "Vivre sur une ile deserte" },
  { a: "Etre l'expert mondial d'un sujet inutile", b: "Etre moyen sur tout" },
  { a: "Eternellement 5 ans", b: "Eternellement 70 ans" },
  { a: "Voir tes amis 1 fois par mois", b: "Vivre avec eux H24" },
  { a: "Marcher 5km tous les jours", b: "Manger fade tous les jours" },
  { a: "Toujours dire la verite", b: "Ne plus jamais mentir mais ne pas savoir te taire" },
  { a: "Connaitre le jour de ta mort", b: "Connaitre la cause" },
];

function create() {
  let phase = "lobby";
  let currentIdx = -1;
  let alignedCount = {}; // name -> rounds voted with the majority side

  function clearRound(room) { room.players.forEach((p) => { p.answered = false; p.answer = -1; }); }
  function startRound(room, idx) { currentIdx = idx; phase = "playing"; clearRound(room); }
  function allVoted(room) { const a = room.activePlayers(); return a.length > 0 && a.every((p) => p.answered); }
  function countWith(room, which) {
    let n = 0;
    room.players.forEach((p) => { if (p.name && p.answered && p.answer === which) n++; });
    return n;
  }
  // Credit each voter who picked the majority side; ties credit no-one.
  function tallyRound(room) {
    const a = countWith(room, 0), b = countWith(room, 1);
    if (a === b) return;
    const winSide = a > b ? 0 : 1;
    room.players.forEach((p) => {
      if (p.name && p.answered && p.answer === winSide) alignedCount[p.name] = (alignedCount[p.name] || 0) + 1;
    });
  }
  function toReveal(room) { phase = "reveal"; tallyRound(room); }
  function resetAll(room) { phase = "lobby"; currentIdx = -1; alignedCount = {}; clearRound(room); }
  function topAligned() {
    let best = null;
    for (const name in alignedCount) { if (!best || alignedCount[name] > alignedCount[best]) best = name; }
    return best ? { name: best, count: alignedCount[best] } : null;
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { if (PROMPTS.length) startRound(room, 0); },
    onAdvance: (room) => {
      if (phase === "lobby") { if (PROMPTS.length) startRound(room, 0); }
      else if (phase === "playing") { toReveal(room); }
      else if (phase === "reveal") {
        if (currentIdx + 1 < PROMPTS.length) startRound(room, currentIdx + 1);
        else phase = "finished";
      } else { resetAll(room); }
    },
    onReset: resetAll,
    onPlayerLeave: (room) => { if (phase === "playing" && allVoted(room)) toReveal(room); },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || p.answered) return;
      if (msg.t !== "answer") return;
      const v = msg.value;
      if (v !== 0 && v !== 1) return;
      p.answered = true;
      p.answer = v;
      if (allVoted(room)) toReveal(room);
    },
    serializeRound: (room) => {
      const r = { total: PROMPTS.length };
      if (currentIdx < 0) return r;
      r.idx = currentIdx;
      if (phase === "playing" || phase === "reveal") {
        r.a = PROMPTS[currentIdx].a;
        r.b = PROMPTS[currentIdx].b;
        r.answered = room.activePlayers().filter((p) => p.answered).length;
      }
      if (phase === "reveal") {
        r.count_a = countWith(room, 0);
        r.count_b = countWith(room, 1);
      }
      if (phase === "finished") {
        const t = topAligned();
        if (t) r.mvp = { label: "Le plus aligné avec la majorité", emoji: "⚖️", name: t.name, value: t.count + " fois" };
      }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "would_rather",
  name: "Tu preferes",
  emoji: "⚖️",
  desc: "Dilemmes a deux options, vote en direct.",
  create,
};
