// Quiz Contre-la-montre — solo 60 s survival. Questions arrive from the server
// (round.questions, reusing the Speed Quiz bank) but the timer + scoring run
// client-side for instant feedback. Best score in localStorage.

(function () {
  var S, tick = null, best = 0;
  var DURATION = 60;

  function loadBest() { try { return parseInt(localStorage.getItem("apero.hs.quiz_solo") || "0", 10) || 0; } catch (e) { return 0; } }
  function saveBest(n) { try { localStorage.setItem("apero.hs.quiz_solo", String(n)); } catch (e) {} }
  function clearTimers() { if (tick) { clearInterval(tick); tick = null; } }

  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="qs-main">' +
        '<div class="quiz-top">' +
          '<div class="points" id="qsSecs" style="min-width:54px;text-align:left">60s</div>' +
          '<div class="timerbar"><i id="qsFill" style="width:100%"></i></div>' +
          '<div class="points" id="qsScore">0</div>' +
        '</div>' +
        '<div class="q" id="qsText"></div>' +
        '<div class="grid">' +
          '<button class="a" id="qb0"></button><button class="b" id="qb1"></button>' +
          '<button class="c" id="qb2"></button><button class="d" id="qb3"></button>' +
        '</div>' +
        '<div class="center" id="qsMsg"></div>' +
        '<button class="primary" id="qsBtn" style="display:none;margin-top:12px"></button>' +
      '</div>';
    best = loadBest();
    S = { started: false, over: false, questions: [], idx: 0, score: 0, endAt: 0 };
    for (var i = 0; i < 4; i++) (function (idx) {
      h.$("qb" + idx).onclick = function () { answer(h, idx); };
    })(i);
    h.$("qsBtn").onclick = function () { restart(h); };
  }

  function begin(h, questions) {
    clearTimers();
    S = { started: true, over: false, questions: questions.slice(), idx: 0, score: 0, endAt: Date.now() + DURATION * 1000 };
    drawQuestion(h);
    tick = setInterval(function () { drawTimer(h); }, 200);
    drawTimer(h);
  }

  function restart(h) {
    // Re-shuffle locally for replay (server's set is reused, order randomised).
    var q = S.questions.slice();
    for (var i = q.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = q[i]; q[i] = q[j]; q[j] = t; }
    begin(h, q);
  }

  function answer(h, choice) {
    if (!S.started || S.over) return;
    var q = S.questions[S.idx];
    if (!q) return;
    var ok = choice === q.correct;
    S.score += ok ? 1 : -1;
    if (S.score < 0) S.score = 0;
    S.idx++;
    if (S.idx >= S.questions.length) S.idx = 0; // loop the pool if they're fast
    flash(h, ok);
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
    if (!q) return;
    h.$("qsText").textContent = q.q || "";
    for (var i = 0; i < 4; i++) { h.$("qb" + i).textContent = (q.choices && q.choices[i]) || ""; h.$("qb" + i).disabled = false; }
  }

  function drawTimer(h) {
    var fill = h.$("qsFill"); if (!fill) return;
    var left = Math.max(0, S.endAt - Date.now());
    fill.style.width = (left / (DURATION * 1000) * 100) + "%";
    fill.style.background = left > 20000 ? "#26890c" : (left > 8000 ? "#d89e00" : "#e6394a");
    var secs = h.$("qsSecs");
    if (secs) { secs.textContent = Math.ceil(left / 1000) + "s"; secs.style.color = left <= 10000 ? "#ff7a7a" : "#fff"; }
    if (left <= 0) finish(h);
  }

  function finish(h) {
    clearTimers();
    S.over = true;
    if (S.score > best) { best = S.score; saveBest(S.score); }
    for (var i = 0; i < 4; i++) h.$("qb" + i).disabled = true;
    h.$("qsText").textContent = "⏱️ Temps écoulé !";
    var msg = h.$("qsMsg");
    msg.style.color = "#fff";
    msg.innerHTML = "Score final : <b>" + S.score + "</b><br><span class='muted'>🏆 Record perso : " + best + "</span>";
    var btn = h.$("qsBtn"); btn.style.display = "block"; btn.textContent = "Rejouer";
  }

  function render(state, h) {
    var r = (state && state.round) || {};
    // Kick off once, when the server's question set arrives.
    if (!S.started && !S.over && r.questions && r.questions.length) {
      begin(h, r.questions);
    }
  }
  function unmount() { clearTimers(); }

  window.GamesHub.register("quiz_solo", {
    name: "Quiz Contre-la-montre", emoji: "🔢",
    desc: "Solo : un max de bonnes réponses en 60 secondes.",
    minPlayers: 1,
    rules: "<b>Solo, 60 secondes.</b> Les questions s'enchaînent : <b>bonne réponse +1</b>, <b>mauvaise −1</b>.<br>" +
           "Pas de chrono par question — vas-y au feeling, le plus vite possible.<br>" +
           "À zéro, score final + ton <b>record perso</b>. (Option apéro : sous un seuil, tu bois.)",
    mount: build, render: render, unmount: unmount,
  });
})();
