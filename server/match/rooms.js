// Are We A Match? — une salle persistante par pack.
//
// Cycle de vie (la salle possède TOUT le timing ; le moteur est un pur
// calculateur de compatibilité) :
//
//   idle     ──Démarrer (HÔTE)──▶  question (30 s pour classer)
//   question ──tous ont répondu / temps écoulé / ⏭️ hôte──▶  reveal (5 s)
//   reveal   ──5 s──▶  question suivante   (ou results après la dernière)
//   results  ──60 s / hôte──▶  idle
//
// L'hôte = le 1ᵉʳ joueur encore actif (joinedAt), même règle que QuizzMaster :
// s'il part, l'arrivé suivant prend la couronne.
//
// Les retardataires peuvent rejoindre à tout moment : ils voient l'écran en
// cours et peuvent classer la question en cours elle-même (celle qui est déjà
// affichée, pas seulement la suivante). Le moteur ignore simplement, dans les
// résultats, les questions qu'ils n'ont pas partagées.

const packs = require("./packs");
const engine = require("./engine");
const players = require("./players");

const QUESTION_MS = Number(process.env.MATCH_QUESTION_MS) > 0 ? Number(process.env.MATCH_QUESTION_MS) : 30000;
const REVEAL_MS = Number(process.env.MATCH_REVEAL_MS) > 0 ? Number(process.env.MATCH_REVEAL_MS) : 5000;
const RESULTS_MS = Number(process.env.MATCH_RESULTS_MS) > 0 ? Number(process.env.MATCH_RESULTS_MS) : 60000;
const QUESTIONS_PER_ROUND = Number(process.env.MATCH_QUESTIONS) > 0 ? Number(process.env.MATCH_QUESTIONS) : 10;
const MIN_PLAYERS = 2;
const MIN_SHARED = 5; // questions communes minimum avant qu'un duo apparaisse n'importe où
// Délai de grâce après une déconnexion avant qu'un joueur soit vraiment
// retiré (couronne d'hôte, quota MIN_PLAYERS). Une coupure wifi de quelques
// secondes ou un rechargement de page ne doivent coûter ni la couronne ni la
// place dans la salle — seul un départ qui dure vraiment doit compter.
const GRACE_MS = Number(process.env.MATCH_GRACE_MS) > 0 ? Number(process.env.MATCH_GRACE_MS) : 5 * 60 * 1000;

function shuffle(arr) {
  const a = arr.slice();
  if (process.env.MATCH_NO_SHUFFLE === "1") return a;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function makeRoom(packDef) {
  const id = packDef.id;
  const playerMap = new Map();   // cid -> { cid, name, socketId, joinedAt, disconnectedAt }
  let state = "idle";            // idle | question | reveal | results
  let questions = [];            // questions tirées pour la manche en cours
  let qIdx = 0;
  // Sac de tirage : on pioche SANS REMISE et on ne rebat le paquet qu'une fois
  // vide. Redistribuer les 45 questions à chaque manche ramenait en moyenne
  // 2,2 questions déjà vues sur 10 — d'où l'impression de tourner en rond.
  // Avec le sac, une soirée enchaîne 4 manches sans la moindre répétition.
  let bag = [];
  let lastRoundIds = [];         // pour ne pas réenchaîner à cheval sur 2 sacs
  // Indexées par CID, jamais par pseudo : deux joueurs peuvent (rarement)
  // porter le même nom d'affichage ailleurs dans le code, et un pseudo est de
  // toute façon une donnée déclarative — le cid, lui, identifie sans ambiguïté
  // QUI a répondu quoi.
  let answers = {};              // { [questionId]: { [cid]: ranking } }
  let deadline = 0;              // fin de la phase courante (timestamp absolu)
  let lastResults = null;
  let lastNameByCid = null;      // instantané des noms au moment du dernier finishRound()
  let lastIdleSince = Date.now();

  // « Actif » = un socket est actuellement branché dessus. Un joueur
  // déconnecté GARDE sa place (cid, nom, joinedAt) pendant le délai de grâce :
  // recharger la page ou perdre le wifi une seconde ne doit ni lui faire
  // perdre la couronne d'hôte, ni le faire disparaître de la salle.
  function activePlayers() { return [...playerMap.values()].filter((p) => p.socketId); }
  function activeNames() { return activePlayers().map((p) => p.name).filter(Boolean); }
  function hostPlayer() {
    const a = activePlayers();
    if (!a.length) return null;
    return a.slice().sort((x, y) => (x.joinedAt || 0) - (y.joinedAt || 0))[0];
  }

  // Un pseudo déjà tenu par un AUTRE cid actif dans cette salle ? Appelé
  // avant d'accepter un join_room : deux réponses sous le même nom d'affichage
  // fusionneraient dans les résultats, et rien ne dit alors laquelle est
  // vraiment "Marie". Le pseudo reste libre dès que l'autre part (déconnexion
  // ou expiration du délai de grâce), comme n'importe quel pseudo en ligne.
  function nameTakenBy(name, excludeCid) {
    const k = String(name || "").trim().toLowerCase();
    if (!k) return false;
    for (const p of activePlayers()) {
      if (p.cid !== excludeCid && String(p.name || "").trim().toLowerCase() === k) return true;
    }
    return false;
  }

  function addPlayer(cid, name, socketId) {
    if (!cid || !name) return null;
    let p = playerMap.get(cid);
    if (p) { p.name = name; p.socketId = socketId; p.disconnectedAt = 0; }
    else { p = { cid, name, socketId, joinedAt: Date.now(), disconnectedAt: 0 }; playerMap.set(cid, p); }
    return p;
  }
  // Déconnexion (socket morte, onglet fermé, ping perdu) : on ne détruit PAS
  // le joueur, on le marque juste absent — sinon un simple rechargement de
  // page recréait un tout nouveau joueur avec un tout nouveau joinedAt, et la
  // couronne d'hôte (triée sur joinedAt) était perdue pour le reste de la
  // soirée. `socketId` fourni : on ne retire QUE si c'est bien ce socket qui
  // part — une vieille socket qui meurt après coup ne doit pas éjecter la
  // session qui vient de se reconnecter avec une socket toute neuve.
  function removePlayer(cid, socketId) {
    const p = playerMap.get(cid);
    if (!p) return;
    if (socketId && p.socketId !== socketId) return; // pas le socket courant : ignorer
    p.socketId = null;
    p.disconnectedAt = Date.now();
    if (state === "idle" && activePlayers().length === 0) lastIdleSince = Date.now();
  }
  // Départ VOLONTAIRE ("Retour au salon" depuis le hall) : là on retire pour
  // de vrai, tout de suite — pas de délai de grâce à faire jouer.
  function leaveForGood(cid) {
    playerMap.delete(cid);
    if (state === "idle" && activePlayers().length === 0) lastIdleSince = Date.now();
  }
  // Nettoyage périodique des fantômes : un joueur déconnecté depuis plus que
  // le délai de grâce n'est manifestement pas en train de recharger sa page —
  // on libère sa place (et son pseudo) pour de bon.
  function purgeStaleGhosts(now) {
    for (const [cid, p] of playerMap) {
      if (!p.socketId && p.disconnectedAt && now - p.disconnectedAt > GRACE_MS) playerMap.delete(cid);
    }
  }

  function currentQuestion() { return questions[qIdx] || null; }

  // Combien de joueurs actifs ont répondu à la question courante ?
  function answeredCount() {
    const q = currentQuestion();
    if (!q) return 0;
    const a = answers[q.id] || {};
    return activePlayers().filter((p) => a[p.cid]).length;
  }
  function allAnswered() {
    const act = activePlayers();
    if (!act.length) return false;
    const q = currentQuestion();
    if (!q) return false;
    const a = answers[q.id] || {};
    return act.every((p) => a[p.cid]);
  }

  // Rebat le paquet en repoussant à la fin les questions de la manche
  // précédente : au moment où le sac se vide en cours de soirée, on ne veut
  // pas retomber immédiatement sur ce qui vient d'être posé.
  function refillBag(avoidIds) {
    const fresh = shuffle(packDef.bank);
    const recent = new Set(avoidIds || []);
    if (!recent.size) return fresh;
    const cold = fresh.filter((q) => !recent.has(q.id));
    const warm = fresh.filter((q) => recent.has(q.id));
    return cold.concat(warm);
  }

  function drawQuestions(n) {
    const out = [];
    const taken = new Set();
    // Le sac peut se vider AU MILIEU d'une manche : il est alors rebattu en
    // écartant ce qui vient d'être posé (manche précédente et début de la
    // manche en cours), sans quoi la même question tomberait deux fois dans
    // la même partie.
    let guard = packDef.bank.length * 3 + n;
    while (out.length < n && guard-- > 0) {
      if (!bag.length) {
        bag = refillBag(lastRoundIds.concat([...taken]));
        if (!bag.length) break;      // banque vide : rien à tirer
      }
      const q = bag.shift();
      if (taken.has(q.id)) continue; // déjà posée dans cette manche
      taken.add(q.id);
      out.push(q);
    }
    return out;
  }

  function startRound() {
    if (activePlayers().length < MIN_PLAYERS) return false;
    const picked = drawQuestions(Math.min(QUESTIONS_PER_ROUND, packDef.bank.length));
    if (!picked.length) return false;
    questions = picked;
    lastRoundIds = picked.map((q) => q.id);
    qIdx = 0;
    answers = {};
    lastResults = null;
    state = "question";
    deadline = Date.now() + QUESTION_MS;
    return true;
  }

  function toReveal(now) {
    state = "reveal";
    deadline = (now || Date.now()) + REVEAL_MS;
  }

  function finishRound(now) {
    // Participants = tout cid qui a répondu à au moins une question, UNION
    // les joueurs encore actifs — pas activeNames() seul : un joueur
    // déconnecté juste avant la fin gardait sinon toutes ses réponses
    // effacées des résultats ET jamais persistées, alors qu'il avait
    // légitimement joué. playerMap conserve son nom même déconnecté (voir
    // removePlayer ci-dessus), donc son pseudo reste résolvable ici.
    const participantCids = new Set();
    for (const qid in answers) for (const cid in answers[qid]) participantCids.add(cid);
    activePlayers().forEach((p) => participantCids.add(p.cid));

    const nameByCid = new Map();
    const names = [];
    for (const cid of participantCids) {
      const p = playerMap.get(cid);
      if (!p || !p.name) continue; // parti pour de bon (leaveForGood) : rien à résoudre
      nameByCid.set(cid, p.name);
      names.push(p.name);
    }

    // Conversion cid → pseudo pour le moteur (qui parle "pseudo", pas "cid").
    // Sûr par construction : deux cid actifs ne peuvent jamais partager un
    // même pseudo dans une salle (nameTakenBy le refuse à l'entrée).
    const nameAnswers = {};
    for (const qid in answers) {
      const row = Object.create(null);
      for (const cid in answers[qid]) {
        const nm = nameByCid.get(cid);
        if (nm) row[nm] = answers[qid][cid];
      }
      nameAnswers[qid] = row;
    }

    lastResults = engine.buildResults(nameAnswers, names, { minShared: MIN_SHARED });
    lastNameByCid = nameByCid;
    state = "results";
    deadline = (now || Date.now()) + RESULTS_MS;

    // Persistance : on mémorise les classements de chaque participant pour le
    // « match historique » (être comparé plus tard à quelqu'un d'absent).
    for (const cid of participantCids) {
      const p = playerMap.get(cid);
      if (!p || !p.name) continue;
      const mine = {};
      for (const qid in answers) {
        if (answers[qid][cid]) mine[qid] = answers[qid][cid];
      }
      if (Object.keys(mine).length) players.recordGame(p.name, cid, id, mine);
    }
  }

  function nextAfterReveal(now) {
    if (qIdx + 1 < questions.length) {
      qIdx++;
      state = "question";
      deadline = (now || Date.now()) + QUESTION_MS;
    } else {
      finishRound(now);
    }
  }

  function resetToIdle(now) {
    state = "idle";
    questions = []; qIdx = 0; answers = {};
    lastResults = null;
    lastNameByCid = null;
    deadline = 0;
    lastIdleSince = now || Date.now();
  }

  function tick(now) {
    let dirty = false;
    // Sous l'effectif minimum en pleine manche (quelqu'un est parti, ou toute
    // la salle s'est vidée) : on ne laisse pas la manche dérouler dans le
    // vide — ni jusqu'à un écran de résultats sans personne pour le voir, ni
    // pendant les 6-7 minutes qu'aurait pris le cycle normal question→reveal.
    if (state !== "idle" && activePlayers().length < MIN_PLAYERS) {
      resetToIdle(now);
      return true;
    }
    if (state === "question") {
      // Tout le monde a répondu → on révèle sans attendre le chrono.
      if (allAnswered()) { toReveal(now); dirty = true; }
      else if (now >= deadline) { toReveal(now); dirty = true; }
    } else if (state === "reveal" && now >= deadline) {
      nextAfterReveal(now);
      dirty = true;
    } else if (state === "results" && now >= deadline) {
      resetToIdle(now);
      dirty = true;
    }
    purgeStaleGhosts(now);
    return dirty;
  }

  // Retourne { ok, reason? } plutôt qu'un booléen nu : le client verrouille
  // son UI de façon optimiste ("Classement envoyé ✅"), donc un rejet SILENCIEUX
  // (même appareil ouvert dans 2 onglets, message en retard sur une question
  // qui n'est déjà plus la bonne…) laissait l'UI mentir sans que rien ne le
  // détrompe jamais. Le detail de la raison permet à index.js de renvoyer un
  // accusé explicite à l'expéditeur.
  function handleMessage(cid, msg) {
    const p = playerMap.get(cid);
    if (!p || !msg) return { ok: false, reason: "no_player" };

    // Lancer la manche — hôte uniquement.
    if (msg.t === "demarrer") {
      if (state !== "idle") return { ok: false, reason: "not_idle" };
      const host = hostPlayer();
      if (!host || host.cid !== cid) return { ok: false, reason: "not_host" };
      return startRound() ? { ok: true } : { ok: false, reason: "cant_start" };
    }

    // Forcer l'étape suivante (⏭️) — hôte uniquement. Sert quand un joueur
    // bloque la question, ou pour écourter un reveal / l'écran de résultats.
    // `msg.state`/`msg.q_index`, quand fournis, doivent encore correspondre :
    // un skip mis en file pendant une coupure réseau et rejoué après coup ne
    // doit pas agir sur une phase que l'hôte n'a jamais vue passer.
    if (msg.t === "skip") {
      const host = hostPlayer();
      if (!host || host.cid !== cid) return { ok: false, reason: "not_host" };
      if (msg.state != null && msg.state !== state) return { ok: false, reason: "stale" };
      if (msg.q_index != null && msg.q_index !== qIdx) return { ok: false, reason: "stale" };
      const now = Date.now();
      if (state === "question") { toReveal(now); return { ok: true }; }
      if (state === "reveal") { nextAfterReveal(now); return { ok: true }; }
      if (state === "results") { resetToIdle(now); return { ok: true }; }
      return { ok: false, reason: "bad_state" };
    }

    // Soumettre son classement pour la question courante. `msg.qid`, quand
    // fourni, doit être celui de la question EN COURS : un classement mis en
    // file pendant une coupure et rejoué à la reconnexion arrivait sinon sur
    // la question suivante, sans qu'aucune incohérence ne soit détectable
    // (deux questions ont le même nombre d'options).
    if (msg.t === "rank" && state === "question") {
      const q = currentQuestion();
      if (!q || !p.name) return { ok: false, reason: "no_question" };
      if (msg.qid != null && msg.qid !== q.id) return { ok: false, reason: "stale" };
      const ranking = msg.ranking;
      if (!engine.isValidRanking(ranking, q.o.length)) return { ok: false, reason: "bad_ranking" };
      if (!answers[q.id]) answers[q.id] = Object.create(null);
      // Déjà répondu — p.ex. le même appareil ouvert dans 2 onglets, le
      // premier a déjà voté. On le dit explicitement plutôt que de laisser
      // le second croire, à tort, que SON classement est parti.
      if (answers[q.id][cid]) return { ok: false, reason: "already_answered" };
      answers[q.id][cid] = ranking.slice();
      // Si c'était le dernier à répondre, on enchaîne immédiatement.
      if (allAnswered()) toReveal(Date.now());
      return { ok: true };
    }
    return { ok: false, reason: "unknown_message" };
  }

  // État public (identique pour tous). Ne contient JAMAIS le classement
  // individuel d'un autre joueur pendant la phase `question`.
  function snapshot() {
    const now = Date.now();
    const host = hostPlayer();
    const act = activePlayers();
    const snap = {
      id, pack: packDef.id, pack_name: packDef.name, pack_emoji: packDef.emoji,
      pack_tagline: packDef.tagline,
      state,
      server_now_ms: now,
      deadline_ms: deadline || 0,
      question_total_ms: QUESTION_MS,
      reveal_total_ms: REVEAL_MS,
      min_players: MIN_PLAYERS,
      // JAMAIS le cid ici : c'est un identifiant de DEVICE, pas un pseudo —
      // le diffuser publiquement permettrait à n'importe qui, assis dans la
      // salle, de le rejouer dans set_identity et de se faire passer pour ce
      // joueur (y compris sur un pseudo protégé par PIN, puisque "même
      // device" court-circuite la vérification du PIN).
      players: act.map((p) => ({ name: p.name })),
      host_name: host ? host.name : null,
      q_index: qIdx,
      q_count: questions.length,
    };

    if (state === "question") {
      const q = currentQuestion();
      if (q) {
        snap.question = { id: q.id, q: q.q, o: q.o.slice() };
        snap.answered = answeredCount();
        snap.answered_total = act.length;
      }
    }

    if (state === "reveal") {
      const q = currentQuestion();
      if (q) {
        // groupRanking/perfectPairsFor n'ont besoin QUE des classements (les
        // clés — ici des cid — ne comptent pas pour le premier), sauf
        // perfectPairsFor qui renvoie ses clés telles quelles : on lui passe
        // donc une version reconvertie en pseudos pour l'affichage.
        const rankingsByCid = answers[q.id] || {};
        const rankingsByName = Object.create(null);
        for (const pcid in rankingsByCid) {
          const pl = playerMap.get(pcid);
          if (pl && pl.name) rankingsByName[pl.name] = rankingsByCid[pcid];
        }
        const gr = engine.groupRanking(rankingsByCid, q.o.length);
        snap.question = { id: q.id, q: q.q, o: q.o.slice() };
        snap.reveal = {
          group: gr.order.map((x) => ({ option: x.option, label: q.o[x.option], score: x.score, firstPicks: x.firstPicks })),
          voters: gr.voters,
          perfect: engine.perfectPairsFor(rankingsByName, q.o.length),
        };
      }
    }

    if (state === "results" && lastResults) {
      snap.results = {
        top: lastResults.top,
        podium: lastResults.podium,
        opposites: lastResults.opposites,
        groupSoul: lastResults.groupSoul,
        freeSpirit: lastResults.freeSpirit,
        matrix: lastResults.matrix,
        averages: lastResults.averages,
        // Figée au moment du finishRound(), PAS recalculée à chaque snapshot :
        // un arrivant pendant l'écran final ne doit ni gagner une ligne/colonne
        // de tirets dans la matrice, ni faire disparaître un duo du podium
        // parce que la liste "live" a changé sous les résultats déjà calculés.
        names: lastNameByCid ? [...lastNameByCid.values()] : [],
        questions: questions.map((q) => ({ id: q.id, q: q.q, o: q.o.slice() })),
      };
    }
    return snap;
  }

  // Payload privé, par joueur : son propre classement + SON meilleur match.
  // Résolu UNIQUEMENT par cid — jamais par un pseudo déclaré côté appelant —
  // sans quoi un joueur qui change de pseudo en cours de partie (ou un
  // deuxième onglet du même appareil) pourrait recevoir le flux privé de
  // quelqu'un d'autre. `cid` doit être celui, actuel, d'un joueur RÉELLEMENT
  // présent dans playerMap ; sinon, rien n'est renvoyé.
  function privateFor(cid) {
    const p = playerMap.get(cid);
    if (!p || !p.name) return {};
    const out = {};
    const q = currentQuestion();
    if ((state === "question" || state === "reveal") && q) {
      const mine = (answers[q.id] || {})[cid];
      if (mine) out.my_ranking = mine.slice();
    }
    if (state === "results" && lastResults) {
      // Le nom qui a servi à CE round (lastNameByCid), pas p.name : si le
      // joueur s'est renommé entre la fin de la manche et maintenant, ses
      // résultats restent ceux calculés sous le nom qu'il portait alors.
      const roundName = (lastNameByCid && lastNameByCid.get(cid)) || p.name;
      out.personal = engine.personalFor(roundName, lastResults);
      // Bonus : les meilleurs matchs historiques (autres soirées, même pack).
      try { out.historic = players.historicMatches(p.name, id, { minShared: 5 }); }
      catch (e) { out.historic = []; }
    }
    return out;
  }

  function lobbyCard() {
    const act = activePlayers();
    return {
      id, pack: packDef.id, pack_name: packDef.name, pack_emoji: packDef.emoji,
      pack_tagline: packDef.tagline,
      state,
      player_count: act.length,
      q_index: qIdx,
      q_count: questions.length,
      bank_size: packDef.bank.length,
    };
  }

  return {
    id, pack: packDef.id,
    addPlayer, removePlayer, leaveForGood, nameTakenBy,
    handleMessage, tick, snapshot, privateFor, lobbyCard,
    hasPlayer: (cid) => playerMap.has(cid),
  };
}

function buildAll() {
  return Object.values(packs).map((p) => makeRoom(p));
}

module.exports = {
  buildAll, PACKS: packs,
  QUESTION_MS, REVEAL_MS, RESULTS_MS, QUESTIONS_PER_ROUND, MIN_PLAYERS,
};
