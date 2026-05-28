// Picolo — escalating prompts, host advances.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on">' +
        '<div class="muted center" id="piMeta"></div>' +
        '<div class="big center" style="margin:14px 0">🍻</div>' +
        '<div id="piPrompt" style="background:#1b1d35;border-radius:14px;padding:20px;min-height:120px;font-size:1.1rem;line-height:1.5;text-align:center"></div>' +
        '<div id="piActions" style="margin-top:14px"></div>' +
      '</div>';
  }

  function render(state, h) {
    var r = state.round || {};
    // round_n is sequential (1, 2, 3…) so it doesn't jump when the server
    // skips prompts that need more unique players than the room has.
    // phase==="finished" is handled by the shared fin-de-partie screen — the
    // shell bypasses this renderer in that case.
    h.$("piMeta").textContent = (state.phase === "playing")
      ? "Round " + (r.round_n || 1)
      : "En attente du demarrage";

    h.$("piPrompt").textContent = (state.phase === "playing") ? (r.prompt || "...") : "Clique \"Demarrer\" pour commencer la partie.";

    h.$("piActions").innerHTML = "";
    if (h.amHost()) {
      var btn = document.createElement("button");
      btn.className = "primary";
      btn.style.width = "100%";
      btn.textContent = state.phase === "lobby" ? "Demarrer" : "Prompt suivant ➜";
      btn.onclick = function () { h.send({ t: "next" }); };
      h.$("piActions").appendChild(btn);
    }
  }

  window.GamesHub.register("picolo", {
    name:   "Picolo",
    emoji:  "🍻",
    desc:   "Prompts pour ambiance soirée, avec les prénoms du groupe.",
    minPlayers: 2,
    endable: true,
    rules:  "L'hôte <b>fait défiler une liste de prompts</b> pour animer la soirée.<br>" +
            "Les <b>prénoms du groupe</b> sont injectés automatiquement (\"{p1} mime un métier…\" devient \"Kevin mime un métier…\").<br>" +
            "Les prompts qui nomment plusieurs joueurs sont <b>sautés</b> dans les petites salles (pour éviter \"Kevin et Kevin échangent place\").<br>" +
            "Suis simplement les instructions à l'oral. Ambiance soirée garantie 🍻.<br>" +
            "<b>Stat de la partie :</b> à la fin, le titre <b>« Le plus interpellé »</b> va au joueur le plus souvent nommé par les prompts.",
    mount:  build,
    render: render
  });
})();
