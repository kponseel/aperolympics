// "La Bombe" — hot potato with a hidden 20-60s countdown. Ported from
// esp32-hub/src/games/bomb.cpp. Holder identity = player name; the boom timer
// fires from tick(room, now). Deadline is never serialized (stays hidden).

function create() {
  let phase = "lobby";
  let holderName = null;
  let deadlineMs = 0;
  let roundN = 0;
  let boomCount = {}; // name -> times exploded
  let lastTick = 0;

  function randomActive(room, exclude) {
    const pool = room.activePlayers().filter((p) => exclude == null || p.name !== exclude);
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)].name;
  }
  function resetAll() { phase = "lobby"; holderName = null; deadlineMs = 0; roundN = 0; boomCount = {}; }
  function startRound(room) {
    const s = randomActive(room, null);
    if (!s) return;
    holderName = s;
    deadlineMs = Date.now() + 20000 + Math.floor(Math.random() * 40000); // 20-60s hidden
    phase = "playing";
    roundN++;
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { startRound(room); },
    onAdvance: (room) => {
      if (phase === "lobby") startRound(room);
      else if (phase === "reveal") startRound(room); // launch next round
      else resetAll(); // playing/finished -> cancel
    },
    onReset: resetAll,
    onPlayerLeave: (room, p) => {
      if (phase !== "playing") return;
      // If we're down to a single player nobody can receive a pass — let the
      // round end with no boom rather than corner the lone survivor.
      if (room.activePlayers().length < 2) { phase = "lobby"; holderName = null; return; }
      if (!p || p.name !== holderName) return;
      const next = randomActive(room, holderName);
      if (!next) { phase = "lobby"; holderName = null; return; }
      holderName = next;
    },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || p.name !== holderName) return;
      if (msg.t !== "pass") return;
      const target = room.players.get(String(msg.target_id || "").toLowerCase());
      // Reject a target who is mid-disconnect — the bomb would otherwise land on
      // a phantom whose screen never updates until they either reconnect or the
      // grace expires.
      if (!target || !target.name || target.name === holderName || !target.active || target.disconnectedAt) return;
      holderName = target.name;
    },
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    serializeRound: (room) => {
      const r = { round_n: roundN };
      if (phase === "lobby") return r;
      if (holderName) { r.holder_id = holderName; r.holder_name = holderName; }
      // Always expose the running scoreboard so players can see boom counts during
      // play, not just on the brief reveal screen.
      r.scoreboard = Object.keys(boomCount)
        .filter((n) => boomCount[n] > 0)
        .map((n) => ({ name: n, booms: boomCount[n] }));
      if (phase === "reveal") { r.boomed = holderName || ""; }
      if (phase === "finished") {
        // Filter to currently-present players so the MVP isn't a player who left.
        const present = new Set();
        room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
        let best = null;
        for (const n in boomCount) {
          if (!present.has(n)) continue;
          if (!best || boomCount[n] > boomCount[best]) best = n;
        }
        if (best && boomCount[best] > 0) {
          r.mvp = { label: "Le plus BOOM-é", emoji: "💥", name: best, value: boomCount[best] + " explosion" + (boomCount[best] > 1 ? "s" : "") };
        }
      }
      return r;
    },
    tick: (room, now) => {
      const prev = lastTick; lastTick = now;
      if (phase !== "playing") return false;
      // Pause the hidden fuse while the holder is mid-disconnect (grace window),
      // so the bomb never explodes on someone who just dropped. It resumes on
      // reconnect, or when onPlayerLeave reassigns it after the grace.
      const h = holderName && room.players.get(holderName.toLowerCase());
      if (h && h.disconnectedAt) { if (prev) deadlineMs += (now - prev); return false; }
      if (now < deadlineMs) return false;
      if (holderName) boomCount[holderName] = (boomCount[holderName] || 0) + 1;
      phase = "reveal";
      return true;
    },
  };
}

module.exports = {
  id: "bomb",
  name: "La Bombe",
  emoji: "💣",
  desc: "Patate chaude avec timer cache. Refile-la !",
  create,
};
