// Réflexe — each player runs 5 attempts locally; on every successful tap we
// post the ms to the server, which keeps a per-player best and broadcasts a
// sorted ranking so everyone sees the room's réflexes live. The 5-attempt
// "done" screen highlights the same ranking + a final classement.

(function () {
  var S, toGreen = null, best = 0;
  function vibe(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  function loadBest() { try { return parseInt(localStorage.getItem("apero.hs.reaction") || "0", 10) || 0; } catch (e) { return 0; } }
  function saveBest(ms) { try { localStorage.setItem("apero.hs.reaction", String(ms)); } catch (e) {} }
  function clearTimers() { if (toGreen) { clearTimeout(toGreen); toGreen = null; } }

  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="rx-main">' +
        '<h2 class="center">⚡ Réflexe</h2>' +
        '<div id="rxZone" class="rx-zone rx-idle"><div class="rx-big" id="rxBig"></div><div class="muted" id="rxSub"></div></div>' +
        '<div class="center" id="rxStats" style="margin-top:12px"></div>' +
        '<button class="primary" id="rxBtn" style="margin-top:12px"></button>' +
        '<div id="rxRoom" class="rx-room"></div>' +
      '</div>';
    best = loadBest();
    S = { state: "idle", times: [], attempt: 0, greenAt: 0, last: 0 };
    var zone = h.$("rxZone");
    zone.addEventListener("pointerdown", function (e) { e.preventDefault(); zoneTap(h); });
    h.$("rxBtn").onclick = function () {
      if (S.state === "done") { S.times = []; S.attempt = 0; }
      startAttempt(h);
    };
    draw(h);
  }

  function zoneTap(h) {
    if (S.state === "waiting" || S.state === "go") { tap(h); return; }
    if (S.state === "done") { S.times = []; S.attempt = 0; }
    startAttempt(h);
  }

  function startAttempt(h) {
    if (S.state === "waiting" || S.state === "go") return;
    clearTimers();
    S.state = "waiting";
    draw(h);
    var delay = 1500 + Math.random() * 3500;
    toGreen = setTimeout(function () { S.state = "go"; S.greenAt = Date.now(); draw(h); }, delay);
  }

  function tap(h) {
    if (S.state === "waiting") { clearTimers(); S.state = "early"; vibe([60, 40, 60]); draw(h); return; }
    if (S.state === "go") {
      var ms = Date.now() - S.greenAt;
      S.last = ms; S.times.push(ms); S.attempt++;
      if (!best || ms < best) { best = ms; saveBest(ms); }
      S.state = (S.attempt >= 5) ? "done" : "between";
      vibe(35);
      h.send({ t: "tap", ms: ms, run_complete: S.state === "done" });
      draw(h);
    }
  }

  // Render the live room ranking (server-side ordering). Always at the bottom;
  // promoted with "Classement final" header when we're on the done screen.
  function drawRoom(h, top) {
    var el = h.$("rxRoom"); if (!el) return;
    top = (top || []).slice(0, 6);
    if (!top.length) { el.innerHTML = ""; return; }
    var medals = ["🥇", "🥈", "🥉"];
    var head = S.state === "done"
      ? '<h3 class="rx-room-h done">🏁 Classement final · réflexes de la salle</h3>'
      : '<h3 class="rx-room-h">🏆 Réflexes de la salle</h3>';
    var me = h.findMe();
    var myName = me ? me.name : "";
    var rows = top.map(function (p, i) {
      var rank = medals[i] || (i + 1);
      var mine = p.name === myName ? " mine" : "";
      return '<li class="rx-row' + mine + '"><span class="rx-rank">' + rank + '</span>' +
        '<span class="rx-who">' + h.escapeHtml(p.name) + '</span>' +
        '<b class="rx-ms">' + p.best_ms + ' <span class="muted">ms</span></b></li>';
    }).join("");
    el.innerHTML = head + '<ol class="rx-room-list">' + rows + '</ol>';
  }

  function draw(h, state) {
    var zone = h.$("rxZone"), big = h.$("rxBig"), sub = h.$("rxSub"), btn = h.$("rxBtn"), stats = h.$("rxStats");
    if (!zone) return;
    var cls = { idle: "rx-idle", waiting: "rx-wait", go: "rx-go", early: "rx-early", between: "rx-idle", done: "rx-idle" };
    zone.className = "rx-zone " + (cls[S.state] || "rx-idle");
    if (S.state === "idle") { big.textContent = "Prêt ?"; sub.textContent = "Tape Démarrer puis attends le vert"; btn.style.display = "block"; btn.textContent = "Démarrer"; }
    else if (S.state === "waiting") { big.textContent = "Attends…"; sub.textContent = "Ne tape pas trop tôt !"; btn.style.display = "none"; }
    else if (S.state === "go") { big.textContent = "TAPE !"; sub.textContent = ""; btn.style.display = "none"; }
    else if (S.state === "early") { big.textContent = "Trop tôt ! 🍺"; sub.textContent = "Faux départ — tu bois. Recommence."; btn.style.display = "block"; btn.textContent = "Recommencer"; }
    else if (S.state === "between") { big.textContent = S.last + " ms"; sub.textContent = "Essai " + S.attempt + "/5"; btn.style.display = "block"; btn.textContent = "Essai suivant"; }
    else if (S.state === "done") {
      var avg = Math.round(S.times.reduce(function (a, b) { return a + b; }, 0) / S.times.length);
      var bestRun = Math.min.apply(null, S.times);
      big.textContent = avg + " ms"; sub.textContent = "Moyenne sur 5 · meilleur " + bestRun + " ms"; btn.style.display = "block"; btn.textContent = "Rejouer";
    }
    stats.innerHTML = '🏆 Record perso : <b>' + (best ? best + " ms" : "—") + '</b>';
    if (state) drawRoom(h, (state.round || {}).top);
  }

  function render(state, h) {
    // Live updates from the server: refresh the room ranking on each broadcast,
    // without disturbing the local play state (timers, attempt counter, etc.).
    drawRoom(h, (state.round || {}).top);
  }
  function unmount() { clearTimers(); }

  window.GamesHub.register("reaction", {
    name: "Réflexe", emoji: "⚡",
    desc: "Tape dès que l'écran passe au vert — 5 essais. Classement live de la salle.",
    minPlayers: 1, endable: true, scored: true,
    // Format reaction's inverse-ms score back to ms for the global 🏆 board.
    // bestMs is recoverable as (5000 - score). 0 score means "no run yet".
    formatScore: function (score) {
      if (!score) return "—";
      return (5000 - score) + " ms";
    },
    rules: "<b>Tape dès que l'écran passe au vert.</b><br>" +
           "Tape <b>avant</b> le vert = faux départ (tu bois 🍺).<br>" +
           "<b>5 essais</b> — on garde ton meilleur temps de la session.<br>" +
           "Tout le monde joue <b>en parallèle</b> ; le classement de la salle se met à jour en direct.<br>" +
           "<b>Stat de fin de partie :</b> ⚡ « Réflexe en or » au plus rapide, podium 🥈🥉 pour les suivants.",
    mount: build, render: render, unmount: unmount,
  });
})();
