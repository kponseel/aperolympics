// "Cap ou pas cap" (dare_duel) — a dare is shown to the active player (rotating);
// they tap Cap 😎 (they do it) or Pas cap 🍺 (they drink). Reveal shows the
// choice + a running tally. Loop game, host-endable. 3 escalating levels; the
// level rises every few rounds (soft → osé). Server is authoritative.

const DARES = {
  1: [
    // Original 15 (kept stable for deterministic tests).
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
    // +20 nouveaux
    "Cite 10 fruits en moins de 15 secondes",
    "Fais ta meilleure tête de joueur d'échecs concentré pendant 10 sec",
    "Chante « Joyeux anniversaire » dans un style death metal",
    "Mets de la musique mentale et danse comme si personne ne te regardait",
    "Trouve le compliment le plus banal possible à faire à quelqu'un",
    "Récite tes propres horoscopes inventés pour chaque joueur",
    "Imite la démarche d'un mannequin sur 3 mètres",
    "Fais un faux pas de danse classique en 5 secondes",
    "Compose un haïku sur la pizza",
    "Mime le réveil le pire au monde",
    "Fais un cri de guerre pour ce groupe",
    "Imite ta professeure principale de collège",
    "Trouve un objet de la pièce et fais-en un compliment poétique",
    "Cite 3 marques de soda en 5 secondes",
    "Fais ta plus belle révérence",
    "Récite le numéro de tel d'un proche par cœur — sinon bois 2 fois",
    "Fais un check chorégraphié avec un joueur de ton choix",
    "Mime un Smartphone qui vient de tomber",
    "Trouve un emoji qui te ressemble et explique pourquoi",
    "Fais un toast avec une voix de méchant Disney",
  ],
  2: [
    // Original 14
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
    // +20 nouveaux
    "Montre les 3 dernières photos prises par toi",
    "Joue à pierre-feuille-ciseaux avec ton voisin, perdant boit 2 fois",
    "Lis ta dernière note dans ton tel (mémo, todo, etc.)",
    "Raconte ta dernière dispute avec quelqu'un en 30 sec",
    "Appelle un proche et raconte-lui une blague nulle",
    "Mime ce qu'on entend dans les toilettes",
    "Dis une phrase « romantique » à un objet de la pièce, lyrique",
    "Envoie un GIF random à 3 personnes de tes contacts",
    "Fais un compliment hypocrite à ton voisin de droite",
    "Choisis un joueur — invente son surnom officiel pour le reste de la soirée",
    "Improvise une présentation de 30 sec sur la chaussure",
    "Crée un nouveau pas de danse, oblige tout le monde à le copier",
    "Vante les mérites d'un défaut du joueur à ta gauche pendant 20 sec",
    "Mets ton tel en mode « sans son » et raconte une histoire silencieuse",
    "Fais semblant de pleurer pendant 15 sec — réussis = applaudissements, rate = boit",
    "Énonce une vérité gênante mais inoffensive sur toi",
    "Fais un toast à ton plus gros échec de la semaine",
    "Imite la voix de ta mère qui appelle pour le dîner",
    "Cite 5 phrases entendues dans les transports en commun parisiens",
    "Improvise une chanson de mariage pour deux joueurs au choix",
  ],
  3: [
    // Original 12
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
    // +18 nouveaux
    "Raconte un moment vraiment embarrassant que tu n'oublies pas",
    "Avoue qui dans le groupe tu trouves le plus inspirant — et pourquoi",
    "Montre la dernière fois que tu as ri seul devant ton tel",
    "Choisis un joueur du groupe et fais-lui une déclaration en yaourt italien",
    "Raconte ton pire bizutage / blague d'école",
    "Sors ton calendrier et lis le titre du dernier événement passé",
    "Envoie un message vocal de 30 sec à un contact aléatoire (sois bienveillant)",
    "Confie un truc qui te fait peur, vraiment",
    "Décris ta pire colocation ou ton pire voisinage",
    "Trouve un point commun secret avec chaque joueur du groupe",
    "Avoue un truc dont tu n'es pas fier dans tes habitudes de soirée",
    "Raconte ce que tu fais en cachette quand tu télétravailles",
    "Décris ton crush ultime, type physique inclus",
    "Choisis un joueur et fais lui une lettre d'amour de 30 sec",
    "Raconte le dernier compliment que tu as gardé pour toi",
    "Décris le dernier rêve gênant que tu te rappelles",
    "Confie une habitude bizarre que tu as quand personne ne regarde",
    "Choisis un joueur — explique pourquoi tu serais son/sa pire ex",
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
  desc: "Cap (tu le fais) ou Pas cap (tu bois) ? 100 défis sur 3 niveaux.",
  create,
};
