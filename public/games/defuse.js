// Désamorçage (defuse) — asymmetric co-op. The démineur sees the bomb (their
// private module); the expert(s) see the manual. Server holds the timer + state.

(function () {
  var WIRE_HEX = { rouge: "#e6394a", bleu: "#1368ce", jaune: "#d89e00", noir: "#444" };
  var TYPE_FR = { wires: "Fils", button: "Bouton", sequence: "Séquence" };

  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="df-main">' +
        '<div class="df-top">' +
          '<div class="df-timer" id="dfTimer">3:00</div>' +
          '<div class="df-prog" id="dfProg"></div>' +
        '</div>' +
        '<div id="dfRole" class="center" style="margin:6px 0 10px"></div>' +
        '<div id="dfBody"></div>' +
        '<button class="primary" id="dfStart" style="display:none;margin-top:12px">🚀 Lancer le désamorçage</button>' +
      '</div>';
    h.$("dfStart").onclick = function () { h.send({ t: "next" }); };
  }

  function fmt(t) { t = Math.max(0, t | 0); return Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2); }

  function manualHTML() {
    return '<div class="rules" style="text-align:left">' +
      '<h4>📖 Manuel de désamorçage</h4>' +
      '<b>🔌 Fils</b> — compte les fils :<br>' +
      '• <b>3 fils</b> : s\'il y a du <span style="color:#e6394a">ROUGE</span> → coupe le <b>2e</b> ; sinon → le <b>dernier</b>.<br>' +
      '• <b>4 fils</b> : s\'il y a du <span style="color:#d89e00">JAUNE</span> → coupe le <b>1er</b> ; sinon → le <b>dernier</b>.<br>' +
      '• <b>5 fils</b> : s\'il y a du <span style="color:#1368ce">BLEU</span> → coupe le <b>3e</b> ; sinon → le <b>1er</b>.<br><br>' +
      '<b>🔘 Bouton</b> — regarde couleur + texte :<br>' +
      '• Texte <b>« ABORT »</b> → <b>appui LONG</b> (maintiens).<br>' +
      '• Sinon, bouton <span style="color:#e6394a">ROUGE</span> → <b>appui LONG</b>.<br>' +
      '• Sinon → <b>appui COURT</b> (tape).<br><br>' +
      '<b>🔣 Séquence</b> — appuie sur les symboles <b>présents</b> dans CET ordre :<br>' +
      '<b style="font-size:1.2rem">Ω → Δ → ☢ → ✦ → ♣ → ❄</b><br>(ignore les absents)</div>';
  }

  function defuserModule(h, mod) {
    if (!mod) return '<div class="muted center">…</div>';
    if (mod.type === "wires") {
      return '<div class="center muted" style="margin-bottom:8px">🔌 Coupe le bon fil (' + mod.colors.length + ' fils)</div>' +
        mod.colors.map(function (c, i) {
          return '<button class="df-wire" data-cut="' + i + '" style="background:' + (WIRE_HEX[c] || "#666") + '">Fil ' + (i + 1) + ' — ' + c + '</button>';
        }).join("");
    }
    if (mod.type === "button") {
      return '<div class="center" style="margin-bottom:10px">🔘 Bouton <b style="color:' + (WIRE_HEX[mod.color] || "#fff") + '">' + mod.color.toUpperCase() + '</b> — texte « <b>' + h.escapeHtml(mod.label) + '</b> »</div>' +
        '<button class="ghost" data-act="tap" style="width:100%;margin:6px 0">👆 Appui court</button>' +
        '<button class="ghost" data-act="hold" style="width:100%;margin:6px 0">✊ Appui long (maintenir)</button>';
    }
    if (mod.type === "sequence") {
      var done = (mod.pressed || []).length;
      return '<div class="center muted" style="margin-bottom:8px">🔣 Appuie dans le bon ordre (' + done + '/' + mod.symbols.length + ')</div>' +
        '<div class="df-syms">' + mod.symbols.map(function (s) {
          var pressed = (mod.pressed || []).indexOf(s) >= 0;
          return '<button class="df-sym' + (pressed ? ' done' : '') + '" data-sym="' + s + '"' + (pressed ? ' disabled' : '') + '>' + s + '</button>';
        }).join("") + '</div>';
    }
    return "";
  }

  function bindDefuser(h, cur) {
    var body = h.$("dfBody");
    body.querySelectorAll("[data-cut]").forEach(function (b) {
      b.onclick = function () { h.send({ t: "act", module: cur, action: "cut", wire: parseInt(b.getAttribute("data-cut"), 10) }); };
    });
    body.querySelectorAll("[data-act]").forEach(function (b) {
      b.onclick = function () { h.send({ t: "act", module: cur, action: b.getAttribute("data-act") }); };
    });
    body.querySelectorAll("[data-sym]").forEach(function (b) {
      b.onclick = function () { h.send({ t: "act", module: cur, action: "press", symbol: b.getAttribute("data-sym") }); };
    });
  }

  function render(state, h) {
    var r = state.round || {};
    var priv = state._private || {};
    var me = h.findMe();
    var amDefuser = !!(me && r.defuser_id && me.id === r.defuser_id);

    h.$("dfTimer").textContent = fmt(r.time_left != null ? r.time_left : 180);
    h.$("dfTimer").style.color = (r.time_left != null && r.time_left <= 30) ? "#ff7a7a" : "#fff";
    h.$("dfProg").textContent = (state.phase === "playing")
      ? ("Module " + ((r.modules_done || 0) + 1) + "/" + (r.modules_total || 3) + (r.module_type ? " · " + (TYPE_FR[r.module_type] || "") : "")) + (r.errors ? " · ⚠️ " + r.errors : "")
      : "";

    var roleTxt = amDefuser ? '💣 Tu es le <b>DÉMINEUR</b> — décris la bombe à voix haute'
      : '📖 Tu es <b>EXPERT</b> — lis le manuel et guide le démineur';
    h.$("dfRole").innerHTML = roleTxt;

    if (state.phase === "assign") {
      h.$("dfBody").innerHTML = '<div class="center muted">Rôles distribués ! Le démineur voit la bombe, l\'expert le manuel.<br>Mettez-vous d\'accord, puis lancez le chrono.</div>' +
        (amDefuser ? "" : manualHTML());
      h.$("dfStart").style.display = h.amHost() ? "block" : "none";
      return;
    }
    h.$("dfStart").style.display = "none";

    if (state.phase === "playing") {
      var body = h.$("dfBody");
      if (amDefuser) {
        body.innerHTML = defuserModule(h, priv.module);
        bindDefuser(h, priv.module_idx != null ? priv.module_idx : (r.modules_done || 0));
      } else {
        body.innerHTML = manualHTML();
      }
      if (r.flash_error) { body.classList.add("df-flash"); setTimeout(function () { body.classList.remove("df-flash"); }, 600); }
      return;
    }
    // phase==="finished" → shared fin-de-partie screen (winner_banner).
  }

  window.GamesHub.register("defuse", {
    name: "Désamorçage", emoji: "💣",
    desc: "Coop 2 joueurs : l'un voit la bombe, l'autre le manuel. Parlez-vous !",
    minPlayers: 2, endable: true,
    rules: "<b>Coopératif, info asymétrique.</b> Au lancement, un <b>Démineur</b> 💣 (voit la bombe) et un·des <b>Expert(s)</b> 📖 (voient le manuel) sont tirés.<br>" +
           "Vous ne voyez <b>pas la même chose</b> : parlez-vous ! Le démineur décrit, l'expert lit la règle et guide.<br>" +
           "3 modules (Fils, Bouton, Séquence) à désamorcer avant la fin du <b>chrono (3 min)</b>. Chaque erreur coûte <b>30 s</b>. Chrono à zéro = 💥 tout le monde boit.",
    mount: build, render: render,
  });
})();
