// "Superlatifs" — same UI as most_likely; the server picks from a different
// prompt bank framed as "Le/la plus X du groupe".

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="sl-vote">' +
        '<div class="q" id="slPrompt"></div>' +
        '<div id="slTargets"></div>' +
        '<div class="center muted" id="slStatus"></div>' +
      '</div>' +
      '<div class="screen" id="sl-reveal">' +
        '<h2 class="center">🏆 Resultats</h2>' +
        '<div class="center muted" id="slPromptR" style="margin-bottom:14px"></div>' +
        '<ol id="slVotes"></ol>' +
        '<button class="primary" id="slNextBtn" style="display:none">Categorie suivante</button>' +
      '</div>';

    h.$("slNextBtn").onclick = function () { h.send({ t: "next" }); };
  }

  function showScreen(h, id) {
    ["sl-vote", "sl-reveal"].forEach(function (s) {
      h.$(s).classList.toggle("on", s === id);
    });
  }

  function render(state, h) {
    var r  = state.round || {};
    var me = h.findMe();
    if (state.phase === "playing") {
      showScreen(h, "sl-vote");
      h.$("slPrompt").textContent = "(" + ((r.idx || 0) + 1) + "/" + (r.total || "?") + ") " + (r.prompt || "");
      var locked  = !!(me && me.answered);
      var targets = h.$("slTargets");
      targets.innerHTML = "";
      // Exclude self — voting yourself "le/la plus X du groupe" is awkward.
      state.players.filter(function (p) { return p.connected && (!me || p.name !== me.name); }).forEach(function (p) {
        var btn = document.createElement("button");
        btn.className = "ghost";
        btn.style.margin = "4px 0";
        btn.style.width  = "100%";
        btn.disabled = locked;
        btn.innerHTML = (p.host ? '<span class="crown">&#x1F451;</span> ' : '') + h.escapeHtml(p.name);
        btn.onclick = function () {
          if (locked) return;
          targets.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
          h.$("slStatus").textContent = "Vote envoye, attends les autres...";
          h.send({ t: "vote", target_id: p.id });
        };
        targets.appendChild(btn);
      });
      var nConn = state.players.filter(function (p) { return p.connected; }).length;
      h.$("slStatus").textContent = locked
        ? "Vote envoye, attends les autres..."
        : (r.answered !== undefined ? (r.answered + " / " + nConn + " vote(s)") : "");
    } else if (state.phase === "reveal") {
      showScreen(h, "sl-reveal");
      h.$("slPromptR").textContent = r.prompt || "";
      var ol = h.$("slVotes"); ol.innerHTML = "";
      var votes = (r.votes || []).slice().sort(function (a, b) { return b.count - a.count; });
      if (!votes.length) {
        var li0 = document.createElement("li");
        li0.innerHTML = '<span style="color:#9aa">Personne n\'a vote</span><b>&nbsp;</b>';
        ol.appendChild(li0);
      } else {
        votes.forEach(function (v, i) {
          var medal = (i === 0) ? "🥇 " : (i === 1 ? "🥈 " : (i === 2 ? "🥉 " : ""));
          var li = document.createElement("li");
          li.innerHTML = "<span>" + medal + h.escapeHtml(v.name) + "</span><b>" + v.count + "</b>";
          ol.appendChild(li);
        });
      }
      h.$("slNextBtn").style.display = h.amHost() ? "block" : "none";
    }
    // phase==="finished" is handled by the shared fin-de-partie screen in the SPA shell.
  }

  window.GamesHub.register("superlatives", {
    name:   "Superlatifs",
    emoji:  "🏆",
    desc:   "10 catégories parmi 110 — vote secret, qui est le/la plus X ?",
    minPlayers: 3,
    rules:  "Variante de \"Le plus susceptible\" mais avec des <b>categories</b> : drole, style, organise, voyageur...<br>" +
            "Vote secret pour le/la plus <b>X du groupe</b>.<br>" +
            "Reveal sous forme de <b>podium</b> 🥇🥈🥉 avec les compteurs.<br>" +
            "<b>Format :</b> 10 catégories par partie, tirées au hasard dans une banque de 110.<br>" +
            "<b>Stats de fin de partie :</b><br>" +
            "• <b>🏆 Champion(ne) des superlatifs</b> — qui cumule le plus de votes.<br>" +
            "• <b>🥈 L'outsider</b> — la médaille d'argent.<br>" +
            "• <b>💞 Les âmes sœurs du vote</b> — la paire qui a le plus souvent voté pour la même personne.",
    mount:  build,
    render: render
  });
})();
