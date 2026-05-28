// "Spyfall" — civilians all see the same secret location; the spy sees nothing.
// Discuss, then vote who's the spy. Ported from esp32-hub/src/games/spyfall.cpp.
// Roles & votes keyed by player name; role delivered via serializePrivate.

const LOCATIONS = [
  "Aeroport", "Restaurant", "Plage", "Casino", "Hopital",
  "Lycee", "Concert", "Banque", "Tour Eiffel", "Musee",
  "Cinema", "Gare", "Hotel", "Camping", "Salle de sport",
  "Centre commercial", "Boulangerie", "Stade", "Theatre", "Foret",
  "Chantier", "Bibliotheque", "Caserne de pompiers", "Sous-marin", "Vol spatial",
  "Zoo", "Aquarium", "Cathedrale", "Studio TV", "Train de nuit",
  "Manoir hante", "Salon de coiffure", "Parc d'attractions", "Marche bio", "Aeroport militaire",
];

function create() {
  let phase = "lobby";
  let location = "";
  let spyName = null;
  let roles = {};  // name -> "civilian" | "spy"  (absent = spectator)
  let votes = {};  // name -> count
  let detectiveCount = {}; // name -> rounds where they cast a vote on the actual spy

  const roleOf = (name) => roles[name] || "spectator";
  function clearRound(room) {
    location = ""; spyName = null; roles = {}; votes = {};
    room.players.forEach((p) => { p.answered = false; p.answer = -1; });
  }
  function resetAll(room) { phase = "lobby"; detectiveCount = {}; clearRound(room); }
  function topDetective(room) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const n in detectiveCount) {
      if (!present.has(n)) continue;
      if (!best || detectiveCount[n] > detectiveCount[best]) best = n;
    }
    return (best && detectiveCount[best] > 0) ? { name: best, count: detectiveCount[best] } : null;
  }
  function startRound(room) {
    const active = room.activePlayers();
    if (active.length < 3) return; // need 3+
    clearRound(room);
    location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    const spy = active[Math.floor(Math.random() * active.length)];
    active.forEach((p) => { roles[p.name] = "civilian"; });
    roles[spy.name] = "spy";
    spyName = spy.name;
    phase = "playing";
  }
  function participants(room) { return room.activePlayers().filter((p) => roleOf(p.name) !== "spectator"); }
  function allVoted(room) { const a = participants(room); return a.length > 0 && a.every((p) => p.answered); }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { startRound(room); },
    onAdvance: (room) => {
      if (phase === "lobby") startRound(room);
      else if (phase === "playing") phase = "reveal";
      else if (phase === "reveal") startRound(room);
      else resetAll(room);
    },
    onReset: resetAll,
    onEndSession: () => { if (phase !== "lobby") phase = "finished"; },
    // Mid-round joiners stay spectators — auto-promoting them would leak the
    // location/role to anyone who joins after the round starts.
    onPlayerLeave: (room) => { if (phase === "playing" && allVoted(room)) phase = "reveal"; },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || p.answered) return;
      if (msg.t !== "vote") return;
      const target = room.players.get(String(msg.target_id || "").toLowerCase());
      // Reject spectators (joined mid-round) and players who already left.
      if (!target || roleOf(target.name) === "spectator" || !target.active) return;
      p.answered = true;
      votes[target.name] = (votes[target.name] || 0) + 1;
      // A correct accusation (voted the actual spy) counts as detective work.
      if (spyName && target.name === spyName && roleOf(p.name) === "civilian") {
        detectiveCount[p.name] = (detectiveCount[p.name] || 0) + 1;
      }
      if (allVoted(room)) phase = "reveal";
    },
    serializeRound: (room) => {
      const r = {};
      if (phase === "lobby") return r;
      if (phase === "playing") {
        r.answered = participants(room).filter((p) => p.answered).length;
      }
      if (phase === "reveal") {
        r.location = location;
        const entries = [...room.players.values()].filter((p) => p.name && roleOf(p.name) !== "spectator");
        let max = 0;
        r.votes = entries.map((p) => {
          const c = votes[p.name] || 0;
          if (c > max) max = c;
          return { name: p.name, count: c };
        });
        if (spyName) {
          r.spy_name = spyName;
          const caught = (votes[spyName] || 0) >= max && max > 0;
          r.winner = caught ? "civilians" : "spy";
        } else {
          r.winner = "spy";
        }
      }
      if (phase === "finished") {
        const t = topDetective(room);
        if (t) r.mvp = { label: "Meilleur détective", emoji: "🕵️", name: t.name, value: t.count + " espion" + (t.count > 1 ? "s" : "") + " démasqué" + (t.count > 1 ? "s" : "") };
      }
      return r;
    },
    serializePrivate: (room, viewer) => {
      if (!viewer || phase === "lobby") return {};
      const role = roleOf(viewer.name);
      if (role === "spectator") return { role: "spectator" };
      if (role === "spy") return { role: "spy" };
      return { role: "civilian", location: location };
    },
    tick: () => false,
  };
}

module.exports = {
  id: "spyfall",
  name: "Spyfall",
  emoji: "🕶️",
  desc: "Tous connaissent le lieu, sauf l'espion. (3 joueurs min)",
  create,
};
