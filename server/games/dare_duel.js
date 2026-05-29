// "Cap ou pas cap" (dare_duel) — a dare is shown to the active player (rotating);
// they tap Cap 😎 (they do it) or Pas cap 🍺 (they drink). Reveal shows the
// choice + a running tally. Loop game, host-endable. 3 escalating levels; the
// level rises every few rounds (soft → osé). Server is authoritative.

const DARES = {
  1: [
    "Imite l'accent d'une région pendant 30 secondes",
    "Fais ta meilleure imitation d'un animal",
    "Chante le refrain de la dernière chanson que tu as écoutée",
    "Parle uniquement en chuchotant jusqu'à ton prochain tour",
    "Fais un compliment sincère à la personne à ta droite",
    "Raconte une blague (même nulle)",
    "Mime ton métier sans parler, les autres devinent",
    "Fais 10 pompes (ou 5, soyons sympas)",
    "Prends la pose la plus dramatique possible pour une photo",
    "Dis l'alphabet à l'envers le plus vite possible",
    "Fais semblant de pleurer de joie pendant 15 secondes",
    "Danse sans musique pendant 20 secondes",
    "Parle comme un présentateur télé jusqu'au prochain tour",
    "Fais un câlin à la personne la plus proche",
    "Invente un slogan pour une marque de chaussettes",
  ],
  2: [
    "Montre la dernière photo de ta galerie (sans filtrer)",
    "Lis ton dernier SMS envoyé à voix haute",
    "Imite quelqu'un dans la pièce, les autres devinent qui",
    "Raconte ton pire rendez-vous galant",
    "Appelle un proche et chante-lui « Joyeux anniversaire »",
    "Montre tes recherches récentes sur ton navigateur",
    "Fais une déclaration d'amour à un objet de la pièce",
    "Envoie un emoji au hasard à la 5e personne de tes contacts",
    "Raconte un truc gênant qui t'est arrivé cette année",
    "Prends un selfie avec la grimace la plus moche",
    "Parle de toi à la 3e personne pendant 3 tours",
    "Mange/bois un truc choisi par le groupe",
    "Fais ton rire le plus diabolique au signal de chacun",
    "Donne ton avis honnête sur la tenue de ton voisin",
  ],
  3: [
    "Laisse la personne à ta gauche poster un statut sur ton réseau",
    "Révèle le dernier mensonge que tu as dit",
    "Raconte ton plus gros fou rire en soirée",
    "Imite la façon de parler de chaque personne présente",
    "Avoue un truc que personne ici ne sait sur toi",
    "Montre ta playlist la plus honteuse",
    "Fais un discours improvisé de 30 s pour défendre une cause absurde",
    "Raconte la chose la plus embarrassante de ton ado",
    "Envoie « je pense à toi » à un contact tiré au sort par le groupe",
    "Décris ton crush sans dire son nom, on devine",
    "Échange un vêtement avec quelqu'un jusqu'au prochain tour",
    "Fais deviner ton dernier achat inutile",
  ],
};

function create() {
  let phase = "lobby";      // lobby | playing | reveal | finished
  let roundN = 0;
  let activeName = null;
  let dareText = "";
  let level = 1;
  let lastDare = {};        // level -> last index (avoid immediate repeat)
  let choice = {};          // current round: name -> "cap"|"nope"  (here only activeName)
  let capCount = {};        // name -> total "cap" this session
  let nopeCount = {};       // name -> total "nope" this session

  function levelForRound(n) { return Math.min(3, 1 + Math.floor((n - 1) / 4)); }
  function pickDare(lv) {
    const bank = DARES[lv] || DARES[1];
    let i;
    do { i = Math.floor(Math.random() * bank.length); } while (bank.length > 1 && i === lastDare[lv]);
    lastDare[lv] = i;
    return bank[i];
  }
  function nextActive(room) {
    const a = room.activePlayers();
    if (!a.length) return null;
    if (!activeName) return a[0].name;
    const idx = a.findIndex((p) => p.name === activeName);
    return a[(idx + 1) % a.length].name;
  }
  function startRound(room) {
    const a = room.activePlayers();
    if (!a.length) { phase = "lobby"; return; }
    roundN++;
    activeName = nextActive(room);
    level = levelForRound(roundN);
    dareText = pickDare(level);
    choice = {};
    room.players.forEach((p) => { p.answered = false; });
    phase = "playing";
  }
  function resetAll() {
    phase = "lobby"; roundN = 0; activeName = null; dareText = ""; level = 1;
    lastDare = {}; choice = {}; capCount = {}; nopeCount = {};
  }
  function topCap(room) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const n in capCount) {
      if (!present.has(n)) continue;
      if (!best || capCount[n] > capCount[best]) best = n;
    }
    return (best && capCount[best] > 0) ? { name: best, count: capCount[best] } : null;
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { resetAll(); startRound(room); },
    onAdvance: (room) => {
      if (phase === "lobby") { resetAll(); startRound(room); }
      else if (phase === "playing") { phase = "reveal"; } // host forces reveal even if undecided
      else if (phase === "reveal") { startRound(room); }
      else { resetAll(); }
    },
    onReset: resetAll,
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onPlayerLeave: (room, p) => {
      if (phase === "playing" && p && p.name === activeName) {
        // Active player bailed mid-dare: just move on to the next round.
        startRound(room);
      }
    },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || msg.t !== "answer") return;
      if (p.name !== activeName) return;        // only the active player decides
      const v = msg.v === "cap" ? "cap" : (msg.v === "nope" ? "nope" : null);
      if (!v || p.answered) return;
      p.answered = true;
      choice[p.name] = v;
      if (v === "cap") capCount[p.name] = (capCount[p.name] || 0) + 1;
      else nopeCount[p.name] = (nopeCount[p.name] || 0) + 1;
      phase = "reveal";
    },
    serializeRound: (room) => {
      const r = {};
      if (phase === "lobby") return r;
      r.round_n = roundN; r.level = level;
      r.dare = dareText;
      if (activeName) { r.active_id = activeName; r.active_name = activeName; }
      if (phase === "reveal") {
        r.choice = Object.assign({}, choice);
      }
      // Running tally is public throughout (no secret).
      const cap = Object.values(capCount).reduce((a, b) => a + b, 0);
      const nope = Object.values(nopeCount).reduce((a, b) => a + b, 0);
      r.tally = { cap, nope };
      if (phase === "finished") {
        const t = topCap(room);
        if (t) r.mvp = { label: "Le plus cap", emoji: "😎", name: t.name, value: t.count + " défi" + (t.count > 1 ? "s" : "") + " relevé" + (t.count > 1 ? "s" : "") };
      }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "dare_duel",
  name: "Cap ou pas cap",
  emoji: "😏",
  desc: "Un défi s'affiche : Cap (tu le fais) ou Pas cap (tu bois) ?",
  create,
};
