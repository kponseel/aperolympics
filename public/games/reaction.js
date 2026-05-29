// Réflexe — solo reaction timer. Runs entirely client-side; the server holds
// only a phase. Best score persists in localStorage (apero.hs.reaction).

(function () {
  var S, toGreen = null, best = 0;

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
      '</div>';
    best = loadBest();
    S = { state: "idle", times: [], attempt: 0, greenAt: 0, last: 0 };
    h.$("rxZone").onclick = function () { tap(h); };
    h.$("rxBtn").onclick = function () {
      if (S.state === "done") { S.times = []; S.attempt = 0; }
      startAttempt(h);
    };
    draw(h);
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
    if (S.state === "waiting") { clearTimers(); S.state = "early"; draw(h); return; }
    if (S.state === "go") {
      var ms = Date.now() - S.greenAt;
      S.last = ms; S.times.push(ms); S.attempt++;
      if (!best || ms < best) { best = ms; saveBest(ms); }
      S.state = (S.attempt >= 5) ? "done" : "between";
      draw(h);
    }
  }

  function draw(h) {
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
  }

  function render() { /* solo — server only carries the phase, nothing to sync */ }
  function unmount() { clearTimers(); }

  window.GamesHub.register("reaction", {
    name: "Réflexe", emoji: "⚡",
    desc: "Solo : tape dès que l'écran passe au vert.",
    minPlayers: 1,
    rules: "<b>Solo / chacun son tour.</b> Tape <b>Démarrer</b> : l'écran devient rouge.<br>" +
           "Dès qu'il passe au <b>vert</b>, tape l'écran le plus vite possible — ton temps de réaction s'affiche en millisecondes.<br>" +
           "Tape <b>avant</b> le vert = faux départ (tu bois 🍺).<br>" +
           "5 essais, on garde ta moyenne et ton <b>record perso</b>.",
    mount: build, render: render, unmount: unmount,
  });
})();
