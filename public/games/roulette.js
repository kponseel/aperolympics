// Roulette russe (soft) — solo / pass-the-phone. 6 chambers, one (or more in
// hardcore) is loaded. Tap "Tirer" to advance; a loaded chamber = you drink.
// All client-side; the server only holds the phase.

(function () {
  var S;
  function vibe(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  function newGame(hardcore) {
    var chambers = 6;
    var bullets = hardcore ? (1 + Math.floor(Math.random() * 2) + 1) : 1; // 2-3 in hardcore, 1 normal
    var loaded = {};
    var placed = 0;
    while (placed < bullets) { var i = Math.floor(Math.random() * chambers); if (!loaded[i]) { loaded[i] = true; placed++; } }
    return { chambers: chambers, loaded: loaded, pos: 0, state: "ready", hardcore: !!hardcore, bullets: bullets };
  }

  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="ro-main">' +
        '<h2 class="center">🎯 Roulette russe</h2>' +
        '<div class="ro-cyl" id="roCyl"></div>' +
        '<div class="rx-big center" id="roMsg" style="min-height:1.4em;margin:8px 0"></div>' +
        '<button class="a" id="roFire" style="width:100%;font-size:1.3rem">Tirer</button>' +
        '<button id="roNew" style="margin-top:10px;display:none">Nouvelle partie</button>' +
        '<label class="ro-hc"><input type="checkbox" id="roHC"> Mode hardcore (2-3 balles)</label>' +
      '</div>';
    S = newGame(false);
    h.$("roFire").onclick = function () { fire(h); };
    h.$("roNew").onclick = function () { S = newGame(h.$("roHC").checked); draw(h); };
    h.$("roHC").onchange = function () { S = newGame(h.$("roHC").checked); draw(h); };
    draw(h);
  }

  function fire(h) {
    if (S.state !== "ready") return;
    var hit = !!S.loaded[S.pos];
    if (hit) {
      S.state = "boom"; vibe([130, 60, 130, 60, 200]);
    } else {
      S.pos++;
      if (S.pos >= S.chambers) S.state = "survived"; // somehow cycled all empty (shouldn't with >=1 bullet)
    }
    draw(h);
  }

  function draw(h) {
    var cyl = h.$("roCyl"), msg = h.$("roMsg"), fire = h.$("roFire"), neo = h.$("roNew");
    if (!cyl) return;
    var dots = "";
    for (var i = 0; i < S.chambers; i++) {
      var c = "ro-dot";
      if (i < S.pos) c += " ro-spent";          // already fired (empty)
      if (S.state === "boom" && i === S.pos) c += " ro-hit";
      if (S.state === "ready" && i === S.pos) c += " ro-next";
      dots += '<span class="' + c + '"></span>';
    }
    cyl.innerHTML = dots;
    if (S.state === "ready") {
      msg.textContent = "Chambre " + (S.pos + 1) + " / " + S.chambers + " — clic… 😬";
      msg.style.color = "#cdd";
      fire.style.display = "block"; fire.disabled = false; neo.style.display = "none";
    } else if (S.state === "boom") {
      msg.textContent = "💥 BANG ! Tu bois ! 🍺";
      msg.style.color = "#ff7a7a";
      fire.style.display = "none"; neo.style.display = "block";
    } else {
      msg.textContent = "😅 Toutes vides — chanceux !";
      msg.style.color = "#b8e8a8";
      fire.style.display = "none"; neo.style.display = "block";
    }
  }

  function render() { /* solo */ }

  window.GamesHub.register("roulette", {
    name: "Roulette russe", emoji: "🎯",
    desc: "Solo : 6 chambres, une piégée. Tu tentes ta chance ?",
    minPlayers: 1,
    rules: "<b>Solo / passe-le-téléphone.</b> 6 chambres, <b>une piégée</b> au hasard.<br>" +
           "Tape <b>Tirer</b> : chambre vide = soulagement, tu continues. Chambre piégée = 💥 <b>tu bois</b> 🍺.<br>" +
           "Jusqu'où oseras-tu aller ? Mode <b>hardcore</b> : 2 à 3 balles.",
    mount: build, render: render,
  });
})();
