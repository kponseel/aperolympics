// "Je n'ai jamais" — anonymous binary vote (have / never). answer: 0 = "J'ai
// déjà", 1 = "Jamais". 130-prompt bank; 10 picked at random per match. End-of-
// session stats: most experienced, most innocent — aggregate-only to preserve
// the per-round anonymity that's the whole point of the game.

const PROMPT_BANK = [
  // Original 25 head (kept stable for deterministic tests).
  "Je n'ai jamais fumé une cigarette",
  "Je n'ai jamais menti à un parent",
  "Je n'ai jamais sauté un cours",
  "Je n'ai jamais chanté en public sobre",
  "Je n'ai jamais oublié un anniversaire important",
  "Je n'ai jamais envoyé un message à la mauvaise personne",
  "Je n'ai jamais pleuré devant un film d'animation",
  "Je n'ai jamais dansé seul devant un miroir",
  "Je n'ai jamais menti sur mon âge",
  "Je n'ai jamais fait semblant d'être malade pour éviter quelque chose",
  "Je n'ai jamais googlé mon propre nom",
  "Je n'ai jamais embrassé quelqu'un que je connaissais à peine",
  "Je n'ai jamais oublié de souhaiter un anniversaire et fait semblant de m'en souvenir",
  "Je n'ai jamais menti sur mon CV",
  "Je n'ai jamais regardé 3 épisodes de série d'affilée à 3 h du matin",
  "Je n'ai jamais fait semblant de connaître une chanson en chantant « na na na »",
  "Je n'ai jamais conduit sans permis",
  "Je n'ai jamais fait semblant d'avoir lu un livre célèbre",
  "Je n'ai jamais rêvé d'un(e) collègue/camarade",
  "Je n'ai jamais lu les CGU avant d'accepter",
  "Je n'ai jamais piraté un film ou une série",
  "Je n'ai jamais menti pour éviter d'aller à une fête",
  "Je n'ai jamais blâmé un pet sur quelqu'un d'autre",
  "Je n'ai jamais fait pipi dans la piscine",
  "Je n'ai jamais dansé sur une table",
  // +105 nouveaux
  "Je n'ai jamais menti sur le temps de trajet pour arriver en retard",
  "Je n'ai jamais bu directement au goulot d'une bouteille en commun",
  "Je n'ai jamais mangé un truc tombé par terre (règle des 5 secondes)",
  "Je n'ai jamais fini un pot de Nutella à la cuillère",
  "Je n'ai jamais fait un selfie aux toilettes",
  "Je n'ai jamais relu une discussion avec mon crush 10 fois",
  "Je n'ai jamais stalké un(e) ex sur les réseaux",
  "Je n'ai jamais swippé pendant un dîner en famille",
  "Je n'ai jamais embrassé un(e) inconnu(e) en soirée",
  "Je n'ai jamais perdu mes clés bourré(e)",
  "Je n'ai jamais perdu mon téléphone une nuit entière",
  "Je n'ai jamais vomi en soirée",
  "Je n'ai jamais dormi tout habillé(e)",
  "Je n'ai jamais raté un avion ou un train",
  "Je n'ai jamais dormi dans un endroit public",
  "Je n'ai jamais pris un selfie avec un(e) inconnu(e)",
  "Je n'ai jamais menti à un(e) ami(e) pour annuler un plan",
  "Je n'ai jamais cassé quelque chose chez quelqu'un sans le dire",
  "Je n'ai jamais piqué un truc dans un Airbnb / hôtel",
  "Je n'ai jamais menti sur ce que je gagne",
  "Je n'ai jamais fait un achat impulsif > 200 €",
  "Je n'ai jamais regretté un tatouage / piercing",
  "Je n'ai jamais regretté une coupe de cheveux pendant des mois",
  "Je n'ai jamais demandé pardon en pleurant",
  "Je n'ai jamais cru à une théorie du complot pendant 5 min",
  "Je n'ai jamais cru en une signe astrologique pour décider de quelque chose",
  "Je n'ai jamais menti pour avoir une réduction étudiant",
  "Je n'ai jamais resquillé dans le métro",
  "Je n'ai jamais fait semblant d'aimer un cadeau",
  "Je n'ai jamais fait un compliment hypocrite",
  "Je n'ai jamais aimé secrètement un truc « cringe »",
  "Je n'ai jamais chanté du Céline Dion à fond seul(e)",
  "Je n'ai jamais regardé un épisode de télé-réalité jusqu'au bout",
  "Je n'ai jamais menti sur mes lectures à un date",
  "Je n'ai jamais dit que j'avais vu un film alors que non",
  "Je n'ai jamais fait semblant d'aimer un sport pour quelqu'un",
  "Je n'ai jamais inventé une excuse de boulot pour rester chez moi",
  "Je n'ai jamais dormi pendant une réunion / un cours",
  "Je n'ai jamais envoyé un email à toute la boîte par erreur",
  "Je n'ai jamais menti sur le fait d'avoir lu un message",
  "Je n'ai jamais ignoré un message volontairement",
  "Je n'ai jamais bloqué quelqu'un sur les réseaux",
  "Je n'ai jamais supprimé une photo après comparaison de likes",
  "Je n'ai jamais demandé à un(e) ex un service",
  "Je n'ai jamais recouché avec un(e) ex",
  "Je n'ai jamais dit « je t'aime » trop tôt",
  "Je n'ai jamais menti sur le nombre de personnes avec qui j'ai été",
  "Je n'ai jamais parlé en mal d'un(e) ami(e) dans son dos",
  "Je n'ai jamais ressenti de la jalousie envers un(e) proche",
  "Je n'ai jamais utilisé l'astuce du toast à l'envers",
  "Je n'ai jamais pleuré au cinéma",
  "Je n'ai jamais pleuré devant une pub",
  "Je n'ai jamais ri tellement fort que j'ai pleuré en public",
  "Je n'ai jamais perdu un pari ridicule",
  "Je n'ai jamais fini bourré(e) le lundi soir",
  "Je n'ai jamais joué au strip-poker",
  "Je n'ai jamais participé à un karaoké jusqu'à 3 h",
  "Je n'ai jamais embrassé quelqu'un du même sexe en soirée",
  "Je n'ai jamais menti à un médecin",
  "Je n'ai jamais menti à un(e) coach sportif(ve)",
  "Je n'ai jamais sauté la queue d'un magasin",
  "Je n'ai jamais fait du stop",
  "Je n'ai jamais conduit pieds nus",
  "Je n'ai jamais conduit en chantant à fond",
  "Je n'ai jamais piqué un crayon / stylo au boulot",
  "Je n'ai jamais ramené du papier toilette du boulot",
  "Je n'ai jamais utilisé l'imprimante du bureau pour perso",
  "Je n'ai jamais menti dans un avis Google",
  "Je n'ai jamais laissé un avis 1 étoile par revanche",
  "Je n'ai jamais menti pour avoir un repas gratuit",
  "Je n'ai jamais traversé en dehors des clous devant un flic",
  "Je n'ai jamais menti au contrôle de billets",
  "Je n'ai jamais fait du télétravail depuis le canapé en pyjama",
  "Je n'ai jamais regardé une série pendant une visio",
  "Je n'ai jamais menti sur la météo pour annuler une sortie",
  "Je n'ai jamais commandé deux desserts dans le même resto",
  "Je n'ai jamais demandé un coup d'un soir",
  "Je n'ai jamais ghosté quelqu'un",
  "Je n'ai jamais été ghosté(e) (juré)",
  "Je n'ai jamais matché avec quelqu'un que je connaissais déjà",
  "Je n'ai jamais utilisé une appli de rencontre",
  "Je n'ai jamais menti sur ma taille ou mon âge sur un profil",
  "Je n'ai jamais pris le métro sans payer",
  "Je n'ai jamais oublié un anniversaire de couple",
  "Je n'ai jamais fini par dormir dans le canapé après une dispute",
  "Je n'ai jamais regardé une saison entière en moins de 48 h",
  "Je n'ai jamais menti à mes parents sur où j'étais le week-end",
  "Je n'ai jamais fait semblant d'écouter une histoire ennuyeuse",
  "Je n'ai jamais regardé une story 50 fois",
  "Je n'ai jamais accepté un défi débile à cause d'un pari",
  "Je n'ai jamais cassé un objet à quelqu'un en cachette",
  "Je n'ai jamais lu un message privé sur le tel d'un(e) ami(e)",
  "Je n'ai jamais lu un journal intime sans permission",
  "Je n'ai jamais espionné un(e) voisin(e)",
  "Je n'ai jamais répondu à une question pour quelqu'un d'autre",
  "Je n'ai jamais regretté un commentaire posté à 1 h du matin",
  "Je n'ai jamais répondu « pdr » sans rire vraiment",
  "Je n'ai jamais inventé une histoire pour briller en société",
  "Je n'ai jamais menti dans un CV pour décrocher un job",
  "Je n'ai jamais dragué quelqu'un en couple (sans savoir)",
  "Je n'ai jamais embrassé un(e) ex après une rupture",
  "Je n'ai jamais payé un service avec une fausse identité",
  "Je n'ai jamais simulé être chiffré à la sécurité",
  "Je n'ai jamais demandé une rallonge d'alcool à 2 h du matin",
  "Je n'ai jamais bu un café froid trouvé sur mon bureau",
];

const ROUND_SIZE = 10; // 10 questions par partie, tirées au hasard

function create() {
  let phase = "lobby";
  let prompts = [];
  let currentIdx = -1;
  let haveCount = {};    // name -> times the player answered "J'ai déjà"
  let neverCount = {};   // name -> times the player answered "Jamais"

  function pickRound() {
    const idxs = PROMPT_BANK.map((_, i) => i);
    if (process.env.NEVER_NO_SHUFFLE !== "1") {
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
  function resetAll(room) { phase = "lobby"; prompts = []; currentIdx = -1; haveCount = {}; neverCount = {}; clearRound(room); }
  function topBy(counts, room) {
    const present = new Set(); room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const n in counts) { if (!present.has(n)) continue; if (!best || counts[n] > counts[best]) best = n; }
    return (best && counts[best] > 0) ? { name: best, count: counts[best] } : null;
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { pickRound(); if (prompts.length) startRound(room, 0); },
    onAdvance: (room) => {
      if (phase === "lobby") { pickRound(); if (prompts.length) startRound(room, 0); }
      else if (phase === "playing") { phase = "reveal"; }
      else if (phase === "reveal") {
        if (currentIdx + 1 < prompts.length) startRound(room, currentIdx + 1);
        else phase = "finished";
      } else { resetAll(room); }
    },
    onReset: resetAll,
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onPlayerLeave: (room) => { if (phase === "playing" && allVoted(room)) phase = "reveal"; },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || p.answered) return;
      if (msg.t !== "answer") return;
      const v = msg.value;
      if (v !== 0 && v !== 1) return;
      p.answered = true;
      p.answer = v;
      if (v === 0) haveCount[p.name] = (haveCount[p.name] || 0) + 1;
      else neverCount[p.name] = (neverCount[p.name] || 0) + 1;
      if (allVoted(room)) phase = "reveal";
    },
    serializeRound: (room) => {
      const r = { total: ROUND_SIZE };
      if (currentIdx < 0 || !prompts.length) return r;
      r.idx = currentIdx;
      if (phase === "playing" || phase === "reveal") {
        r.prompt = prompts[currentIdx];
        r.answered = room.activePlayers().filter((p) => p.answered).length;
      }
      if (phase === "reveal") {
        r.have = countWith(room, 0);
        r.never = countWith(room, 1);
      }
      if (phase === "finished") {
        const exp = topBy(haveCount, room), inn = topBy(neverCount, room);
        if (exp) r.mvp = { label: "Le plus expérimenté", emoji: "🙊", name: exp.name, value: exp.count + " × « j'ai déjà »" };
        r.extras = [];
        if (inn) r.extras.push({ emoji: "😇", label: "Le plus innocent", name: inn.name, value: inn.count + " × « jamais »" });
      }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "never",
  name: "Je n'ai jamais",
  emoji: "🙊",
  desc: "10 questions parmi 130 — anonyme, j'ai déjà ou jamais ?",
  create,
};
