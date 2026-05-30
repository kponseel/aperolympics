// Quiz Contre-la-montre — race to 5 correct answers. Each player gets their
// own random pool of questions (delivered via `state._private`); a stopwatch
// counts up while they answer; the run ends the instant they reach the 5th
// correct answer, and the time is posted to the server. Live "Quiz de la
// salle" ranking sits below the answer grid, same pattern as Réflexe.

(function () {
  var S, tick = null, best = 0;
  var TARGET = 5;

  function loadBest() { try { return parseInt(localStorage.getItem("apero.hs.quiz_solo") || "0", 10) || 0; } catch (e) { return 0; } }
  function saveBest(ms) { try { localStorage.setItem("apero.hs.quiz_solo", String(ms)); } catch (e) {} }
  function clearTimers() { if (tick) { clearInterval(tick); tick = null; } }

  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="qs-main">' +
        '<div class="quiz-top">' +
          '<div class="points" id="qsSecs" style="min-width:66px;text-align:left">0.0 s</div>' +
          '<div class="muted center" id="qsTarget" style="flex:1">0 / 5 bonnes</div>' +
          '<div class="points" id="qsScore">0</div>' +
        '</div>' +
        '<div class="q" id="qsText">Prépare-toi — premier arrivé à 5 bonnes réponses gagne.</div>' +
        '<div class="grid">' +
          '<button class="a" id="qb0"></button><button class="b" id="qb1"></button>' +
          '<button class="c" id="qb2"></button><button class="d" id="qb3"></button>' +
        '</div>' +
        '<div class="center" id="qsMsg"></div>' +
        '<button class="primary" id="qsBtn" style="margin-top:12px">Démarrer</button>' +
        '<div id="qsRoom" class="rx-room"></div>' +
      '</div>';
    best = loadBest();
    S = { started: false, over: false, questions: [], idx: 0, score: 0, correct: 0, target: TARGET, startedAt: 0, endedAt: 0 };
    for (var i = 0; i < 4; i++) (function (idx) {
      h.$("qb" + idx).onclick = function () { answer(h, idx); };
    })(i);
    h.$("qsBtn").onclick = function () { startRun(h); };
    drawIdle(h);
  }

  function readPool(state) {
    var priv = (state && state._private) || {};
    return (priv.questions && priv.questions.length) ? priv.questions.slice() : [];
  }

  function startRun(h) {
    clearTimers();
    var pool = readPool(window.__lastState);
    if (!pool.length) { h.$("qsMsg").textContent = "Chargement des questions…"; return; }
    var now = Date.now();
    S = { started: true, over: false, questions: pool, idx: 0, score: 0, correct: 0, target: TARGET, startedAt: now, endedAt: 0 };
    drawQuestion(h);
    tick = setInterval(function () { drawClock(h); }, 100);
    drawClock(h);
  }

  function answer(h, choice) {
    if (!S.started || S.over) return;
    var q = S.questions[S.idx];
    if (!q) return;
    var ok = choice === q.correct;
    if (ok) { S.correct++; S.score++; }
    else { S.score = Math.max(0, S.score - 1); }
    S.idx++;
    if (S.idx >= S.questions.length) S.idx = 0; // wrap if pool runs out (unlikely with 30)
    flash(h, ok);
    if (S.correct >= S.target) { finish(h, true); return; }
    drawQuestion(h);
  }

  function flash(h, ok) {
    var msg = h.$("qsMsg");
    if (!msg) return;
    msg.textContent = ok ? "✅ +1" : "❌ −1";
    msg.style.color = ok ? "#b8e8a8" : "#ff7a7a";
  }

  function drawQuestion(h) {
    var q = S.questions[S.idx];
    h.$("qsScore").textContent = S.score;
    h.$("qsTarget").textContent = S.correct + " / " + S.target + " bonnes";
    if (!q) return;
    h.$("qsText").textContent = q.q || "";
    for (var i = 0; i < 4; i++) { h.$("qb" + i).textContent = (q.choices && q.choices[i]) || ""; h.$("qb" + i).disabled = false; }
    h.$("qsBtn").style.display = "none";
  }

  function drawClock(h) {
    var secs = h.$("qsSecs"); if (!secs) return;
    var elapsed = (Date.now() - S.startedAt) / 1000;
    secs.textContent = elapsed.toFixed(1) + " s";
    secs.style.color = "#fff";
  }

  function drawIdle(h) {
    h.$("qsScore").textContent = "0";
    h.$("qsTarget").textContent = "0 / " + TARGET + " bonnes";
    h.$("qsSecs").textContent = "0.0 s";
    for (var i = 0; i < 4; i++) { h.$("qb" + i).textContent = ""; h.$("qb" + i).disabled = true; }
    h.$("qsBtn").style.display = "block";
    h.$("qsBtn").textContent = "Démarrer";
  }

  function finish(h, completed) {
    clearTimers();
    S.over = true;
    S.endedAt = Date.now();
    var ms = S.endedAt - S.startedAt;
    try { if (navigator.vibrate) navigator.vibrate(completed ? [80, 40, 80, 40, 160] : [70]); } catch (e) {}
    if (completed) {
      if (!best || ms < best) { best = ms; saveBest(ms); }
      // Submit the run time so the room ranking + MVP can be computed server-side.
      h.send({ t: "run_done", ms: ms, correct: S.correct });
    }
    for (var i = 0; i < 4; i++) h.$("qb" + i).disabled = true;
    h.$("qsText").textContent = "🏁 Bravo — 5 bonnes en " + (ms / 1000).toFixed(2) + " s !";
    var msg = h.$("qsMsg");
    msg.style.color = "#fff";
    var bestSec = best ? (best / 1000).toFixed(2) + " s" : "—";
    msg.innerHTML = "Mauvaises : <b>" + (S.idx - S.correct) + "</b><br>" +
      "<span class='muted'>🏆 Record perso : " + bestSec + "</span>";
    var btn = h.$("qsBtn"); btn.style.display = "block"; btn.textContent = "Rejouer";
  }

  // Render the live room ranking below the answer grid (same pattern as Réflexe).
  function drawRoom(h, top) {
    var el = h.$("qsRoom"); if (!el) return;
    top = (top || []).slice(0, 6);
    if (!top.length) { el.innerHTML = ""; return; }
    var medals = ["🥇", "🥈", "🥉"];
    var head = S.over
      ? '<h3 class="rx-room-h done">🏁 Classement de la salle</h3>'
      : '<h3 class="rx-room-h">🏆 Quiz de la salle</h3>';
    var me = h.findMe();
    var myName = me ? me.name : "";
    var rows = top.map(function (p, i) {
      var rank = medals[i] || (i + 1);
      var mine = p.name === myName ? " mine" : "";
      return '<li class="rx-row' + mine + '"><span class="rx-rank">' + rank + '</span>' +
        '<span class="rx-who">' + h.escapeHtml(p.name) + '</span>' +
        '<b class="rx-ms">' + (p.best_ms / 1000).toFixed(2) + ' <span class="muted">s</span></b></li>';
    }).join("");
    el.innerHTML = head + '<ol class="rx-room-list">' + rows + '</ol>';
  }

  function render(state, h) {
    window.__lastState = state; // so the Démarrer click can pull the latest pool
    drawRoom(h, (state.round || {}).top);
    // First time the pool lands, enable the Démarrer button text
    if (!S.started && !S.over) {
      var pool = readPool(state);
      var btn = h.$("qsBtn");
      if (pool.length && btn) {
        btn.textContent = "Démarrer";
        btn.disabled = false;
      } else if (btn) {
        btn.textContent = "Chargement…";
        btn.disabled = true;
      }
    }
  }
  function unmount() { clearTimers(); }

  window.GamesHub.register("quiz_solo", {
    name: "Quiz Contre-la-montre", emoji: "🔢",
    desc: "Premier arrivé à 5 bonnes réponses gagne — questions tirées au hasard parmi 150.",
    minPlayers: 1, endable: true, scored: true,
    // Best time-to-5 is stored as score = max(0, 60000 - bestMs); render back as seconds.
    formatScore: function (score) {
      if (!score) return "—";
      var ms = 60000 - score;
      return (ms / 1000).toFixed(2) + " s";
    },
    rules: "<b>Course à 5 bonnes réponses.</b> Tu reçois ton propre paquet de questions ; un chrono part dès <b>Démarrer</b>.<br>" +
           "Le premier à atteindre <b>5 bonnes réponses</b> gagne.<br>" +
           "Une <b>mauvaise</b> réponse coûte 1 point au score, mais l'objectif reste 5 bonnes.<br>" +
           "Le <b>classement de la salle</b> se met à jour en direct ; ton meilleur temps est gardé en mémoire (record perso).",
    mount: build, render: render, unmount: unmount,
  });
})();
