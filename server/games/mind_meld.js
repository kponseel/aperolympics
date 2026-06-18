// "Le Convergent" (mind_meld) — everyone secretly types one word for a theme;
// on reveal, identical words (normalised) are matches → télépathie. Loop game:
// the host advances themes and can end the session (🏁). Same hook shape as
// never.js. Server is authoritative; words stay hidden until reveal.

const THEMES = [
  "un fruit", "un animal", "une couleur", "un pays", "une ville",
  "un prénom", "un métier", "une boisson", "un plat", "un sport",
  "une marque de voiture", "un super-héros", "un film culte", "une série",
  "un instrument de musique", "un légume", "un dessert", "une partie du corps",
  "un jour de la semaine", "un mois", "un nombre entre 1 et 10", "une planète",
  "un personnage de dessin animé", "une émotion", "un objet dans ton sac",
  "un truc dans une cuisine", "un animal de la ferme", "une fleur",
  "un moyen de transport", "un vêtement", "une saison", "un réseau social",
  "une appli sur ton téléphone", "un jeu de société", "un style de musique",
  "un pays où tu rêves d'aller", "une langue", "un héros d'enfance",
  "une mauvaise excuse pour être en retard", "un truc qu'on regrette le lendemain",
  "un truc qu'on a déjà fait bourré", "une habitude agaçante", "un cliché de soirée",
  "un mensonge classique", "le pire cadeau possible", "une phrase de drague ratée",
  "un truc qu'on cherche toujours", "une corvée qu'on déteste", "un plaisir coupable",
  "un truc qu'on dit quand on ment", "une peur irrationnelle", "un surnom ridicule",
  "un truc qui pue", "un bruit agaçant", "une manie au volant",
  "un truc qu'on garde « au cas où »", "une réplique de film", "un juron soft",
  "un truc qu'on poste jamais", "une chanson qu'on connaît par cœur",
];

function normalize(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase().trim().replace(/\s+/g, " ");
}

function create() {
  let phase = "lobby";       // lobby | playing | reveal | finished
  let order = [];            // shuffled theme indices for this session
  let pos = -1;              // index into `order`
  let words = {};            // name -> raw word (current round)
  let connectCount = {};     // name -> times in a match group (session MVP)

  function shuffleThemes() {
    order = THEMES.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
    pos = -1;
  }
  function clearRound(room) { words = {}; room.players.forEach((p) => { p.answered = false; }); }
  function startRound(room) {
    if (!order.length) shuffleThemes();
    pos++;
    if (pos >= order.length) { phase = "finished"; return; }
    phase = "playing"; clearRound(room);
  }
  function allAnswered(room) { const a = room.activePlayers(); return a.length > 0 && a.every((p) => p.answered); }

  // Group current words by normalised value; any group with 2+ distinct
  // players is a "match". Returns array of name-arrays.
  function computeMatches() {
    const byNorm = {};
    Object.keys(words).forEach((name) => {
      const n = normalize(words[name]);
      if (!n) return;
      (byNorm[n] = byNorm[n] || []).push(name);
    });
    return Object.keys(byNorm).map((n) => byNorm[n]).filter((g) => g.length >= 2);
  }
  function tallyConnections() {
    computeMatches().forEach((group) => group.forEach((name) => { connectCount[name] = (connectCount[name] || 0) + 1; }));
  }
  function toReveal(room) { if (phase !== "playing") return; phase = "reveal"; tallyConnections(); }

  function resetAll(room) { phase = "lobby"; order = []; pos = -1; words = {}; connectCount = {}; clearRound(room); }

  function topConnected(room) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const n in connectCount) {
      if (!present.has(n)) continue;
      if (!best || connectCount[n] > connectCount[best]) best = n;
    }
    return (best && connectCount[best] > 0) ? { name: best, count: connectCount[best] } : null;
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { shuffleThemes(); startRound(room); },
    onAdvance: (room) => {
      if (phase === "lobby") { shuffleThemes(); startRound(room); }
      else if (phase === "playing") { toReveal(room); }
      else if (phase === "reveal") { startRound(room); }
      else { resetAll(room); }
    },
    onReset: resetAll,
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onPlayerLeave: (room) => { if (phase === "playing" && allAnswered(room)) toReveal(room); },
    onMessage: (room, p, msg) => {
      if (!p || !p.name || phase !== "playing" || msg.t !== "submit") return;
      if (p.answered) return;
      let text = String(msg.word == null ? "" : msg.word).trim().slice(0, 24);
      if (!text) return;
      words[p.name] = text;
      p.answered = true;
      if (allAnswered(room)) toReveal(room);
    },
    serializeRound: (room) => {
      const r = { total: THEMES.length };
      if (phase === "lobby") return r;
      r.idx = pos;
      r.theme = (pos >= 0 && pos < order.length) ? THEMES[order[pos]] : "";
      if (phase === "playing") {
        const submitted = {};
        room.activePlayers().forEach((p) => { if (p.answered) submitted[p.name] = true; });
        r.submitted = submitted;
        r.answered = room.activePlayers().filter((p) => p.answered).length;
      } else if (phase === "reveal") {
        r.words = Object.assign({}, words);
        r.matches = computeMatches();
      } else if (phase === "finished") {
        const t = topConnected(room);
        if (t) r.mvp = { label: "Le plus connecté", emoji: "🤝", name: t.name, value: t.count + " télépathie" + (t.count > 1 ? "s" : "") };
      }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "mind_meld",
  name: "Le Convergent",
  emoji: "🤝",
  desc: "Pensez au même mot ! Télépathie validée = vous trinquez.",
  create,
};
