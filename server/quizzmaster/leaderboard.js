// QuizzMaster — persistent leaderboard.
//
// JSON file on disk (scores.json); per-room top 10 + a derived global top 10.
// Atomic writes via fs.rename so a crash mid-save never leaves a partial file.
// Each entry: { name, cid, value, displayValue, at }
//   - value: numeric score used for sorting (higher = better for "quiz",
//            lower = better for "quiz_solo" since it's a time in ms).
//   - displayValue: pre-formatted string shown in the UI.
//   - cid: client-id (uuid v4 in localStorage) → recognises a returning player
//          so we keep only their personal best per room.

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "scores.json");
const TOP_N = 10;

function emptyData() { return { by_room: {}, version: 1, updated_at: 0 }; }

let data = load();

function load() {
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.by_room) return parsed;
    return emptyData();
  } catch (e) {
    return emptyData();
  }
}

function save() {
  try {
    const tmp = FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, FILE);
  } catch (e) {
    console.error("[QuizzMaster] leaderboard save failed:", e.message);
  }
}

// Record one player's score in a room. Keeps the best score per (room, cid).
// `mode` controls sort direction: "quiz" → desc, "quiz_solo" → asc.
function record(roomId, mode, entry) {
  if (!entry || !entry.cid || !entry.name) return false;
  const sortAsc = mode === "quiz_solo";
  const arr = data.by_room[roomId] = data.by_room[roomId] || [];
  const existingIdx = arr.findIndex((e) => e.cid === entry.cid);
  if (existingIdx >= 0) {
    const cur = arr[existingIdx];
    const better = sortAsc ? entry.value < cur.value : entry.value > cur.value;
    if (!better) return false; // existing best is at least as good
    arr.splice(existingIdx, 1);
  }
  arr.push({
    name: String(entry.name).slice(0, 24),
    cid: String(entry.cid),
    value: Number(entry.value) || 0,
    displayValue: String(entry.displayValue || ""),
    at: Number(entry.at) || Date.now(),
  });
  arr.sort((a, b) => sortAsc ? a.value - b.value : b.value - a.value);
  if (arr.length > TOP_N) arr.length = TOP_N;
  data.updated_at = Date.now();
  save();
  return true;
}

function top(roomId) {
  return (data.by_room[roomId] || []).slice();
}

// Weighted-sum global top: for each room, 1st place = TOP_N pts, 2nd = TOP_N-1,
// …, TOP_Nth = 1 pt. Sum per cid across all rooms. Player must appear in at
// least one room top 10 to be on the global board.
function globalTop(roomIds) {
  const tally = {}; // cid -> { name, cid, points }
  roomIds.forEach((rid) => {
    const arr = data.by_room[rid] || [];
    arr.forEach((e, i) => {
      const pts = Math.max(0, TOP_N - i);
      tally[e.cid] = tally[e.cid] || { name: e.name, cid: e.cid, points: 0 };
      tally[e.cid].points += pts;
      tally[e.cid].name = e.name; // most recent name wins
    });
  });
  return Object.values(tally).sort((a, b) => b.points - a.points).slice(0, TOP_N);
}

// Test hook: clear everything (used by the E2E to start from a clean slate).
function _reset() { data = emptyData(); try { fs.unlinkSync(FILE); } catch (e) {} }

module.exports = { record, top, globalTop, TOP_N, _reset };
