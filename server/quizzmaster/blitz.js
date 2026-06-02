// QuizzMaster — moteur "Blitz 60 secondes".
//
// Règle unique : pendant 60 s, chaque joueur enchaîne un maximum de questions.
// Chaque question = 4 choix + un bouton « Je passe ».
//   bonne réponse  = +1 point
//   mauvaise       = −1 point
//   je passe       =  0 point
// Score = bonnes − mauvaises. « Je passe » devient donc un choix stratégique
// (mieux vaut passer que risquer −1 quand on hésite).
//
// S'il y a plusieurs joueurs, ils reçoivent le MÊME paquet de questions, dans
// le MÊME ordre (mélangé une fois au départ) → course équitable. Chaque joueur
// progresse à son rythme : le client garde son propre index et remonte ses
// compteurs cumulés (bonnes / mauvaises / passées / meilleure série). Le
// scoring est côté client (acceptable pour un quiz d'apéro ; à durcir plus tard
// si le classement permanent doit résister à la triche).

function shuffle(arr) {
  const a = arr.slice();
  if (process.env.QM_NO_SHUFFLE === "1") return a;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function clampInt(v, max) {
  const n = Number(v);
  if (!isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), max);
}

function create(bank) {
  let questions = [];   // [{ q, choices, correct }]
  let stats = {};       // name -> { correct, wrong, skipped, streak }
  let eligible = [];    // names racing this round

  function score(s) { return s.correct - s.wrong; }

  function rows() {
    return eligible.map((n) => {
      const s = stats[n] || { correct: 0, wrong: 0, skipped: 0, streak: 0 };
      const attempts = s.correct + s.wrong;
      return {
        name: n,
        correct: s.correct, wrong: s.wrong, skipped: s.skipped, streak: s.streak,
        attempts: attempts,
        seen: attempts + s.skipped,
        score: score(s),
        accuracy: attempts > 0 ? Math.round((s.correct / attempts) * 100) : 0,
      };
    });
  }

  function standings() {
    return rows().sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;     // higher score first
      if (a.wrong !== b.wrong) return a.wrong - b.wrong;     // fewer mistakes
      if (b.correct !== a.correct) return b.correct - a.correct;
      return a.name.localeCompare(b.name);
    });
  }

  return {
    begin(players) {
      questions = shuffle(bank).map((q) => ({
        q: q.text, choices: q.options.slice(), correct: q.correct,
      }));
      eligible = players.map((p) => p.name).filter(Boolean);
      stats = {};
      eligible.forEach((n) => { stats[n] = { correct: 0, wrong: 0, skipped: 0, streak: 0 }; });
    },

    report(name, msg) {
      if (!stats[name]) return false;
      const total = questions.length || 999;
      stats[name] = {
        correct: clampInt(msg.correct, total),
        wrong: clampInt(msg.wrong, total),
        skipped: clampInt(msg.skipped, total),
        streak: clampInt(msg.streak, total),
      };
      return true;
    },

    questions: () => questions,
    standings,

    // Rich end-of-game summary: winner + a handful of fun secondary awards +
    // room-wide aggregates. Awards only surface when meaningful (≥1 attempt).
    summary() {
      const st = standings();
      if (!st.length) return { mvp: null, extras: [], totals: {}, standings: [] };

      const top = st[0];
      const mvp = {
        emoji: "🥇", label: "Champion(ne) du Blitz", name: top.name,
        value: top.score + " pt" + (Math.abs(top.score) > 1 ? "s" : "") + " · " + top.correct + "✓ " + top.wrong + "✗",
      };

      const extras = [];
      const attempted = st.filter((r) => r.attempts >= 1);

      // 🎯 Le plus précis (meilleure %, min 3 tentatives)
      const accPool = st.filter((r) => r.attempts >= 3);
      if (accPool.length) {
        const best = accPool.slice().sort((a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts)[0];
        if (best && best.accuracy > 0 && best.name !== top.name) {
          extras.push({ emoji: "🎯", label: "Le plus précis", name: best.name, value: best.accuracy + "% de réussite" });
        }
      }
      // 🔥 Meilleure série
      const streakPool = st.filter((r) => r.streak >= 3);
      if (streakPool.length) {
        const best = streakPool.slice().sort((a, b) => b.streak - a.streak)[0];
        extras.push({ emoji: "🔥", label: "Meilleure série", name: best.name, value: best.streak + " d'affilée" });
      }
      // ⚡ La machine (le plus de questions tentées)
      if (attempted.length > 1) {
        const fastest = attempted.slice().sort((a, b) => b.seen - a.seen)[0];
        if (fastest && fastest.seen >= 5) {
          extras.push({ emoji: "⚡", label: "La machine", name: fastest.name, value: fastest.seen + " questions vues" });
        }
      }
      // 🙈 Le plus téméraire (le plus d'erreurs, si ≥2)
      const recklessPool = st.filter((r) => r.wrong >= 2);
      if (recklessPool.length) {
        const reckless = recklessPool.slice().sort((a, b) => b.wrong - a.wrong)[0];
        if (reckless.name !== top.name) {
          extras.push({ emoji: "🙈", label: "Le plus téméraire", name: reckless.name, value: reckless.wrong + " erreurs" });
        }
      }
      // 🧊 Le prudent (le plus de passes, si ≥3)
      const cautiousPool = st.filter((r) => r.skipped >= 3);
      if (cautiousPool.length) {
        const cautious = cautiousPool.slice().sort((a, b) => b.skipped - a.skipped)[0];
        extras.push({ emoji: "🧊", label: "Le plus prudent", name: cautious.name, value: cautious.skipped + " passées" });
      }

      const totals = {
        players: st.length,
        total_correct: st.reduce((s, r) => s + r.correct, 0),
        total_seen: st.reduce((s, r) => s + r.seen, 0),
        best_score: top.score,
      };

      return { mvp, extras: extras.slice(0, 4), totals, standings: st };
    },

    reset() { questions = []; stats = {}; eligible = []; },
  };
}

module.exports = { create };
