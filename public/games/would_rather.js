// "Tu preferes A ou B ?" — binary vote with live tally.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="wr-vote">' +
        '<div class="q center" style="margin-bottom:6px">Tu preferes...</div>' +
        '<div class="muted center" id="wrIdx" style="margin-bottom:14px"></div>' +
        '<button class="b" id="wrA" style="width:100%;margin:6px 0;min-height:90px;font-size:1.1rem"></button>' +
        '<div class="center muted" style="margin:6px 0">— ou —</div>' +
        '<button class="c" id="wrB" style="width:100%;margin:6px 0;min-height:90px;font-size:1.1rem"></button>' +
        '<div class="center muted" id="wrStatus" style="margin-top:8px"></div>' +
      '</div>' +
      '<div class="screen" id="wr-reveal">' +
        '<h2 class="center">Resultats</h2>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px">' +
          '<div style="background:#1368ce;padding:18px;border-radius:12px;text-align:center">' +
            '<div id="wrAR" style="font-size:0.9rem;color:#fff;margin-bottom:8px"></div>' +
            '<div style="font-size:2.4rem;font-weight:700" id="wrCntA">0</div>' +
          '</div>' +
          '<div style="background:#d89e00;padding:18px;border-radius:12px;text-align:center">' +
            '<div id="wrBR" style="font-size:0.9rem;color:#fff;margin-bottom:8px"></div>' +
            '<div style="font-size:2.4rem;font-weight:700" id="wrCntB">0</div>' +
          '</div>' +
        '</div>' +
        '<button class="primary" id="wrNextBtn" style="display:none;margin-top:14px">Question suivante</button>' +
      '</div>';

    h.$("wrA").onclick = function () {
      var me = h.findMe(); if (me && me.answered) return;
      h.$("wrA").disabled = true; h.$("wrB").disabled = true;
      h.$("wrStatus").textContent = "Vote envoye, attends les autres...";
      h.send({ t: "answer", value: 0 });
    };
    h.$("wrB").onclick = function () {
      var me = h.findMe(); if (me && me.answered) return;
      h.$("wrA").disabled = true; h.$("wrB").disabled = true;
      h.$("wrStatus").textContent = "Vote envoye, attends les autres...";
      h.send({ t: "answer", value: 1 });
    };
    h.$("wrNextBtn").onclick = function () { h.send({ t: "next" }); };
  }

  function showScreen(h, id) {
    ["wr-vote", "wr-reveal"].forEach(function (s) {
      h.$(s).classList.toggle("on", s === id);
    });
  }

  function render(state, h) {
    var r  = state.round || {};
    var me = h.findMe();
    if (state.phase === "playing") {
      showScreen(h, "wr-vote");
      h.$("wrIdx").textContent = "(" + ((r.idx || 0) + 1) + "/" + (r.total || "?") + ")";
      h.$("wrA").textContent   = r.a || "A";
      h.$("wrB").textContent   = r.b || "B";
      var locked = !!(me && me.answered);
      h.$("wrA").disabled = locked;
      h.$("wrB").disabled = locked;
      var nConnW = state.players.filter(function (p) { return p.connected; }).length;
      h.$("wrStatus").textContent = locked
        ? "Vote envoye, attends les autres..."
        : (r.answered !== undefined ? (r.answered + " / " + nConnW + " vote(s)") : "");
    } else if (state.phase === "reveal") {
      showScreen(h, "wr-reveal");
      h.$("wrAR").textContent = r.a || "A";
      h.$("wrBR").textContent = r.b || "B";
      h.$("wrCntA").textContent = r.count_a || 0;
      h.$("wrCntB").textContent = r.count_b || 0;
      h.$("wrNextBtn").style.display = h.amHost() ? "block" : "none";
    }
    // phase==="finished" is handled by the shared fin-de-partie screen in the SPA shell.
  }

  window.GamesHub.register("would_rather", {
    name:   "Tu preferes",
    emoji:  "⚖️",
    desc:   "10 dilemmes tirés au hasard parmi 135+ — vote en direct.",
    minPlayers: 2,
    rules:  "Un dilemme entre <b>A</b> ou <b>B</b> (\"Pizza pour la vie\" vs \"Plus jamais de fromage\"...).<br>" +
            "Vote pour ton option preferee, en meme temps que tout le monde.<br>" +
            "Le reveal affiche les <b>compteurs par cote</b> dans des cards colorees.<br>" +
            "<b>Format :</b> 10 dilemmes par partie, tirés au hasard dans une banque de 135+ — pas de déjà-vu d'une soirée à l'autre.<br>" +
            "<b>Stats de fin de partie :</b><br>" +
            "• <b>⚖️ Le plus aligné avec la majorité</b> — qui a le plus souvent voté du côté gagnant.<br>" +
            "• <b>🔥 L'éternel rebelle</b> — qui a le plus souvent voté à contre-courant.<br>" +
            "• <b>💞 Les âmes sœurs</b> — la paire qui a le plus souvent voté pareil.",
    mount:  build,
    render: render
  });
})();
