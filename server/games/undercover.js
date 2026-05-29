// "Undercover" — everyone gets a secret word; the majority share one, 1-2
// undercovers get a close-but-different word. Vote out the imposter. Ported from
// esp32-hub/src/games/undercover.cpp. Roles/votes by name; word via serializePrivate.

const PAIRS = [
  // Original 25 head (kept stable for deterministic tests).
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
  // +50 nouvelles paires
  { civ: "soleil", uc: "lune" },
  { civ: "fraise", uc: "framboise" },
  { civ: "vin", uc: "biere" },
  { civ: "tasse", uc: "mug" },
  { civ: "chaussure", uc: "botte" },
  { civ: "pull", uc: "veste" },
  { civ: "frigo", uc: "congelateur" },
  { civ: "lit", uc: "canape" },
  { civ: "fauteuil", uc: "tabouret" },
  { civ: "couteau", uc: "fourchette" },
  { civ: "rue", uc: "boulevard" },
  { civ: "metro", uc: "tramway" },
  { civ: "boulanger", uc: "patissier" },
  { civ: "medecin", uc: "infirmier" },
  { civ: "pilote", uc: "chauffeur" },
  { civ: "acteur", uc: "chanteur" },
  { civ: "musee", uc: "galerie" },
  { civ: "park", uc: "jardin" },
  { civ: "lac", uc: "etang" },
  { civ: "fleuve", uc: "riviere" },
  { civ: "canard", uc: "oie" },
  { civ: "lion", uc: "tigre" },
  { civ: "chemise", uc: "tshirt" },
  { civ: "jupe", uc: "robe" },
  { civ: "casquette", uc: "bonnet" },
  { civ: "miel", uc: "sirop d'erable" },
  { civ: "yaourt", uc: "fromage blanc" },
  { civ: "spaghetti", uc: "tagliatelle" },
  { civ: "riz", uc: "quinoa" },
  { civ: "tomate", uc: "poivron" },
  { civ: "courgette", uc: "concombre" },
  { civ: "guitare electrique", uc: "guitare acoustique" },
  { civ: "piano", uc: "clavier" },
  { civ: "batterie", uc: "djembe" },
  { civ: "judo", uc: "karate" },
  { civ: "tennis", uc: "padel" },
  { civ: "football", uc: "rugby" },
  { civ: "skate", uc: "rollers" },
  { civ: "snowboard", uc: "ski" },
  { civ: "kayak", uc: "canoe" },
  { civ: "navette", uc: "ferry" },
  { civ: "ordinateur", uc: "tablette" },
  { civ: "ecouteurs", uc: "casque audio" },
  { civ: "lunettes", uc: "monocle" },
  { civ: "montre", uc: "bracelet" },
  { civ: "valise", uc: "sac a dos" },
  { civ: "tente", uc: "caravane" },
  { civ: "carte postale", uc: "lettre" },
  { civ: "souris", uc: "rat" },
  { civ: "lapin", uc: "lievre" },
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
  function topDetective(room) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const n in detectiveCount) {
      if (!present.has(n)) continue;
      if (!best || detectiveCount[n] > detectiveCount[best]) best = n;
    }
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
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    // Mid-round joiners stay spectators — auto-promoting them would leak the
    // secret word to anyone who joins after the round starts.
    onPlayerLeave: (room) => { if (phase === "playing" && allVoted(room)) phase = "reveal"; },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || p.answered) return;
      if (msg.t !== "vote") return;
      const target = room.players.get(String(msg.target_id || "").toLowerCase());
      // Reject spectators (joined mid-round) and players who already left.
      if (!target || roleOf(target.name) === "spectator" || !target.active) return;
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
        const t = topDetective(room);
        // Distinct from spyfall's "Meilleur détective" so a player who plays
        // both games in a session sees two distinct trophies, not the same one.
        if (t) r.mvp = { label: "Meilleur démasqueur", emoji: "🕵️", name: t.name, value: t.count + " intrus démasqué" + (t.count > 1 ? "s" : "") };
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
  desc: "Mot secret différent pour l'intrus — 75 paires. Trouvez-le ! (3 joueurs min)",
  create,
};
