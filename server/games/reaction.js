// "Réflexe" — solo skill game played in parallel by every player in the room.
// Each player runs their 5 attempts locally; the client posts the best (and
// average) to the server. The server keeps a per-player best-ever ms, builds
// a sorted "réflexes de la salle" ranking, and turns the best ms into a `score`
// (5000 - bestMs) so the global 🏆 leaderboard sorts correctly even though
// "lower ms is better". onEndSession lets the host 🏁 the session and surface
// the gold-medal réflexe MVP on the shared fin-de-partie screen.

function create() {
  let phase = "lobby";        // lobby -> playing (-> finished via host 🏁)
  let bestMs = {};            // name -> best single ms across the session
  let attempts = {};          // name -> total successful taps (caps at 5 per "run")
  let runs = {};              // name -> completed full-runs of 5

  function clearAll() { bestMs = {}; attempts = {}; runs = {}; }
  function inversedScore(ms) { return ms > 0 ? Math.max(0, 5000 - ms) : 0; }

  function applyScores(room) {
    room.players.forEach((p) => {
      if (!p.name) return;
      p.score = inversedScore(bestMs[p.name] || 0);
    });
  }

  function topReflexes(room) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    const list = [];
    for (const n in bestMs) {
      // Only show currently-connected players in the live ranking — keeping
      // departed players in here clutters the board and rewards a player who
      // already left.
      if (!present.has(n)) continue;
      if (!bestMs[n]) continue;
      list.push({ name: n, best_ms: bestMs[n], attempts: attempts[n] || 0, runs: runs[n] || 0 });
    }
    list.sort((a, b) => a.best_ms - b.best_ms);
    return list;
  }

  return {
    phase: () => phase,
    onSelect: (room) => { phase = "lobby"; clearAll(); applyScores(room); },
    onStart: (room) => { phase = "playing"; clearAll(); applyScores(room); },
    onAdvance: (room) => { if (phase === "lobby") { phase = "playing"; clearAll(); applyScores(room); } },
    onReset: (room) => { phase = "lobby"; clearAll(); applyScores(room); },
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onMessage: (room, p, msg) => {
      if (!p || !p.name || phase === "lobby") return;
      if (msg.t === "tap") {
        // Single-attempt result: { ms: number, run_complete: bool }
        const ms = Number(msg.ms);
        if (!isFinite(ms) || ms <= 0 || ms > 5000) return;
        if (!bestMs[p.name] || ms < bestMs[p.name]) bestMs[p.name] = ms;
        attempts[p.name] = (attempts[p.name] || 0) + 1;
        if (msg.run_complete) runs[p.name] = (runs[p.name] || 0) + 1;
        applyScores(room);
      }
    },
    serializeRound: (room) => {
      const top = topReflexes(room);
      const r = { solo: true, top: top };
      if (phase === "finished" && top.length) {
        r.mvp = { label: "Réflexe en or", emoji: "⚡", name: top[0].name, value: top[0].best_ms + " ms" };
        if (top.length > 1) {
          r.extras = [{ emoji: "🥈", label: "Vice-champion(ne) du réflexe", name: top[1].name, value: top[1].best_ms + " ms" }];
          if (top.length > 2) r.extras.push({ emoji: "🥉", label: "3ᵉ marche du podium", name: top[2].name, value: top[2].best_ms + " ms" });
        }
      }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "reaction",
  name: "Réflexe",
  emoji: "⚡",
  desc: "Tape dès que l'écran passe au vert — 5 essais. Classement live de la salle.",
  create,
};
