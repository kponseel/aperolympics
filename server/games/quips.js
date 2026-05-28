// "Vannes" (Quips, Jackbox-style) — 2 random contestants write a punchline, the
// rest vote A/B, the funnier wins. Ported from esp32-hub/src/games/quips.cpp.
// Contestant identity is the player name (client compares me.id === contestant_*_id,
// and our buildState sets id = name). Server is authoritative.

const PROMPTS = [
  "La pire excuse possible pour annuler un rendez-vous",
  "Le slogan d'un fast-food trop honnête",
  "Une devise de famille gênante",
  "La réplique d'un mauvais film d'action",
  "Le pire surnom pour un chat",
  "Le titre d'une autobiographie de ton voisin",
  "Une chanson qui passerait dans un ascenseur",
  "Le pire conseil que tu as reçu",
  "Une publicité des années 80",
  "Une règle de jeu de société absurde",
  "Le nom d'un parfum vraiment improbable",
  "Le motto secret d'un super-méchant timide",
  "Un slogan pour une marque de chaussettes",
  "Une excuse pour ne pas faire la vaisselle",
  "Le titre d'un film qui ferait fuir au cinéma",
  "Un cri de guerre pour des enfants en colo",
  "La première phrase d'un journal apocalyptique",
  "Le nom d'un groupe de musique improbable",
  "La devise d'une école de cuisine en déroute",
  "Le titre d'une théorie du complot ridicule",
  "Une phrase entendue dans une pub pharmaceutique",
  "Le pire compliment à faire en speed dating",
  "Le nom d'un nouveau parfum Yankee Candle",
  "Une excuse de retard pour un Premier Ministre",
  "La première ligne d'un poème écrit par une IA défaillante",
];
const ANS_LEN = 47;

function create() {
  let phase = "lobby";
  let promptIdx = -1;
  let contestantA = null; // player name
  let contestantB = null;
  let answerA = "";
  let answerB = "";
  let step = 0; // 0 = submit, 1 = vote
  let votesA = 0, votesB = 0;
  let roundN = 0;
  let roundWins = {}; // name -> rounds won (used for MVP at end)
  let lastGain = {};  // name -> points earned in the most recent round (for the reveal screen)

  function isContestant(name) { return name && (name === contestantA || name === contestantB); }

  function clearRound(room) {
    room.players.forEach((p) => { p.answered = false; p.answer = -1; });
    answerA = ""; answerB = ""; votesA = 0; votesB = 0;
  }

  function pickContestants(room) {
    const actives = room.activePlayers().map((p) => p.name);
    if (actives.length < 2) { contestantA = null; contestantB = null; return; }
    const i = Math.floor(Math.random() * actives.length);
    let j = Math.floor(Math.random() * (actives.length - 1));
    if (j >= i) j++;
    contestantA = actives[i];
    contestantB = actives[j];
  }

  function startRound(room) {
    if (!PROMPTS.length) return;
    promptIdx = Math.floor(Math.random() * PROMPTS.length);
    pickContestants(room);
    if (!contestantA) { phase = "lobby"; return; }
    clearRound(room);
    step = 0;
    phase = "playing";
    roundN++;
  }

  function resetAll(room) {
    phase = "lobby"; promptIdx = -1; contestantA = null; contestantB = null; step = 0; roundN = 0;
    roundWins = {};
    lastGain = {};
    clearRound(room);
    room.players.forEach((p) => { p.score = 0; });
  }
  function topComic(room) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const n in roundWins) {
      if (!present.has(n)) continue;
      if (!best || roundWins[n] > roundWins[best]) best = n;
    }
    return (best && roundWins[best] > 0) ? { name: best, count: roundWins[best] } : null;
  }

  function bothSubmitted() { return !!answerA && !!answerB; }
  function allVotersVoted(room) {
    const voters = room.activePlayers().filter((p) => !isContestant(p.name));
    return voters.length > 0 && voters.every((p) => p.answered);
  }
  function awardWinner(room) {
    const a = contestantA && room.players.get(contestantA.toLowerCase());
    const b = contestantB && room.players.get(contestantB.toLowerCase());
    lastGain = {};
    if (votesA === votesB) {
      if (a) { a.score += 100; lastGain[contestantA] = 100; }
      if (b) { b.score += 100; lastGain[contestantB] = 100; }
    } else if (votesA > votesB) {
      if (a) { a.score += 300; lastGain[contestantA] = 300; }
      if (contestantA) roundWins[contestantA] = (roundWins[contestantA] || 0) + 1;
    } else {
      if (b) { b.score += 300; lastGain[contestantB] = 300; }
      if (contestantB) roundWins[contestantB] = (roundWins[contestantB] || 0) + 1;
    }
  }

  function advance(room) {
    if (phase === "lobby") { startRound(room); return; }
    if (phase === "playing" && step === 0) {
      if (!answerA) answerA = "(pas de reponse)";
      if (!answerB) answerB = "(pas de reponse)";
      room.players.forEach((p) => { p.answered = false; p.answer = -1; });
      step = 1;
      return;
    }
    if (phase === "playing" && step === 1) { awardWinner(room); phase = "reveal"; return; }
    if (phase === "reveal") { startRound(room); return; }
    resetAll(room);
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { startRound(room); },
    onAdvance: advance,
    onReset: resetAll,
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onPlayerLeave: (room, p) => {
      if (phase !== "playing") return;
      if (p && isContestant(p.name)) { if (step === 0) advance(room); }
      else if (step === 1 && allVotersVoted(room)) advance(room);
    },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing") return;
      if (step === 0 && msg.t === "submit" && isContestant(p.name)) {
        let text = String(msg.text == null ? "" : msg.text).replace(/^[ \t]+/, "");
        if (!text) return;
        text = text.slice(0, ANS_LEN).replace(/[ \t]+$/, "");
        if (!text) return;
        if (p.name === contestantA) { if (answerA) return; answerA = text; }
        else { if (answerB) return; answerB = text; }
        if (bothSubmitted()) advance(room);
        return;
      }
      if (step === 1 && msg.t === "vote" && !isContestant(p.name) && !p.answered) {
        const v = msg.value;
        if (v === 0) { votesA++; p.answered = true; p.answer = 0; }
        else if (v === 1) { votesB++; p.answered = true; p.answer = 1; }
        else return;
        if (allVotersVoted(room)) advance(room);
      }
    },
    serializeRound: (room) => {
      const r = { round_n: roundN };
      if (phase === "lobby") return r;
      r.prompt = promptIdx >= 0 ? PROMPTS[promptIdx] : "";
      if (contestantA) { r.contestant_a_id = contestantA; r.contestant_a_name = contestantA; }
      if (contestantB) { r.contestant_b_id = contestantB; r.contestant_b_name = contestantB; }
      r.step = step === 0 ? "submit" : "vote";
      if (phase === "playing" && step === 0) {
        r.submitted = (answerA ? 1 : 0) + (answerB ? 1 : 0);
        r.submitted_a = !!answerA;
        r.submitted_b = !!answerB;
      }
      if (phase === "playing" && step === 1) {
        r.answer_a = answerA;
        r.answer_b = answerB;
        const voters = room.activePlayers().filter((p) => !isContestant(p.name));
        r.voted = voters.filter((p) => p.answered).length;
        r.voters = voters.length;
      }
      if (phase === "reveal") {
        r.answer_a = answerA;
        r.answer_b = answerB;
        r.votes_a = votesA;
        r.votes_b = votesB;
        r.winner = votesA === votesB ? "tie" : (votesA > votesB ? "a" : "b");
        r.gains = Object.keys(lastGain).map((n) => ({ name: n, gain: lastGain[n] }));
      }
      if (phase === "finished") {
        const t = topComic(room);
        if (t) r.mvp = { label: "Meilleur vanneur", emoji: "🎤", name: t.name, value: t.count + " round" + (t.count > 1 ? "s" : "") + " gagné" + (t.count > 1 ? "s" : "") };
      }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "quips",
  name: "Vannes",
  emoji: "🎤",
  desc: "Deux contestants ecrivent la meilleure vanne, la salle vote.",
  create,
};
