// "Undercover" — everyone gets a secret word; the majority share one, 1-2
// undercovers get a close-but-different word. Vote out the imposter. Ported from
// esp32-hub/src/games/undercover.cpp. Roles/votes by name; word via serializePrivate.

const PAIRS = [
  { civ: "chien", uc: "chat" },
  { civ: "pomme", uc: "poire" },
  { civ: "plage", uc: "piscine" },
  { civ: "voiture", uc: "moto" },
  { civ: "hiver", uc: "automne" },
  { civ: "baguette", uc: "croissant" },
  { civ: "cafe", uc: "the" },
  { civ: "musique", uc: "podcast" },
  { civ: "livre", uc: "film" },
  { civ: "foret", uc: "montagne" },
  { civ: "violon", uc: "guitare" },
  { civ: "velo", uc: "trottinette" },
  { civ: "crayon", uc: "stylo" },
  { civ: "oiseau", uc: "chauve-souris" },
  { civ: "basketball", uc: "volleyball" },
  { civ: "camion", uc: "bus" },
  { civ: "ours", uc: "loup" },
  { civ: "requin", uc: "dauphin" },
  { civ: "sushi", uc: "pizza" },
  { civ: "jeux video", uc: "jeux de societe" },
  { civ: "chocolat", uc: "caramel" },
  { civ: "avion", uc: "helicoptere" },
  { civ: "pluie", uc: "neige" },
  { civ: "professeur", uc: "etudiant" },
  { civ: "telephone", uc: "tablette" },
];

function create() {
  let phase = "lobby";
  let wordCiv = "";
  let wordUc = "";
  let roles = {}; // name -> "civilian" | "undercover" (absent = spectator)
  let votes = {};
  let detectiveCount = {}; // name -> rounds where a civilian correctly voted an actual undercover

  const roleOf = (name) => roles[name] || "spectator";
  function clearRound(room) {
    roles = {}; votes = {};
    room.players.forEach((p) => { p.answered = false; p.answer = -1; });
  }
  function resetAll(room) { phase = "lobby"; wordCiv = ""; wordUc = ""; detectiveCount = {}; clearRound(room); }
  function topDetective() {
    let best = null;
    for (const n in detectiveCount) { if (!best || detectiveCount[n] > detectiveCount[best]) best = n; }
    return (best && detectiveCount[best] > 0) ? { name: best, count: detectiveCount[best] } : null;
  }
  function startRound(room) {
    const active = room.activePlayers();
    if (active.length < 3) return;
    clearRound(room);
    const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    if (Math.random() < 0.5) { wordCiv = pair.civ; wordUc = pair.uc; }
    else { wordCiv = pair.uc; wordUc = pair.civ; }
    const nUc = active.length >= 5 ? 2 : 1;
    active.forEach((p) => { roles[p.name] = "civilian"; });
    let picked = 0;
    while (picked < nUc) {
      const s = active[Math.floor(Math.random() * active.length)];
      if (roles[s.name] !== "undercover") { roles[s.name] = "undercover"; picked++; }
    }
    phase = "playing";
  }
  function participants(room) { return room.activePlayers().filter((p) => roleOf(p.name) !== "spectator"); }
  function allVoted(room) { const a = participants(room); return a.length > 0 && a.every((p) => p.answered); }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { startRound(room); },
    onAdvance: (room) => {
      if (phase === "lobby") startRound(room);
      else if (phase === "playing") phase = "reveal";
      else if (phase === "reveal") startRound(room);
      else resetAll(room);
    },
    onReset: resetAll,
    onEndSession: () => { if (phase !== "lobby") phase = "finished"; },
    // Mid-round joiners stay spectators — auto-promoting them would leak the
    // secret word to anyone who joins after the round starts.
    onPlayerLeave: (room) => { if (phase === "playing" && allVoted(room)) phase = "reveal"; },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || p.answered) return;
      if (msg.t !== "vote") return;
      const target = room.players.get(String(msg.target_id || "").toLowerCase());
      if (!target || roleOf(target.name) === "spectator") return;
      p.answered = true;
      votes[target.name] = (votes[target.name] || 0) + 1;
      // A civilian voting an actual undercover is a correct deduction.
      if (roleOf(p.name) === "civilian" && roleOf(target.name) === "undercover") {
        detectiveCount[p.name] = (detectiveCount[p.name] || 0) + 1;
      }
      if (allVoted(room)) phase = "reveal";
    },
    serializeRound: (room) => {
      const r = {};
      if (phase === "lobby") return r;
      if (phase === "playing") {
        r.answered = participants(room).filter((p) => p.answered).length;
      }
      if (phase === "reveal") {
        const entries = [...room.players.values()].filter((p) => p.name && roleOf(p.name) !== "spectator");
        let max = 0;
        r.votes = entries.map((p) => {
          const c = votes[p.name] || 0;
          if (c > max) max = c;
          return { name: p.name, count: c };
        });
        const undercovers = entries.filter((p) => roleOf(p.name) === "undercover").map((p) => p.name);
        let civiliansWin = undercovers.length > 0;
        undercovers.forEach((n) => { if ((votes[n] || 0) < max || max === 0) civiliansWin = false; });
        r.undercovers = undercovers;
        r.word_civ = wordCiv;
        r.word_uc = wordUc;
        r.winner = civiliansWin ? "civilians" : "undercover";
      }
      if (phase === "finished") {
        const t = topDetective();
        if (t) r.mvp = { label: "Meilleur détective", emoji: "🕵️", name: t.name, value: t.count + " intrus démasqué" + (t.count > 1 ? "s" : "") };
      }
      return r;
    },
    serializePrivate: (room, viewer) => {
      if (!viewer || phase === "lobby") return {};
      const role = roleOf(viewer.name);
      if (role === "spectator") return { role: "spectator" };
      return { role: role, word: role === "undercover" ? wordUc : wordCiv };
    },
    tick: () => false,
  };
}

module.exports = {
  id: "undercover",
  name: "Undercover",
  emoji: "🕵️",
  desc: "Mot secret different pour l'intrus. Trouvez-le ! (3 joueurs min)",
  create,
};
