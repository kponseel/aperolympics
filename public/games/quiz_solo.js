// Quiz Contre-la-montre — synchronised race to 5 correct answers. Everyone
// in the room sees the SAME questions (delivered via `state.round.questions`,
// no more `_private`), the host triggers a 3-2-1-GO countdown from the
// lobby Démarrer button, and live progress ("Alice 3/5, Bob 2/5") updates
// on every screen as players tap. First to 5 wins; the race stays open so
// the others can finish — fin-de-partie podium ranks by arrival order. v49.

(function () {
  var S, tick = null, best = 0;
  var TARGET = 5;

  function loadBest() { try { return parseInt(localStorage.getItem("apero.hs.quiz_solo") || "0", 10) || 0; } catch (e) { return 0; } }
  function saveBest(ms) { try { localStorage.setItem("apero.hs.quiz_solo", String(ms)); } catch (e) {} }
  function clearTimers() { if (tick) { clearInterval(tick); tick = null; } }

  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="qs-main">' +
        '<div class="quiz-top">' +
          '<div class="points" id="qsSecs" style="min-width:66px;text-align:left">0.0 s</div>' +
          '<div class="muted center" id="qsTarget" style="flex:1">En attente — l\'hôte lance la course.</div>' +
          '<div class="points" id="qsScore">0</div>' +
        '</div>' +
        '<div class="q" id="qsText">Prépare-toi — premier arrivé à 5 bonnes réponses gagne.</div>' +
        '<div class="grid" id="qsGrid">' +
          '<button class="a" id="qb0"></button><button class="b" id="qb1"></button>' +
          '<button class="c" id="qb2"></button><button class="d" id="qb3"></button>' +
        '</div>' +
        '<div class="center" id="qsMsg"></div>' +
        '<div class="qs-countdown" id="qsCountdown" style="display:none"></div>' +
        '<div id="qsRoom" class="rx-room"></div>' +
      '</div>';
    best = loadBest();
    S = { idx: 0, correct: 0, wrong: 0, done: false, lastWinnerAnnouncedFor: "" };
    for (var i = 0; i < 4; i++) (function (idx) {
      h.$("qb" + idx).onclick = function () { answer(h, idx); };
    })(i);
    disableButtons(h, true);
  }

  function disableButtons(h, dis) {
    for (var i = 0; i < 4; i++) {
      var b = h.$("qb" + i); if (b) b.disabled = dis;
    }
  }

  function readQuestions(state) {
    var r = (state && state.round) || {};
    return (r.questions && r.questions.length) ? r.questions : [];
  }

  function answer(h, choice) {
    if (S.done) return;
    var st = window.__lastState || {};
    var r = st.round || {};
    if (r.phase !== "playing") return;
    var qs = readQuestions(st);
    var q = qs[S.idx];
    if (!q) return;
    var ok = choice === q.correct;
    if (ok) S.correct++;
    else S.wrong++;
    S.idx++;
    if (S.idx >= qs.length) S.idx = 0;
    flash(h, ok);
    // Tell the server our new live counts on every tap so the room panel updates.
    try { h.send({ t: "answer_progress", correct: S.correct, wrong: S.wrong }); } catch (e) {}
    if (S.correct >= TARGET) {
      S.done = true;
      try { if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 160]); } catch (e) {}
      // Local "finished" UI; server confirms via state broadcast.
      var raceStart = Number(r.race_start_at) || Date.now();
      var ms = Math.max(1, Date.now() - raceStart);
      if (!best || ms < best) { best = ms; saveBest(ms); }
      disableButtons(h, true);
      h.$("qsText").textContent = "🏁 Bravo — tu as fini en " + (ms / 1000).toFixed(2) + " s ! Attends les autres.";
      h.$("qsMsg").style.color = "#fff";
      h.$("qsMsg").innerHTML = "Bonnes : <b>" + S.correct + "</b> — Mauvaises : <b>" + S.wrong + "</b><br>" +
        "<span class='muted'>🏆 Record perso : " + (best ? (best / 1000).toFixed(2) + " s" : "—") + "</span>";
      return;
    }
    drawQuestion(h, qs[S.idx]);
  }

  function flash(h, ok) {
    var msg = h.$("qsMsg");
    if (!msg) return;
    msg.textContent = ok ? "✅ +1" : "❌ −1";
    msg.style.color = ok ? "#b8e8a8" : "#ff7a7a";
  }

  function drawQuestion(h, q) {
    if (!q) return;
    h.$("qsText").textContent = q.q || "";
    for (var i = 0; i < 4; i++) {
      var b = h.$("qb" + i);
      b.textContent = (q.choices && q.choices[i]) || "";
    }
  }

  function fmtSec(ms) { return (ms / 1000).toFixed(2); }

  function drawTopbar(h, r) {
    h.$("qsScore").textContent = S.correct;
    h.$("qsTarget").textContent = S.correct + " / " + TARGET + " bonnes";
    var secs = h.$("qsSecs"); if (!secs) return;
    if (r && r.race_start_at && r.phase === "playing") {
      var elapsed = (Date.now() - r.race_start_at) / 1000;
      secs.textContent = Math.max(0, elapsed).toFixed(1) + " s";
      secs.style.color = "#fff";
    } else if (r && r.phase === "countdown") {
      secs.textContent = "0.0 s";
      secs.style.color = "#9aa3d6";
    } else {
      secs.textContent = "—";
      secs.style.color = "#9aa3d6";
    }
  }

  function drawCountdown(h, r) {
    var c = h.$("qsCountdown"); if (!c) return;
    if (!r || r.phase !== "countdown" || !r.race_start_at) { c.style.display = "none"; return; }
    var left = r.race_start_at - Date.now();
    if (left <= 0) { c.style.display = "none"; return; }
    c.style.display = "flex";
    var n = Math.ceil(left / 1000);
    c.textContent = n <= 0 ? "GO !" : String(n);
  }

  // Live "Course en cours" panel. Shows everyone's progress as 5 pips +
  // their finish time once they hit 5.
  function drawRoom(h, r) {
    var el = h.$("qsRoom"); if (!el) return;
    var prog = (r && r.progress) || [];
    if (!prog.length) { el.innerHTML = ""; return; }
    var me = h.findMe();
    var myName = me ? me.name : "";
    var anyFinished = prog.some(function (x) { return x.finished_ms != null; });
    var head = (r.phase === "finished")
      ? '<h3 class="rx-room-h done">🏁 Classement final</h3>'
      : '<h3 class="rx-room-h">' + (anyFinished ? '🏁 Course en cours' : '🏆 Course en cours') + '</h3>';
    var rows = prog.map(function (p, i) {
      var rank;
      if (p.finished_ms != null) rank = (i === 0 ? "🥇" : (i === 1 ? "🥈" : (i === 2 ? "🥉" : (i + 1))));
      else rank = (i + 1);
      var mine = p.name === myName ? " mine" : "";
      var pips = "";
      for (var k = 0; k < TARGET; k++) {
        pips += '<span class="qs-pip ' + (k < p.correct ? "on" : "off") + '"></span>';
      }
      var time = p.finished_ms != null
        ? '<b class="rx-ms">' + fmtSec(p.finished_ms) + ' <span class="muted">s</span></b>'
        : '<span class="qs-count muted">' + p.correct + '/' + TARGET + '</span>';
      return '<li class="rx-row' + mine + '"><span class="rx-rank">' + rank + '</span>' +
        '<span class="rx-who">' + h.escapeHtml(p.name) + '</span>' +
        '<span class="qs-pips">' + pips + '</span>' +
        time + '</li>';
    }).join("");
    el.innerHTML = head + '<ol class="rx-room-list">' + rows + '</ol>';
  }

  function announceWinner(h, r) {
    if (!r || !r.winner) return;
    if (S.lastWinnerAnnouncedFor === r.winner) return;
    S.lastWinnerAnnouncedFor = r.winner;
    var me = h.findMe();
    if (me && r.winner === me.name) return; // we already saw our own "Bravo"
    // Find their time
    var entry = (r.progress || []).find(function (x) { return x.name === r.winner; });
    var t = (entry && entry.finished_ms != null) ? fmtSec(entry.finished_ms) + " s" : "";
    var msg = h.$("qsMsg"); if (!msg) return;
    msg.style.color = "#ffd23f";
    msg.textContent = "🏆 " + r.winner + " a fini" + (t ? " en " + t : "") + " !";
  }

  function render(state, h) {
    window.__lastState = state;
    var r = (state && state.round) || {};
    drawRoom(h, r);
    drawCountdown(h, r);
    drawTopbar(h, r);

    // Phase-driven question display + button enable/disable.
    var qs = readQuestions(state);
    if (r.phase === "lobby" || !r.phase) {
      // Idle pre-race: keep the placeholder text, no questions yet.
      if (!S.done) {
        h.$("qsText").textContent = "Prépare-toi — l'hôte va lancer la course.";
        for (var i = 0; i < 4; i++) h.$("qb" + i).textContent = "";
        disableButtons(h, true);
      }
      clearTimers();
    } else if (r.phase === "countdown") {
      // Pre-paint the first question (disabled).
      S = { idx: 0, correct: 0, wrong: 0, done: false, lastWinnerAnnouncedFor: S.lastWinnerAnnouncedFor || "" };
      if (qs.length) drawQuestion(h, qs[0]);
      disableButtons(h, true);
      if (!tick) tick = setInterval(function () {
        var st = window.__lastState || {};
        drawTopbar(h, st.round || {});
        drawCountdown(h, st.round || {});
      }, 100);
    } else if (r.phase === "playing") {
      if (!tick) tick = setInterval(function () {
        var st = window.__lastState || {};
        drawTopbar(h, st.round || {});
      }, 100);
      if (!S.done) {
        if (qs.length) drawQuestion(h, qs[S.idx]);
        disableButtons(h, false);
      } else {
        disableButtons(h, true);
      }
      announceWinner(h, r);
    } else if (r.phase === "finished") {
      clearTimers();
      disableButtons(h, true);
      // The shared fin-de-partie screen takes over; our own text stays as
      // last seen (Bravo line if we finished, "Course finie" otherwise).
      if (!S.done) {
        var me = h.findMe();
        var myEntry = (r.progress || []).find(function (x) { return me && x.name === me.name; });
        if (myEntry && myEntry.finished_ms != null) {
          h.$("qsText").textContent = "🏁 Tu as fini en " + fmtSec(myEntry.finished_ms) + " s !";
        } else {
          h.$("qsText").textContent = "🏁 Course terminée — " + (r.winner || "personne") + " gagne.";
        }
      }
    }
  }

  function unmount() { clearTimers(); }

  window.GamesHub.register("quiz_solo", {
    name: "Quiz Contre-la-montre", emoji: "🔢",
    desc: "Course synchronisée à 5 bonnes — mêmes questions, progression en direct.",
    minPlayers: 1, endable: true, scored: true,
    // Best time-to-5 stored as score = max(0, 60000 - bestMs); render back as seconds.
    formatScore: function (score) {
      if (!score) return "—";
      var ms = 60000 - score;
      return (ms / 1000).toFixed(2) + " s";
    },
    rules: "<b>Course synchronisée à 5 bonnes réponses.</b> Tout le monde reçoit les <b>mêmes</b> questions ; un <b>3 - 2 - 1 - GO</b> se déclenche simultanément quand l'hôte clique Démarrer.<br>" +
           "La <b>progression de la salle</b> s'affiche en direct sous la question.<br>" +
           "Le premier à <b>5 bonnes</b> gagne la course ; les autres terminent leur run pour le classement.<br>" +
           "Le record personnel (meilleur temps de la soirée) est mémorisé.",
    mount: build, render: render, unmount: unmount,
  });
})();
