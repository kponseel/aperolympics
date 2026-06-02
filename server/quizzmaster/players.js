// QuizzMaster — persistent player store (accounts + PIN + lifetime stats).
//
// One JSON file on disk (players.json), keyed by lowercased name. Each record:
//   {
//     name,                       // canonical display name
//     pinHash, salt,              // optional 4-digit PIN protection
//     ownerCid,                   // last device (uuid) that authenticated
//     stats: { games, correct, wrong, skipped, points, bestScore, lastAt },
//     themeBest: { france: 18, chine: 12, ... }   // best Blitz score per theme
//     themeStats: { france: { games, points, best, correct, wrong, skipped }, ... }
//     streakBest, wins, podiums   // fun trophies (cumulative)
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
function emptyThemeStats() { return { games: 0, points: 0, best: 0, correct: 0, wrong: 0, skipped: 0 }; }
function emptyData() { return { byName: {}, version: 2, updated_at: 0 }; }

// Backfill new fields on an existing account. Idempotent — safe to call on every
// access. Keeps old players.json files (which only have `themeBest`) working
// without forcing a manual migration.
function ensureSchema(a) {
  if (!a) return;
  if (!a.themeBest) a.themeBest = {};
  if (!a.themeStats) a.themeStats = {};
  for (const t in a.themeBest) {
    if (!a.themeStats[t]) {
      a.themeStats[t] = emptyThemeStats();
      a.themeStats[t].best = a.themeBest[t] | 0;
    } else if (a.themeStats[t].best == null) {
      a.themeStats[t].best = a.themeBest[t] | 0;
    }
  }
  if (a.streakBest == null) a.streakBest = 0;
  if (a.wins == null) a.wins = 0;
  if (a.podiums == null) a.podiums = 0;
}

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (parsed && parsed.byName) {
      for (const k in parsed.byName) ensureSchema(parsed.byName[k]);
      return parsed;
    }
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

function getAccount(name) { const a = data.byName[key(name)] || null; if (a) ensureSchema(a); return a; }
function isProtected(name) { const a = getAccount(name); return !!(a && a.pinHash); }

function ensure(name, cid) {
  const k = key(name); if (!k) return null;
  if (!data.byName[k]) {
    data.byName[k] = {
      name: String(name).trim().slice(0, 16),
      pinHash: null, salt: null, ownerCid: cid || null,
      stats: emptyStats(), themeBest: {}, themeStats: {},
      streakBest: 0, wins: 0, podiums: 0,
    };
  }
  ensureSchema(data.byName[k]);
  return data.byName[k];
}

function setPin(name, pin) {
  const a = ensure(name); if (!a) return false;
  if (!PIN_RE.test(String(pin))) return false;
  a.salt = crypto.randomBytes(8).toString("hex");
  a.pinHash = hashPin(pin, a.salt);
  return true;
}

// Rename an existing account. Requires the requester (`cid`) to be the owner.
// Returns:
//   { ok: true, account } on success (stats + PIN + theme bests are carried over)
//   { ok: false, reason: "bad_name" | "same_name" | "not_owner" | "name_taken" | "no_account" }
function rename(oldName, newName, cid) {
  const oldK = key(oldName), newK = key(newName);
  if (!oldK || !newK) return { ok: false, reason: "bad_name" };
  if (oldK === newK) return { ok: false, reason: "same_name" };
  const a = data.byName[oldK];
  if (!a) return { ok: false, reason: "no_account" };
  if (a.ownerCid && a.ownerCid !== cid) return { ok: false, reason: "not_owner" };
  if (data.byName[newK]) return { ok: false, reason: "name_taken" };
  const display = String(newName).trim().slice(0, 16);
  a.name = display;
  data.byName[newK] = a;
  delete data.byName[oldK];
  data.updated_at = Date.now();
  save();
  return { ok: true, account: a };
}

// Resolve a connection attempt. Returns:
//   { ok: true, account }
//   { ok: false, reason: "pin_required" }
//   { ok: false, reason: "pin_wrong" }
function authenticate(name, cid, pin) {
  const k = key(name);
  if (!k) return { ok: false, reason: "bad_name" };
  const a = getAccount(name);

  if (!a) {
    const acc = ensure(name, cid);
    acc.ownerCid = cid;
    acc.name = String(name).trim().slice(0, 16);
    if (pin && PIN_RE.test(String(pin))) setPin(name, pin);
    save();
    return { ok: true, account: acc, protected: !!acc.pinHash };
  }

  if (a.ownerCid === cid) {
    if (pin && PIN_RE.test(String(pin)) && !a.pinHash) setPin(name, pin);
    save();
    return { ok: true, account: a, protected: !!a.pinHash };
  }

  if (a.pinHash) {
    if (!pin) return { ok: false, reason: "pin_required" };
    if (hashPin(pin, a.salt) === a.pinHash) { a.ownerCid = cid; save(); return { ok: true, account: a, protected: true }; }
    return { ok: false, reason: "pin_wrong" };
  }

  a.ownerCid = cid;
  if (pin && PIN_RE.test(String(pin))) setPin(name, pin);
  save();
  return { ok: true, account: a, protected: !!a.pinHash };
}

// Record one finished Blitz game for a player.
// r = { score, correct, wrong, skipped, streak?, rank?, totalPlayers? }
function recordGame(name, cid, theme, r) {
  const a = ensure(name, cid); if (!a) return;
  const correct = Math.max(0, r.correct | 0);
  const wrong = Math.max(0, r.wrong | 0);
  const skipped = Math.max(0, r.skipped | 0);
  const score = (r.score | 0);
  const streak = Math.max(0, r.streak | 0);
  const rank = Math.max(0, r.rank | 0);
  const totalPlayers = Math.max(0, r.totalPlayers | 0);

  a.stats.games += 1;
  a.stats.correct += correct;
  a.stats.wrong += wrong;
  a.stats.skipped += skipped;
  a.stats.points += Math.max(0, score);       // cumulative points (floored at 0/game)
  if (score > a.stats.bestScore) a.stats.bestScore = score;
  a.stats.lastAt = Date.now();

  // Best score per theme — keep the highest, incl. 0/negative bests.
  // (Use === undefined, not falsy: a stored 0 must not be treated as "no record"
  // and overwritten by a worse score.)
  if (theme) {
    if (a.themeBest[theme] === undefined || score > a.themeBest[theme]) a.themeBest[theme] = score;
    const ts = a.themeStats[theme] = a.themeStats[theme] || emptyThemeStats();
    ts.games += 1;
    ts.points += Math.max(0, score);
    ts.correct += correct;
    ts.wrong += wrong;
    ts.skipped += skipped;
    if (score > ts.best) ts.best = score;
  }
  if (streak > a.streakBest) a.streakBest = streak;
  // Wins / podiums only count multi-player games — solo wins are too easy.
  if (rank === 1 && totalPlayers >= 2) a.wins += 1;
  if (rank >= 1 && rank <= 3 && totalPlayers >= 3) a.podiums += 1;

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
  // Only surface records of at least 1 point. Scores of 0 / negative (typically
  // test runs or a quick give-up) are still stored per account, but showing them
  // just pollutes the board — a real record starts at 1.
  return Object.values(data.byName)
    .filter((a) => a.themeBest[theme] >= 1)
    .map((a) => ({ name: a.name, value: a.themeBest[theme], displayValue: a.themeBest[theme] + " pt" + (a.themeBest[theme] > 1 ? "s" : ""), locked: !!a.pinHash }))
    .sort((x, y) => y.value - x.value || x.name.localeCompare(y.name))
    .slice(0, TOP_N);
}

// Rich per-player profile for the leaderboard "tap a player" view.
// `themesMap` (optional): { id: { name, emoji } } used to enrich theme rows.
// Returns null if no such account.
function playerStats(name, themesMap) {
  const a = getAccount(name);
  if (!a) return null;
  ensureSchema(a);
  const meta = themesMap || {};

  const themeRows = [];
  for (const t in a.themeStats) {
    const ts = a.themeStats[t];
    if (!ts || (ts.games | 0) <= 0) continue;
    const m = meta[t] || {};
    const att = (ts.correct | 0) + (ts.wrong | 0);
    themeRows.push({
      theme: t,
      themeName: m.name || t,
      emoji: m.emoji || "🎯",
      games: ts.games | 0,
      points: ts.points | 0,
      best: ts.best | 0,
      correct: ts.correct | 0,
      wrong: ts.wrong | 0,
      accuracy: att > 0 ? Math.round((ts.correct / att) * 100) : 0,
      avg: ts.games > 0 ? Math.round((ts.points / ts.games) * 10) / 10 : 0,
    });
  }

  // Top 3 favorites: themes that brought the most cumulative points.
  const favorites = themeRows.slice()
    .sort((x, y) => y.points - x.points || y.best - x.best || x.themeName.localeCompare(y.themeName))
    .slice(0, 3);

  // Bête noire: theme with the lowest average score per game, among themes
  // actually played at least twice. Only surfaces if the player has tried 2+
  // distinct themes (otherwise their only theme would trivially be the worst).
  let nemesis = null;
  const playedTwice = themeRows.filter((r) => r.games >= 2);
  if (playedTwice.length >= 2) {
    nemesis = playedTwice.slice().sort((x, y) => x.avg - y.avg || x.best - y.best || x.themeName.localeCompare(y.themeName))[0];
  }

  // bestTheme considers ALL themeStats entries (incl. games=0 legacy records
  // where only `best` survived the schema migration), so an existing record
  // surfaces even before the player has played again under the new schema.
  let bestTheme = null;
  for (const t in a.themeStats) {
    const ts = a.themeStats[t];
    if (!ts || !ts.best) continue;
    if (!bestTheme || ts.best > bestTheme.best) {
      const m = meta[t] || {};
      bestTheme = {
        theme: t, themeName: m.name || t, emoji: m.emoji || "🎯",
        best: ts.best | 0, games: ts.games | 0, points: ts.points | 0,
      };
    }
  }

  return {
    name: a.name,
    locked: !!a.pinHash,
    games: a.stats.games | 0,
    points: a.stats.points | 0,
    best: a.stats.bestScore | 0,
    correct: a.stats.correct | 0,
    wrong: a.stats.wrong | 0,
    skipped: a.stats.skipped | 0,
    accuracy: accuracy(a.stats),
    streakBest: a.streakBest | 0,
    wins: a.wins | 0,
    podiums: a.podiums | 0,
    favorites,
    nemesis,
    bestTheme,
    themes: themeRows.sort((x, y) => y.best - x.best || y.points - x.points || x.themeName.localeCompare(y.themeName)),
  };
}

function _reset() { data = emptyData(); try { fs.unlinkSync(FILE); } catch (e) {} }

module.exports = {
  authenticate, isProtected, getAccount, setPin, rename, recordGame,
  globalRanking, themeTop, playerStats, TOP_N, PIN_RE, _reset,
};
