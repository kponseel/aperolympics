// Cap ou pas cap (dare_duel) — the active player taps Cap 😎 or Pas cap 🍺.
// Loop game, host-endable. Level escalates as rounds go.

(function () {
  var LEVELS = { 1: "Soft", 2: "Osé", 3: "Hardcore" };

  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="dd-input">' +
        '<div class="center" id="ddMeta" style="margin-bottom:6px"></div>' +
        '<div class="q center" id="ddDare" style="margin:10px 0 6px"></div>' +
        '<div class="center muted" id="ddTarget" style="margin-bottom:14px"></div>' +
        '<div id="ddButtons">' +
          '<button class="d" id="ddCap" style="width:100%;margin:6px 0;font-size:1.2rem">😎 Cap</button>' +
          '<button class="a" id="ddNope" style="width:100%;margin:6px 0;font-size:1.2rem">🍺 Pas cap</button>' +
        '</div>' +
        '<div class="center muted" id="ddTally" style="margin-top:12px"></div>' +
      '</div>' +
      '<div class="screen" id="dd-reveal">' +
        '<div class="rx-big center" id="ddVerdict" style="margin:10px 0"></div>' +
        '<div class="center muted" id="ddDareR" style="margin-bottom:12px"></div>' +
        '<div class="center" id="ddTallyR" style="margin-bottom:12px"></div>' +
        '<button class="primary" id="ddNext" style="display:none">Défi suivant</button>' +
      '</div>';
    h.$("ddCap").onclick = function () { h.send({ t: "answer", v: "cap" }); lock(h); };
    h.$("ddNope").onclick = function () { h.send({ t: "answer", v: "nope" }); lock(h); };
    h.$("ddNext").onclick = function () { h.send({ t: "next" }); };
  }
  function lock(h) { h.$("ddCap").disabled = true; h.$("ddNope").disabled = true; }
  function showScreen(h, id) { ["dd-input", "dd-reveal"].forEach(function (s) { h.$(s).classList.toggle("on", s === id); }); }

  function render(state, h) {
    var r = state.round || {};
    var me = h.findMe();
    var amActive = !!(me && r.active_id && me.id === r.active_id);
    var tally = r.tally || { cap: 0, nope: 0 };
    if (state.phase === "playing") {
      showScreen(h, "dd-input");
      h.$("ddMeta").innerHTML = 'Défi #' + (r.round_n || 0) + ' · <b>' + (LEVELS[r.level] || "Soft") + '</b>';
      h.$("ddDare").textContent = r.dare || "";
      h.$("ddButtons").style.display = amActive ? "block" : "none";
      h.$("ddCap").disabled = false; h.$("ddNope").disabled = false;
      h.$("ddTarget").innerHTML = amActive
        ? "👉 <b>À toi de choisir !</b>"
        : "En attente de <b>" + h.escapeHtml(r.active_name || "?") + "</b>…";
      h.$("ddTally").textContent = "😎 " + tally.cap + " cap · 🍺 " + tally.nope + " pas cap";
    } else if (state.phase === "reveal") {
      showScreen(h, "dd-reveal");
      var ch = (r.choice && r.active_id) ? r.choice[r.active_id] : null;
      h.$("ddVerdict").innerHTML = ch === "cap" ? ("😎 " + h.escapeHtml(r.active_name || "") + " est CAP !")
        : ch === "nope" ? ("🍺 " + h.escapeHtml(r.active_name || "") + " se dégonfle — boit !")
        : "⏭️ Passé";
      h.$("ddDareR").textContent = r.dare || "";
      h.$("ddTallyR").textContent = "😎 " + tally.cap + " cap · 🍺 " + tally.nope + " pas cap";
      h.$("ddNext").style.display = h.amHost() ? "block" : "none";
    }
    // phase==="finished" handled by the shared fin-de-partie screen.
  }

  window.GamesHub.register("dare_duel", {
    name: "Cap ou pas cap", emoji: "😏",
    desc: "Un défi s'affiche : Cap (tu le fais) ou Pas cap (tu bois) ?",
    minPlayers: 2, endable: true,
    rules: "À tour de rôle, un <b>défi</b> s'affiche pour le joueur actif.<br>" +
           "Il tape <b>Cap 😎</b> (il le fait, les autres jugent) ou <b>Pas cap 🍺</b> (il boit).<br>" +
           "Les défis <b>montent en intensité</b> (Soft → Osé → Hardcore). <b>Stat de fin :</b> « Le plus cap ».",
    mount: build, render: render,
  });
})();
