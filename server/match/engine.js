// Are We A Match? — moteur de compatibilité.
//
// Mécanique : à chaque question, un joueur CLASSE les 3 options (1er = préféré,
// 3e = le moins aimé). Un classement est stocké comme un tableau d'indices
// d'options, meilleur d'abord : [2,0,1] = option 2 en 1er, option 0 en 2e,
// option 1 en 3e.
//
// Compatibilité entre deux joueurs = part des COMPARAISONS PAR PAIRES sur
// lesquelles ils sont d'accord. Avec 3 options il y a 3 comparaisons par
// question (A/B, A/C, B/C) : pour chacune, « est-ce que les deux mettent la
// même option devant ? ». Score = accords / comparaisons.
//
// Pourquoi ce choix : c'est la distance de Kendall normalisée — lisse (4
// paliers par question), symétrique, et surtout explicable aux joueurs en une
// phrase (« 3 comparaisons par question, 1 point par accord »).
//
// ⚠️ Propriété importante : deux classements ALÉATOIRES s'accordent sur 50 %
// des comparaisons en moyenne. Le chiffre brut est donc naturellement centré
// vers 50 % — ce qui compte est le CLASSEMENT RELATIF des duos, pas la valeur
// absolue. L'UI traduit le score en paliers qualitatifs.

const OPTIONS_PER_QUESTION = 3;

// --- helpers ---------------------------------------------------------------

// Un classement valide = permutation exacte de [0..n-1].
function isValidRanking(ranking, nOptions) {
  if (!Array.isArray(ranking) || ranking.length !== nOptions) return false;
  const seen = new Set();
  for (const v of ranking) {
    if (!Number.isInteger(v) || v < 0 || v >= nOptions) return false;
    if (seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

// position[opt] = rang (0 = préféré).
function positionsOf(ranking) {
  const pos = {};
  ranking.forEach((opt, idx) => { pos[opt] = idx; });
  return pos;
}

// Accord par paires entre deux classements de la MÊME question.
// Retourne { agree, total } — avec 3 options : total = 3.
function pairAgreement(rankA, rankB, nOptions) {
  const n = nOptions || OPTIONS_PER_QUESTION;
  const pa = positionsOf(rankA);
  const pb = positionsOf(rankB);
  let agree = 0, total = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (pa[i] == null || pa[j] == null || pb[i] == null || pb[j] == null) continue;
      total++;
      // « i passe avant j » — même verdict des deux côtés ?
      if ((pa[i] < pa[j]) === (pb[i] < pb[j])) agree++;
    }
  }
  return { agree, total };
}

// --- matrice de compatibilité ----------------------------------------------

// answers : { [questionId]: { [playerName]: ranking } }
// names   : liste des joueurs à inclure (l'ordre pilote l'affichage).
// Retourne :
//   pairs  : [{ a, b, agree, total, pct, shared, sameTop }]
//   byName : { [name]: { [other]: pct } }  (accès rapide symétrique)
function buildMatrix(answers, names, nOptions) {
  const n = nOptions || OPTIONS_PER_QUESTION;
  const pairs = [];
  const byName = {};
  names.forEach((x) => { byName[x] = {}; });

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i], b = names[j];
      let agree = 0, total = 0, shared = 0, sameTop = 0;
      for (const qid in answers) {
        const ra = answers[qid][a];
        const rb = answers[qid][b];
        if (!ra || !rb) continue;           // question non partagée
        const r = pairAgreement(ra, rb, n);
        agree += r.agree;
        total += r.total;
        shared++;
        if (ra[0] === rb[0]) sameTop++;      // même coup de cœur
      }
      const pct = total > 0 ? Math.round((agree / total) * 100) : null;
      pairs.push({ a, b, agree, total, pct, shared, sameTop });
      if (pct != null) { byName[a][b] = pct; byName[b][a] = pct; }
    }
  }
  return { pairs, byName };
}

// Palier qualitatif — c'est lui qui porte l'émotion, pas le chiffre brut.
function band(pct) {
  if (pct == null) return { key: "unknown", label: "—", emoji: "❔" };
  if (pct >= 90) return { key: "soulmates", label: "Âmes sœurs", emoji: "💞" };
  if (pct >= 75) return { key: "high", label: "Très compatibles", emoji: "💘" };
  if (pct >= 60) return { key: "good", label: "Bonne entente", emoji: "🙂" };
  if (pct >= 40) return { key: "mixed", label: "Ça dépend des jours", emoji: "🤷" };
  return { key: "opposite", label: "Opposés", emoji: "⚔️" };
}

// --- résultats de fin de partie --------------------------------------------

// Construit le payload public de l'écran final.
// minShared : nombre minimum de questions communes pour qu'un duo soit classé.
function buildResults(answers, names, opts) {
  const o = opts || {};
  const nOptions = o.nOptions || OPTIONS_PER_QUESTION;
  const minShared = o.minShared || 1;
  const { pairs, byName } = buildMatrix(answers, names, nOptions);

  const ranked = pairs
    .filter((p) => p.pct != null && p.shared >= minShared)
    .sort((x, y) => y.pct - x.pct || y.sameTop - x.sameTop || x.a.localeCompare(y.a));

  // Moyenne de compatibilité par joueur (avec tous les autres).
  const avg = {};
  names.forEach((nm) => {
    const vals = Object.values(byName[nm] || {});
    avg[nm] = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  });
  const withAvg = names.filter((nm) => avg[nm] != null);
  const sortedAvg = withAvg.slice().sort((x, y) => avg[y] - avg[x] || x.localeCompare(y));

  const res = {
    pairs: ranked,
    matrix: byName,
    averages: avg,
    top: ranked.length ? ranked[0] : null,
    podium: ranked.slice(0, 3),
    opposites: ranked.length > 1 ? ranked[ranked.length - 1] : null,
  };

  // 🫂 L'âme sœur du groupe : la meilleure moyenne (celui qui s'entend avec tous).
  if (sortedAvg.length) {
    const best = sortedAvg[0];
    res.groupSoul = { name: best, pct: avg[best] };
    // 🛸 L'électron libre : la plus faible moyenne (le contrariant).
    if (sortedAvg.length > 1) {
      const worst = sortedAvg[sortedAvg.length - 1];
      if (worst !== best) res.freeSpirit = { name: worst, pct: avg[worst] };
    }
  }
  return res;
}

// Vue PERSONNELLE d'un joueur : son meilleur (et son pire) match.
// Envoyée en privé à chaque joueur — c'est le payoff individuel.
function personalFor(name, results) {
  const row = (results.matrix && results.matrix[name]) || {};
  const entries = Object.keys(row).map((other) => ({ name: other, pct: row[other] }));
  if (!entries.length) return { best: null, worst: null, average: null };
  entries.sort((x, y) => y.pct - x.pct || x.name.localeCompare(y.name));
  const best = entries[0];
  const worst = entries[entries.length - 1];
  // Le détail du duo phare (pour afficher les coups de cœur communs).
  const bestPair = (results.pairs || []).find(
    (p) => (p.a === name && p.b === best.name) || (p.b === name && p.a === best.name)
  );
  return {
    best: { name: best.name, pct: best.pct, band: band(best.pct), sameTop: bestPair ? bestPair.sameTop : 0 },
    worst: entries.length > 1 ? { name: worst.name, pct: worst.pct, band: band(worst.pct) } : null,
    average: results.averages ? results.averages[name] : null,
    ranking: entries,
  };
}

// --- mini-reveal (après chaque question) ------------------------------------

// Classement agrégé du groupe pour une question : score de Borda (rang 0 vaut
// le plus de points). Sert au mini-reveal « ce que le groupe a préféré ».
function groupRanking(rankingsByName, nOptions) {
  const n = nOptions || OPTIONS_PER_QUESTION;
  const score = new Array(n).fill(0);
  const firstPicks = new Array(n).fill(0);
  let voters = 0;
  for (const nm in rankingsByName) {
    const r = rankingsByName[nm];
    if (!r) continue;
    voters++;
    r.forEach((opt, idx) => { score[opt] += (n - 1 - idx); });
    firstPicks[r[0]]++;
  }
  const order = score
    .map((s, i) => ({ option: i, score: s, firstPicks: firstPicks[i] }))
    .sort((x, y) => y.score - x.score || y.firstPicks - x.firstPicks || x.option - y.option);
  return { order, voters, firstPicks };
}

// Duos en accord PARFAIT sur cette question (3/3) — le highlight du reveal.
function perfectPairsFor(rankingsByName, nOptions) {
  const n = nOptions || OPTIONS_PER_QUESTION;
  const names = Object.keys(rankingsByName).filter((nm) => rankingsByName[nm]);
  const out = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const r = pairAgreement(rankingsByName[names[i]], rankingsByName[names[j]], n);
      if (r.total > 0 && r.agree === r.total) out.push({ a: names[i], b: names[j] });
    }
  }
  return out;
}

module.exports = {
  OPTIONS_PER_QUESTION,
  isValidRanking,
  positionsOf,
  pairAgreement,
  buildMatrix,
  buildResults,
  personalFor,
  band,
  groupRanking,
  perfectPairsFor,
};
