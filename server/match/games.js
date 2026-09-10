// Are We A Match? — les PARTIES en différé.
//
// Un joueur crée une partie et devient l'hôte ; il partage un code (QR, lien).
// Chacun répond aux 20 scènes quand il veut, en classant 3 réponses par
// préférence. Les résultats se calculent au fur et à mesure.
//
// Les règles qui font tenir le différé (voir le plan v2) :
//   - les 20 scènes sont tirées UNE fois, dans le jeu fusionné, et présentées
//     dans le MÊME ordre à tout le monde ;
//   - pour une scène, on ne voit les réponses des autres qu'après avoir validé
//     la sienne ; une réponse validée ne se change plus ;
//   - les résultats FINAUX (duo, podium, titres, matrice) portent sur les
//     joueurs qui ont fini ; une compatibilité PROVISOIRE s'affiche avec ceux
//     en cours dès MIN_SHARED scènes en commun, marquée comme telle ;
//   - une partie reste ouverte tant que l'hôte ne la ferme pas.
//
// Persistance : games.json via storage.js (écriture atomique, quarantaine),
// hors du dossier déployé. Les écritures sont REGROUPÉES : une réponse ne
// réécrit pas le fichier à elle seule.

const crypto = require("crypto");
const engine = require("./engine");
const packs = require("./packs");
const players = require("./players");
const storage = require("../storage");

const SCENES_PER_GAME = Number(process.env.MATCH_SCENES) > 0 ? Number(process.env.MATCH_SCENES) : 20;
const MIN_SHARED = 5;                 // scènes communes minimum pour une compatibilité provisoire
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // sans 0/O, 1/I/L : tapable sans hésiter
const CODE_LEN = 5;
const SAVE_DELAY_MS = Number(process.env.MATCH_SAVE_DELAY_MS) >= 0 ? Number(process.env.MATCH_SAVE_DELAY_MS) : 250;
const MAX_TITLE = 40;
const TEST_GAME_TTL_MS = 2 * 60 * 60 * 1000;   // une partie de test (mode dev) vit 2 h au plus

// Bots du mode dev : permutations FIXES, donc résultats prévisibles (classer
// dans l'ordre affiché = 100 % avec Bot A, 0 % avec Bot B).
const BOT_PERMS = [[0, 1, 2], [2, 1, 0], [1, 0, 2], [0, 2, 1]];
const BOT_NAMES = ["🤖 Bot A", "🤖 Bot B", "🤖 Bot C", "🤖 Bot D"];
const MAX_BOTS = BOT_PERMS.length;

// Même mécanique que players.js : le fichier vit hors du dossier déployé ; le
// chemin « legacy » n'existe pas pour les parties, il sert juste de repli.
const store = storage.open("games", require("path").join(__dirname, "games.json"));

// Le jeu fusionné, indexé par id de scène.
const BANK = packs.all();
const BY_ID = new Map(BANK.map((q) => [q.id, q]));

function key(name) { return String(name || "").trim().toLowerCase(); }
function shuffle(arr) {
  const a = arr.slice();
  if (process.env.MATCH_NO_SHUFFLE === "1") return a;
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

// ---------------------------------------------------------------- persistance
function emptyData() { return { byCode: Object.create(null), version: 2, updated_at: 0 }; }
let data = load();
let saveTimer = null;

function ensureGameSchema(g) {
  if (!g || typeof g !== "object") return null;
  if (typeof g.code !== "string" || !Array.isArray(g.sceneIds)) return null;
  g.sceneIds = g.sceneIds.filter((id) => BY_ID.has(id));
  if (!g.sceneIds.length) return null;
  // Comme players.js : les joueurs sont indexés par pseudo, jamais sur un
  // objet à prototype (byName["__proto__"] serait Object.prototype).
  const ps = Object.create(null);
  const src = (g.players && typeof g.players === "object") ? g.players : {};
  for (const k of Object.keys(src)) {
    const p = src[k];
    if (!p || typeof p !== "object" || !p.name) continue;
    const answers = Object.create(null);
    const a = (p.answers && typeof p.answers === "object") ? p.answers : {};
    for (const qid of Object.keys(a)) {
      const q = BY_ID.get(qid);
      if (q && g.sceneIds.includes(qid) && engine.isValidRanking(a[qid], q.o.length)) answers[qid] = a[qid].slice();
    }
    ps[k] = { name: String(p.name), joinedAt: p.joinedAt || 0, finishedAt: p.finishedAt || null, answers, hidden: !!p.hidden, seenAt: p.seenAt || 0, bot: !!p.bot };
  }
  g.players = ps;
  g.title = typeof g.title === "string" ? g.title.slice(0, MAX_TITLE) : "";
  g.closedAt = g.closedAt || null;
  g.test = !!g.test;
  g.updatedAt = g.updatedAt || g.createdAt || 0;
  return g;
}

function load() {
  const parsed = store.read();
  const out = emptyData();
  if (parsed && parsed.byCode && typeof parsed.byCode === "object") {
    for (const code of Object.keys(parsed.byCode)) {
      const g = ensureGameSchema(parsed.byCode[code]);
      if (g) out.byCode[g.code] = g;
    }
    out.updated_at = parsed.updated_at || 0;
  }
  return out;
}
function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  data.updated_at = Date.now();
  store.write(data);
}
// Regroupe les écritures : plusieurs réponses en rafale = une seule écriture.
function scheduleSave() {
  if (SAVE_DELAY_MS === 0) { flush(); return; }
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; try { flush(); } catch (e) { console.error("[games] écriture impossible :", e.message); } }, SAVE_DELAY_MS);
  if (saveTimer.unref) saveTimer.unref();   // ne retient pas le process pour une écriture différée
}
// À l'arrêt (redémarrage de l'hébergeur, Ctrl-C), ce qui est en attente est
// écrit avant de partir : sans ça, la dernière réponse d'un joueur se perdrait.
process.on("beforeExit", () => { if (saveTimer) flush(); });
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.once(sig, () => { try { if (saveTimer) flush(); } catch (e) {} process.exit(0); });
}

// ---------------------------------------------------------------- codes
function normCode(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); }
function genCode() {
  for (let tries = 0; tries < 1000; tries++) {
    let c = "";
    const bytes = crypto.randomBytes(CODE_LEN);
    for (let i = 0; i < CODE_LEN; i++) c += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    if (!data.byCode[c]) return c;
  }
  throw new Error("plus de codes disponibles");
}

// ---------------------------------------------------------------- accès
function getGame(code) { const c = normCode(code); return (c && data.byCode[c]) || null; }
function pubQuestion(q) {
  const out = { id: q.id, q: q.q, o: q.o.slice(), pack: q.pack };
  if (q.ctx) out.ctx = q.ctx;
  return out;
}
function scenes(g) { return g.sceneIds.map((id) => pubQuestion(BY_ID.get(id))); }
function progressOf(g, p) { let n = 0; for (const id of g.sceneIds) if (p.answers[id]) n++; return n; }
function nextIndexOf(g, p) { for (let i = 0; i < g.sceneIds.length; i++) if (!p.answers[g.sceneIds[i]]) return i; return g.sceneIds.length; }
function touch(g) { g.updatedAt = Date.now(); scheduleSave(); }
function playerList(g) { return Object.keys(g.players).map((k) => g.players[k]); }

// ---------------------------------------------------------------- créer / rejoindre
function createGame(opts) {
  const o = opts || {};
  const hostName = String(o.hostName || "").trim().slice(0, 16);
  const hostKey = key(hostName);
  if (!hostKey) return { ok: false, reason: "bad_name" };
  const n = Math.max(1, Math.min(BANK.length, Number(o.sceneCount) || SCENES_PER_GAME));
  const sceneIds = shuffle(BANK).slice(0, n).map((q) => q.id);
  const now = Date.now();
  const g = {
    code: genCode(), title: String(o.title || "").trim().slice(0, MAX_TITLE),
    hostKey, hostName, sceneIds, createdAt: now, updatedAt: now, closedAt: null, test: !!o.test,
    players: Object.create(null),
  };
  g.players[hostKey] = { name: hostName, joinedAt: now, finishedAt: null, answers: Object.create(null), hidden: false, seenAt: now, bot: false };
  data.byCode[g.code] = g;
  touch(g);
  return { ok: true, game: g };
}

function joinGame(code, name) {
  const g = getGame(code);
  if (!g) return { ok: false, reason: "unknown_game" };
  const k = key(name);
  if (!k) return { ok: false, reason: "bad_name" };
  if (g.players[k]) { g.players[k].hidden = false; return { ok: true, game: g, already: true }; }
  if (g.closedAt) return { ok: false, reason: "closed" };
  g.players[k] = { name: String(name).trim().slice(0, 16), joinedAt: Date.now(), finishedAt: null, answers: Object.create(null), hidden: false, seenAt: Date.now(), bot: false };
  touch(g);
  return { ok: true, game: g };
}

// ---------------------------------------------------------------- répondre
// Enregistre le classement d'une scène. Une réponse validée ne se change plus
// (already_answered) : sinon on pourrait la « corriger » après avoir vu les
// autres. Quand la dernière scène est validée, le joueur est « fini » et ses
// classements nourrissent son profil (matchs d'un autre soir), pack par pack.
function answer(code, name, qid, ranking) {
  const g = getGame(code);
  if (!g) return { ok: false, reason: "unknown_game" };
  const p = g.players[key(name)];
  if (!p) return { ok: false, reason: "not_in_game" };
  if (g.closedAt) return { ok: false, reason: "closed" };
  if (!g.sceneIds.includes(qid)) return { ok: false, reason: "unknown_scene" };
  const q = BY_ID.get(qid);
  if (p.answers[qid]) return { ok: false, reason: "already_answered" };
  if (!engine.isValidRanking(ranking, q.o.length)) return { ok: false, reason: "bad_ranking" };
  p.answers[qid] = ranking.slice();
  let finished = false;
  if (progressOf(g, p) === g.sceneIds.length) {
    p.finishedAt = Date.now();
    finished = true;
    if (!g.test && !p.bot) recordProfile(g, p);
  }
  touch(g);
  return { ok: true, finished, index: nextIndexOf(g, p), progress: progressOf(g, p), reveal: sceneReveal(g, qid, key(name)) };
}
function recordProfile(g, p) {
  const byPack = {};
  for (const id of g.sceneIds) {
    const q = BY_ID.get(id);
    if (!p.answers[id]) continue;
    (byPack[q.pack] = byPack[q.pack] || {})[id] = p.answers[id];
  }
  try { players.recordAnswersByPack(p.name, null, byPack); } catch (e) { console.error("[games] profil non mis à jour :", e.message); }
}

// ---------------------------------------------------------------- reveal d'une scène
// Ce que voit un joueur qui a répondu à une scène : les classements de TOUS
// ceux qui y ont répondu (lui compris), le classement du groupe, les accords
// parfaits, et qui manque encore. Jamais rien si le joueur n'a pas répondu.
function sceneReveal(g, qid, viewerKey) {
  const me = g.players[viewerKey];
  if (!me || !me.answers[qid]) return null;
  const q = BY_ID.get(qid);
  const byName = Object.create(null);
  const answers = [];
  const missing = [];
  for (const p of playerList(g)) {
    if (p.answers[qid]) { byName[p.name] = p.answers[qid]; answers.push({ name: p.name, ranking: p.answers[qid].slice(), me: p === me }); }
    else missing.push(p.name);
  }
  const gr = engine.groupRanking(byName, q.o.length);
  return {
    qid, index: g.sceneIds.indexOf(qid), question: pubQuestion(q),
    answers, missing,
    group: gr.order.map((x) => ({ option: x.option, label: q.o[x.option], score: x.score, firstPicks: x.firstPicks })),
    voters: gr.voters,
    perfect: engine.perfectPairsFor(byName, q.o.length),
  };
}
function reveal(code, name, qid) {
  const g = getGame(code);
  if (!g) return null;
  return sceneReveal(g, qid, key(name));
}
// « Scène par scène » : tous les reveals auxquels le joueur a droit.
function revealsFor(code, name) {
  const g = getGame(code);
  if (!g) return null;
  const k = key(name);
  if (!g.players[k]) return null;
  return g.sceneIds.map((qid) => sceneReveal(g, qid, k)).filter(Boolean);
}

// ---------------------------------------------------------------- résultats
function commonAgreement(g, a, b) {
  let agree = 0, total = 0, shared = 0, sameTop = 0;
  for (const id of g.sceneIds) {
    const ra = a.answers[id], rb = b.answers[id];
    if (!ra || !rb) continue;
    const r = engine.pairAgreement(ra, rb, ra.length);
    agree += r.agree; total += r.total; shared++;
    if (ra[0] === rb[0]) sameTop++;
  }
  return { agree, total, shared, sameTop, pct: total > 0 ? Math.round((agree / total) * 100) : null };
}
// Meilleure compatibilité provisoire d'un joueur avec n'importe quel autre
// (fini ou non), dès MIN_SHARED scènes en commun : l'amorce de l'accueil.
function teaserFor(g, me) {
  let best = null;
  for (const p of playerList(g)) {
    if (p === me) continue;
    const c = commonAgreement(g, me, p);
    if (c.shared < MIN_SHARED || c.pct == null) continue;
    if (!best || c.pct > best.pct || (c.pct === best.pct && c.shared > best.shared)) best = { name: p.name, pct: c.pct, shared: c.shared };
  }
  return best;
}

function results(code, name) {
  const g = getGame(code);
  if (!g) return null;
  const k = key(name);
  const me = g.players[k];
  if (!me) return null;
  const all = playerList(g);
  const finished = all.filter((p) => p.finishedAt);
  const base = {
    code: g.code, title: g.title, closed: !!g.closedAt, sceneCount: g.sceneIds.length,
    players: all.map((p) => ({ name: p.name, progress: progressOf(g, p), finished: !!p.finishedAt, me: p === me })),
    finishedCount: finished.length,
  };
  if (!me.finishedAt) {
    return Object.assign(base, { locked: true, progress: progressOf(g, me), teaser: teaserFor(g, me) });
  }
  // Finaux : uniquement les joueurs finis (20 scènes communes, c'est solide).
  const nameAnswers = {};
  for (const id of g.sceneIds) {
    const row = Object.create(null);
    for (const p of finished) if (p.answers[id]) row[p.name] = p.answers[id];
    nameAnswers[id] = row;
  }
  const names = finished.map((p) => p.name);
  const res = engine.buildResults(nameAnswers, names, { minShared: MIN_SHARED });
  // Provisoires : avec ceux qui n'ont pas fini, dès MIN_SHARED scènes en commun.
  const provisional = [];
  for (const p of all) {
    if (p.finishedAt || p === me) continue;
    const c = commonAgreement(g, me, p);
    if (c.shared >= MIN_SHARED && c.pct != null) provisional.push({ name: p.name, pct: c.pct, shared: c.shared, progress: progressOf(g, p), band: engine.band(c.pct) });
  }
  provisional.sort((x, y) => y.pct - x.pct || y.shared - x.shared);
  me.seenAt = Date.now();
  scheduleSave();
  return Object.assign(base, {
    locked: false,
    final: {
      top: res.top, podium: res.podium, opposites: res.opposites,
      groupSoul: res.groupSoul, freeSpirit: res.freeSpirit,
      matrix: res.matrix, averages: res.averages, names,
    },
    personal: engine.personalFor(me.name, res),
    provisional,
    moments: moments(g, finished),
  });
}

// Les moments de la partie, sur les joueurs finis : la scène qui divise le
// plus, la scène unanime, le duo le plus souvent en accord parfait.
function moments(g, finished) {
  if (finished.length < 2) return null;
  let divisive = null, unanimous = null;
  const perfectCount = Object.create(null);
  for (const id of g.sceneIds) {
    const q = BY_ID.get(id);
    const byName = Object.create(null);
    for (const p of finished) if (p.answers[id]) byName[p.name] = p.answers[id];
    const names = Object.keys(byName);
    if (names.length < 2) continue;
    let agree = 0, total = 0;
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const r = engine.pairAgreement(byName[names[i]], byName[names[j]], q.o.length);
      agree += r.agree; total += r.total;
    }
    const pct = total ? Math.round((agree / total) * 100) : 0;
    if (!divisive || pct < divisive.pct) divisive = { qid: id, q: q.q, pct };
    if (pct === 100 && (!unanimous || names.length > unanimous.voters)) unanimous = { qid: id, q: q.q, voters: names.length };
    for (const pair of engine.perfectPairsFor(byName, q.o.length)) {
      const pk = [pair.a, pair.b].sort().join(" & ");
      perfectCount[pk] = (perfectCount[pk] || 0) + 1;
    }
  }
  let bestPair = null;
  for (const pk in perfectCount) if (!bestPair || perfectCount[pk] > bestPair.count) bestPair = { pair: pk, count: perfectCount[pk] };
  return { divisive, unanimous, perfectPair: bestPair };
}

// ---------------------------------------------------------------- état public
// Ce que voit quelqu'un qui ouvre la partie (joueur ou non). Jamais une
// réponse : celles-ci ne sortent que par sceneReveal / results.
function state(code, name) {
  const g = getGame(code);
  if (!g) return null;
  const k = key(name);
  const me = g.players[k] || null;
  const all = playerList(g);
  const out = {
    code: g.code, title: g.title, hostName: g.hostName, test: g.test,
    sceneCount: g.sceneIds.length, createdAt: g.createdAt, updatedAt: g.updatedAt, closedAt: g.closedAt,
    players: all.map((p) => ({ name: p.name, progress: progressOf(g, p), finished: !!p.finishedAt, host: key(p.name) === g.hostKey, me: p === me, bot: !!p.bot })),
    finishedCount: all.filter((p) => p.finishedAt).length,
    me: me ? { joined: true, host: k === g.hostKey, progress: progressOf(g, me), finished: !!me.finishedAt, nextIndex: nextIndexOf(g, me), teaser: me.finishedAt ? null : teaserFor(g, me) }
            : { joined: false, host: false, progress: 0, finished: false, nextIndex: 0, teaser: null },
  };
  if (me) out.scenes = scenes(g);   // le contenu des scènes, réservé aux joueurs de la partie
  return out;
}

// La liste « Mes parties » d'un joueur, la plus récente d'abord, avec ce qui
// est nouveau depuis son dernier passage (quelqu'un a fini).
function listFor(name) {
  const k = key(name);
  const out = [];
  for (const code of Object.keys(data.byCode)) {
    const g = data.byCode[code];
    const me = g.players[k];
    if (!me || me.hidden) continue;
    const all = playerList(g);
    const hasNew = all.some((p) => p !== me && p.finishedAt && p.finishedAt > (me.seenAt || 0));
    out.push({
      code: g.code, title: g.title, hostName: g.hostName, host: k === g.hostKey, test: g.test,
      playerCount: all.length, finishedCount: all.filter((p) => p.finishedAt).length,
      sceneCount: g.sceneIds.length, progress: progressOf(g, me), finished: !!me.finishedAt,
      closed: !!g.closedAt, updatedAt: g.updatedAt, hasNew, teaser: me.finishedAt ? null : teaserFor(g, me),
    });
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}
function markSeen(code, name) {
  const g = getGame(code); const p = g && g.players[key(name)];
  if (!p) return; p.seenAt = Date.now(); scheduleSave();
}
function isPlayer(code, name) { const g = getGame(code); return !!(g && g.players[key(name)]); }

// ---------------------------------------------------------------- hôte
function closeGame(code, name) {
  const g = getGame(code);
  if (!g) return { ok: false, reason: "unknown_game" };
  if (key(name) !== g.hostKey) return { ok: false, reason: "not_host" };
  if (g.test) { deleteGame(code); return { ok: true, deleted: true }; }
  g.closedAt = g.closedAt || Date.now();
  touch(g);
  return { ok: true };
}
function removePlayer(code, hostName, targetName) {
  const g = getGame(code);
  if (!g) return { ok: false, reason: "unknown_game" };
  if (key(hostName) !== g.hostKey) return { ok: false, reason: "not_host" };
  const tk = key(targetName);
  if (tk === g.hostKey || !g.players[tk]) return { ok: false, reason: "bad_target" };
  delete g.players[tk];
  touch(g);
  return { ok: true };
}
function hideGame(code, name) {
  const g = getGame(code); const p = g && g.players[key(name)];
  if (!p) return { ok: false, reason: "not_in_game" };
  p.hidden = true; touch(g);
  return { ok: true };
}
function deleteGame(code) {
  const c = normCode(code);
  if (!data.byCode[c]) return false;
  delete data.byCode[c];
  scheduleSave();
  return true;
}

// ---------------------------------------------------------------- mode dev
// Une partie de test : des bots qui répondent à tout, tout de suite, avec
// leur permutation fixe. Rien ne touche les profils (g.test), et la partie
// disparaît quand l'hôte la ferme ou après TEST_GAME_TTL_MS.
function createTestGame(hostName, bots) {
  const r = createGame({ hostName, title: "Partie de test", test: true });
  if (!r.ok) return r;
  const g = r.game;
  const n = Math.max(0, Math.min(MAX_BOTS, Number(bots) || 0));
  for (let i = 0; i < n; i++) {
    const p = { name: BOT_NAMES[i], joinedAt: Date.now(), finishedAt: Date.now(), answers: Object.create(null), hidden: false, seenAt: 0, bot: true };
    for (const id of g.sceneIds) {
      const q = BY_ID.get(id);
      const perm = BOT_PERMS[i];
      p.answers[id] = perm.length === q.o.length ? perm.slice() : Array.from({ length: q.o.length }, (_, k2) => k2);
    }
    g.players[key(p.name)] = p;
  }
  touch(g);
  return { ok: true, game: g };
}
function purgeTestGames(now) {
  const t = now || Date.now();
  for (const code of Object.keys(data.byCode)) {
    const g = data.byCode[code];
    if (g.test && t - g.updatedAt > TEST_GAME_TTL_MS) delete data.byCode[code];
  }
}

// ---------------------------------------------------------------- admin
function adminList() {
  return Object.keys(data.byCode).map((code) => {
    const g = data.byCode[code];
    const all = playerList(g);
    return {
      code: g.code, title: g.title, hostName: g.hostName, test: g.test,
      players: all.length, finished: all.filter((p) => p.finishedAt).length,
      sceneCount: g.sceneIds.length, createdAt: g.createdAt, updatedAt: g.updatedAt, closedAt: g.closedAt,
    };
  }).sort((a, b) => b.updatedAt - a.updatedAt);
}

function _reset() { data = emptyData(); if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } }

module.exports = {
  createGame, joinGame, answer, results, reveal, revealsFor, state, listFor, markSeen, isPlayer,
  closeGame, removePlayer, hideGame, deleteGame,
  createTestGame, purgeTestGames, adminList,
  getGame, normCode, flush, question: (id) => { const q = BY_ID.get(id); return q ? pubQuestion(q) : null; },
  SCENES_PER_GAME, MIN_SHARED, MAX_BOTS, BANK_SIZE: BANK.length, CODE_LEN, _reset,
};
