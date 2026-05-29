// Le Convergent (mind_meld) — type one word for the theme; identical words on
// reveal = télépathie. Loop game, host-endable.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="mm-input">' +
        '<div class="center muted" id="mmMeta"></div>' +
        '<h2 class="center" id="mmTheme" style="margin:8px 0 14px"></h2>' +
        '<input id="mmWord" placeholder="Ton mot…" maxlength="24" autocomplete="off" />' +
        '<button class="primary" id="mmSend" style="margin-top:10px">Envoyer</button>' +
        '<div class="center muted" id="mmStatus" style="margin-top:12px"></div>' +
      '</div>' +
      '<div class="screen" id="mm-reveal">' +
        '<div class="center muted" id="mmThemeR" style="margin-bottom:4px"></div>' +
        '<div class="rx-big center" id="mmVerdict" style="margin-bottom:12px"></div>' +
        '<div id="mmWords"></div>' +
        '<button class="primary" id="mmNext" style="display:none;margin-top:14px">Manche suivante</button>' +
      '</div>';
    h.$("mmSend").onclick = function () {
      var me = h.findMe(); if (me && me.answered) return;
      var w = (h.$("mmWord").value || "").trim();
      if (!w) { h.$("mmStatus").textContent = "Écris un mot d'abord."; return; }
      h.$("mmWord").disabled = true; h.$("mmSend").disabled = true;
      h.send({ t: "submit", word: w });
    };
    h.$("mmWord").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); h.$("mmSend").click(); } });
    h.$("mmNext").onclick = function () { h.send({ t: "next" }); };
  }

  function showScreen(h, id) { ["mm-input", "mm-reveal"].forEach(function (s) { h.$(s).classList.toggle("on", s === id); }); }

  function render(state, h) {
    var r = state.round || {};
    var me = h.findMe();
    if (state.phase === "playing") {
      showScreen(h, "mm-input");
      h.$("mmMeta").textContent = "Manche " + ((r.idx || 0) + 1);
      h.$("mmTheme").textContent = r.theme || "";
      var locked = !!(me && me.answered);
      h.$("mmWord").disabled = locked; h.$("mmSend").disabled = locked;
      var nConn = state.players.filter(function (p) { return p.connected; }).length;
      h.$("mmStatus").textContent = locked
        ? "Mot envoyé — on attend les autres… (" + (r.answered || 0) + "/" + nConn + ")"
        : (r.answered !== undefined ? (r.answered + " / " + nConn + " ont répondu") : "");
    } else if (state.phase === "reveal") {
      showScreen(h, "mm-reveal");
      h.$("mmThemeR").textContent = r.theme || "";
      var words = r.words || {};
      var matches = r.matches || [];
      var matched = {};
      matches.forEach(function (g) { g.forEach(function (n) { matched[n] = true; }); });
      var names = Object.keys(words);
      var anyMatch = matches.length > 0;
      var allMatch = names.length > 1 && names.every(function (n) { return matched[n]; });
      h.$("mmVerdict").innerHTML = !names.length ? "—"
        : allMatch ? "🍻 Télépathie totale !"
        : anyMatch ? "🤝 Connexion partielle !"
        : "🍺 Aucun match — vous buvez !";
      h.$("mmWords").innerHTML = names.map(function (n) {
        var hit = matched[n];
        return '<div class="mm-word' + (hit ? ' mm-hit' : '') + '">' +
          '<span class="mm-who">' + h.escapeHtml(n) + '</span>' +
          '<b>' + h.escapeHtml(words[n]) + (hit ? ' 🤝' : '') + '</b></div>';
      }).join("");
      h.$("mmNext").style.display = h.amHost() ? "block" : "none";
    }
    // phase==="finished" handled by the shared fin-de-partie screen.
  }

  window.GamesHub.register("mind_meld", {
    name: "Le Convergent", emoji: "🤝",
    desc: "Pensez au même mot ! Télépathie validée = vous trinquez.",
    minPlayers: 2, endable: true,
    rules: "Un <b>thème</b> s'affiche (ex. « un fruit »). Chacun tape <b>un seul mot</b> en secret.<br>" +
           "Au reveal, on compare : <b>mots identiques = télépathie</b> 🤝 (vous trinquez ensemble) ; " +
           "sinon, vous buvez chacun 🍺.<br>" +
           "Normalisation : minuscules, sans accents. <b>Stat de fin :</b> « Le plus connecté ».",
    mount: build, render: render,
  });
})();
