// "Je n'ai jamais..." — anonymous binary vote.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="nv-vote">' +
        '<div class="q" id="nvPrompt"></div>' +
        '<button class="a" id="nvHave"  style="margin:6px 0;width:100%">J\'ai deja</button>' +
        '<button class="d" id="nvNever" style="margin:6px 0;width:100%">Jamais</button>' +
        '<div class="center muted" id="nvStatus"></div>' +
      '</div>' +
      '<div class="screen" id="nv-reveal">' +
        '<h2 class="center">Resultats</h2>' +
        '<div class="center muted" id="nvPromptR" style="margin-bottom:14px"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div style="background:#1b1d35;padding:18px;border-radius:12px;text-align:center">' +
            '<div class="muted">J\'ai deja</div>' +
            '<div style="font-size:2.4rem;color:#e6394a;font-weight:700" id="nvHaveCnt">0</div>' +
          '</div>' +
          '<div style="background:#1b1d35;padding:18px;border-radius:12px;text-align:center">' +
            '<div class="muted">Jamais</div>' +
            '<div style="font-size:2.4rem;color:#26890c;font-weight:700" id="nvNeverCnt">0</div>' +
          '</div>' +
        '</div>' +
        '<button class="primary" id="nvNextBtn" style="display:none;margin-top:14px">Question suivante</button>' +
      '</div>';

    h.$("nvHave").onclick = function () {
      var me = h.findMe(); if (me && me.answered) return;
      h.$("nvHave").disabled = true; h.$("nvNever").disabled = true;
      h.$("nvStatus").textContent = "Reponse envoyee...";
      h.send({ t: "answer", value: 0 });
    };
    h.$("nvNever").onclick = function () {
      var me = h.findMe(); if (me && me.answered) return;
      h.$("nvHave").disabled = true; h.$("nvNever").disabled = true;
      h.$("nvStatus").textContent = "Reponse envoyee...";
      h.send({ t: "answer", value: 1 });
    };
    h.$("nvNextBtn").onclick = function () { h.send({ t: "next" }); };
  }

  function showScreen(h, id) {
    ["nv-vote", "nv-reveal"].forEach(function (s) {
      h.$(s).classList.toggle("on", s === id);
    });
  }

  function render(state, h) {
    var r  = state.round || {};
    var me = h.findMe();
    if (state.phase === "playing") {
      showScreen(h, "nv-vote");
      h.$("nvPrompt").textContent = "(" + ((r.idx || 0) + 1) + "/" + (r.total || "?") + ") " + (r.prompt || "");
      var locked = !!(me && me.answered);
      h.$("nvHave").disabled  = locked;
      h.$("nvNever").disabled = locked;
      var nConnN = state.players.filter(function (p) { return p.connected; }).length;
      h.$("nvStatus").textContent = locked
        ? "Reponse envoyee, attends les autres..."
        : (r.answered !== undefined ? (r.answered + " / " + nConnN + " repondu(s)") : "");
    } else if (state.phase === "reveal") {
      showScreen(h, "nv-reveal");
      h.$("nvPromptR").textContent = r.prompt || "";
      h.$("nvHaveCnt").textContent  = r.have  || 0;
      h.$("nvNeverCnt").textContent = r.never || 0;
      h.$("nvNextBtn").style.display = h.amHost() ? "block" : "none";
    }
    // phase==="finished" is handled by the shared fin-de-partie screen in the SPA shell.
  }

  window.GamesHub.register("never", {
    name:   "Je n'ai jamais",
    emoji:  "🙊",
    desc:   "Anonyme : j'ai deja ou jamais ? On voit le score.",
    minPlayers: 2,
    rules:  "Une phrase \"Je n'ai jamais...\" s'affiche.<br>" +
            "Chacun choisit <b>J'ai deja</b> ou <b>Jamais</b>.<br>" +
            "Le reveal montre uniquement les <b>compteurs</b> par question (qui a repondu quoi reste secret).<br>" +
            "Le but : ambiance, decouvertes, et tu bois quand t'as deja fait 😉.<br>" +
            "<b>Stat de la partie :</b> a la fin, le titre <b>« Le plus experimente »</b> va au joueur qui a cumule le plus de <b>« J'ai deja »</b> sur toute la session (l'agregat est public, pas le detail par question).",
    mount:  build,
    render: render
  });
})();
