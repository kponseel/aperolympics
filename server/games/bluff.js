// "Le Bluff" — write a fake answer, then vote the real one out of the shuffled
// pool. 60+ trivia questions; a random 8 picked per match so the same trio of
// players doesn't see the same question twice in a row. End-of-session extras
// crown both the best bluffer and the best detective.

const QUESTIONS = [
  // Original 25 head (deterministic tests still hit "Bradype" at idx 0).
  { q: "Quel est l'autre nom scientifique du paresseux ?", a: "Bradype" },
  { q: "Comment s'appelle la peur des longs mots ?", a: "Hippopotomonstrosesquippedaliophobie" },
  { q: "Quelle est la capitale du Kazakhstan ?", a: "Astana" },
  { q: "En quelle annee a ete invente le post-it ?", a: "1974" },
  { q: "Quel est l'animal national de l'Ecosse ?", a: "La licorne" },
  { q: "Combien de coeurs a un poulpe ?", a: "Trois" },
  { q: "Quel mineral compose la perle ?", a: "Aragonite" },
  { q: "Quelle planete a la plus longue journee ?", a: "Venus" },
  { q: "Quel est le plus long fleuve d'Europe ?", a: "La Volga" },
  { q: "Quel mot Anglais a le plus de definitions ?", a: "Set" },
  { q: "En quelle annee a ete fonde Google ?", a: "1998" },
  { q: "Quel est le metal le plus cher au monde ?", a: "Le rhodium" },
  { q: "Combien de pattes a une etoile de mer typique ?", a: "Cinq" },
  { q: "Quel est le nom de la phobie des araignees ?", a: "Arachnophobie" },
  { q: "Quel pays a le plus de fuseaux horaires ?", a: "France" },
  { q: "Comment s'appelle le bebe d'un kangourou ?", a: "Joey" },
  { q: "Quel est l'element chimique de symbole Au ?", a: "Or" },
  { q: "Quel est le plus grand pays d'Amerique du Sud ?", a: "Bresil" },
  { q: "Qui a invente le telephone ?", a: "Bell" },
  { q: "Quel est le plus petit os du corps humain ?", a: "L'etrier" },
  { q: "Quel est l'oiseau qui ne peut pas voler ET nage ?", a: "Manchot" },
  { q: "Quel est l'instrument national de l'Inde ?", a: "Sitar" },
  { q: "En quelle annee est sorti le premier Mario ?", a: "1985" },
  { q: "Quel est le plus petit pays du monde ?", a: "Vatican" },
  { q: "Combien de couleurs a l'arc-en-ciel ?", a: "Sept" },
  // +50 nouvelles questions
  { q: "Quelle est la capitale de l'Australie ?", a: "Canberra" },
  { q: "Quelle est la capitale du Brésil ?", a: "Brasilia" },
  { q: "Quel est le plus grand désert chaud du monde ?", a: "Sahara" },
  { q: "Quelle est la plus haute montagne d'Afrique ?", a: "Kilimandjaro" },
  { q: "Quel océan borde le Maroc à l'ouest ?", a: "Atlantique" },
  { q: "Combien de joueurs dans une équipe de hand-ball sur le terrain ?", a: "Sept" },
  { q: "En quelle année a été construite la tour Eiffel ?", a: "1889" },
  { q: "Quel artiste a peint « La Persistance de la mémoire » ?", a: "Dalí" },
  { q: "Combien de cordes a une guitare classique ?", a: "Six" },
  { q: "Quel est l'animal le plus rapide sur terre ?", a: "Guépard" },
  { q: "Quel est le plus grand mammifère du monde ?", a: "Baleine bleue" },
  { q: "Quel poète a écrit « Les Fleurs du mal » ?", a: "Baudelaire" },
  { q: "Quelle planète est la plus chaude du système solaire ?", a: "Vénus" },
  { q: "Combien d'os dans le corps humain adulte ?", a: "206" },
  { q: "Quel pays a inventé le judo ?", a: "Japon" },
  { q: "Quelle est la monnaie officielle de la Suisse ?", a: "Franc suisse" },
  { q: "En quelle année a coulé le Titanic ?", a: "1912" },
  { q: "Combien de continents sur Terre ?", a: "Sept" },
  { q: "Quelle est la plus grande île du monde ?", a: "Groenland" },
  { q: "Quel pays a remporté la coupe du monde 1998 ?", a: "France" },
  { q: "Quel pays a la forme d'une botte ?", a: "Italie" },
  { q: "Quel est le pays le plus peuplé du monde (2025) ?", a: "Inde" },
  { q: "Combien de minutes dans une journée ?", a: "1440" },
  { q: "Quel scientifique a énoncé la théorie de la relativité ?", a: "Einstein" },
  { q: "Quel est le plus long os du corps humain ?", a: "Fémur" },
  { q: "Combien de touches sur un piano standard ?", a: "88" },
  { q: "Quelle est la plus grande planète du système solaire ?", a: "Jupiter" },
  { q: "Quel élément a pour symbole Fe ?", a: "Fer" },
  { q: "Quel pays a inventé les pâtes (officiellement) ?", a: "Chine" },
  { q: "Quel est le plus petit océan du monde ?", a: "Arctique" },
  { q: "En quelle année a eu lieu la chute du mur de Berlin ?", a: "1989" },
  { q: "Quel président américain est apparu sur le billet de 1 $ ?", a: "Washington" },
  { q: "Quel sport pratique-t-on à Wimbledon ?", a: "Tennis" },
  { q: "Quel est le plus haut sommet du monde ?", a: "Everest" },
  { q: "Combien de cartes dans un jeu de 32 ?", a: "32" },
  { q: "Quel artiste a chanté « Bohemian Rhapsody » ?", a: "Queen" },
  { q: "Quel auteur a écrit Les Misérables ?", a: "Hugo" },
  { q: "Quelle est la capitale de l'Argentine ?", a: "Buenos Aires" },
  { q: "Quel film a remporté le premier Oscar du meilleur film ?", a: "Wings" },
  { q: "Quelle est la langue officielle du Brésil ?", a: "Portugais" },
  { q: "Combien de joueurs dans une équipe de volley en salle ?", a: "Six" },
  { q: "Quel est l'animal symbole de la Chine ?", a: "Panda" },
  { q: "Quel scientifique a découvert la pénicilline ?", a: "Fleming" },
  { q: "En quelle année est sorti le premier iPhone ?", a: "2007" },
  { q: "Quel est le plus grand lac d'eau douce du monde ?", a: "Supérieur" },
  { q: "Quel mot anglais signifie « papillon » ?", a: "Butterfly" },
  { q: "Quel élément chimique a pour symbole H ?", a: "Hydrogène" },
  { q: "Combien de jours dure une année bissextile ?", a: "366" },
  { q: "Quel artiste a peint la Joconde ?", a: "De Vinci" },
  { q: "Quelle ville est surnommée « la Big Apple » ?", a: "New York" },
];
const MAX_SUBMISSION_LEN = 31;
const ROUND_SIZE = 8; // 8 questions par partie, tirées au hasard

function create() {
  let phase = "lobby";
  let questions = [];   // shuffled subset for this match
  let qIdx = -1;        // index INTO `questions`
  let step = 0; // 0 = submit fakes, 1 = vote
  let submissions = {}; // player name -> fake text
  let options = []; // [{ text, owner: name|null }]  (null owner = real answer)
  let realOptionIdx = -1;
  let bluffVotes = {};  // name -> cumulative votes their fake lies have lured
  let truthsFound = {}; // name -> times the player voted the real answer
  let lastGain = {};

  function pickRound() {
    const idxs = QUESTIONS.map((_, i) => i);
    if (process.env.BLUFF_NO_SHUFFLE !== "1") {
      for (let i = idxs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = idxs[i]; idxs[i] = idxs[j]; idxs[j] = t; }
    }
    questions = idxs.slice(0, Math.min(ROUND_SIZE, idxs.length)).map((i) => QUESTIONS[i]);
  }
  function clearStepFlags(room) { room.players.forEach((p) => { p.answered = false; p.answer = -1; }); }
  function clearFullRound(room) { clearStepFlags(room); submissions = {}; options = []; realOptionIdx = -1; }
  function startRound(room, idx) { qIdx = idx; step = 0; phase = "playing"; clearFullRound(room); }
  function resetAll(room) {
    phase = "lobby"; questions = []; qIdx = -1; step = 0; clearFullRound(room);
    bluffVotes = {}; truthsFound = {}; lastGain = {};
    room.players.forEach((p) => { p.score = 0; });
  }
  function topBy(counts, room, minOne) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const name in counts) {
      if (!present.has(name)) continue;
      if (!best || counts[name] > counts[best]) best = name;
    }
    if (!best) return null;
    return (minOne && counts[best] <= 0) ? null : { name: best, count: counts[best] };
  }
  function allActiveActed(room) { const a = room.activePlayers(); return a.length > 0 && a.every((p) => p.answered); }

  function shuffleAndSealOptions(room) {
    options = [];
    const real = questions[qIdx].a;
    room.activePlayers().forEach((p) => {
      const sub = submissions[p.name];
      if (!sub) return;
      if (sub.toLowerCase() === real.toLowerCase()) return; // matched truth -> dropped
      options.push({ text: sub, owner: p.name });
    });
    options.push({ text: real, owner: null });
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = options[i]; options[i] = options[j]; options[j] = tmp;
    }
    realOptionIdx = options.findIndex((o) => o.owner === null);
  }

  function applyScoring(room) {
    if (realOptionIdx < 0) return;
    lastGain = {};
    room.players.forEach((p) => {
      if (!p.name || !p.answered) return;
      const pick = p.answer;
      if (typeof pick !== "number" || pick < 0 || pick >= options.length) return;
      if (pick === realOptionIdx) {
        p.score += 500;
        lastGain[p.name] = (lastGain[p.name] || 0) + 500;
        truthsFound[p.name] = (truthsFound[p.name] || 0) + 1;
        return;
      }
      const owner = options[pick].owner;
      if (owner && owner !== p.name) {
        const op = room.players.get(owner.toLowerCase());
        if (op) op.score += 250;
        lastGain[owner] = (lastGain[owner] || 0) + 250;
        bluffVotes[owner] = (bluffVotes[owner] || 0) + 1;
      }
    });
  }

  function advance(room) {
    if (phase === "lobby") { pickRound(); if (questions.length) startRound(room, 0); return; }
    if (phase === "playing" && step === 0) { shuffleAndSealOptions(room); step = 1; clearStepFlags(room); return; }
    if (phase === "playing" && step === 1) { applyScoring(room); phase = "reveal"; return; }
    if (phase === "reveal") {
      if (qIdx + 1 < questions.length) startRound(room, qIdx + 1);
      else phase = "finished";
      return;
    }
    resetAll(room);
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { pickRound(); if (questions.length) startRound(room, 0); },
    onAdvance: advance,
    onReset: resetAll,
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onPlayerLeave: (room) => { if (phase === "playing" && allActiveActed(room)) advance(room); },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing") return;
      if (step === 0 && msg.t === "submit" && !p.answered) {
        let text = String(msg.text == null ? "" : msg.text).replace(/^[ \t]+/, "");
        if (!text) return;
        text = text.slice(0, MAX_SUBMISSION_LEN).replace(/[ \t]+$/, "");
        if (!text) return;
        submissions[p.name] = text;
        p.answered = true;
        if (allActiveActed(room)) advance(room);
        return;
      }
      if (step === 1 && msg.t === "vote" && !p.answered) {
        const opt = msg.option;
        if (typeof opt !== "number" || opt < 0 || opt >= options.length) return;
        if (options[opt].owner === p.name) return; // can't vote your own fake
        p.answered = true;
        p.answer = opt;
        if (allActiveActed(room)) advance(room);
      }
    },
    serializeRound: (room) => {
      const r = { total: ROUND_SIZE };
      if (qIdx < 0 || !questions.length) return r;
      r.idx = qIdx;
      r.q = questions[qIdx].q;
      r.step = step === 0 ? "submit" : "vote";
      const active = room.activePlayers();
      if (phase === "playing") {
        r.answered = active.filter((p) => p.answered).length;
        r.players_active = active.length;
        if (step === 1) r.options = options.map((o) => o.text);
      }
      if (phase === "reveal") {
        r.real_answer = questions[qIdx].a;
        r.real_option_idx = realOptionIdx;
        r.options = options.map((o, i) => {
          const obj = { text: o.text, real: i === realOptionIdx };
          if (o.owner) obj.owner = o.owner;
          return obj;
        });
        r.gains = Object.keys(lastGain).map((n) => ({ name: n, gain: lastGain[n] }));
      }
      if (phase === "finished") {
        const b = topBy(bluffVotes, room, true);
        if (b) r.mvp = { label: "Meilleur bluffeur", emoji: "🤥", name: b.name, value: b.count + " piège" + (b.count > 1 ? "s" : "") };
        const det = topBy(truthsFound, room, true);
        r.extras = [];
        if (det) r.extras.push({ emoji: "🕵️", label: "Le détective", name: det.name, value: det.count + " bonne" + (det.count > 1 ? "s réponses" : " réponse") });
      }
      return r;
    },
    serializePrivate: (room, viewer) => {
      if (!viewer || !viewer.name) return {};
      if (phase === "playing" && step === 1) {
        const idx = options.findIndex((o) => o.owner === viewer.name);
        return idx >= 0 ? { my_option_idx: idx } : {};
      }
      if (phase === "reveal" && realOptionIdx >= 0) {
        return { my_correct: !!(viewer.answered && viewer.answer === realOptionIdx) };
      }
      return {};
    },
    tick: () => false,
  };
}

module.exports = {
  id: "bluff",
  name: "Le Bluff",
  emoji: "🤥",
  desc: "8 questions parmi 75 — invente une fausse réponse, vote la vraie.",
  create,
};
