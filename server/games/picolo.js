// "Picolo" — escalating party prompts; the host advances. {p1}/{p2}/{p3} are
// replaced by random distinct active player names. Ported from
// esp32-hub/src/games/picolo.cpp.

const PROMPTS = [
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
  function renderPrompt(room, idx) {
    if (idx < 0 || idx >= PROMPTS.length) { rendered = ""; return; }
    const names = room.activePlayers().map((p) => p.name);
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
      const first = nextEligibleIdx(-1, room.activePlayers().length);
      if (first < 0) return;
      promptIdx = first; renderPrompt(room, promptIdx); phase = "playing"; roundN = 1;
    },
    onAdvance: (room) => {
      if (phase === "lobby") {
        const first = nextEligibleIdx(-1, room.activePlayers().length);
        if (first < 0) return;
        promptIdx = first; renderPrompt(room, promptIdx); phase = "playing"; roundN = 1;
      } else if (phase === "playing") {
        const next = nextEligibleIdx(promptIdx, room.activePlayers().length);
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
  desc: "Prompts pour ambiance soirée, avec les prénoms du groupe.",
  create,
};
