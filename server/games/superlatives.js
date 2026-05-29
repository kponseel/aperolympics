// "Superlatifs" — secret vote by category. Same vote shape as most_likely;
// different bank. 100+ prompts; a random 10/match keeps things fresh, and at
// the finish we crown the most-voted, the silver-medal outsider, and the
// "âmes sœurs du vote" pair (parity with most_likely).

const PROMPT_BANK = [
  // Original 25 head — kept stable so deterministic tests still hit "drole" at idx 0.
  "Le/la plus drole du groupe",
  "Le/la plus drama queen",
  "Le/la plus susceptible de devenir celebre",
  "Le/la meilleur(e) cuisinier(e)",
  "Le/la plus voyageur(e)",
  "Le/la plus style(e)",
  "Le/la plus organise(e)",
  "Le/la plus probable d'avoir un chat plus tard",
  "Le/la plus probable de courir un marathon",
  "Le/la plus probable de monter une startup",
  "Le/la plus loyal(e)",
  "Le/la plus chaotique en soiree",
  "Le/la plus calin(e)",
  "Le/la plus accro a son tel",
  "Le/la plus tete-en-l'air",
  "Le/la plus sportif/ive",
  "Le/la plus rapide pour repondre a un message",
  "Le/la plus susceptible de t'aider a 3h du matin",
  "Le/la plus mauvais(e) menteur/se",
  "Le/la plus prevenant(e)",
  "Le/la plus fanatique d'un sujet bizarre",
  "Le/la plus susceptible de finir en politique",
  "Le/la roi/reine des memes",
  "Le/la plus difficile a reveiller",
  "Le/la plus apte a survivre en pleine nature",
  // +85 nouveaux superlatifs
  "Le/la plus généreux/se",
  "Le/la plus tactile",
  "Le/la plus radin(e) sur l'apéro",
  "Le/la roi/reine du karaoké",
  "Le/la plus mauvais(e) danseur(se)",
  "Le/la plus susceptible de gagner un Top Chef",
  "Le/la plus susceptible de rater son train",
  "Le/la plus en retard sur tout",
  "Le/la plus dispo à 3 h du mat'",
  "Le/la roi/reine du dad joke",
  "Le/la plus susceptible de finir sur scène",
  "Le/la plus susceptible de se perdre dans son propre quartier",
  "Le/la plus susceptible de devenir parent en premier",
  "Le/la plus susceptible de partir vivre à l'étranger",
  "Le/la plus susceptible de gagner au loto et tout dépenser",
  "Le/la meilleur(e) hôte de soirée",
  "Le/la plus susceptible de pleurer devant un Disney",
  "Le/la plus accro à Netflix",
  "Le/la plus susceptible de te texter à 2 h du matin",
  "Le/la plus susceptible de partir en mode aventure tout(e) seul(e)",
  "Le/la plus susceptible d'organiser un anniversaire surprise",
  "Le/la plus susceptible de finir maire d'un petit village",
  "Le/la plus calé(e) en culture geek",
  "Le/la plus susceptible d'écrire un livre",
  "Le/la plus susceptible d'avoir 5 chats",
  "Le/la plus susceptible de monter un food truck",
  "Le/la plus susceptible de finir podcasteur(se)",
  "Le/la plus susceptible de devenir prof",
  "Le/la plus susceptible d'enchaîner 3 marathons",
  "Le/la plus susceptible de gagner Koh-Lanta",
  "Le/la roi/reine des théories du complot",
  "Le/la plus susceptible de tomber amoureux/se en vacances",
  "Le/la plus susceptible d'envoyer un meme au mauvais groupe",
  "Le/la plus susceptible de te défendre dans une bagarre",
  "Le/la plus calme face à une crise",
  "Le/la plus susceptible de paniquer pour un rien",
  "Le/la plus susceptible d'écouter encore les Daft Punk dans 30 ans",
  "Le/la plus susceptible d'avoir une boutique Etsy",
  "Le/la plus susceptible de devenir youtubeur(se)",
  "Le/la plus susceptible d'écrire un roman et de l'oublier dans un tiroir",
  "Le/la plus susceptible de tout plaquer pour faire le tour du monde",
  "Le/la plus susceptible de finir nudiste sur une plage perdue",
  "Le/la plus susceptible de se tromper de prénom en cas de drague",
  "Le/la plus susceptible de craquer pour une pub TikTok",
  "Le/la plus susceptible de finir au journal local pour un truc absurde",
  "Le/la plus susceptible de tomber dans une fontaine en regardant son tel",
  "Le/la plus susceptible de battre tout le monde au Trivial Pursuit",
  "Le/la plus susceptible de battre tout le monde à un quiz musical",
  "Le/la plus susceptible de te confier le plus gros secret",
  "Le/la plus susceptible de raconter le secret 5 min après",
  "Le/la plus susceptible de garder rancune 10 ans",
  "Le/la plus susceptible de pardonner trop vite",
  "Le/la plus susceptible de payer la tournée",
  "Le/la plus susceptible d'oublier sa carte au restau",
  "Le/la plus susceptible de prendre un dessert en plus",
  "Le/la plus susceptible de commander un truc bizarre au restau",
  "Le/la plus susceptible de finir le frigo à 3 h",
  "Le/la plus mauvais(e) au volant",
  "Le/la plus susceptible de râler sur la météo",
  "Le/la plus susceptible de râler sur les transports en commun",
  "Le/la plus susceptible de devenir militant(e) écolo",
  "Le/la plus susceptible d'adopter un mode de vie minimaliste",
  "Le/la plus susceptible de re-craquer pour une nouvelle paire de sneakers",
  "Le/la plus susceptible de devenir collectionneur(se) compulsif(ve)",
  "Le/la plus susceptible de connaître toutes les paroles de Stromae",
  "Le/la plus susceptible de chanter du Céline Dion seul(e) sous la douche",
  "Le/la plus susceptible de balayer un buffet à volonté",
  "Le/la plus susceptible de filmer chaque coucher de soleil",
  "Le/la plus susceptible de prendre 200 photos d'un même plat",
  "Le/la plus mauvais(e) photographe du groupe",
  "Le/la meilleur(e) photographe du groupe",
  "Le/la plus susceptible de poster un selfie depuis un lieu hostile",
  "Le/la plus susceptible de devenir patron(ne) ultra-strict(e)",
  "Le/la plus susceptible d'être le/la chef tranquille",
  "Le/la plus susceptible de te masser quand t'as mal au dos",
  "Le/la plus susceptible de tout faire à l'arrache mais que ça marche",
  "Le/la plus susceptible de planifier les vacances 6 mois à l'avance",
  "Le/la plus susceptible de t'embarquer dans un délire à 4 h du matin",
  "Le/la plus susceptible de te coacher pour un objectif perso",
  "Le/la plus susceptible de te raconter sa vie au premier verre",
  "Le/la plus susceptible de te servir une analyse psy non sollicitée",
  "Le/la plus susceptible d'écouter en boucle un seul album",
  "Le/la plus susceptible de découvrir un groupe avant tout le monde",
  "Le/la plus susceptible de devenir DJ amateur",
  "Le/la plus susceptible d'apprendre la guitare et d'abandonner",
];

const ROUND_SIZE = 10; // 10 superlatifs par partie, tirés au hasard

function create() {
  let phase = "lobby";
  let prompts = [];
  let currentIdx = -1;
  let votes = {};
  let totalVotes = {};
  let voteAlignment = {};    // "A||B" -> rounds where A and B voted for the same target

  function pickRound() {
    const idxs = PROMPT_BANK.map((_, i) => i);
    if (process.env.SUPERLATIVES_NO_SHUFFLE !== "1") {
      for (let i = idxs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = idxs[i]; idxs[i] = idxs[j]; idxs[j] = t; }
    }
    prompts = idxs.slice(0, Math.min(ROUND_SIZE, idxs.length)).map((i) => PROMPT_BANK[i]);
  }
  function clearRound(room) {
    votes = {};
    room.players.forEach((p) => { p.answered = false; p.answer = -1; p.voteTarget = null; });
  }
  function startRound(room, idx) { currentIdx = idx; phase = "playing"; clearRound(room); }
  function allVoted(room) { const a = room.activePlayers(); return a.length > 0 && a.every((p) => p.answered); }
  function tallyRound(room) {
    const voters = [...room.players.values()].filter((p) => p.name && p.answered && p.voteTarget);
    for (let i = 0; i < voters.length; i++) {
      for (let j = i + 1; j < voters.length; j++) {
        if (voters[i].voteTarget !== voters[j].voteTarget) continue;
        const key = [voters[i].name, voters[j].name].sort().join("||");
        voteAlignment[key] = (voteAlignment[key] || 0) + 1;
      }
    }
  }
  function toReveal(room) { phase = "reveal"; tallyRound(room); }
  function resetAll(room) {
    phase = "lobby"; prompts = []; currentIdx = -1; totalVotes = {}; voteAlignment = {}; clearRound(room);
  }
  function topVoted(room) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const name in totalVotes) {
      if (!present.has(name)) continue;
      if (!best || totalVotes[name] > totalVotes[best]) best = name;
    }
    return best ? { name: best, count: totalVotes[best] } : null;
  }
  function secondVoted(room, excludeName) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const name in totalVotes) {
      if (!present.has(name)) continue;
      if (name === excludeName) continue;
      if (totalVotes[name] <= 0) continue;
      if (!best || totalVotes[name] > totalVotes[best]) best = name;
    }
    return best ? { name: best, count: totalVotes[best] } : null;
  }
  function topPair(room) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const k in voteAlignment) {
      const [x, y] = k.split("||");
      if (!present.has(x) || !present.has(y)) continue;
      if (!best || voteAlignment[k] > best.count) best = { names: [x, y], count: voteAlignment[k] };
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
      if (msg.t !== "vote") return;
      const target = room.players.get(String(msg.target_id || "").toLowerCase());
      if (!target || !target.name) return;
      p.answered = true;
      p.voteTarget = target.name;
      votes[target.name] = (votes[target.name] || 0) + 1;
      totalVotes[target.name] = (totalVotes[target.name] || 0) + 1;
      if (allVoted(room)) toReveal(room);
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
        r.votes = Object.keys(votes)
          .filter((name) => votes[name] > 0)
          .map((name) => ({ name: name, count: votes[name] }));
      }
      if (phase === "finished") {
        const top = topVoted(room);
        if (top) r.mvp = { label: "Champion(ne) des superlatifs", emoji: "🏆", name: top.name, value: top.count + " vote" + (top.count > 1 ? "s" : "") };
        const second = top ? secondVoted(room, top.name) : null;
        const pair = topPair(room);
        r.extras = [];
        if (second) r.extras.push({ emoji: "🥈", label: "L'outsider", name: second.name, value: second.count + " vote" + (second.count > 1 ? "s" : "") });
        if (pair) r.extras.push({ emoji: "💞", label: "Les âmes sœurs du vote", name: pair.names.join(" & "), value: pair.count + " votes communs" });
      }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "superlatives",
  name: "Superlatifs",
  emoji: "🏆",
  desc: "10 catégories parmi 110 — vote secret, qui est le/la plus X ?",
  create,
};
