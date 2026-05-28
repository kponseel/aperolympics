// Quiz renderer — owns the DOM inside #game-area while quiz is selected.
// Ported as-is from esp32-hub/data/js/games/quiz.js (same helpers contract);
// the only change is registering on window.Apero. Use this file as the template
// to port the other 15 renderers.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="q-question">' +
        '<div class="quiz-top">' +
          '<div class="timerbar"><i id="qTimerFill"></i></div>' +
          '<div class="points" id="qPoints"></div>' +
        '</div>' +
        '<div class="q" id="qText"></div>' +
        '<div class="grid">' +
          '<button class="a" id="b0"></button>' +
          '<button class="b" id="b1"></button>' +
          '<button class="c" id="b2"></button>' +
          '<button class="d" id="b3"></button>' +
        '</div>' +
        '<div class="center muted" id="qStatus"></div>' +
        '<button id="qPauseBtn" style="display:none">&#9208; Pause</button>' +
      '</div>' +
      '<div class="screen" id="q-paused">' +
        '<div class="big">&#9208;&#65039;</div>' +
        '<div class="q center">En pause</div>' +
        '<div class="center muted">L\'h&ocirc;te a mis la partie en pause.</div>' +
        '<button class="primary" id="qResumeBtn" style="display:none">&#9654; Reprendre</button>' +
      '</div>' +
      '<div class="screen" id="q-reveal">' +
        '<div class="big" id="revealMark"></div>' +
        '<div class="center" id="revealMsg"></div>' +
        '<div class="center muted">Score : <span id="myScore">0</span></div>' +
        '<button class="primary" id="quizNextBtn" style="display:none">Question suivante</button>' +
      '</div>' +
      '<div class="screen" id="q-end">' +
        '<h2>🏅 Podium</h2>' +
        '<ol id="board"></ol>' +
        '<button class="primary" id="quizResetBtn" style="display:none">Recommencer</button>' +
      '</div>';

    for (var i = 0; i < 4; i++) {
      (function (idx) {
        h.$("b" + idx).onclick = function () {
          var me = h.findMe();
          if (me && me.answered) return;
          for (var j = 0; j < 4; j++) h.$("b" + j).disabled = true;
          h.$("qStatus").textContent = "Réponse envoyée, attends les autres…";
          h.send({ t: "answer", choice: idx });
        };
      })(i);
    }
    h.$("quizNextBtn").onclick = function () { h.send({ t: "next" }); };
    h.$("quizResetBtn").onclick = function () { h.send({ t: "reset" }); };
    h.$("qPauseBtn").onclick = function () { h.send({ t: "pause" }); };
    h.$("qResumeBtn").onclick = function () { h.send({ t: "resume" }); };
  }

  function showScreen(h, id) {
    ["q-question", "q-paused", "q-reveal", "q-end"].forEach(function (s) { h.$(s).classList.toggle("on", s === id); });
  }

  function render(state, h) {
    var r = state.round || {};
    var me = h.findMe();

    if (state.phase === "playing") {
      if (r.paused) {
        showScreen(h, "q-paused");
        h.$("qResumeBtn").style.display = h.amHost() ? "block" : "none";
        return;
      }
      showScreen(h, "q-question");
      h.$("qText").textContent = "(" + ((r.idx || 0) + 1) + "/" + (r.total || "?") + ") " + (r.q || "");
      var locked = !!(me && me.answered);
      for (var i = 0; i < 4; i++) {
        var b = h.$("b" + i);
        b.textContent = (r.options && r.options[i]) || "";
        b.disabled = locked;
      }
      // Live countdown: points fade with time + a draining timer bar.
      var total = r.time_total_ms || 10000;
      var left = (r.time_left_ms != null) ? r.time_left_ms : total;
      var frac = Math.max(0, Math.min(1, left / total));
      var fill = h.$("qTimerFill");
      fill.style.width = (frac * 100) + "%";
      fill.style.background = frac > 0.5 ? "#26890c" : (frac > 0.25 ? "#d89e00" : "#e6394a");
      h.$("qPoints").textContent = (r.points_now != null) ? (r.points_now + " pts") : "";
      h.$("qPauseBtn").style.display = h.amHost() ? "block" : "none";
      h.$("qStatus").textContent = locked
        ? "Réponse envoyée, attends les autres…"
        : (r.answered !== undefined ? (r.answered + " / " + state.players.length + " répondu(s)") : "");
    } else if (state.phase === "reveal") {
      showScreen(h, "q-reveal");
      var correct = r.correct;
      // `answer` is no longer in the public state; the server whispers `my_correct`.
      var ok = !!(state._private && state._private.my_correct);
      h.$("myScore").textContent = me ? me.score : 0;
      h.$("revealMark").innerHTML = ok ? "&#9989;" : (me && me.answered ? "&#10060;" : "&#10067;");
      // Show this question's payoff for the player ("+850 pts") if they got it.
      var myGain = (r.gains || []).find(function (g) { return me && g.name === me.name; });
      h.$("revealMsg").textContent = "Bonne réponse : " + ["A", "B", "C", "D"][correct] + (myGain ? "   — +" + myGain.gain + " pts" : "");
      h.$("quizNextBtn").style.display = h.amHost() ? "block" : "none";
    } else if (state.phase === "finished") {
      showScreen(h, "q-end");
      var ol = h.$("board"); ol.innerHTML = "";
      var sorted = state.players.slice().sort(function (a, b) { return b.score - a.score; });
      var medals = ["🥇", "🥈", "🥉"];
      sorted.forEach(function (p, i) {
        var li = document.createElement("li");
        li.innerHTML = "<span>" + (medals[i] || (i + 1) + ".") + " " +
          (p.host ? "<span class=crown>&#x1F451;</span> " : "") +
          h.escapeHtml(p.name) + "</span><b>" + p.score + "</b>";
        ol.appendChild(li);
      });
      h.$("quizResetBtn").style.display = h.amHost() ? "block" : "none";
    }
  }

  window.Apero.register("quiz", {
    name: "Quiz",
    emoji: "🧠",
    desc: "Questions à choix multiples, score au chrono.",
    minPlayers: 1,
    rules: "Une question + 4 options <b>A/B/C/D</b>. Réponds <b>le plus vite possible</b> : tu as " +
           "<b>10 secondes</b> et les points <b>fondent avec le temps</b> (de <b>1000</b> à <b>500</b>).<br>" +
           "L'hôte 👑 peut <b>mettre en pause</b> (tout est masqué pour tout le monde) et avance entre les questions.",
    scored: true,
    endable: true,
    mount: build,
    render: render,
  });
})();
