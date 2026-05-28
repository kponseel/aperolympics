// "Le Bluff" — write a fake answer, then vote the real one out of the shuffled
// pool. Ported from esp32-hub/src/games/bluff.cpp. The C++ "owner slot" maps to
// a player name here (names are unique). Server is authoritative.

const QUESTIONS = [
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
];
const MAX_SUBMISSION_LEN = 31;

function create() {
  let phase = "lobby";
  let qIdx = -1;
  let step = 0; // 0 = submit fakes, 1 = vote
  let submissions = {}; // player name -> fake text
  let options = []; // [{ text, owner: name|null }]  (null owner = real answer)
  let realOptionIdx = -1;
  let bluffVotes = {}; // name -> cumulative votes their fake lies have lured
  let lastGain = {};   // name -> points scored on the most recent question

  function clearStepFlags(room) { room.players.forEach((p) => { p.answered = false; p.answer = -1; }); }
  function clearFullRound(room) { clearStepFlags(room); submissions = {}; options = []; realOptionIdx = -1; }
  function startRound(room, idx) { qIdx = idx; step = 0; phase = "playing"; clearFullRound(room); }
  function resetAll(room) {
    phase = "lobby"; qIdx = -1; step = 0; clearFullRound(room);
    bluffVotes = {};
    lastGain = {};
    room.players.forEach((p) => { p.score = 0; });
  }
  function topBluffer() {
    let best = null;
    for (const name in bluffVotes) { if (!best || bluffVotes[name] > bluffVotes[best]) best = name; }
    return (best && bluffVotes[best] > 0) ? { name: best, count: bluffVotes[best] } : null;
  }
  function allActiveActed(room) { const a = room.activePlayers(); return a.length > 0 && a.every((p) => p.answered); }

  function shuffleAndSealOptions(room) {
    options = [];
    const real = QUESTIONS[qIdx].a;
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
    // Credit everyone who actually voted (not just `activePlayers()`): a voter
    // who dropped between voting and the reveal still cast their vote, and the
    // bluffer they fooled deserves the bluffVotes credit (parity with would_rather).
    room.players.forEach((p) => {
      if (!p.name || !p.answered) return;
      const pick = p.answer;
      if (typeof pick !== "number" || pick < 0 || pick >= options.length) return;
      if (pick === realOptionIdx) { p.score += 500; lastGain[p.name] = (lastGain[p.name] || 0) + 500; return; }
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
    if (phase === "lobby") { if (QUESTIONS.length) startRound(room, 0); return; }
    if (phase === "playing" && step === 0) { shuffleAndSealOptions(room); step = 1; clearStepFlags(room); return; }
    if (phase === "playing" && step === 1) { applyScoring(room); phase = "reveal"; return; }
    if (phase === "reveal") {
      if (qIdx + 1 < QUESTIONS.length) startRound(room, qIdx + 1);
      else phase = "finished";
      return;
    }
    resetAll(room);
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { if (QUESTIONS.length) startRound(room, 0); },
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
      const r = { total: QUESTIONS.length };
      if (qIdx < 0) return r;
      r.idx = qIdx;
      r.q = QUESTIONS[qIdx].q;
      r.step = step === 0 ? "submit" : "vote";
      const active = room.activePlayers();
      if (phase === "playing") {
        r.answered = active.filter((p) => p.answered).length;
        r.players_active = active.length;
        if (step === 1) r.options = options.map((o) => o.text);
      }
      if (phase === "reveal") {
        r.real_answer = QUESTIONS[qIdx].a;
        r.real_option_idx = realOptionIdx;
        r.options = options.map((o, i) => {
          const obj = { text: o.text, real: i === realOptionIdx };
          if (o.owner) obj.owner = o.owner;
          return obj;
        });
        r.gains = Object.keys(lastGain).map((n) => ({ name: n, gain: lastGain[n] }));
      }
      if (phase === "finished") {
        const b = topBluffer();
        if (b) r.mvp = { label: "Meilleur bluffeur", emoji: "🤥", name: b.name, value: b.count + " piège" + (b.count > 1 ? "s" : "") };
      }
      return r;
    },
    // Per-player whispers:
    //   - vote step: which option is the viewer's own fake (so the client can
    //     grey it out — voting your own is rejected server-side and would
    //     otherwise silently stall the round).
    //   - reveal:    whether the viewer voted the truth (so the +500 personal
    //     badge fires only for correct guessers, not for incidental bluff
    //     scorers; needed because `answer` no longer ships in the public state).
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
  desc: "Question difficile : ecris une fausse reponse, vote la vraie.",
  create,
};
