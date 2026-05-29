// Duel de rapidité (buzzer) — first to tap the correct answer wins the point.
// Wrong tap locks you for the round. Scored podium at the end.

(function () {
  var curLocked = []; // names locked this round, refreshed each render (read by taps)

  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="bz-play">' +
        '<div class="quiz-top"><div class="timerbar"><i id="bzFill"></i></div><div class="points" id="bzCount"></div></div>' +
        '<div class="q" id="bzQ"></div>' +
        '<div class="grid">' +
          '<button class="a" id="bz0"></button><button class="b" id="bz1"></button>' +
          '<button class="c" id="bz2"></button><button class="d" id="bz3"></button>' +
        '</div>' +
        '<div class="center muted" id="bzStatus"></div>' +
      '</div>' +
      '<div class="screen" id="bz-reveal">' +
        '<div class="rx-big center" id="bzVerdict" style="margin:8px 0"></div>' +
        '<div class="center muted" id="bzAns" style="margin-bottom:12px"></div>' +
        '<ol id="bzScores"></ol>' +
        '<button class="primary" id="bzNext" style="display:none;margin-top:8px">Manche suivante</button>' +
      '</div>';
    for (var i = 0; i < 4; i++) (function (idx) {
      h.$("bz" + idx).onclick = function () {
        var me = h.findMe();
        // Read the live locked list (refreshed each render), not a stale cache.
        var locked = me && curLocked.indexOf(me.name) >= 0;
        if (locked) return;
        for (var j = 0; j < 4; j++) h.$("bz" + j).disabled = true;
        h.$("bzStatus").textContent = "Réponse envoyée…";
        h.send({ t: "answer", choice: idx });
      };
    })(i);
    h.$("bzNext").onclick = function () { h.send({ t: "next" }); };
  }

  function showScreen(h, id) { ["bz-play", "bz-reveal"].forEach(function (s) { h.$(s).classList.toggle("on", s === id); }); }

  function scoreRows(h, scores) {
    var arr = Object.keys(scores || {}).map(function (n) { return { name: n, s: scores[n] }; });
    arr.sort(function (a, b) { return b.s - a.s || (a.name < b.name ? -1 : 1); });
    var medals = ["🥇", "🥈", "🥉"];
    return arr.map(function (e, i) {
      return '<li><span class="rank">' + (medals[i] || (i + 1)) + '</span><span class="who">' + h.escapeHtml(e.name) + '</span><b class="pts">' + e.s + '</b></li>';
    }).join("");
  }

  function render(state, h) {
    var r = state.round || {};
    var me = h.findMe();
    if (state.phase === "playing") {
      showScreen(h, "bz-play");
      curLocked = r.locked || [];
      h.$("bzQ").textContent = "(" + ((r.idx || 0) + 1) + "/" + (r.total || "?") + ") " + (r.q || "");
      var iLocked = !!(me && (r.locked || []).indexOf(me.name) >= 0);
      for (var i = 0; i < 4; i++) { var btn = h.$("bz" + i); btn.textContent = (r.choices && r.choices[i]) || ""; btn.disabled = iLocked; }
      var total = r.time_total_ms || 12000, left = (r.time_left_ms != null) ? r.time_left_ms : total;
      var frac = Math.max(0, Math.min(1, left / total));
      var fill = h.$("bzFill"); fill.style.width = (frac * 100) + "%";
      fill.style.background = frac > 0.5 ? "#26890c" : (frac > 0.25 ? "#d89e00" : "#e6394a");
      h.$("bzCount").textContent = (me ? (r.scores && r.scores[me.name]) || 0 : 0) + " pt";
      h.$("bzStatus").textContent = iLocked ? "❌ Raté — bloqué pour cette manche." : "Premier bon = +1 point !";
    } else if (state.phase === "reveal") {
      showScreen(h, "bz-reveal");
      var letters = ["A", "B", "C", "D"];
      if (r.winner) {
        var mine = me && r.winner === me.name;
        h.$("bzVerdict").textContent = mine ? "⚡ Gagné !" : ("⚡ " + r.winner + " a buzzé !");
      } else {
        h.$("bzVerdict").textContent = "⏱️ Personne ! Tout le monde boit 🍺";
      }
      h.$("bzAns").textContent = (r.correct != null && r.correct >= 0) ? ("Bonne réponse : " + letters[r.correct] + " — " + ((r.choices && r.choices[r.correct]) || "")) : "";
      h.$("bzScores").innerHTML = scoreRows(h, r.scores);
      h.$("bzNext").style.display = h.amHost() ? "block" : "none";
    }
    // phase==="finished" → shared fin-de-partie screen (scored podium).
  }

  window.GamesHub.register("buzzer", {
    name: "Duel de rapidité", emoji: "🔔",
    desc: "Le premier à taper la bonne réponse rafle le point !",
    minPlayers: 2, scored: true, endable: true,
    rules: "Une question + 4 choix pour tout le monde en même temps.<br>" +
           "<b>Premier à taper la bonne réponse = +1 point</b> et la manche s'arrête.<br>" +
           "Une <b>mauvaise</b> réponse te <b>bloque</b> pour la manche (et tu bois 🍺).<br>" +
           "Personne ne trouve à temps = tout le monde boit. Podium final au score.",
    mount: build, render: render,
  });
})();
