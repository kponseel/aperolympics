// Roulette russe — 1 to 6 players sharing ONE revolver, server-authoritative.
// The current player taps Tirer; the trigger passes around the table; whoever
// lands the loaded chamber drinks. Solo, you pull every chamber yourself.

(function () {
  var lastBoom = "";
  function vibe(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  function build(area, h) {
    lastBoom = "";
    area.innerHTML =
      '<div class="screen on" id="ro-main">' +
        '<div class="muted center" id="roRound" style="margin-bottom:4px"></div>' +
        '<div class="big center" id="roIcon" style="margin:6px 0">🎯</div>' +
        '<div class="ro-cyl" id="roCyl"></div>' +
        '<div class="q center" id="roMsg" style="min-height:1.5em;margin:10px 0"></div>' +
        '<button class="a" id="roFire" style="width:100%;font-size:1.3rem">Tirer</button>' +
        '<button class="primary" id="roNew" style="display:none;margin-top:10px">Nouvelle manche</button>' +
        '<div id="roBoard" style="margin-top:12px"></div>' +
      '</div>';
    h.$("roFire").onclick = function () { h.$("roFire").disabled = true; h.send({ t: "pull" }); };
    h.$("roNew").onclick = function () { h.send({ t: "next" }); };
  }

  function render(state, h) {
    var r = state.round || {}, me = h.findMe();
    var amCurrent = !!(me && r.current_id !== undefined && me.id === r.current_id);
    h.$("roRound").textContent = r.round_n ? ("Manche #" + r.round_n) : "";

    // Cylinder: spent chambers dimmed, the live chamber glowing, the loaded one
    // revealed in red only at the boom.
    var pos = r.pos || 0, n = r.chambers || 6, dots = "";
    for (var i = 0; i < n; i++) {
      var c = "ro-dot";
      if (i < pos) c += " ro-spent";
      if (state.phase === "playing" && i === pos) c += " ro-next";
      if (state.phase === "reveal" && r.bullet != null && i === r.bullet) c += " ro-hit";
      dots += '<span class="' + c + '"></span>';
    }
    h.$("roCyl").innerHTML = dots;

    var sb = (r.scoreboard || []).slice().sort(function (a, b) { return b.booms - a.booms; });
    h.$("roBoard").innerHTML = sb.length
      ? '<div class="muted center" style="font-size:.85rem">💥 ' + sb.map(function (s) { return h.escapeHtml(s.name) + " ×" + s.booms; }).join(" · ") + '</div>'
      : "";

    if (state.phase === "playing") {
      h.$("roIcon").textContent = "🎯";
      h.$("roNew").style.display = "none";
      var fire = h.$("roFire"); fire.style.display = "block";
      if (amCurrent) {
        fire.disabled = false; fire.textContent = "Tirer 😬";
        h.$("roMsg").innerHTML = "<b>À toi de tirer !</b> (chambre " + (pos + 1) + "/" + n + ")";
      } else {
        fire.disabled = true; fire.textContent = "Tirer";
        h.$("roMsg").innerHTML = "Au tour de <b>" + h.escapeHtml(r.current_name || "?") + "</b>… 🤞";
      }
    } else if (state.phase === "reveal") {
      h.$("roIcon").textContent = "💥";
      h.$("roFire").style.display = "none";
      var mine = me && r.victim_id === me.id;
      h.$("roMsg").innerHTML = "💥 <b>" + h.escapeHtml(r.victim_name || "?") + "</b> " +
        (mine ? "— c'est toi, bois ! 🍺" : "a pris la balle — bois ! 🍺");
      h.$("roNew").style.display = h.amHost() ? "block" : "none";
      var sig = "boom#" + r.round_n;
      if (sig !== lastBoom) { lastBoom = sig; vibe(mine ? [130, 60, 130, 60, 220] : [80]); }
    }
    // phase==="finished" → shared fin-de-partie screen (MVP « Le plus dégommé »).
  }

  window.GamesHub.register("roulette", {
    name: "Roulette russe", emoji: "🎯",
    desc: "1 à 6 joueurs : chacun son tour, même barillet.",
    minPlayers: 1, endable: true,
    rules: "<b>Un seul barillet pour la table.</b> 6 chambres, <b>une balle</b> au hasard.<br>" +
           "Chacun son tour, on tape <b>Tirer</b> sur le <b>même revolver</b> : chambre vide = ouf, on passe au suivant ; " +
           "chambre piégée = 💥 <b>tu bois</b> 🍺.<br>" +
           "<b>Solo :</b> tu tires toi-même chaque chambre. L'hôte relance une manche après chaque tir. " +
           "<b>Stat de fin :</b> « Le plus dégommé ».",
    mount: build, render: render,
  });
})();
