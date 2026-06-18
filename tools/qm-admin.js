#!/usr/bin/env node
// QuizzMaster admin CLI — édite players.json hors socket, en bypassant
// l'ownership et le PIN. À utiliser uniquement côté serveur (SSH).
//
//   node tools/qm-admin.js list
//   node tools/qm-admin.js info "Pute"
//   node tools/qm-admin.js delete "Pute"
//   node tools/qm-admin.js rename "Pute" "Edouard H."
//
// Écriture atomique via tmp + rename (cohérent avec players.js).

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "server", "quizzmaster", "players.json");

function key(name) { return String(name || "").trim().toLowerCase(); }
function load() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch (e) { console.error("Impossible de lire " + FILE + " : " + e.message); process.exit(1); }
}
function save(data) {
  data.updated_at = Date.now();
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, FILE);
}

function cmdList(data) {
  const rows = Object.values(data.byName || {}).sort((a, b) => a.name.localeCompare(b.name));
  console.log("Total : " + rows.length + " comptes");
  rows.forEach((a) => {
    console.log("  " + (a.pinHash ? "🔒 " : "   ") + a.name.padEnd(20) + " · " + (a.stats.games | 0) + " parties · record " + (a.stats.bestScore | 0));
  });
}

function cmdInfo(data, name) {
  const a = data.byName[key(name)];
  if (!a) { console.log("Aucun compte sous « " + name + " »."); process.exit(1); }
  console.log(JSON.stringify(a, null, 2));
}

function cmdDelete(data, name) {
  const k = key(name);
  if (!data.byName[k]) { console.log("Aucun compte sous « " + name + " » — rien à faire."); process.exit(1); }
  delete data.byName[k];
  save(data);
  console.log("✓ Compte « " + name + " » supprimé.");
}

function cmdRename(data, oldName, newName) {
  const oldK = key(oldName), newK = key(newName);
  if (!data.byName[oldK]) { console.log("Aucun compte sous « " + oldName + " »."); process.exit(1); }
  if (oldK === newK) { console.log("Même clé, rien à faire."); process.exit(0); }
  if (data.byName[newK]) { console.log("« " + newName + " » est déjà pris — abandon."); process.exit(1); }
  const a = data.byName[oldK];
  a.name = String(newName).trim().slice(0, 16);
  data.byName[newK] = a;
  delete data.byName[oldK];
  save(data);
  console.log("✓ « " + oldName + " » → « " + a.name + " » (stats + PIN conservés).");
}

const [, , cmd, arg1, arg2] = process.argv;
const data = load();

switch (cmd) {
  case "list": cmdList(data); break;
  case "info": if (!arg1) { console.error("Usage: info <name>"); process.exit(2); } cmdInfo(data, arg1); break;
  case "delete": if (!arg1) { console.error("Usage: delete <name>"); process.exit(2); } cmdDelete(data, arg1); break;
  case "rename": if (!arg1 || !arg2) { console.error("Usage: rename <old> <new>"); process.exit(2); } cmdRename(data, arg1, arg2); break;
  default:
    console.log("QuizzMaster admin CLI");
    console.log("  node tools/qm-admin.js list");
    console.log("  node tools/qm-admin.js info <name>");
    console.log("  node tools/qm-admin.js delete <name>");
    console.log("  node tools/qm-admin.js rename <old> <new>");
    process.exit(cmd ? 2 : 0);
}
