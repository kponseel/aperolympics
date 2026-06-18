// "Loups" — simplified Werewolf. Night: wolves pick a victim (private vote).
// Day: the whole village votes. Ported from esp32-hub/src/games/wolves.cpp.
// Roles/alive/votes keyed by player name; roles & allies via serializePrivate.

function create() {
  let phase = "lobby";
  let step = 0; // 0 = night, 1 = day
  let roundN = 0;
  let winner = "";
  let roles = {}; // name -> "village" | "wolf" (absent = spectator / not in match)
  let alive = {}; // name -> bool
  let votes = {}; // name -> count
  let lastVictimName = null;
  let lastKillType = "";

  const roleOf = (name) => roles[name] || "spectator";
  function clearVotes(room) { votes = {}; room.players.forEach((p) => { p.answered = false; p.answer = -1; }); }
  function countAlive(room, role) {
    // Require the player to be currently connected too — a disconnected-but-
    // alive wolf would otherwise keep the game in a 'wolves still in play'
    // state and deadlock the night vote (allWolvesVoted needs >0 active wolves).
    return [...room.players.values()].filter((p) => p.name && p.active && alive[p.name] && roles[p.name] === role).length;
  }
  function assignRoles(room) {
    roles = {}; alive = {};
    const active = room.activePlayers();
    if (active.length < 4) return;
    active.forEach((p) => { roles[p.name] = "village"; alive[p.name] = true; });
    const nWolves = active.length >= 7 ? 2 : 1;
    let picked = 0;
    while (picked < nWolves) {
      const s = active[Math.floor(Math.random() * active.length)];
      if (roles[s.name] !== "wolf") { roles[s.name] = "wolf"; picked++; }
    }
  }
  function resetAll(room) {
    phase = "lobby"; step = 0; roundN = 0; winner = ""; lastVictimName = null; lastKillType = "";
    roles = {}; alive = {}; clearVotes(room);
  }
  function startRound(room) {
    assignRoles(room);
    if (countAlive(room, "village") + countAlive(room, "wolf") < 4) return; // not enough
    step = 0; clearVotes(room); lastVictimName = null; lastKillType = "";
    phase = "playing"; roundN = 1; winner = "";
  }
  function allWolvesVoted(room) {
    const w = room.activePlayers().filter((p) => roles[p.name] === "wolf" && alive[p.name]);
    return w.length > 0 && w.every((p) => p.answered);
  }
  function allAliveVoted(room) {
    const a = room.activePlayers().filter((p) => alive[p.name] && (roles[p.name] === "village" || roles[p.name] === "wolf"));
    return a.length > 0 && a.every((p) => p.answered);
  }
  function tallyAndKill(room) {
    // Find every alive AND currently-connected player at the max vote count.
    // A tie at the top means nobody dies (canonical werewolf rule).
    // Disconnected (`!p.active`) players shouldn't be eligible to die — they
    // aren't in the room to defend themselves and would skew checkEnd.
    let max = 0, tiedAtMax = [];
    [...room.players.values()].forEach((p) => {
      if (!p.name || !alive[p.name] || !p.active) return;
      const c = votes[p.name] || 0;
      if (c > max) { max = c; tiedAtMax = [p.name]; }
      else if (c === max && max > 0) { tiedAtMax.push(p.name); }
    });
    if (max === 0 || tiedAtMax.length !== 1) { lastVictimName = null; return; }
    lastVictimName = tiedAtMax[0]; alive[lastVictimName] = false;
  }
  function checkEnd(room) {
    const wolves = countAlive(room, "wolf");
    const village = countAlive(room, "village");
    if (wolves === 0) { winner = "villagers"; phase = "finished"; }
    else if (wolves >= village) { winner = "wolves"; phase = "finished"; }
  }
  // No one left able to vote in the next sub-phase = the round can never
  // resolve. `step` here is the UPCOMING step (0 = night → only wolves vote,
  // 1 = day → any alive villager+wolf votes).
  function noEligibleVoters(room, nextStep) {
    const eligible = room.activePlayers().filter((p) =>
      alive[p.name] && (roles[p.name] === "village" || roles[p.name] === "wolf") &&
      !(nextStep === 0 && roles[p.name] !== "wolf")
    );
    return eligible.length === 0;
  }
  function advance(room) {
    if (phase === "lobby") { startRound(room); return; }
    if (phase === "playing") { tallyAndKill(room); lastKillType = step === 0 ? "night" : "day"; phase = "reveal"; return; }
    if (phase === "reveal") {
      checkEnd(room);
      if (phase === "finished") return;
      const nextStep = step === 0 ? 1 : 0;
      if (noEligibleVoters(room, nextStep)) {
        // Everyone who could vote has bailed mid-round → end the match rather
        // than soft-lock waiting on a vote that can never arrive.
        const wolves = countAlive(room, "wolf");
        const village = countAlive(room, "village");
        winner = wolves > 0 && wolves >= village ? "wolves" : (village > 0 ? "villagers" : "wolves");
        phase = "finished";
        return;
      }
      if (step === 0) step = 1; else { step = 0; roundN++; }
      clearVotes(room); lastVictimName = null; lastKillType = "";
      phase = "playing";
      return;
    }
    resetAll(room);
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { startRound(room); },
    onAdvance: advance,
    onReset: resetAll,
    // Wolves opts into the 🏁 end-session affordance so a host can break out
    // of a stuck night/day if the lone wolf has bailed and nobody can vote.
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onPlayerLeave: (room) => {
      if (phase !== "playing") return;
      // A leave can flip the win condition (last wolf gone → villagers win).
      // Check end-of-game first; if not over, propagate to the vote progression.
      checkEnd(room);
      if (phase === "finished") return;
      if (step === 0 && allWolvesVoted(room)) advance(room);
      else if (step === 1 && allAliveVoted(room)) advance(room);
    },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing") return;
      if (roleOf(p.name) === "spectator" || !alive[p.name] || p.answered) return;
      if (msg.t !== "vote") return;
      if (step === 0 && roles[p.name] !== "wolf") return; // night: wolves only
      const target = room.players.get(String(msg.target_id || "").toLowerCase());
      // Reject votes on a player who is dead OR has disconnected — eliminating
      // someone who isn't in the room would distort checkEnd.
      if (!target || !alive[target.name] || !target.active) return;
      if (step === 0 && roles[target.name] === "wolf") return; // wolves don't eat wolves
      p.answered = true;
      votes[target.name] = (votes[target.name] || 0) + 1;
      if (step === 0 && allWolvesVoted(room)) advance(room);
      else if (step === 1 && allAliveVoted(room)) advance(room);
    },
    serializeRound: (room) => {
      const r = { round_n: roundN };
      if (phase === "lobby") return r;
      r.step = step === 0 ? "night" : "day";
      r.alive_villagers = countAlive(room, "village");
      r.alive_wolves = countAlive(room, "wolf");
      if (phase === "playing") {
        const voters = room.activePlayers().filter((p) =>
          alive[p.name] && (roles[p.name] === "village" || roles[p.name] === "wolf") && !(step === 0 && roles[p.name] !== "wolf"));
        r.voters = voters.length;
        r.voted = voters.filter((p) => p.answered).length;
      }
      if (phase === "reveal" && lastVictimName) {
        r.victim_name = lastVictimName;
        r.victim_role = roles[lastVictimName] === "wolf" ? "loup" : "villageois";
        r.kill_type = lastKillType;
      }
      if (phase === "finished") {
        r.winner = winner;
        r.winner_banner = winner === "wolves"
          ? { emoji: "🐺", text: "Les Loups gagnent !" }
          : { emoji: "🧑‍🌾", text: "Les Villageois gagnent !" };
        const hn = room.hostName();
        r.roster = [...room.players.values()]
          .filter((p) => p.name && roleOf(p.name) !== "spectator")
          .map((p) => ({ name: p.name, role: roles[p.name] === "wolf" ? "loup" : "villageois", alive: !!alive[p.name], host: p.name === hn }));
      }
      return r;
    },
    serializePrivate: (room, viewer) => {
      if (!viewer || phase === "lobby") return {};
      const role = roleOf(viewer.name);
      if (role === "spectator") return { role: "spectator" };
      if (!alive[viewer.name]) return { role: "eliminated" };
      const out = {};
      if (role === "wolf") {
        out.role = "wolf";
        out.allies = [...room.players.values()].filter((p) => p.name && roles[p.name] === "wolf").map((p) => p.name);
      } else {
        out.role = "villager";
      }
      if (phase === "playing") {
        const canVote = (step === 0 && role === "wolf") || step === 1;
        out.can_vote = canVote;
        if (canVote) {
          out.voteable = room.activePlayers()
            .filter((p) => alive[p.name] && !(step === 0 && roles[p.name] === "wolf"))
            .map((p) => ({ id: p.name, name: p.name }));
        }
      }
      return out;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "wolves",
  name: "Loups",
  emoji: "🐺",
  desc: "Werewolf simplifie. 4 joueurs min. 7+ = 2 loups.",
  create,
};
