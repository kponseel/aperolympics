// Plus ou Moins (higher_lower) — the active player guesses if the next stat is
// higher or lower; correct chains the streak, wrong passes the hand. Turn-based.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="hl-main">' +
        '<div class="center muted" id="hlDeck"></div>' +
        '<div class="hl-cards">' +
          '<div class="hl-card" id="hlA"><div class="hl-label" id="hlALabel"></div><div class="hl-val" id="hlAVal"></div></div>' +
          '<div class="hl-vs">vs</div>' +
          '<div class="hl-card" id="hlB"><div class="hl-label" id="hlBLabel"></div><div class="hl-val" id="hlBVal">?</div></div>' +
        '</div>' +
        '<div class="center" id="hlMsg" style="min-height:1.4em;margin:10px 0"></div>' +
        '<div id="hlControls">' +
          '<button class="d" id="hlHigher" style="width:100%;margin:6px 0;font-size:1.2rem">⬆️ Plus haut</button>' +
          '<button class="b" id="hlLower" style="width:100%;margin:6px 0;font-size:1.2rem">⬇️ Plus bas</button>' +
        '</div>' +
        '<button class="primary" id="hlCont" style="display:none;margin-top:8px">Continuer ▶</button>' +
        '<div class="center muted" id="hlStreak" style="margin-top:12px"></div>' +
      '</div>';
    h.$("hlHigher").onclick = function () { h.send({ t: "guess", dir: "higher" }); lockGuess(h); };
    h.$("hlLower").onclick = function () { h.send({ t: "guess", dir: "lower" }); lockGuess(h); };
    h.$("hlCont").onclick = function () { h.send({ t: "cont" }); h.$("hlCont").disabled = true; };
  }
  function lockGuess(h) { h.$("hlHigher").disabled = true; h.$("hlLower").disabled = true; }

  function render(state, h) {
    var r = state.round || {};
    var me = h.findMe();
    var amActive = !!(me && r.active_id && me.id === r.active_id);
    var a = r.cardA || {}, bC = r.cardB || {};
    h.$("hlDeck").textContent = r.deck ? ("📊 " + r.deck) : "";
    h.$("hlALabel").textContent = a.label || "";
    h.$("hlAVal").textContent = (a.value != null ? a.value : "?") + (a.unit ? " " + a.unit : "");
    h.$("hlBLabel").textContent = bC.label || "";

    var streak = r.streak || {};
    var sList = Object.keys(streak).map(function (n) { return h.escapeHtml(n) + " : " + streak[n]; }).join(" · ");
    h.$("hlStreak").textContent = sList ? ("🔥 Séries — " + sList) : "";

    if (state.phase === "playing") {
      h.$("hlBVal").textContent = "?";
      h.$("hlControls").style.display = amActive ? "block" : "none";
      h.$("hlHigher").disabled = !amActive; h.$("hlLower").disabled = !amActive;
      h.$("hlCont").style.display = "none";
      h.$("hlMsg").innerHTML = amActive
        ? "👉 <b>" + h.escapeHtml(bC.label || "") + "</b> : plus haut ou plus bas que <b>" + h.escapeHtml(a.label || "") + "</b> ?"
        : "En attente de <b>" + h.escapeHtml(r.active_name || "?") + "</b>…";
    } else if (state.phase === "reveal") {
      h.$("hlBVal").textContent = (bC.value != null ? bC.value : "?") + (bC.unit ? " " + bC.unit : "");
      h.$("hlControls").style.display = "none";
      var ok = !!r.lastCorrect;
      h.$("hlMsg").innerHTML = ok
        ? '<span style="color:#b8e8a8">✅ Bien vu ' + h.escapeHtml(r.active_name || "") + ' !</span>'
        : '<span style="color:#ff7a7a">❌ Raté — ' + h.escapeHtml(r.active_name || "") + ' boit 🍺, la main passe.</span>';
      // The active player drives their own run; the host can also push it along.
      var showCont = amActive || h.amHost();
      h.$("hlCont").style.display = showCont ? "block" : "none";
      h.$("hlCont").disabled = false;
      h.$("hlCont").textContent = ok ? "Continuer ▶" : "Joueur suivant ▶";
      if (h.amHost() && !amActive) h.$("hlCont").onclick = function () { h.send({ t: "next" }); h.$("hlCont").disabled = true; };
      else h.$("hlCont").onclick = function () { h.send({ t: "cont" }); h.$("hlCont").disabled = true; };
    }
    // phase==="finished" → shared fin-de-partie screen (MVP « Plus longue série »).
  }

  window.GamesHub.register("higher_lower", {
    name: "Plus ou Moins", emoji: "📈",
    desc: "Plus haut ou plus bas ? Devine la stat et enchaîne les bonnes séries.",
    minPlayers: 2, endable: true,
    rules: "Une stat s'affiche avec sa valeur. Le joueur actif devine si la <b>suivante</b> est <b>plus haute ⬆️</b> ou <b>plus basse ⬇️</b>.<br>" +
           "Bonne réponse = la série continue (la carte révélée devient la référence). Erreur = tu bois 🍺 et la <b>main passe</b>.<br>" +
           "Chaque manche reste dans un <b>même thème</b> (population, vitesse, hauteur…). <b>Stat de fin :</b> « Plus longue série ».",
    mount: build, render: render,
  });
})();
