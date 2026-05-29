// "Tu préfères" — binary A/B vote with live tally. 130-prompt bank; a fresh
// random 10 picked per match (avoid déjà-vu). At the finish we surface richer
// session stats: most aligned with the majority, the "rebel" (most often
// against), and the soulmate pair (the two players who agreed most often).
// Per-round detail stays anonymous — only per-player aggregates leak.

const PROMPT_BANK = [
  // Original 25 (kept at the head so deterministic tests still hit a known prompt at idx 0)
  { a: "Pouvoir voler", b: "Pouvoir lire dans les pensées" },
  { a: "Pizza pour le restant de tes jours", b: "Plus jamais de fromage" },
  { a: "Vivre en ville", b: "Vivre à la campagne" },
  { a: "Trop chaud", b: "Trop froid" },
  { a: "Voir le futur", b: "Voir le passé" },
  { a: "Être invisible", b: "Pouvoir devenir très grand" },
  { a: "Vivre dans le passé", b: "Vivre dans le futur" },
  { a: "Voyager sans bagage", b: "Toujours en avoir trop" },
  { a: "Cuisiner pour 20", b: "Manger toujours seul" },
  { a: "Pouvoir parler toutes les langues", b: "Pouvoir parler aux animaux" },
  { a: "Plus jamais de café", b: "Plus jamais de chocolat" },
  { a: "Mer", b: "Montagne" },
  { a: "Chat", b: "Chien" },
  { a: "Être célèbre", b: "Être riche anonyme" },
  { a: "Perdre tes photos", b: "Perdre tes contacts" },
  { a: "Lire toutes les pensées autour", b: "Que tout le monde lise les tiennes" },
  { a: "Vacances éternelles sans amis", b: "Boulot idéal entouré d'amis" },
  { a: "Pas de téléphone pendant 1 an", b: "Pas de TV/streaming pendant 1 an" },
  { a: "Vivre dans une méga-ville", b: "Vivre sur une île déserte" },
  { a: "Être l'expert mondial d'un sujet inutile", b: "Être moyen sur tout" },
  { a: "Éternellement 5 ans", b: "Éternellement 70 ans" },
  { a: "Voir tes amis 1 fois par mois", b: "Vivre avec eux H24" },
  { a: "Marcher 5 km tous les jours", b: "Manger fade tous les jours" },
  { a: "Toujours dire la vérité", b: "Ne plus jamais mentir mais ne pas savoir te taire" },
  { a: "Connaître le jour de ta mort", b: "Connaître la cause" },
  // +110 nouveaux dilemmes
  { a: "Été toute l'année", b: "Hiver toute l'année" },
  { a: "Pieds nus partout", b: "Toujours des chaussettes" },
  { a: "Sucré", b: "Salé" },
  { a: "Petit-déj géant", b: "Dîner gastronomique" },
  { a: "Thé toute la journée", b: "Café toute la journée" },
  { a: "Brunch", b: "Apéro qui dure 4 h" },
  { a: "Sushi à vie", b: "Pizza à vie" },
  { a: "Cuisine italienne", b: "Cuisine asiatique" },
  { a: "Burgers", b: "Tacos" },
  { a: "Glaces", b: "Pâtisseries" },
  { a: "Voir tous les Marvel d'affilée", b: "Voir tous les Harry Potter d'affilée" },
  { a: "Lire un livre par semaine", b: "Voir un film par jour" },
  { a: "Reality TV", b: "Documentaires" },
  { a: "Concert", b: "Festival" },
  { a: "Musée", b: "Parc d'attractions" },
  { a: "Karaoké", b: "Soirée jeux" },
  { a: "Escape game", b: "Murder party" },
  { a: "Apéro chez toi", b: "Bar bondé" },
  { a: "Soirée à 4", b: "Soirée à 30" },
  { a: "Rentrer à 23h", b: "Fermer le club" },
  { a: "Jeux vidéo solo", b: "Jeux de société entre amis" },
  { a: "Switch", b: "PlayStation" },
  { a: "Console de salon", b: "PC gamer" },
  { a: "Spotify", b: "Apple Music" },
  { a: "Insta", b: "TikTok" },
  { a: "WhatsApp", b: "Signal" },
  { a: "Email", b: "Téléphone" },
  { a: "Réveil à 6 h", b: "Coucher à 3 h" },
  { a: "Sieste tous les jours", b: "Une vraie grasse mat' par mois" },
  { a: "Plus jamais de réveil", b: "Plus jamais de bouchon" },
  { a: "Marche à pied", b: "Vélo" },
  { a: "Voiture", b: "Train" },
  { a: "Avion", b: "Bateau" },
  { a: "Road-trip USA", b: "Tour d'Europe en train" },
  { a: "Visiter Tokyo", b: "Visiter New York" },
  { a: "Trekking en montagne", b: "Plage paradisiaque" },
  { a: "Voyager seul", b: "Voyager en groupe" },
  { a: "Tente sauvage", b: "Hôtel 5 étoiles" },
  { a: "Auberge de jeunesse", b: "Airbnb cosy" },
  { a: "Camping en forêt", b: "Croisière" },
  { a: "Skier", b: "Surfer" },
  { a: "Plongée sous-marine", b: "Parapente" },
  { a: "Marathon", b: "Triathlon" },
  { a: "Yoga", b: "CrossFit" },
  { a: "Foot", b: "Basket" },
  { a: "Tennis", b: "Padel" },
  { a: "Boxe", b: "Escalade" },
  { a: "Course matinale", b: "Sport en salle le soir" },
  { a: "Avoir 1 000 000 € maintenant", b: "Avoir 100 000 €/an à vie" },
  { a: "Travailler 4 jours par semaine", b: "Gagner +20 %" },
  { a: "Bureau", b: "Télétravail" },
  { a: "Devenir patron d'une boîte", b: "Avoir le job parfait sans responsabilités" },
  { a: "Anonymat total", b: "Reconnaissance partout" },
  { a: "Pouvoir téléporter une fois par jour", b: "Toujours savoir l'heure exactement" },
  { a: "Lire en diagonale tout livre", b: "Apprendre une langue en 1 mois" },
  { a: "Talent musical inné", b: "Talent sportif inné" },
  { a: "Mémoire photographique", b: "Vitesse de réaction surhumaine" },
  { a: "Voyager dans le temps (une seule fois)", b: "Voir l'avenir 1 minute à l'avance" },
  { a: "Voler", b: "Devenir invisible" },
  { a: "Comprendre tous les animaux", b: "Comprendre tous les bébés" },
  { a: "Ne plus jamais avoir mal", b: "Ne plus jamais être triste" },
  { a: "Ne plus jamais être fatigué", b: "Ne plus jamais avoir faim" },
  { a: "Dormir 4 h sans être fatigué", b: "Manger ce que tu veux sans grossir" },
  { a: "Vivre 150 ans", b: "Vivre 80 ans en pleine forme" },
  { a: "Être super beau / belle", b: "Être super intelligent·e" },
  { a: "Tout le monde t'aime", b: "Tout le monde te respecte" },
  { a: "Ne plus jamais perdre", b: "Ne plus jamais s'ennuyer" },
  { a: "Toujours raison", b: "Toujours apaisé·e" },
  { a: "Sortir avec ton crush mais 1 mois max", b: "Une amitié forte à vie" },
  { a: "Mariage à 100 personnes", b: "Mariage à 6 personnes" },
  { a: "Vivre seul·e", b: "Vivre en coloc à vie" },
  { a: "5 enfants", b: "Pas d'enfants" },
  { a: "Élever un chien", b: "Élever un chat" },
  { a: "Avoir un chien de 60 kg", b: "Avoir 3 petits chiens" },
  { a: "Habiter Paris", b: "Habiter au bord de la mer" },
  { a: "Maison à la campagne", b: "Appart en centre-ville" },
  { a: "Jardin", b: "Balcon avec vue" },
  { a: "Salle de cinéma à la maison", b: "Piscine à la maison" },
  { a: "Voiture de sport", b: "Van aménagé" },
  { a: "Pouvoir effacer 1 souvenir", b: "Pouvoir revoir 1 souvenir comme un film" },
  { a: "Refaire ton ado", b: "Sauter directement à 60 ans en pleine forme" },
  { a: "Tout recommencer", b: "Tout garder tel quel" },
  { a: "Une journée dans la peau d'une célébrité", b: "Une journée dans le futur" },
  { a: "Dîner avec ton idole d'enfance", b: "Dîner avec ton arrière-petit-enfant" },
  { a: "Connaître toute l'histoire du monde", b: "Connaître toute la science actuelle" },
  { a: "Inventer un objet utile", b: "Inventer un slogan culte" },
  { a: "Gagner un Oscar", b: "Gagner un Nobel" },
  { a: "Être pirate", b: "Être chevalier" },
  { a: "Être détective", b: "Être astronaute" },
  { a: "Pouvoir parler avec les morts", b: "Pouvoir parler aux extraterrestres" },
  { a: "Vivre dans Game of Thrones", b: "Vivre dans Harry Potter" },
  { a: "Vivre dans le Seigneur des Anneaux", b: "Vivre dans Star Wars" },
  { a: "Combattre 1 cheval-canard", b: "Combattre 100 canards-chevaux" },
  { a: "Toujours sentir bon", b: "Toujours bien dormir" },
  { a: "Ne plus tomber malade", b: "Ne plus avoir mal au dos" },
  { a: "Connaître la date de la fin du monde", b: "Connaître la date de ta retraite" },
  { a: "Vivre 1 an dans la jungle", b: "Vivre 1 an en Antarctique" },
  { a: "Tomber sur 100 € dans la rue", b: "Récupérer un objet perdu d'enfance" },
  { a: "Faire la fête tous les week-ends", b: "Pouvoir prendre 3 mois off par an" },
  { a: "Pas d'Internet 1 mois", b: "Pas de musique 1 mois" },
  { a: "Plus jamais de réseaux sociaux", b: "Plus jamais de streaming" },
  { a: "Lire dans les pensées", b: "Connaître les rêves des autres" },
  { a: "Avoir un super-pouvoir nul (mais réel)", b: "Avoir un talent banal poussé à l'extrême" },
  { a: "Pouvoir parler à toi-même à 10 ans", b: "Recevoir un conseil de toi à 70 ans" },
  { a: "Refaire le bac", b: "Refaire la première année d'études" },
  { a: "Avoir une mémoire qui efface le pire", b: "Avoir une mémoire qui n'oublie rien" },
  { a: "Toujours retomber sur tes pieds", b: "Toujours dire le bon mot au bon moment" },
  { a: "Dîner en tête-à-tête avec ton idole", b: "Karaoké avec tes 5 meilleurs amis" },
  { a: "Faire un film sur ta vie", b: "Écrire un livre sur ta vie" },
  { a: "Être héros un jour", b: "Être tranquille toute ta vie" },
  { a: "Soirée pyjama à 30 ans", b: "Soirée smoking à 18 ans" },
  { a: "Être suivi par 1 M de followers", b: "Avoir un cercle de 10 amis ultra fidèles" },
  { a: "Découvrir un trésor", b: "Découvrir une nouvelle espèce animale" },
  { a: "Être bilingue parfait", b: "Savoir cuisiner comme un chef" },
];

const ROUND_SIZE = 10; // 10 dilemmes par partie, tirés au hasard

function create() {
  let phase = "lobby";
  let prompts = [];              // shuffled subset for this match
  let currentIdx = -1;           // index INTO `prompts`
  let alignedCount = {};         // name -> rounds voted with the majority
  let minorityCount = {};        // name -> rounds voted against the majority
  let pairAgreements = {};       // "A||B" (sorted) -> times those two voted the same side

  function pickRound() {
    const idxs = PROMPT_BANK.map((_, i) => i);
    if (process.env.WOULD_RATHER_NO_SHUFFLE !== "1") {
      for (let i = idxs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = idxs[i]; idxs[i] = idxs[j]; idxs[j] = t; }
    }
    prompts = idxs.slice(0, Math.min(ROUND_SIZE, idxs.length)).map((i) => PROMPT_BANK[i]);
  }
  function clearRound(room) { room.players.forEach((p) => { p.answered = false; p.answer = -1; }); }
  function startRound(room, idx) { currentIdx = idx; phase = "playing"; clearRound(room); }
  function allVoted(room) { const a = room.activePlayers(); return a.length > 0 && a.every((p) => p.answered); }
  function countWith(room, which) {
    let n = 0;
    room.players.forEach((p) => { if (p.name && p.answered && p.answer === which) n++; });
    return n;
  }
  // Tally one round: credit majority voters, tag minority, and record every
  // PAIR of voters who agreed (any side) so we can crown a "soulmate" pair.
  function tallyRound(room) {
    const a = countWith(room, 0), b = countWith(room, 1);
    if (a > b) {
      room.players.forEach((p) => {
        if (!p.name || !p.answered) return;
        if (p.answer === 0) alignedCount[p.name] = (alignedCount[p.name] || 0) + 1;
        else minorityCount[p.name] = (minorityCount[p.name] || 0) + 1;
      });
    } else if (b > a) {
      room.players.forEach((p) => {
        if (!p.name || !p.answered) return;
        if (p.answer === 1) alignedCount[p.name] = (alignedCount[p.name] || 0) + 1;
        else minorityCount[p.name] = (minorityCount[p.name] || 0) + 1;
      });
    }
    // Pair agreements: any 2 voters who picked the same side (incl. ties).
    const voters = [...room.players.values()].filter((p) => p.name && p.answered);
    for (let i = 0; i < voters.length; i++) {
      for (let j = i + 1; j < voters.length; j++) {
        if (voters[i].answer !== voters[j].answer) continue;
        const key = [voters[i].name, voters[j].name].sort().join("||");
        pairAgreements[key] = (pairAgreements[key] || 0) + 1;
      }
    }
  }
  function toReveal(room) { phase = "reveal"; tallyRound(room); }
  function resetAll(room) { phase = "lobby"; prompts = []; currentIdx = -1; alignedCount = {}; minorityCount = {}; pairAgreements = {}; clearRound(room); }
  function topBy(counts, room) {
    const present = new Set(); room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const n in counts) { if (!present.has(n)) continue; if (!best || counts[n] > counts[best]) best = n; }
    return (best && counts[best] > 0) ? { name: best, count: counts[best] } : null;
  }
  function topPair(room) {
    const present = new Set(); room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const k in pairAgreements) {
      const [x, y] = k.split("||");
      if (!present.has(x) || !present.has(y)) continue;
      if (!best || pairAgreements[k] > pairAgreements[best.k]) best = { k: k, names: [x, y], count: pairAgreements[k] };
    }
    return (best && best.count > 1) ? best : null;
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { pickRound(); if (prompts.length) startRound(room, 0); },
    onAdvance: (room) => {
      if (phase === "lobby") { pickRound(); if (prompts.length) startRound(room, 0); }
      else if (phase === "playing") { toReveal(room); }
      else if (phase === "reveal") {
        if (currentIdx + 1 < prompts.length) startRound(room, currentIdx + 1);
        else phase = "finished";
      } else { resetAll(room); }
    },
    onReset: resetAll,
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
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
      const r = { total: ROUND_SIZE };
      if (currentIdx < 0 || !prompts.length) return r;
      r.idx = currentIdx;
      if (phase === "playing" || phase === "reveal") {
        r.a = prompts[currentIdx].a;
        r.b = prompts[currentIdx].b;
        r.answered = room.activePlayers().filter((p) => p.answered).length;
      }
      if (phase === "reveal") {
        r.count_a = countWith(room, 0);
        r.count_b = countWith(room, 1);
      }
      if (phase === "finished") {
        const aligned = topBy(alignedCount, room);
        const rebel = topBy(minorityCount, room);
        const pair = topPair(room);
        if (aligned) r.mvp = { label: "Le plus aligné avec la majorité", emoji: "⚖️", name: aligned.name, value: aligned.count + " fois" };
        // Extra stats surfaced as reveal text on the shared fin-de-partie screen.
        r.extras = [];
        if (rebel) r.extras.push({ emoji: "🔥", label: "L'éternel rebelle", name: rebel.name, value: rebel.count + " fois à contre-courant" });
        if (pair) r.extras.push({ emoji: "💞", label: "Les âmes sœurs", name: pair.names.join(" & "), value: pair.count + " réponses communes" });
      }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "would_rather",
  name: "Tu préfères",
  emoji: "⚖️",
  desc: "10 dilemmes tirés au hasard parmi 135+ — vote en direct.",
  create,
};
