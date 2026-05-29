// Simon — solo memory game. The game plays a growing colour sequence, you
// replay it. All client-side; the server only holds a phase. Best score in
// localStorage (apero.hs.simon). Optional Web Audio tones (guarded).

(function () {
  var S, seqTimer = null, best = 0, audio = null;
  var PADS = [
    { id: 0, cls: "sp0", freq: 329.6 },
    { id: 1, cls: "sp1", freq: 261.6 },
    { id: 2, cls: "sp2", freq: 392.0 },
    { id: 3, cls: "sp3", freq: 220.0 },
  ];

  function loadBest() { try { return parseInt(localStorage.getItem("apero.hs.simon") || "0", 10) || 0; } catch (e) { return 0; } }
  function saveBest(n) { try { localStorage.setItem("apero.hs.simon", String(n)); } catch (e) {} }
  function clearTimers() { if (seqTimer) { clearTimeout(seqTimer); seqTimer = null; } }

  function tone(freq, ms) {
    try {
      if (!audio) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; audio = new AC(); }
      var o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = freq; o.type = "sine"; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.0001, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, audio.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000);
      o.start(); o.stop(audio.currentTime + ms / 1000 + 0.02);
    } catch (e) {}
  }

  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="si-main">' +
        '<h2 class="center">🧩 Simon</h2>' +
        '<div class="center" id="siMsg" style="min-height:1.4em;margin-bottom:8px"></div>' +
        '<div class="simon-grid" id="siGrid">' +
          PADS.map(function (p) { return '<button class="simon-pad ' + p.cls + '" data-pad="' + p.id + '"></button>'; }).join("") +
        '</div>' +
        '<div class="center" id="siStats" style="margin-top:12px"></div>' +
        '<button class="primary" id="siBtn" style="margin-top:12px">Commencer</button>' +
      '</div>';
    best = loadBest();
    S = { seq: [], input: [], state: "idle", level: 0 };
    // pointerdown (not onclick) so a fast finger registers immediately on
    // mobile — onclick waits for touch-release and is cancelled by tiny
    // finger drift, which made pads feel unresponsive.
    h.$("siGrid").querySelectorAll(".simon-pad").forEach(function (b) {
      var fire = function (e) { if (e && e.preventDefault) e.preventDefault(); padTap(h, parseInt(b.getAttribute("data-pad"), 10)); };
      if ("onpointerdown" in window) b.addEventListener("pointerdown", fire);
      else b.addEventListener("click", fire);
    });
    h.$("siBtn").onclick = function () { startGame(h); };
    draw(h);
  }

  function startGame(h) {
    clearTimers();
    S = { seq: [], input: [], state: "show", level: 0 };
    nextRound(h);
  }

  function nextRound(h) {
    S.seq.push(Math.floor(Math.random() * 4));
    S.input = [];
    S.level = S.seq.length;
    S.state = "show";
    draw(h);
    playSequence(h, 0);
  }

  function playSequence(h, i) {
    if (i >= S.seq.length) { S.state = "input"; draw(h); return; }
    var pad = S.seq[i];
    flash(h, pad);
    seqTimer = setTimeout(function () { playSequence(h, i + 1); }, 650);
  }

  function flash(h, pad) {
    var el = h.$("siGrid") && h.$("siGrid").querySelector('[data-pad="' + pad + '"]');
    if (!el) return;
    el.classList.add("lit");
    tone(PADS[pad].freq, 350);
    setTimeout(function () { el.classList.remove("lit"); }, 320);
  }

  function padTap(h, pad) {
    if (S.state !== "input") return;
    flash(h, pad);
    S.input.push(pad);
    var idx = S.input.length - 1;
    if (S.seq[idx] !== pad) { gameOver(h); return; }
    if (S.input.length === S.seq.length) {
      S.state = "ok";
      try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {}
      draw(h);
      seqTimer = setTimeout(function () { nextRound(h); }, 700);
    }
  }

  function gameOver(h) {
    clearTimers();
    var reached = S.seq.length - 1; // last fully-completed level
    if (reached > best) { best = reached; saveBest(reached); }
    S.state = "over"; S.reached = reached;
    tone(110, 500);
    try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) {}
    draw(h);
  }

  function draw(h) {
    var msg = h.$("siMsg"), btn = h.$("siBtn"), stats = h.$("siStats");
    if (!msg) return;
    if (S.state === "idle") { msg.textContent = "Mémorise la séquence puis reproduis-la."; btn.style.display = "block"; btn.textContent = "Commencer"; }
    else if (S.state === "show") { msg.textContent = "👀 Regarde… (niveau " + S.level + ")"; btn.style.display = "none"; }
    else if (S.state === "input") { msg.textContent = "À toi ! (" + S.input.length + "/" + S.seq.length + ")"; btn.style.display = "none"; }
    else if (S.state === "ok") { msg.textContent = "✅ Niveau " + S.level + " réussi !"; btn.style.display = "none"; }
    else if (S.state === "over") { msg.textContent = "💥 Raté ! Niveau atteint : " + S.reached + " 🍺"; btn.style.display = "block"; btn.textContent = "Rejouer"; }
    stats.innerHTML = '🏆 Record perso : <b>niveau ' + (best || 0) + '</b>';
  }

  function render() { /* solo */ }
  function unmount() { clearTimers(); }

  window.GamesHub.register("simon", {
    name: "Simon", emoji: "🧩",
    desc: "Solo : mémorise la séquence de couleurs qui s'allonge.",
    minPlayers: 1,
    rules: "<b>Solo.</b> Le jeu illumine une <b>séquence de couleurs</b> (avec sons). Reproduis-la dans l'ordre.<br>" +
           "Chaque réussite ajoute une couleur — la séquence <b>s'allonge</b>.<br>" +
           "Une erreur = game over. On garde le <b>niveau atteint</b> et ton record. (Option apéro : 1 gorgée par niveau manqué.)",
    mount: build, render: render, unmount: unmount,
  });
})();
