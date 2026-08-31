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
// cours et participent dès la question suivante. Le moteur ignore simplement
// les questions qu'ils n'ont pas partagées.

const packs = require("./packs");
const engine = require("./engine");
const players = require("./players");

const QUESTION_MS = Number(process.env.MATCH_QUESTION_MS) > 0 ? Number(process.env.MATCH_QUESTION_MS) : 30000;
const REVEAL_MS = Number(process.env.MATCH_REVEAL_MS) > 0 ? Number(process.env.MATCH_REVEAL_MS) : 5000;
const RESULTS_MS = Number(process.env.MATCH_RESULTS_MS) > 0 ? Number(process.env.MATCH_RESULTS_MS) : 60000;
const QUESTIONS_PER_ROUND = Number(process.env.MATCH_QUESTIONS) > 0 ? Number(process.env.MATCH_QUESTIONS) : 10;
const MIN_PLAYERS = 2;

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
  const playerMap = new Map();   // cid -> { cid, name, socketId, joinedAt }
  let state = "idle";            // idle | question | reveal | results
  let questions = [];            // questions tirées pour la manche en cours
  let qIdx = 0;
  // Sac de tirage : on pioche SANS REMISE et on ne rebat le paquet qu'une fois
  // vide. Redistribuer les 45 questions à chaque manche ramenait en moyenne
  // 2,2 questions déjà vues sur 10 — d'où l'impression de tourner en rond.
  // Avec le sac, une soirée enchaîne 4 manches sans la moindre répétition.
  let bag = [];
  let lastRoundIds = [];         // pour ne pas réenchaîner à cheval sur 2 sacs
  let answers = {};              // { [questionId]: { [name]: ranking } }
  let deadline = 0;              // fin de la phase courante (timestamp absolu)
  let lastResults = null;
  let lastIdleSince = Date.now();

  function activePlayers() { return [...playerMap.values()].filter((p) => p.socketId); }
  function activeNames() { return activePlayers().map((p) => p.name).filter(Boolean); }
  function hostPlayer() {
    const a = activePlayers();
    if (!a.length) return null;
    return a.slice().sort((x, y) => (x.joinedAt || 0) - (y.joinedAt || 0))[0];
  }

  function addPlayer(cid, name, socketId) {
    if (!cid || !name) return null;
    let p = playerMap.get(cid);
    if (p) { p.name = name; p.socketId = socketId; }
    else { p = { cid, name, socketId, joinedAt: Date.now() }; playerMap.set(cid, p); }
    return p;
  }
  function removePlayer(cid) {
    playerMap.delete(cid);
    if (state === "idle" && activePlayers().length === 0) lastIdleSince = Date.now();
  }

  function currentQuestion() { return questions[qIdx] || null; }

  // Combien de joueurs actifs ont répondu à la question courante ?
  function answeredCount() {
    const q = currentQuestion();
    if (!q) return 0;
    const a = answers[q.id] || {};
    return activeNames().filter((n) => a[n]).length;
  }
  function allAnswered() {
    const act = activeNames();
    if (!act.length) return false;
    const q = currentQuestion();
    if (!q) return false;
    const a = answers[q.id] || {};
    return act.every((n) => a[n]);
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
    const names = activeNames();
    lastResults = engine.buildResults(answers, names, { minShared: 1 });
    state = "results";
    deadline = (now || Date.now()) + RESULTS_MS;
    // Persistance : on mémorise les classements de chaque joueur pour le
    // « match historique » (être comparé plus tard à quelqu'un d'absent).
    activePlayers().forEach((p) => {
      if (!p.name) return;
      const mine = {};
      for (const qid in answers) {
        if (answers[qid][p.name]) mine[qid] = answers[qid][p.name];
      }
      if (Object.keys(mine).length) players.recordGame(p.name, p.cid, id, mine);
    });
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
    deadline = 0;
    lastIdleSince = now || Date.now();
  }

  function tick(now) {
    let dirty = false;
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
    return dirty;
  }

  function handleMessage(cid, msg) {
    const p = playerMap.get(cid);
    if (!p || !msg) return false;

    // Lancer la manche — hôte uniquement.
    if (msg.t === "demarrer") {
      if (state !== "idle") return false;
      const host = hostPlayer();
      if (!host || host.cid !== cid) return false;
      return startRound();
    }

    // Forcer l'étape suivante (⏭️) — hôte uniquement. Sert quand un joueur
    // bloque la question, ou pour écourter un reveal / l'écran de résultats.
    if (msg.t === "skip") {
      const host = hostPlayer();
      if (!host || host.cid !== cid) return false;
      const now = Date.now();
      if (state === "question") { toReveal(now); return true; }
      if (state === "reveal") { nextAfterReveal(now); return true; }
      if (state === "results") { resetToIdle(now); return true; }
      return false;
    }

    // Soumettre son classement pour la question courante.
    if (msg.t === "rank" && state === "question") {
      const q = currentQuestion();
      if (!q || !p.name) return false;
      const ranking = msg.ranking;
      if (!engine.isValidRanking(ranking, q.o.length)) return false;
      if (!answers[q.id]) answers[q.id] = {};
      if (answers[q.id][p.name]) return false;         // déjà répondu, on verrouille
      answers[q.id][p.name] = ranking.slice();
      // Si c'était le dernier à répondre, on enchaîne immédiatement.
      if (allAnswered()) toReveal(Date.now());
      return true;
    }
    return false;
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
      players: act.map((p) => ({ cid: p.cid, name: p.name })),
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
        const rankings = answers[q.id] || {};
        const gr = engine.groupRanking(rankings, q.o.length);
        snap.question = { id: q.id, q: q.q, o: q.o.slice() };
        snap.reveal = {
          group: gr.order.map((x) => ({ option: x.option, label: q.o[x.option], firstPicks: x.firstPicks })),
          voters: gr.voters,
          perfect: engine.perfectPairsFor(rankings, q.o.length),
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
        names: activeNames(),
        questions: questions.map((q) => ({ id: q.id, q: q.q, o: q.o.slice() })),
      };
    }
    return snap;
  }

  // Payload privé, par joueur : son propre classement + SON meilleur match.
  function privateFor(p) {
    if (!p || !p.name) return {};
    const out = {};
    const q = currentQuestion();
    if ((state === "question" || state === "reveal") && q) {
      const mine = (answers[q.id] || {})[p.name];
      if (mine) out.my_ranking = mine.slice();
    }
    if (state === "results" && lastResults) {
      out.personal = engine.personalFor(p.name, lastResults);
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
    addPlayer, removePlayer, handleMessage, tick, snapshot, privateFor, lobbyCard,
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
