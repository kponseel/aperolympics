// "Le plus susceptible" — secret vote. 130-prompt bank; a fresh random 10
// picked per match (avoid déjà-vu). End-of-session stats: most-voted MVP,
// the silver-medal "outsider", and the "âmes sœurs du vote" pair (the two
// players who voted for the same target most often). Server is authoritative.

const PROMPT_BANK = [
  // Original 25 (kept at the head so deterministic tests still hit a known
  // prompt at idx 0).
  "Qui est le plus susceptible de chanter au karaoke ?",
  "Qui est le plus susceptible d'oublier son anniversaire ?",
  "Qui est le plus susceptible de finir milliardaire ?",
  "Qui est le plus susceptible de devenir prof ?",
  "Qui est le plus susceptible de partir vivre a l'etranger ?",
  "Qui est le plus susceptible de finir le frigo a 3h du matin ?",
  "Qui est le plus susceptible de pleurer devant un Disney ?",
  "Qui est le plus susceptible d'envoyer un message a son ex ?",
  "Qui est le plus susceptible de se perdre dans son propre quartier ?",
  "Qui est le plus susceptible de rater son train ?",
  "Qui est le plus susceptible de tomber amoureux/se en vacances ?",
  "Qui est le plus susceptible de finir sur scene un jour ?",
  "Qui est le plus susceptible de mentir sur son age ?",
  "Qui est le plus susceptible d'oublier son tel quelque part ?",
  "Qui est le plus susceptible de gagner au loto et tout depenser ?",
  "Qui est le plus susceptible de devenir vegan ?",
  "Qui est le plus susceptible de se faire arnaquer en ligne ?",
  "Qui est le plus susceptible de finir tatoueur ?",
  "Qui est le plus susceptible d'avoir 5 enfants ?",
  "Qui est le plus susceptible de divorcer 3 fois ?",
  "Qui est le plus susceptible de passer un Noel seul a l'autre bout du monde ?",
  "Qui est le plus susceptible de devenir influenceur/euse ?",
  "Qui est le plus susceptible de se reveiller en retard a son mariage ?",
  "Qui est le plus susceptible de finir avec un emploi bizarre (testeur de matelas, mascotte) ?",
  "Qui est le plus susceptible de croire encore au pere Noel a 30 ans ?",
  // +105 nouveaux
  "Qui est le plus susceptible de finir en prison pour une raison ridicule ?",
  "Qui est le plus susceptible de faire pipi dans une piscine sans prévenir ?",
  "Qui est le plus susceptible de parler tout seul dans la rue ?",
  "Qui est le plus susceptible de publier une photo qu'il/elle regrettera 5 ans plus tard ?",
  "Qui est le plus susceptible d'envoyer un sms à son boss par erreur ?",
  "Qui est le plus susceptible de finir patron d'une boîte un peu louche ?",
  "Qui est le plus susceptible de devenir politicien(ne) ?",
  "Qui est le plus susceptible de devenir youtubeur food ?",
  "Qui est le plus susceptible de monter un side-business chelou ?",
  "Qui est le plus susceptible d'acheter un truc inutile à 3 h du matin ?",
  "Qui est le plus susceptible de cramer 500 € en soldes en 20 min ?",
  "Qui est le plus susceptible de craquer pour une arnaque pyramidale ?",
  "Qui est le plus susceptible de partir en road-trip sans plan ?",
  "Qui est le plus susceptible de rater son vol parce qu'il/elle dormait ?",
  "Qui est le plus susceptible de perdre son passeport en voyage ?",
  "Qui est le plus susceptible de se faire arrêter pour resquille dans le métro ?",
  "Qui est le plus susceptible de parler dans son sommeil en voyage ?",
  "Qui est le plus susceptible de ronfler dans un avion ?",
  "Qui est le plus susceptible de récupérer le mauvais bagage à l'aéroport ?",
  "Qui est le plus susceptible de tomber amoureux/se du serveur en vacances ?",
  "Qui est le plus susceptible de se marier à Las Vegas sur un coup de tête ?",
  "Qui est le plus susceptible de devenir parent par accident ?",
  "Qui est le plus susceptible d'avoir eu un crush sur un(e) prof ?",
  "Qui est le plus susceptible de balancer un secret au pire moment ?",
  "Qui est le plus susceptible de rire pendant un enterrement ?",
  "Qui est le plus susceptible d'oublier le prénom d'un(e) ex en pleine soirée ?",
  "Qui est le plus susceptible de s'endormir en pleine soirée ?",
  "Qui est le plus susceptible de boire son verre, celui des autres ET le pichet ?",
  "Qui est le plus susceptible d'être cuit(e) avant 22 h ?",
  "Qui est le plus susceptible de piquer de la nourriture dans l'assiette d'un(e) autre ?",
  "Qui est le plus susceptible de demander à goûter et finir le plat ?",
  "Qui est le plus susceptible de mettre du ketchup sur tout ?",
  "Qui est le plus susceptible de détester un truc bobo (matcha, kombucha) ?",
  "Qui est le plus susceptible de devenir crossfiteur(se) extrême ?",
  "Qui est le plus susceptible de courir un marathon sans entraînement ?",
  "Qui est le plus susceptible d'abandonner un cours de yoga au bout de 5 min ?",
  "Qui est le plus susceptible de faire un body roll involontaire en dansant ?",
  "Qui est le plus susceptible de chanter faux mais à fond au karaoké ?",
  "Qui est le plus susceptible de demander un slow à un(e) inconnu(e) ?",
  "Qui est le plus susceptible d'embrasser un(e) parfait(e) inconnu(e) ?",
  "Qui est le plus susceptible de tomber amoureux/se de quelqu'un croisé(e) dans le métro ?",
  "Qui est le plus susceptible de flirter avec un robot vocal (Siri, Alexa) ?",
  "Qui est le plus susceptible de liker une photo de 2014 d'un(e) ex ?",
  "Qui est le plus susceptible d'envoyer un vocal de 4 min pour ne rien dire ?",
  "Qui est le plus susceptible d'envoyer un meme à la famille au pire moment ?",
  "Qui est le plus susceptible de casser un truc chez quelqu'un et partir sans le dire ?",
  "Qui est le plus susceptible de mentir sur ses compétences en cuisine ?",
  "Qui est le plus susceptible de cramer un plat dans le micro-ondes ?",
  "Qui est le plus susceptible de confondre sel et sucre dans un gâteau ?",
  "Qui est le plus susceptible d'oublier le four allumé toute une nuit ?",
  "Qui est le plus susceptible de mettre du gel douche dans les cheveux ?",
  "Qui est le plus susceptible de chercher ses lunettes alors qu'elles sont sur sa tête ?",
  "Qui est le plus susceptible de chercher son tel pendant qu'il/elle téléphone ?",
  "Qui est le plus susceptible d'avouer un secret en dormant ?",
  "Qui est le plus susceptible d'oublier le prénom de son crush en le présentant ?",
  "Qui est le plus susceptible de faire un faux pas vestimentaire mémorable ?",
  "Qui est le plus susceptible d'acheter le même vêtement en 3 couleurs ?",
  "Qui est le plus susceptible de finir avec une garde-robe 100 % noire ?",
  "Qui est le plus susceptible de devenir collectionneur(se) de plantes ?",
  "Qui est le plus susceptible de devenir collectionneur(se) de figurines ?",
  "Qui est le plus susceptible de faire un cosplay un jour ?",
  "Qui est le plus susceptible de se mettre au vinyle pour faire l'esthète ?",
  "Qui est le plus susceptible de devenir adepte d'un sport ultra-niche ?",
  "Qui est le plus susceptible de partir en ashram un mois ?",
  "Qui est le plus susceptible d'échouer à un détox digital en moins de 12 h ?",
  "Qui est le plus susceptible d'acheter un van pour le revendre 3 mois plus tard ?",
  "Qui est le plus susceptible de devenir adepte des cryptos ?",
  "Qui est le plus susceptible de mettre toutes ses économies dans une seule action et de tout perdre ?",
  "Qui est le plus susceptible d'acheter un bien immobilier sur un coup de tête ?",
  "Qui est le plus susceptible de finir avec une chèvre et un potager ?",
  "Qui est le plus susceptible d'adopter 3 chats d'un coup ?",
  "Qui est le plus susceptible d'envoyer le mauvais fichier à son boss ?",
  "Qui est le plus susceptible de faire « Répondre à tous » à la place de « Répondre » ?",
  "Qui est le plus susceptible de faire une visio sans pantalon ?",
  "Qui est le plus susceptible d'avoir un appareil dentaire à 35 ans ?",
  "Qui est le plus susceptible de faire un selfie au mauvais moment ?",
  "Qui est le plus susceptible de parler trop fort au téléphone dans le train ?",
  "Qui est le plus susceptible d'écouter de la musique sans écouteurs en public ?",
  "Qui est le plus susceptible d'ouvrir Instagram en pleine réunion ?",
  "Qui est le plus susceptible de retweeter par erreur un truc compromettant ?",
  "Qui est le plus susceptible de payer son café avec un billet de 100 € ?",
  "Qui est le plus susceptible d'oublier sa carte au resto et d'appeler 3 ami(e)s ?",
  "Qui est le plus susceptible de demander un doggy bag dans un 3 étoiles ?",
  "Qui est le plus susceptible de négocier un prix dans un magasin sans solde ?",
  "Qui est le plus susceptible de saluer quelqu'un qui ne le saluait pas ?",
  "Qui est le plus susceptible de rater un check et d'en faire un drama ?",
  "Qui est le plus susceptible d'inventer une excuse délirante pour annuler un plan ?",
  "Qui est le plus susceptible de cuisiner un croque-monsieur à 4 h du matin ?",
  "Qui est le plus susceptible de passer 1 h à cuisiner juste pour soi ?",
  "Qui est le plus susceptible de démarrer un podcast et d'abandonner après 2 épisodes ?",
  "Qui est le plus susceptible de lancer un blog et de le laisser mort ?",
  "Qui est le plus susceptible d'ouvrir une boutique Etsy et de tout vendre 5 € ?",
  "Qui est le plus susceptible de partir un week-end et d'oublier la moitié des affaires ?",
  "Qui est le plus susceptible de dormir dans une maison hantée pour le fun ?",
  "Qui est le plus susceptible d'écrire un roman et de le cacher pour toujours ?",
  "Qui est le plus susceptible de tout plaquer pour devenir surfeur(se) ?",
  "Qui est le plus susceptible de tomber amoureux/se de la voix d'un GPS ?",
  "Qui est le plus susceptible d'ouvrir une cagnotte pour ses propres bonbons ?",
  "Qui est le plus susceptible de retrouver un crush d'enfance sur LinkedIn ?",
  "Qui est le plus susceptible d'oublier son rendez-vous médical 3 fois ?",
  "Qui est le plus susceptible d'organiser un anniversaire surprise raté ?",
  "Qui est le plus susceptible de partir vivre dans un autre pays sur un coup de tête ?",
  "Qui est le plus susceptible d'apprendre une chorégraphie TikTok à 40 ans ?",
  "Qui est le plus susceptible de tomber raide dingue d'un personnage de série ?",
  "Qui est le plus susceptible d'oublier le mariage d'un(e) ami(e) proche ?",
];

const ROUND_SIZE = 10; // 10 questions par partie, tirées au hasard

function create() {
  let phase = "lobby";
  let prompts = [];          // shuffled subset for this match
  let currentIdx = -1;       // index INTO `prompts`
  let votes = {};            // round-local: target name -> vote count
  let totalVotes = {};       // session-cumulative: target name -> votes received
  let voteAlignment = {};    // "A||B" (sorted) -> rounds where A and B voted for the same target

  function pickRound() {
    const idxs = PROMPT_BANK.map((_, i) => i);
    if (process.env.MOST_LIKELY_NO_SHUFFLE !== "1") {
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
  // Tally one round: every PAIR of voters who picked the SAME target gains
  // one point. Lets us crown a "âmes sœurs du vote" at the end.
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
    phase = "lobby";
    prompts = [];
    currentIdx = -1;
    totalVotes = {};
    voteAlignment = {};
    clearRound(room);
  }
  // Pick the player who collected the most votes across all rounds. Only crown
  // a player who is still in the room — naming a long-departed player as
  // "Le plus voté de la soirée" reads strangely on the results screen.
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
  // Silver medal: 2nd-most-voted present player, excluding the MVP.
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
        if (top) r.mvp = { label: "Le plus voté de la soirée", emoji: "😈", name: top.name, value: top.count + " vote" + (top.count > 1 ? "s" : "") };
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
  id: "most_likely",
  name: "Le plus susceptible",
  emoji: "😈",
  desc: "10 questions parmi 130 — vote secret, qui est le plus susceptible de... ?",
  create,
};
