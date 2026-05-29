// "Picolo" — escalating party prompts; the host advances. {p1}/{p2}/{p3} are
// replaced by random distinct active player names. Ported from
// esp32-hub/src/games/picolo.cpp.

const PROMPTS = [
  // Original 30 head (kept stable so deterministic tests still hit a known prompt).
  "{p1} commence : raconte ta journee en 15 secondes",
  "{p1} et {p2} : faites un high-five aussi maladroit que possible",
  "Tout le monde sauf {p1} bois une gorgee",
  "{p1} : nomme 3 joueurs qui doivent boire",
  "{p1} et {p2} echangent de place",
  "{p1} mime un metier, les autres devinent",
  "Les gauchers boivent. (Pas de gauchers ? {p1} bois)",
  "{p1} chante 5 secondes d'une chanson, {p2} continue",
  "Categorie : marques de cereales. Tour de table, premier·e qui rate bois",
  "{p1} regarde {p2} sans rire pendant 10 secondes",
  "Tout le monde leve son verre — {p1} fait le toast",
  "{p1} et {p2} : echangez un compliment honnete",
  "{p1} : revele un detail sur toi qu'aucun ici ne sait",
  "Cul-sec collectif sur 3-2-1 — chacun ce qu'il/elle veut",
  "{p1} pose une question, {p2} repond en moins de 3 sec",
  "Sondage : sur une echelle de 1 a 10, comment va {p1} ce soir ?",
  "{p1} et {p3} echangent leur pseudo pour les 3 prochains tours",
  "{p1} : explique a {p2} le sens de la vie (30 sec max)",
  "{p1} et {p2} : duel de regards, perdant bois",
  "Vote a main levee : qui est le/la plus chaotique ce soir ? Le/la elu·e bois",
  "{p1} fait un compliment a {p2}, mais en yaourt anglais",
  "Categorie : films de Tarantino. Premier·e qui rate bois",
  "Tout le monde change de place avec son voisin de droite",
  "{p1} : raconte un souvenir d'enfance en 20 sec",
  "{p1} et {p2} doivent dire la meme phrase EN MEME TEMPS",
  "{p1} : pose une question chelou aux autres",
  "Tous les bruns boivent. (Pas de bruns ? {p1} bois)",
  "{p1} et {p2} : 30 secondes pour inventer une chanson sur le mot 'fromage'",
  "Avant chaque gorgee : tout le monde doit dire 'sante a {p1}' pendant 5 tours",
  "Mini-jeu : tour de table, citez un fruit ; premier qui repete ou rate bois",
  // +60 nouveaux prompts
  "{p1} fait une déclaration enflammée à {p2} comme dans un drame",
  "{p1} : avoue un truc bon mais que tu n'avoueras à personne demain",
  "Tour de table : tout le monde dit un mot, {p1} doit raconter une histoire avec",
  "Categorie : capitales européennes. Tour de table, premier·e qui rate bois",
  "Categorie : marques de voiture. Tour de table, premier·e qui rate bois",
  "Categorie : films Disney. Tour de table, premier·e qui rate bois",
  "{p1} : trouve un point commun avec {p2} en 10 secondes",
  "{p1} doit faire rire {p2} sans dire un mot",
  "Le/la plus jeune bois. Le/la plus âgé(e) trinque avec.",
  "{p1} et {p2} : jeu du « si tu étais » (animal, plat, chanson)",
  "{p1} imite la voix de {p2} sur la prochaine phrase",
  "{p1} fait une danse de victoire, tout le monde imite",
  "{p1} et {p2} : duel de pierre-feuille-ciseaux, perdant bois",
  "{p1} : raconte une anecdote en commençant par « Une fois en soirée... »",
  "Tout le monde qui a déjà fait du yoga bois (sinon {p1})",
  "{p1} et {p2} doivent inventer un haka pour ce groupe",
  "Tout le monde qui porte du noir bois (sinon {p1})",
  "{p1} regarde {p3} dans les yeux et lui balance un fact random",
  "Categorie : marques de bière. Tour de table, premier·e qui rate bois",
  "{p1} doit dire « santé » dans 5 langues différentes — sinon bois",
  "{p1} : décris {p2} en 3 mots",
  "Tous ceux qui ont voyagé hors d'Europe boivent",
  "{p1} se lève et fait le tour de la pièce comme une diva",
  "{p1} et {p2} : tour de chant en duo, public juge",
  "Categorie : super-héros. Tour de table, premier·e qui rate bois",
  "{p1} crée un nouvel emoji rien que pour ce groupe et le mime",
  "{p1} doit complimenter {p2} et {p3} en même temps",
  "Tout le monde qui a déjà fait une présentation en public bois",
  "{p1} : invente une légende urbaine sur cette pièce",
  "{p1} et {p2} : choisissez le surnom officiel du groupe pour ce soir",
  "{p1} doit faire son meilleur rire de méchant Disney",
  "Tout le monde croise les bras — dernier·e à les croiser bois",
  "{p1} : raconte ton dernier rêve étrange en 20 sec",
  "{p1} et {p2} font une mini-pièce de théâtre de 20 secondes",
  "Categorie : prénoms commençant par M. Tour de table, premier·e qui rate bois",
  "{p1} fait son look de mannequin pour une photo, on shoot",
  "{p1} doit dire « je t'aime » à un objet de la pièce",
  "Tout le monde qui porte des lunettes bois (sinon {p1})",
  "{p1} : nomme la chanson la plus honteuse qu'il/elle ait sur son tel",
  "{p1} et {p2} : mimez ensemble un sport sans le dire",
  "Tour de table : tout le monde dit un fait sur soi, {p3} doit deviner si vrai/faux",
  "{p1} : prédis ce que {p2} fera dans 10 ans",
  "Tout le monde qui a déjà mangé du sushi cru au comptoir bois",
  "{p1} et {p2} : prouvez en 30 secondes que les pingouins peuvent voler",
  "Categorie : dessins animés des années 90. Tour de table, premier·e qui rate bois",
  "{p1} doit faire 5 squats pour avoir le droit de parler à nouveau",
  "{p1} et {p2} : challenge de sourire-fixe, premier qui craque bois",
  "{p1} : trouve un trait positif chez chaque joueur (5 sec chacun)",
  "Tour de table : citez un instrument de musique, {p1} doit le mimer",
  "{p1} fait une story Insta vocale pour le groupe (sans publier)",
  "{p1} et {p2} : inventez une pub de 15 sec pour une marque de chaussettes",
  "Tout le monde qui a déjà couru un 10 km bois",
  "{p1} : décris ton dernier achat inutile et défends-le 20 sec",
  "{p1} fait l'inverse de ce qu'on lui dit, pendant 2 tours",
  "Categorie : jeux Olympiques (sports). Tour de table, premier·e qui rate bois",
  "{p1} et {p2} : roulette du destin, pierre-feuille-ciseaux en 3 manches",
  "{p1} : invente une recette absurde pour ce soir (5 ingrédients)",
  "Le dernier·e à dire « apéro ! » bois (3-2-1)",
  "{p1} et {p2} : changez d'accent pour la prochaine phrase chacun",
  "{p1} : compose un petit poème de 4 vers sur {p2}",
];

// Each prompt's minimum unique-player requirement: 3 if it names {p3}, 2 if it
// names {p2}, else 1. Computed once so the advance loop can skip prompts that
// would otherwise read as "Solo et Solo échangent place" in tiny rooms.
const PROMPT_MIN = PROMPTS.map((p) =>
  p.indexOf("{p3}") >= 0 ? 3 : p.indexOf("{p2}") >= 0 ? 2 : 1
);

function create() {
  let phase = "lobby";
  let promptIdx = -1;
  let rendered = "";
  let roundN = 0;
  let mentions = {}; // name -> times the prompt template actually named this player

  function pick(names, exclude) {
    const pool = names.filter((n) => exclude.indexOf(n) < 0);
    const from = pool.length ? pool : names;
    return from[Math.floor(Math.random() * from.length)];
  }
  // Next prompt index (strictly after `after`) eligible for the current room
  // size. -1 if no eligible prompts remain (signals end of session).
  function nextEligibleIdx(after, activeN) {
    for (let i = after + 1; i < PROMPTS.length; i++) {
      if (PROMPT_MIN[i] <= activeN) return i;
    }
    return -1;
  }
  // Players in the 3s disconnect grace are still in activePlayers() but are
  // about to vanish — picking them as {p1}/{p2}/{p3} risks rendering a prompt
  // around a name no longer in the room moments later.
  function presentNames(room) {
    return room.activePlayers().filter((p) => !p.disconnectedAt).map((p) => p.name);
  }
  function renderPrompt(room, idx) {
    if (idx < 0 || idx >= PROMPTS.length) { rendered = ""; return; }
    const names = presentNames(room);
    if (!names.length) { rendered = PROMPTS[idx]; return; }
    const p1 = names[Math.floor(Math.random() * names.length)];
    const p2 = pick(names, [p1]);
    const p3 = pick(names, [p1, p2]);
    const tmpl = PROMPTS[idx];
    // Dedupe the credited names: in 1- or 2-player rooms `pick()` falls back
    // and can pick the same name twice, which would otherwise double-count.
    const credited = new Set();
    if (tmpl.indexOf("{p1}") >= 0) credited.add(p1);
    if (tmpl.indexOf("{p2}") >= 0) credited.add(p2);
    if (tmpl.indexOf("{p3}") >= 0) credited.add(p3);
    credited.forEach((n) => { mentions[n] = (mentions[n] || 0) + 1; });
    rendered = tmpl.split("{p1}").join(p1).split("{p2}").join(p2).split("{p3}").join(p3);
  }
  // Only crown a player who is still in the room — naming a long-departed
  // player as "le plus interpellé" reads strangely on the results screen.
  function topMentioned(room) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const name in mentions) {
      if (!present.has(name)) continue;
      if (!best || mentions[name] > mentions[best]) best = name;
    }
    return best ? { name: best, count: mentions[best] } : null;
  }
  function resetAll() { phase = "lobby"; promptIdx = -1; roundN = 0; rendered = ""; mentions = {}; }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => {
      const first = nextEligibleIdx(-1, presentNames(room).length);
      if (first < 0) return;
      promptIdx = first; renderPrompt(room, promptIdx); phase = "playing"; roundN = 1;
    },
    onAdvance: (room) => {
      if (phase === "lobby") {
        const first = nextEligibleIdx(-1, presentNames(room).length);
        if (first < 0) return;
        promptIdx = first; renderPrompt(room, promptIdx); phase = "playing"; roundN = 1;
      } else if (phase === "playing") {
        const next = nextEligibleIdx(promptIdx, presentNames(room).length);
        if (next < 0) { phase = "finished"; return; }
        promptIdx = next; renderPrompt(room, promptIdx); roundN++;
      } else { resetAll(); }
    },
    onReset: resetAll,
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    serializeRound: (room) => {
      const r = { round_n: roundN, total: PROMPTS.length };
      if (phase === "playing") { r.idx = promptIdx; r.prompt = rendered; }
      if (phase === "finished") {
        const m = topMentioned(room);
        if (m) r.mvp = { label: "Le plus interpellé", emoji: "🍻", name: m.name, value: m.count + " fois" };
      }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "picolo",
  name: "Picolo",
  emoji: "🍻",
  desc: "90 prompts d'ambiance avec les prénoms du groupe.",
  create,
};
