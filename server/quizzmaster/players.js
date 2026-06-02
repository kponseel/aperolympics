// QuizzMaster — persistent player store (accounts + PIN + lifetime stats).
//
// One JSON file on disk (players.json), keyed by lowercased name. Each record:
//   {
//     name,                       // canonical display name
//     pinHash, salt,              // optional 4-digit PIN protection
//     ownerCid,                   // last device (uuid) that authenticated
//     stats: { games, correct, wrong, skipped, points, bestScore, lastAt },
//     themeBest: { france: 18, chine: 12, ... }  // best Blitz score per theme
//   }
//
// "Protection" is opt-in: a player attaches a 4-digit PIN to their name. After
// that, a DIFFERENT device using the same name must supply the PIN. The owner's
// own device (same cid) is always let through. Unprotected names are first-come
// and can be taken over freely (stats then accrue to whoever plays).
//
// Atomic writes via tmp + rename so a crash never leaves a half-written file.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "players.json");
const TOP_N = 10;
const PIN_RE = /^\d{4}$/;

let data = load();

function emptyStats() { return { games: 0, correct: 0, wrong: 0, skipped: 0, points: 0, bestScore: 0, lastAt: 0 }; }
function emptyData() { return { byName: {}, version: 1, updated_at: 0 }; }

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (parsed && parsed.byName) return parsed;
  } catch (e) {}
  return emptyData();
}
function save() {
  try {
    const tmp = FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, FILE);
  } catch (e) { console.error("[QuizzMaster] players save failed:", e.message); }
}

function key(name) { return String(name || "").trim().toLowerCase(); }
function hashPin(pin, salt) { return crypto.createHash("sha256").update(salt + ":" + String(pin)).digest("hex"); }

function getAccount(name) { return data.byName[key(name)] || null; }
function isProtected(name) { const a = getAccount(name); return !!(a && a.pinHash); }

function ensure(name, cid) {
  const k = key(name); if (!k) return null;
  if (!data.byName[k]) {
    data.byName[k] = { name: String(name).trim().slice(0, 16), pinHash: null, salt: null, ownerCid: cid || null, stats: emptyStats(), themeBest: {} };
  }
  return data.byName[k];
}

function setPin(name, pin) {
  const a = ensure(name); if (!a) return false;
  if (!PIN_RE.test(String(pin))) return false;
  a.salt = crypto.randomBytes(8).toString("hex");
  a.pinHash = hashPin(pin, a.salt);
  return true;
}

// Resolve a connection attempt. Returns:
//   { ok: true, account }
//   { ok: false, reason: "pin_required" }
//   { ok: false, reason: "pin_wrong" }
function authenticate(name, cid, pin) {
  const k = key(name);
  if (!k) return { ok: false, reason: "bad_name" };
  const a = getAccount(name);

  if (!a) {                                   // free name → claim for this device
    const acc = ensure(name, cid);
    acc.ownerCid = cid;
    acc.name = String(name).trim().slice(0, 16);
    if (pin && PIN_RE.test(String(pin))) setPin(name, pin);
    save();
    return { ok: true, account: acc, protected: !!acc.pinHash };
  }

  if (a.ownerCid === cid) {                   // same device owns it
    if (pin && PIN_RE.test(String(pin)) && !a.pinHash) setPin(name, pin);  // late protection
    save();
    return { ok: true, account: a, protected: !!a.pinHash };
  }

  if (a.pinHash) {                            // protected, different device
    if (!pin) return { ok: false, reason: "pin_required" };
    if (hashPin(pin, a.salt) === a.pinHash) { a.ownerCid = cid; save(); return { ok: true, account: a, protected: true }; }
    return { ok: false, reason: "pin_wrong" };
  }

  // exists, unprotected, different device → takeover allowed
  a.ownerCid = cid;
  if (pin && PIN_RE.test(String(pin))) setPin(name, pin);
  save();
  return { ok: true, account: a, protected: !!a.pinHash };
}

// Record one finished Blitz game for a player.
function recordGame(name, cid, theme, r) {
  const a = ensure(name, cid); if (!a) return;
  const correct = Math.max(0, r.correct | 0), wrong = Math.max(0, r.wrong | 0), skipped = Math.max(0, r.skipped | 0);
  const score = (r.score | 0);
  a.stats.games += 1;
  a.stats.correct += correct;
  a.stats.wrong += wrong;
  a.stats.skipped += skipped;
  a.stats.points += Math.max(0, score);       // cumulative points (floored at 0/game)
  if (score > a.stats.bestScore) a.stats.bestScore = score;
  a.stats.lastAt = Date.now();
  if (theme && (!a.themeBest[theme] || score > a.themeBest[theme])) a.themeBest[theme] = score;
  data.updated_at = Date.now();
  save();
}

function accuracy(s) { const att = s.correct + s.wrong; return att > 0 ? Math.round((s.correct / att) * 100) : 0; }

// Global ranking with per-player stats. Ranked by cumulative points, then best.
function globalRanking() {
  return Object.values(data.byName)
    .filter((a) => a.stats.games > 0)
    .map((a) => ({
      name: a.name,
      points: a.stats.points,
      games: a.stats.games,
      best: a.stats.bestScore,
      correct: a.stats.correct,
      accuracy: accuracy(a.stats),
      locked: !!a.pinHash,
    }))
    .sort((x, y) => y.points - x.points || y.best - x.best || x.name.localeCompare(y.name))
    .slice(0, TOP_N);
}

// Per-theme record board (best single-game score in that theme).
function themeTop(theme) {
  return Object.values(data.byName)
    .filter((a) => (a.themeBest[theme] | 0) > 0)
    .map((a) => ({ name: a.name, value: a.themeBest[theme], displayValue: a.themeBest[theme] + " pt" + (a.themeBest[theme] > 1 ? "s" : ""), locked: !!a.pinHash }))
    .sort((x, y) => y.value - x.value || x.name.localeCompare(y.name))
    .slice(0, TOP_N);
}

function _reset() { data = emptyData(); try { fs.unlinkSync(FILE); } catch (e) {} }

module.exports = { authenticate, isProtected, getAccount, setPin, recordGame, globalRanking, themeTop, TOP_N, PIN_RE, _reset };
