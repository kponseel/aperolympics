// Quiz — server-authoritative, ported from esp32-hub/src/games/quiz.cpp.
//
// This file is the reference for porting the other 15 games: copy the shape
// (a `create()` returning the hooks below) and translate the matching .cpp.
//
// Hook contract (mirror of games/game_api.h). Every hook receives the `room`
// (use room.players / room.activePlayers()); never broadcast yourself — the
// core does it after each hook and whenever tick() returns true.
//   phase()                  -> "lobby" | "playing" | "reveal" | "finished"
//   onSelect(room)           -> entered from the hub (reset)
//   onStart(room)            -> explicit start (optional)
//   onAdvance(room)          -> NEXT pressed (host / admin)
//   onReset(room)            -> full reset
//   onEndSession(room)       -> host pressed 🏁 (loop-only games; flip to "finished")
//   onPlayerJoin(room, p)    -> optional
//   onPlayerLeave(room, p)   -> optional
//   onMessage(room, p, msg)  -> game-specific intent (server decides outcomes)
//   serializeRound(room)     -> object put in state.round
//   serializePrivate(room,p) -> per-player whisper, or null (optional)
//   tick(room, nowMs)        -> return true if state changed (timers)
//
// Reserved keys on `state.round` at phase==="finished" — consumed by the
// shared fin-de-partie screen in public/app.js (renderResults):
//   mvp:           { label, name, value, emoji? }   per-game session stat
//   winner_banner: { text, emoji? }                 role/cup games' headline
//
// CLIENT-side (public/games/<id>.js) registration flags consumed by the SPA:
//   scored:     true  -> render a 3-medal podium at "finished" (else "Partie jouée — N")
//   endable:    true  -> show the 🏁 topbar button (host can force "finished")
//   minPlayers: N     -> hub card shows "👥 N+" badge; below this disables Démarrer
//   renderFinishedExtras(area, state, helpers) -> optional hook to layer
//                       game-specific reveal content under the shared screen
//                       (wolves uses it for the role roster).

const QUESTION_TIME_MS = 10000; // max answer time per question (10 s)

const QUESTIONS = [
  { text: "Quelle est la capitale de la France ?", options: ["Lyon", "Paris", "Marseille", "Nice"], correct: 1 },
  { text: "Combien font 7 × 8 ?", options: ["54", "56", "64", "48"], correct: 1 },
  { text: "Quel gaz les plantes absorbent-elles ?", options: ["Oxygène", "Azote", "CO₂", "Hélium"], correct: 2 },
  { text: "Quel est le plus grand océan ?", options: ["Atlantique", "Indien", "Arctique", "Pacifique"], correct: 3 },
  { text: "Combien de bits dans un octet ?", options: ["4", "8", "16", "32"], correct: 1 },
  { text: "Quelle est la capitale de l'Espagne ?", options: ["Lisbonne", "Madrid", "Athènes", "Rome"], correct: 1 },
  { text: "Quelle est la plus grosse planète du système solaire ?", options: ["Mars", "Saturne", "Jupiter", "Neptune"], correct: 2 },
  { text: "Combien y a-t-il de continents ?", options: ["4", "5", "6", "7"], correct: 3 },
  { text: "Quel animal a le plus long cou ?", options: ["Autruche", "Lama", "Girafe", "Flamant"], correct: 2 },
  { text: "Qui a peint la Joconde ?", options: ["Michel-Ange", "Raphaël", "Léonard de Vinci", "Picasso"], correct: 2 },
  { text: "Comment s'appelle un bébé chien ?", options: ["Chaton", "Chiot", "Faon", "Poulain"], correct: 1 },
  { text: "Quel est le plus grand désert chaud du monde ?", options: ["Gobi", "Kalahari", "Atacama", "Sahara"], correct: 3 },
  { text: "En quelle année est tombé le Mur de Berlin ?", options: ["1985", "1989", "1991", "1993"], correct: 1 },
  { text: "Combien de touches a un piano classique ?", options: ["76", "82", "88", "96"], correct: 2 },
  { text: "Quelle est la monnaie du Japon ?", options: ["Won", "Yuan", "Yen", "Baht"], correct: 2 },
  { text: "Quel est le plus haut sommet du monde ?", options: ["K2", "Mont Blanc", "Everest", "Kilimandjaro"], correct: 2 },
  { text: "Quel sport pratique Roger Federer ?", options: ["Golf", "Tennis", "Ski", "Basket"], correct: 1 },
  { text: "Combien de joueurs dans une équipe de foot ?", options: ["9", "10", "11", "12"], correct: 2 },
  { text: "Quelle est la capitale de l'Australie ?", options: ["Sydney", "Melbourne", "Canberra", "Perth"], correct: 2 },
  { text: "Quel auteur a écrit « Les Misérables » ?", options: ["Zola", "Hugo", "Balzac", "Dumas"], correct: 1 },
  { text: "Combien d'os dans le corps humain adulte ?", options: ["186", "206", "256", "306"], correct: 1 },
  { text: "Quelle planète a des anneaux célèbres ?", options: ["Mars", "Jupiter", "Saturne", "Uranus"], correct: 2 },
  { text: "Quel est le pays le plus peuplé au monde ?", options: ["Chine", "Inde", "USA", "Indonésie"], correct: 1 },
  { text: "Combien de côtés a un hexagone ?", options: ["5", "6", "7", "8"], correct: 1 },
  { text: "Combien de cordes sur une guitare standard ?", options: ["4", "5", "6", "7"], correct: 2 },
];

function create() {
  let phase = "lobby";
  let currentQ = -1;
  let questionStart = 0;
  let paused = false; // host pause: timer frozen, question hidden for everyone
  let pausedAt = 0;
  let streakNow = {};   // name -> current consecutive correct count
  let bestStreak = {};  // name -> longest correct streak achieved this session
  let lastGain = {};    // name -> points awarded on the most recent question (for the reveal screen)

  function startQuestion(room, idx) {
    currentQ = idx;
    phase = "playing";
    questionStart = Date.now();
    paused = false;
    pausedAt = 0;
    room.players.forEach((p) => {
      p.answered = false;
      p.answer = -1;
    });
  }

  function allAnswered(room) {
    const a = room.activePlayers();
    return a.length > 0 && a.every((p) => p.answered);
  }

  function doReveal(room) {
    if (phase !== "playing") return; // idempotent: timeout vs all-answered
    const correct = QUESTIONS[currentQ].correct;
    lastGain = {};
    room.activePlayers().forEach((p) => {
      if (p.answered && p.answer === correct) {
        let frac = 1 - p.answerMs / QUESTION_TIME_MS;
        if (frac < 0) frac = 0;
        const gain = 500 + Math.round(500 * frac);
        p.score += gain;
        lastGain[p.name] = gain;
        streakNow[p.name] = (streakNow[p.name] || 0) + 1;
        if (streakNow[p.name] > (bestStreak[p.name] || 0)) bestStreak[p.name] = streakNow[p.name];
      } else {
        streakNow[p.name] = 0;
      }
    });
    phase = "reveal";
  }

  function topStreak(room) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const name in bestStreak) {
      if (!present.has(name)) continue;
      if (!best || bestStreak[name] > bestStreak[best]) best = name;
    }
    return (best && bestStreak[best] >= 2) ? { name: best, count: bestStreak[best] } : null;
  }

  function resetAll(room) {
    phase = "lobby";
    currentQ = -1;
    paused = false;
    pausedAt = 0;
    streakNow = {};
    bestStreak = {};
    lastGain = {};
    room.players.forEach((p) => {
      p.score = 0;
      p.answered = false;
      p.answer = -1;
    });
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { if (QUESTIONS.length) startQuestion(room, 0); },
    onAdvance: (room) => {
      if (phase === "lobby") { if (QUESTIONS.length) startQuestion(room, 0); }
      else if (phase === "playing") { doReveal(room); }
      else if (phase === "reveal") {
        if (currentQ + 1 < QUESTIONS.length) startQuestion(room, currentQ + 1);
        else phase = "finished";
      } else { resetAll(room); }
    },
    onReset: resetAll,
    // Host can cut a long quiz short — straight to fin de partie with the
    // current scores. Idempotent (lobby/finished are no-ops).
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onPlayerLeave: (room, p) => {
      // Don't let dropping mid-question preserve (and silently extend) a streak:
      // a timeout would zero it via doReveal's else-branch, so a disconnect should too.
      if (p && p.name && phase === "playing" && !p.answered) streakNow[p.name] = 0;
      if (phase === "playing" && allAnswered(room)) doReveal(room);
    },
    onMessage: (room, p, msg) => {
      if (!p) return;
      const isHost = room.hostName() === p.name;
      // Host pause/resume: freeze the timer; while paused the question is hidden
      // for everyone (serializeRound) and answers are refused.
      if (msg.t === "pause") {
        if (isHost && phase === "playing" && !paused) { paused = true; pausedAt = Date.now(); }
        return;
      }
      if (msg.t === "resume") {
        if (isHost && phase === "playing" && paused) { questionStart += Date.now() - pausedAt; paused = false; }
        return;
      }
      if (msg.t !== "answer") return;
      if (phase !== "playing" || paused || p.answered) return;
      const choice = msg.choice;
      if (typeof choice !== "number" || choice < 0 || choice > 3) return;
      p.answered = true;
      p.answer = choice;
      p.answerMs = Date.now() - questionStart;
      if (allAnswered(room)) doReveal(room);
    },
    serializeRound: (room) => {
      const r = { total: QUESTIONS.length };
      if (currentQ < 0) return r;
      const q = QUESTIONS[currentQ];
      r.idx = currentQ;
      if (phase === "playing" && paused) {
        r.paused = true; // hide everything while the host has paused
        return r;
      }
      if (phase === "playing" || phase === "reveal") {
        r.q = q.text;
        r.options = q.options.slice();
      }
      if (phase === "playing") {
        const elapsed = Date.now() - questionStart;
        const left = elapsed >= QUESTION_TIME_MS ? 0 : QUESTION_TIME_MS - elapsed;
        r.time_left_ms = left;
        r.time_total_ms = QUESTION_TIME_MS;
        r.points_now = 500 + Math.round(500 * (left / QUESTION_TIME_MS)); // points a correct answer earns right now
        r.answered = room.activePlayers().filter((p) => p.answered).length;
      } else if (phase === "reveal") {
        r.correct = q.correct;
        // Per-player score deltas for this question so the reveal screen can
        // show "+X pts" next to each correct answerer.
        r.gains = Object.keys(lastGain).map((n) => ({ name: n, gain: lastGain[n] }));
      }
      if (phase === "finished") {
        const s = topStreak(room);
        if (s) r.mvp = { label: "Meilleure série de bonnes réponses", emoji: "🔥", name: s.name, value: s.count + " d'affilée" };
      }
      return r;
    },
    // Per-player: tell each player at reveal whether they got the question
    // right. `answer` is no longer in the public state (privacy), so the
    // ✅/❌ badge needs this whisper to know.
    serializePrivate: (room, viewer) => {
      if (!viewer || phase !== "reveal" || currentQ < 0) return {};
      const correct = QUESTIONS[currentQ].correct;
      return { my_correct: !!(viewer.answered && viewer.answer === correct) };
    },
    tick: (room, now) => {
      if (phase !== "playing" || paused) return false;
      if (now - questionStart >= QUESTION_TIME_MS) { doReveal(room); return true; }
      return true; // refresh the live countdown (points + timer bar) ~2x/s
    },
  };
}

module.exports = {
  id: "quiz",
  name: "Quiz",
  emoji: "🧠",
  desc: "Questions à choix multiples, score au chrono.",
  create,
};
