// "Désamorçage coopératif" (defuse) — asymmetric co-op (2 ideal). One player is
// the DÉMINEUR (sees the bomb on their screen); the other(s) are EXPERT(S) who
// see the MANUAL. They can't see the same thing and must talk to defuse before
// the timer runs out. Inspired by Keep Talking and Nobody Explodes.
//
// Server is authoritative: it holds the timer (tick) and the module state, and
// — crucially — sends the BOMB only to the démineur and the MANUAL only to the
// experts (serializePrivate). The manual is a FIXED ruleset; the bomb is
// generated randomly but consistently, so a valid solution always exists.
//
// 3 modules, solved sequentially: Fils → Bouton → Séquence. An error costs
// 30 s (forgiving "apéro" difficulty); timer at 0 = boom.

const TOTAL_TIME = 180;     // seconds
const ERROR_PENALTY = 30;   // seconds lost per mistake

const WIRE_COLORS = ["rouge", "bleu", "jaune", "noir"];
const BTN_COLORS = ["rouge", "bleu", "vert", "blanc"];
const BTN_LABELS = ["ABORT", "HOLD", "DÉTONER", "VAS-Y"];
const SYMBOLS = ["Ω", "Δ", "☢", "✦", "♣", "❄"];   // fixed universe
const SYMBOL_PRIORITY = ["Ω", "Δ", "☢", "✦", "♣", "❄"]; // manual's fixed order

function rand(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[rand(arr.length)]; }

// --- module generators (return {def: defuser-visible, answer: solution}) ---
function genWires() {
  const n = 3 + rand(3); // 3..5
  const colors = [];
  for (let i = 0; i < n; i++) colors.push(pick(WIRE_COLORS));
  let answer; // 0-based index to cut
  const has = (c) => colors.indexOf(c) >= 0;
  if (n === 3) answer = has("rouge") ? 1 : n - 1;
  else if (n === 4) answer = has("jaune") ? 0 : n - 1;
  else answer = has("bleu") ? 2 : 0;
  return { type: "wires", colors: colors, answer: answer };
}
function genButton() {
  const color = pick(BTN_COLORS);
  const label = pick(BTN_LABELS);
  let answer; // "hold" | "tap"
  if (label === "ABORT") answer = "hold";
  else if (color === "rouge") answer = "hold";
  else answer = "tap";
  return { type: "button", color: color, label: label, answer: answer };
}
function genSequence() {
  const pool = SYMBOLS.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = rand(i + 1); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
  const present = pool.slice(0, 4);
  const display = present.slice();
  for (let i = display.length - 1; i > 0; i--) { const j = rand(i + 1); const t = display[i]; display[i] = display[j]; display[j] = t; }
  const expected = SYMBOL_PRIORITY.filter((s) => present.indexOf(s) >= 0); // press order
  return { type: "sequence", symbols: display, expected: expected, pressed: [] };
}

function create() {
  let phase = "lobby";        // lobby | assign | playing | finished
  let defuserName = null;
  let modules = [];
  let cur = 0;                // current module index
  let timeLeft = TOTAL_TIME;
  let lastTick = 0;
  let result = null;          // "defused" | "boom"
  let lastError = 0;          // timestamp of last mistake (for client flash)
  let errorCount = 0;

  function assign(room) {
    const a = room.activePlayers();
    if (a.length < 2) return false;
    defuserName = a[rand(a.length)].name;
    modules = [genWires(), genButton(), genSequence()];
    cur = 0; timeLeft = TOTAL_TIME; result = null; lastError = 0; errorCount = 0;
    return true;
  }
  function resetAll() { phase = "lobby"; defuserName = null; modules = []; cur = 0; timeLeft = TOTAL_TIME; result = null; lastError = 0; errorCount = 0; lastTick = 0; }
  function roleOf(name) { return name === defuserName ? "defuser" : "expert"; }

  function penalize() { timeLeft -= ERROR_PENALTY; errorCount++; lastError = Date.now(); if (timeLeft <= 0) { timeLeft = 0; phase = "finished"; result = "boom"; } }
  function solveCurrent() { cur++; if (cur >= modules.length) { phase = "finished"; result = "defused"; } }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { resetAll(); if (assign(room)) phase = "assign"; },
    onAdvance: (room) => {
      if (phase === "lobby") { resetAll(); if (assign(room)) phase = "assign"; }
      else if (phase === "assign") { phase = "playing"; lastTick = Date.now(); } // host launches the clock
      else if (phase === "finished") { resetAll(); }
    },
    onReset: resetAll,
    onEndSession: () => { if (phase === "playing" || phase === "assign") { phase = "finished"; if (!result) result = "boom"; } },
    onPlayerLeave: (room, p) => {
      if (phase === "lobby" || phase === "finished") return;
      // If the démineur bails, the bomb can't be worked — fail the round.
      if (p && p.name === defuserName) { phase = "finished"; result = "boom"; return; }
      // If the démineur is left alone (all experts gone), they have no manual
      // to follow → also fails. Avoids a 3-minute soft-lock to the timer.
      if (room.activePlayers().length < 2) { phase = "finished"; result = "boom"; }
    },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || msg.t !== "act") return;
      if (p.name !== defuserName) return;          // only the démineur acts
      const m = modules[cur];
      if (!m) return;
      if (m.type === "wires" && msg.action === "cut") {
        if (typeof msg.wire !== "number") return;
        if (msg.wire === m.answer) solveCurrent(); else penalize();
      } else if (m.type === "button" && (msg.action === "tap" || msg.action === "hold")) {
        if (msg.action === m.answer) solveCurrent(); else penalize();
      } else if (m.type === "sequence" && msg.action === "press") {
        const sym = String(msg.symbol || "");
        const expectedNext = m.expected[m.pressed.length];
        if (sym === expectedNext) {
          m.pressed.push(sym);
          if (m.pressed.length === m.expected.length) solveCurrent();
        } else {
          m.pressed = []; // reset the sequence on a wrong press
          penalize();
        }
      }
    },
    // Public (role-agnostic) state: timer, progress, result. The actual bomb /
    // manual are role-gated in serializePrivate.
    serializeRound: (room) => {
      const r = { phase_x: phase, time_left: timeLeft, time_total: TOTAL_TIME, modules_total: modules.length, modules_done: cur, errors: errorCount };
      // The current module's TYPE is public (not the answer) so the expert can
      // jump to the right manual section and the defuser sees their progress.
      if (phase === "playing" && modules[cur]) r.module_type = modules[cur].type;
      if (defuserName) { r.defuser_id = defuserName; r.defuser_name = defuserName; }
      if (lastError && Date.now() - lastError < 1500) r.flash_error = true;
      if (phase === "finished") {
        r.result = result;
        r.winner_banner = result === "defused"
          ? { emoji: "🎉", text: "Bombe désamorcée ! Bravo l'équipe !" }
          : { emoji: "💥", text: "BOOM ! Tout le monde boit 🍺" };
      }
      return r;
    },
    // Role-gated: the démineur gets the bomb (no answers); experts get the
    // manual (no bomb specifics). Never cross the streams.
    serializePrivate: (room, viewer) => {
      if (!viewer || phase === "lobby" || phase === "finished") return {};
      const role = roleOf(viewer.name);
      if (role === "defuser") {
        const m = modules[cur];
        let view = null;
        if (m) {
          if (m.type === "wires") view = { type: "wires", colors: m.colors };
          else if (m.type === "button") view = { type: "button", color: m.color, label: m.label };
          else if (m.type === "sequence") view = { type: "sequence", symbols: m.symbols, pressed: m.pressed.slice() };
        }
        return { role: "defuser", module: view, module_idx: cur };
      }
      // expert(s)
      return { role: "expert" };
    },
    tick: (room, now) => {
      if (phase !== "playing") { lastTick = now; return false; }
      if (!lastTick) lastTick = now;
      const dt = Math.floor((now - lastTick) / 1000);
      if (dt >= 1) {
        lastTick = now - ((now - lastTick) % 1000);
        timeLeft -= dt;
        if (timeLeft <= 0) { timeLeft = 0; phase = "finished"; result = "boom"; }
        return true;
      }
      return false;
    },
  };
}

module.exports = {
  id: "defuse",
  name: "Désamorçage",
  emoji: "💣",
  desc: "Coop 2 joueurs : l'un voit la bombe, l'autre le manuel. Parlez-vous !",
  create,
};
