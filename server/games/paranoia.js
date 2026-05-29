// "Paranoia" — one player gets a PRIVATE question, points at someone; a coin
// flip decides whether the question is revealed to the room. Ported from
// esp32-hub/src/games/paranoia.cpp. Whisperer/accused identity = player name.

const PROMPTS = [
  // Original 25 head (kept stable for deterministic tests).
  "Qui dans le groupe a le pire gout musical ?",
  "Avec qui partirais-tu en road-trip sans hesiter ?",
  "Qui ferait le pire colocataire ?",
  "Qui te raconte les meilleures histoires ?",
  "Avec qui voudrais-tu echanger ta vie pour un jour ?",
  "Qui est secretement le plus competitif ?",
  "Qui peut le moins garder un secret ?",
  "Qui dans le groupe est ton acolyte ideal pour un mauvais coup ?",
  "Qui prendrais-tu en premier dans une equipe de quiz ?",
  "Qui a le plus de chance de devenir riche ?",
  "Avec qui passerais-tu un weekend sur une ile deserte ?",
  "Qui ferait le meilleur DJ de soiree ?",
  "Qui dans le groupe est le plus mauvais perdant ?",
  "Avec qui ferais-tu equipe pour braquer une banque (hypothetique) ?",
  "Qui est le plus susceptible de finir prof de yoga ?",
  "Qui as-tu le plus envie de connaitre mieux ?",
  "Qui ferait le meilleur partenaire d'escape game ?",
  "Qui dirait le plus de betises sous l'effet de la fatigue ?",
  "Qui pleure le plus facilement (en bien ou en mal) ?",
  "Qui as-tu le plus de mal a contredire ?",
  "Qui ferait le meilleur baby-sitter ?",
  "Qui te ferait le moins confiance pour cacher un cadeau de surprise ?",
  "Qui dans le groupe est le plus genereux ?",
  "Qui ferait le pire prof particulier ?",
  "Qui aurait le plus de followers sur TikTok si il/elle s'y mettait serieusement ?",
  // +60 nouveaux prompts
  "Qui ferait l'épouse/époux le plus exigeant ?",
  "Avec qui aimerais-tu monter un projet pro ?",
  "Qui ferait le meilleur coach de vie ?",
  "Qui te confierait son code de carte sans hésiter ?",
  "Qui est le plus susceptible d'avoir une double vie ?",
  "Qui dans le groupe pleurerait au moment du discours de mariage ?",
  "Qui ferait le meilleur ambassadeur de la France à l'étranger ?",
  "Qui est secrètement le/la plus stylé(e) du groupe ?",
  "Qui te ferait le meilleur cadeau d'anniversaire ?",
  "Qui te ferait le pire cadeau d'anniversaire ?",
  "Qui te paraît le/la plus chaotique en couple ?",
  "Qui dans le groupe assumerait le mieux d'être nu(e) sur une plage ?",
  "Qui finirait par tout dire après 2 verres ?",
  "Qui te connaît le mieux sans être ton/ta meilleur·e ami·e ?",
  "Qui ferait le meilleur enquêteur dans un Cluedo grandeur nature ?",
  "Avec qui partirais-tu vivre dans une cabane 1 an ?",
  "Qui ferait le pire colocataire matinal ?",
  "Qui pourrait te trouver un job en 24 h ?",
  "Qui rirait le plus fort si tu glissais en public ?",
  "Qui t'enverrait un meme à 4 h du matin ?",
  "Qui prendrait le plus de selfies à un mariage ?",
  "Qui ferait le meilleur faux médecin sur LinkedIn ?",
  "Qui te défendrait sans hésiter face à un inconnu ?",
  "Avec qui aimerais-tu cuisiner un repas dégueulasse pour le fun ?",
  "Avec qui partirais-tu en mode aventure backpack ?",
  "Qui ferait le meilleur coach de remise en forme ?",
  "Qui finirait par danser sur une table ce soir ?",
  "Avec qui ferais-tu équipe pour un quiz télé ?",
  "Qui dans le groupe est le/la plus mystérieux/se ?",
  "Qui te raconterait les pires anecdotes croustillantes ?",
  "Qui ferait le pire prof de yoga ?",
  "Qui te répondrait honnêtement si tu lui demandais ton défaut ?",
  "Qui dirait oui à un saut en parachute sans réfléchir ?",
  "Qui est le/la plus susceptible d'écrire une lettre à un journal ?",
  "Avec qui partirais-tu à un concert de musique électro ?",
  "Qui ferait la meilleure colocation à l'autre bout du monde ?",
  "Qui assumerait de chanter en karaoké même sobre ?",
  "Qui ferait le meilleur DJ de mariage ?",
  "Qui te paraît le plus à l'aise face aux compliments ?",
  "Qui rougit le plus vite ?",
  "Qui dans le groupe est le/la plus protecteur/trice ?",
  "Qui est le/la plus susceptible de payer sa tournée 3 fois de suite ?",
  "Qui ferait un super coach scolaire pour des ados ?",
  "Qui te ferait la meilleure surprise pour ton anniversaire ?",
  "Qui dans le groupe ne sait pas dire non ?",
  "Avec qui aimerais-tu écrire un livre ?",
  "Qui partirait à l'aventure sur une appli de rencontre étrange ?",
  "Qui dirait oui à un défi de manger des trucs étranges ?",
  "Qui dans le groupe est le/la plus susceptible de venir en aide à 3 h du matin ?",
  "Qui ferait le meilleur premier ministre virtuel ?",
  "Qui te ferait le meilleur massage des cervicales ?",
  "Qui est le/la plus susceptible de retrouver les clés perdues ?",
  "Avec qui partirais-tu en festival sans plan B ?",
  "Qui ferait le meilleur photographe lors d'une soirée ?",
  "Qui sait écouter sans interrompre ?",
  "Qui t'a le plus impressionné(e) dans le groupe cette année ?",
  "Qui te tirerait du lit à 5 h pour un lever de soleil ?",
  "Qui dirait oui à un nouveau pays demain ?",
  "Qui dans le groupe ferait le meilleur agent secret ?",
  "Qui assumerait le rôle de témoin pour un mariage improbable ?",
];

function create() {
  let phase = "lobby";
  let whispererName = null;
  let accusedName = null;
  let currentPrompt = "";
  let revealPrompt = false;
  let turn = 0;
  let pointedAt = {}; // name -> times this player was the accused

  function pickPrompt() { currentPrompt = PROMPTS.length ? PROMPTS[Math.floor(Math.random() * PROMPTS.length)] : ""; }
  function resetAll() { phase = "lobby"; whispererName = null; accusedName = null; currentPrompt = ""; revealPrompt = false; turn = 0; pointedAt = {}; }
  function startTurn(room) {
    const a = room.activePlayers();
    if (!a.length) return;
    whispererName = a[Math.floor(Math.random() * a.length)].name;
    accusedName = null; revealPrompt = false; pickPrompt(); phase = "playing"; turn = 1;
  }
  function nextTurn(room) {
    const a = room.activePlayers();
    if (!a.length) { phase = "lobby"; return; }
    const idx = a.findIndex((p) => p.name === whispererName);
    whispererName = a[(idx + 1) % a.length].name;
    accusedName = null; revealPrompt = false; pickPrompt(); phase = "playing"; turn++;
  }
  function topAccused(room) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const n in pointedAt) {
      if (!present.has(n)) continue;
      if (!best || pointedAt[n] > pointedAt[best]) best = n;
    }
    return best ? { name: best, count: pointedAt[best] } : null;
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { startTurn(room); },
    onAdvance: (room) => {
      if (phase === "lobby") startTurn(room);
      // Host force-advance with no accusation: skip the empty reveal entirely.
      else if (phase === "playing") { if (accusedName) { phase = "reveal"; revealPrompt = Math.random() < 0.5; } else { nextTurn(room); } }
      else if (phase === "reveal") nextTurn(room);
      else resetAll();
    },
    onReset: resetAll,
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onPlayerLeave: (room, p) => { if (phase === "playing" && p && p.name === whispererName) nextTurn(room); },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || p.name !== whispererName) return;
      if (msg.t !== "point") return;
      const target = room.players.get(String(msg.target_id || "").toLowerCase());
      // No self-point (nonsense reveal) and no targeting a player who has left
      // (or is mid-disconnect) — would accuse someone not in the room.
      if (!target || !target.name || target.name === whispererName || !target.active) return;
      accusedName = target.name;
      pointedAt[target.name] = (pointedAt[target.name] || 0) + 1;
      revealPrompt = Math.random() < 0.5; // 50/50 coin
      phase = "reveal";
    },
    serializeRound: (room) => {
      const r = { turn: turn };
      if (phase === "lobby") return r;
      if (whispererName) { r.whisperer_id = whispererName; r.whisperer_name = whispererName; }
      if (phase === "reveal" && accusedName) {
        r.accused_id = accusedName;
        r.accused_name = accusedName;
        r.coin = revealPrompt ? "open" : "sealed";
        if (revealPrompt) r.prompt = currentPrompt;
      }
      if (phase === "finished") {
        const t = topAccused(room);
        if (t) r.mvp = { label: "Le plus accusé", emoji: "👀", name: t.name, value: t.count + " fois" };
      }
      return r;
    },
    serializePrivate: (room, viewer) => {
      if (!viewer || phase !== "playing" || !whispererName) return {};
      if (viewer.name !== whispererName) return {};
      return { prompt: currentPrompt, your_turn: true };
    },
    tick: () => false,
  };
}

module.exports = {
  id: "paranoia",
  name: "Paranoia",
  emoji: "👀",
  desc: "Question secrète à une personne — 85 prompts. Le doigt parle, le coin décide.",
  create,
};
