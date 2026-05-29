// "Roulette russe" — 1 to 6 players, ONE shared revolver. Six chambers, a
// single bullet placed at random for the round (hidden until it fires). Players
// take turns pulling the SAME gun: solo, you pull every chamber yourself; with
// others, the trigger passes around the table. Whoever lands the loaded chamber
// drinks — then a new round, the next player starts. Server-authoritative so the
// barrel is genuinely shared.

function create() {
  let phase = "lobby";      // lobby | playing | reveal | finished
  let bullet = -1;          // loaded chamber 0..5 (never serialised until boom)
  let pos = 0;              // chambers already pulled this round (= next index)
  let currentName = null;   // whose turn it is
  let victimName = null;    // who got shot (reveal)
  let roundN = 0;
  let boomCount = {};       // name -> times shot this session

  function shuffleGun() { bullet = Math.floor(Math.random() * 6); pos = 0; victimName = null; }
  function startRound(room, rotate) {
    const a = room.activePlayers();
    if (!a.length) { phase = "lobby"; return; }
    shuffleGun();
    if (rotate && currentName) {
      const i = a.findIndex((p) => p.name === currentName);
      currentName = a[(i + 1) % a.length].name; // next round starts with the next player
    } else if (!currentName || a.findIndex((p) => p.name === currentName) < 0) {
      currentName = a[0].name;
    }
    phase = "playing"; roundN++;
  }
  function nextTurn(room) {
    const a = room.activePlayers();
    if (!a.length) { phase = "lobby"; return; }
    const i = a.findIndex((p) => p.name === currentName);
    currentName = a[(i + 1) % a.length].name;
  }
  function resetAll() { phase = "lobby"; bullet = -1; pos = 0; currentName = null; victimName = null; roundN = 0; boomCount = {}; }
  function topVictim(room) {
    const present = new Set(); room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const n in boomCount) { if (!present.has(n)) continue; if (!best || boomCount[n] > boomCount[best]) best = n; }
    return (best && boomCount[best] > 0) ? { name: best, count: boomCount[best] } : null;
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { resetAll(); startRound(room, false); },
    onAdvance: (room) => {
      if (phase === "lobby") { resetAll(); startRound(room, false); }
      else if (phase === "reveal") { startRound(room, true); } // host launches the next round
      else if (phase === "finished") { resetAll(); }
      // during "playing", advancing is the players' job (pull), not the host's
    },
    onReset: resetAll,
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onPlayerLeave: (room, p) => {
      if (phase === "playing" && p && p.name === currentName) nextTurn(room);
    },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || msg.t !== "pull") return;
      if (p.name !== currentName) return;          // only the player whose turn it is
      if (pos === bullet) {                          // BANG
        victimName = p.name;
        boomCount[p.name] = (boomCount[p.name] || 0) + 1;
        phase = "reveal";
      } else {                                        // click… safe
        pos++;
        nextTurn(room);
      }
    },
    serializeRound: (room) => {
      const r = { round_n: roundN, chambers: 6 };
      if (phase === "lobby") return r;
      r.pos = pos; // spent chambers so far
      if (currentName) { r.current_id = currentName; r.current_name = currentName; }
      // Running tally of who's been hit (public — no secret here).
      r.scoreboard = Object.keys(boomCount)
        .filter((n) => boomCount[n] > 0)
        .map((n) => ({ name: n, booms: boomCount[n] }));
      if (phase === "reveal") {
        r.victim_id = victimName; r.victim_name = victimName;
        r.bullet = bullet; // now safe to reveal which chamber was loaded
      }
      if (phase === "finished") {
        const t = topVictim(room);
        if (t) r.mvp = { label: "Le plus dégommé", emoji: "💥", name: t.name, value: t.count + " fois" };
      }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "roulette",
  name: "Roulette russe",
  emoji: "🎯",
  desc: "1 à 6 joueurs : chacun son tour, même barillet. Une balle, six chambres.",
  create,
};
