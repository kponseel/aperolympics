// Are We A Match? — comptes persistants (pseudo + PIN optionnel + réponses).
//
// Un fichier JSON sur disque (players.json), clé = pseudo en minuscules :
//   {
//     name, pinHash, salt, ownerCid,
//     stats: { games, answered, lastAt },
//     answers: { [packId]: { [questionId]: [rankings] } }   // dernière réponse connue
//   }
//
// Les RÉPONSES sont conservées : c'est ce qui permet le « match historique »
// (être comparé à quelqu'un qui a joué un autre soir, sans être dans la salle).
// Même modèle de protection que QuizzMaster : PIN 4 chiffres optionnel, le
// device propriétaire (cid) passe toujours, un pseudo libre est réclamable.
//
// Écriture atomique (tmp + rename) pour qu'un crash ne laisse jamais un
// fichier à moitié écrit.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const engine = require("./engine");
const storage = require("../storage");

// Hors du dossier déployé (voir server/storage.js) : les réponses mémorisées
// sont tout l'intérêt du « match d'un autre soir », les perdre à chaque mise
// en ligne viderait la fonctionnalité de son sens.
const store = storage.open("match", path.join(__dirname, "players.json"));
const FILE = store.file;
const PIN_RE = /^\d{4}$/;
const TOP_N = 10;

let data = load();

function emptyStats() { return { games: 0, answered: 0, lastAt: 0 }; }
// `byName` est indexé DIRECTEMENT par le pseudo tapé par un joueur : un objet
// littéral hérite d'Object.prototype, et lire byName["__proto__"] ne renvoie
// jamais undefined — ça renvoie Object.prototype lui-même (toujours "vrai"),
// ce qui contourne silencieusement toute la logique de création de compte et
// finit par écrire des propriétés directement sur le prototype partagé par
// TOUT le process (donc aussi Aperolympics et QuizzMaster). Object.create(null)
// n'a aucun prototype : la même lecture y renvoie bien undefined.
function emptyData() { return { byName: Object.create(null), version: 1, updated_at: 0 }; }
// Ceinture ET bretelles : même avec byName sans prototype, un pseudo comme
// "toString" ou "constructor" resterait un nom de compte parfaitement valide
// mais piégeux ailleurs dans le code (accès par hasOwnProperty non garanti
// partout). On les refuse simplement à la création — un pseudo pareil n'a de
// toute façon aucun sens pour un joueur.
// En minuscules : `key()` compare toujours sur le pseudo déjà passé en
// minuscules (c'est un piège que j'ai moi-même fait tomber dans un premier
// jet — "toString" ne matchait jamais "tostring").
const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype", "tostring", "valueof", "hasownproperty"]);

// Un classement stocké doit rester une PERMUTATION plausible (indices entiers
// uniques) : un fichier édité à la main, une vieille version du client, ou une
// future banque à N options ne doit jamais faire planter isValidRanking /
// pairAgreement plus tard — on écarte l'entrée invalide au chargement, une
// fois pour toutes, plutôt que de laisser le serveur tomber sur une requête
// anonyme (get_profile, historicMatches…) qui la relit.
function sanitizeRanking(r) {
  if (!Array.isArray(r) || !r.length || r.length > 12) return false;
  const seen = new Set();
  for (const v of r) {
    if (!Number.isInteger(v) || v < 0 || seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

function ensureSchema(a) {
  if (!a) return;
  if (!a.stats) a.stats = emptyStats();
  if (a.stats.games == null) a.stats.games = 0;
  if (a.stats.answered == null) a.stats.answered = 0;
  if (a.stats.lastAt == null) a.stats.lastAt = 0;
  if (!a.answers || typeof a.answers !== "object") a.answers = {};
  for (const packId in a.answers) {
    const byQid = a.answers[packId];
    if (!byQid || typeof byQid !== "object") { delete a.answers[packId]; continue; }
    for (const qid in byQid) {
      if (!sanitizeRanking(byQid[qid])) delete byQid[qid];
    }
  }
}

function load() {
  const parsed = store.read();
  if (parsed && parsed.byName) {
    // JSON.parse rend un objet littéral ordinaire (donc avec le prototype
    // standard) : on le reconstruit sans prototype, comme emptyData().
    const byName = Object.assign(Object.create(null), parsed.byName);
    for (const k in byName) ensureSchema(byName[k]);
    parsed.byName = byName;
    return parsed;
  }
  return emptyData();
}
function save() { store.write(data); }

function key(name) { return String(name || "").trim().toLowerCase(); }
function hashPin(pin, salt) { return crypto.createHash("sha256").update(salt + ":" + String(pin)).digest("hex"); }

function getAccount(name) { const a = data.byName[key(name)] || null; if (a) ensureSchema(a); return a; }
function isProtected(name) { const a = getAccount(name); return !!(a && a.pinHash); }

function ensure(name, cid) {
  const k = key(name); if (!k || RESERVED_KEYS.has(k)) return null;
  if (!data.byName[k]) {
    data.byName[k] = {
      name: String(name).trim().slice(0, 16),
      pinHash: null, salt: null, ownerCid: cid || null,
      stats: emptyStats(), answers: {},
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
  save();
  return true;
}

// Résout une tentative de connexion. Mêmes règles que QuizzMaster :
//   { ok: true, account } | { ok:false, reason:"pin_required"|"pin_wrong"|"bad_name" }
function authenticate(name, cid, pin) {
  const k = key(name);
  if (!k || RESERVED_KEYS.has(k)) return { ok: false, reason: "bad_name" };
  const a = getAccount(name);

  if (!a) {                                   // pseudo libre → réservé pour ce device
    const acc = ensure(name, cid);
    acc.ownerCid = cid;
    acc.name = String(name).trim().slice(0, 16);
    if (pin && PIN_RE.test(String(pin))) setPin(name, pin);
    save();
    return { ok: true, account: acc, protected: !!acc.pinHash };
  }
  if (a.ownerCid === cid) {                   // même device
    if (pin && PIN_RE.test(String(pin)) && !a.pinHash) setPin(name, pin);
    save();
    return { ok: true, account: a, protected: !!a.pinHash };
  }
  if (a.pinHash) {                            // protégé, autre device
    if (!pin) return { ok: false, reason: "pin_required" };
    if (hashPin(pin, a.salt) === a.pinHash) { a.ownerCid = cid; save(); return { ok: true, account: a, protected: true }; }
    return { ok: false, reason: "pin_wrong" };
  }
  // Libre, autre device → reprise. Volontairement AUCUN setPin ici, même si
  // un pin a été fourni : un compte non protégé est réclamable par
  // conception (musical chairs assumé), mais poser un PIN dans la même
  // requête verrouillerait l'ancien détenteur hors de son propre historique
  // en un seul message, sans qu'il ait jamais rien pu protéger lui-même.
  // Protéger un compte reste réservé au flux dédié (bouton 🔒, événement
  // set_pin) — un geste explicite et séparé, jamais un effet de bord du login.
  a.ownerCid = cid;
  save();
  return { ok: true, account: a, protected: !!a.pinHash };
}

// Enregistre une partie terminée : on mémorise les classements donnés pour
// pouvoir matcher plus tard. `answersByQid` = { [questionId]: ranking }.
function recordGame(name, cid, packId, answersByQid) {
  const a = ensure(name, cid); if (!a) return;
  if (!a.answers[packId]) a.answers[packId] = {};
  let n = 0;
  for (const qid in answersByQid) {
    const r = answersByQid[qid];
    if (!engine.isValidRanking(r, engine.OPTIONS_PER_QUESTION)) continue;
    a.answers[packId][qid] = r.slice();   // la dernière réponse écrase l'ancienne
    n++;
  }
  a.stats.games += 1;
  a.stats.answered += n;
  a.stats.lastAt = Date.now();
  data.updated_at = Date.now();
  save();
}

// « Match historique » : compare les réponses stockées d'un joueur à celles de
// TOUS les autres comptes ayant joué le même pack. C'est ce qui permet d'être
// comparé à quelqu'un qui n'est pas dans la salle.
// `minShared` évite les faux 100 % sur 1 seule question commune.
function historicMatches(name, packId, opts) {
  const o = opts || {};
  const minShared = o.minShared || 5;
  const me = getAccount(name);
  if (!me || !me.answers[packId]) return [];
  const mine = me.answers[packId];

  const out = [];
  for (const k in data.byName) {
    const other = data.byName[k];
    ensureSchema(other);
    if (!other.name || other.name === me.name) continue;
    const theirs = other.answers[packId];
    if (!theirs) continue;
    let agree = 0, total = 0, shared = 0, sameTop = 0;
    for (const qid in mine) {
      if (!theirs[qid] || mine[qid].length !== theirs[qid].length) continue; // options incomparables
      const r = engine.pairAgreement(mine[qid], theirs[qid], mine[qid].length);
      agree += r.agree; total += r.total; shared++;
      if (mine[qid][0] === theirs[qid][0]) sameTop++;
    }
    if (shared < minShared || total === 0) continue;
    const pct = Math.round((agree / total) * 100);
    out.push({ name: other.name, pct, shared, sameTop, band: engine.band(pct) });
  }
  out.sort((x, y) => y.pct - x.pct || y.shared - x.shared || x.name.localeCompare(y.name));
  return out.slice(0, TOP_N);
}

// Profil affichable d'un joueur.
function profile(name, packsMeta) {
  const a = getAccount(name);
  if (!a) return null;
  const meta = packsMeta || {};
  const packs = Object.keys(a.answers).map((pid) => {
    const m = meta[pid] || {};
    return {
      pack: pid,
      name: m.name || pid,
      emoji: m.emoji || "🎯",
      answered: Object.keys(a.answers[pid] || {}).length,
    };
  }).sort((x, y) => y.answered - x.answered);
  return {
    name: a.name,
    locked: !!a.pinHash,
    games: a.stats.games | 0,
    answered: a.stats.answered | 0,
    lastAt: a.stats.lastAt || 0,
    packs,
  };
}

// --- Admin (utilisé par le panneau /admin, mêmes conventions que QuizzMaster) ---
function adminList() {
  return Object.values(data.byName).map((a) => {
    ensureSchema(a);
    return {
      name: a.name,
      protected: !!a.pinHash,
      games: a.stats.games | 0,
      answered: a.stats.answered | 0,
      lastAt: a.stats.lastAt || 0,   // pas `| 0` : un timestamp déborde l'int32
      packs: Object.keys(a.answers || {}).length,
    };
  }).sort((x, y) => x.name.localeCompare(y.name));
}
function adminDelete(name) {
  const k = key(name);
  if (!data.byName[k]) return false;
  delete data.byName[k];
  data.updated_at = Date.now();
  save();
  return true;
}
function adminResetPin(name) {
  const a = data.byName[key(name)];
  if (!a) return false;
  a.pinHash = null; a.salt = null; a.ownerCid = null;
  data.updated_at = Date.now();
  save();
  return true;
}

function _reset() { data = emptyData(); try { fs.unlinkSync(FILE); } catch (e) {} }

module.exports = {
  authenticate, isProtected, getAccount, setPin, recordGame,
  historicMatches, profile,
  adminList, adminDelete, adminResetPin,
  PIN_RE, TOP_N, _reset,
};
