// QuizzMaster SPA — single "Blitz 30 s" mode.
// Socket.IO namespace /qm. 3 screens: pseudo / hall (10 themes) / room.
// Room is state-driven: idle → countdown (3-2-1) → playing (30 s) → podium.
// Mobile-first, large touch targets, high contrast (lisible 60+).

(function () {
  "use strict";

  // ---------- identité persistante ----------
  function uuid() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function (c) {
      return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
    });
  }
  function getCid() { var c = localStorage.getItem("qm.cid"); if (!c) { c = uuid(); localStorage.setItem("qm.cid", c); } return c; }
  function getPseudo() { return (localStorage.getItem("qm.pseudo") || "").trim(); }
  function setPseudo(n) { localStorage.setItem("qm.pseudo", n); }

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function show(screenId) {
    ["s-pseudo", "s-hall", "s-room"].forEach(function (s) { var el = $(s); if (el) el.classList.toggle("on", s === screenId); });
    var back = $("qmBack"); if (back) back.style.display = (screenId === "s-room") ? "" : "none";
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function setStatus(t) { var el = $("qmStatus"); if (el) el.textContent = t || ""; }
  function setWho() { var el = $("qmWho"); if (el) { var p = getPseudo(); el.textContent = p ? "👋 " + p : ""; } }
  function medal(i) { return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1); }

  // ---------- socket + session ----------
  var socket = null, connected = false;
  var lastLobby = null, lastRoom = null, currentRoomId = null;
  var refreshTick = null;

  // local blitz play state (client-trusted scoring, mirrors server)
  var play = null; // { idx, correct, wrong, skipped, streak, curStreak, locked }

  function connect() {
    if (socket) return;
    socket = io("/qm", { transports: ["websocket", "polling"] });
    socket.on("connect", function () {
      connected = true; setStatus("");
      if (getPseudo()) socket.emit("set_identity", { cid: getCid(), name: getPseudo() });
    });
    socket.on("disconnect", function () { connected = false; setStatus("Connexion perdue — reconnexion…"); });
    socket.on("identity_ok", function () {
      setStatus("");
      if (currentRoomId) socket.emit("join_room", { id: currentRoomId });
      else if ($("s-hall").classList.contains("on")) socket.emit("join_lobby");
    });
    socket.on("error_msg", function (m) {
      var code = m && m.msg;
      if (code === "bad_identity" || code === "no_identity") return;
      setStatus(code ? "Erreur : " + code : "Erreur");
    });
    socket.on("lobby_state", function (m) { lastLobby = m || {}; renderLobby(); });
    socket.on("room_state", function (m) {
      var prev = lastRoom;
      lastRoom = m || {};
      window.__qmLastRoom = lastRoom;
      // New race starting: (re)initialise local play state once, at countdown.
      if (lastRoom.state === "countdown" && (!prev || prev.state === "idle" || prev.state === "podium")) {
        play = { idx: 0, correct: 0, wrong: 0, skipped: 0, streak: 0, curStreak: 0, locked: false };
      }
      renderRoom();
    });
  }

  // ---------- pseudo ----------
  function setupPseudo() {
    var input = $("qmName"); if (!input) return;
    input.value = getPseudo();
    $("qmContinue").onclick = function () {
      var n = (input.value || "").trim().slice(0, 16);
      if (!n) { $("qmPseudoError").textContent = "Entre ton prénom."; return; }
      setPseudo(n); setWho();
      if (socket) socket.emit("set_identity", { cid: getCid(), name: n });
      enterHall();
    };
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("qmContinue").click(); } });
  }

  function enterHall() {
    currentRoomId = null;
    if (socket && connected) socket.emit("join_lobby");
    show("s-hall");
  }

  // ---------- hall ----------
  function roomStateLabel(card) {
    if (card.state === "playing") return { txt: "🔥 En cours", cls: "live" };
    if (card.state === "countdown") return { txt: "🚦 Ça démarre !", cls: "go" };
    if (card.state === "podium") return { txt: "🏆 Résultats…", cls: "podium" };
    if (card.player_count > 0) return { txt: "⏳ " + card.player_count + " en attente", cls: "wait" };
    return { txt: "Touche pour jouer", cls: "" };
  }

  function renderLobby() {
    if (!lastLobby) return;
    var wrap = $("qmRooms"); if (!wrap) return;
    wrap.innerHTML = "";
    (lastLobby.rooms || []).forEach(function (card) {
      var st = roomStateLabel(card);
      var el = document.createElement("button");
      el.type = "button";
      el.className = "qm-room-card" + (card.state === "playing" || card.state === "countdown" ? " live" : "");
      el.innerHTML =
        '<span class="qm-rc-emoji">' + esc(card.theme_emoji) + '</span>' +
        '<span class="qm-rc-name">' + esc(card.theme_name) + '</span>' +
        '<span class="qm-rc-state ' + st.cls + '">' + esc(st.txt) + '</span>';
      el.onclick = function () { enterRoom(card.id); };
      wrap.appendChild(el);
    });
    var top = lastLobby.global_top || [];
    var ol = $("qmGlobalTop");
    if (!top.length) ol.innerHTML = '<li class="qm-top-empty">Aucun score pour l\'instant. Sois le premier !</li>';
    else ol.innerHTML = top.map(function (e, i) {
      return '<li><span class="rank">' + medal(i) + '</span><span class="who">' + esc(e.name) + '</span><b class="pts">' + (e.points | 0) + ' pts</b></li>';
    }).join("");
  }

  // ---------- room ----------
  function enterRoom(id) {
    currentRoomId = id;
    play = null;
    if (socket && connected) { socket.emit("leave_lobby"); socket.emit("join_room", { id: id }); }
    show("s-room");
  }
  function leaveRoom() {
    if (socket && connected && currentRoomId) socket.emit("leave_room");
    currentRoomId = null; lastRoom = null; stopRefresh();
    enterHall();
  }

  function amParticipant(r) {
    // You're a participant if you were present when the deck was dealt — the
    // server lists you in `standings` once playing starts. During countdown,
    // anyone in `players` is in.
    var me = getPseudo();
    if (r.state === "countdown") return (r.players || []).some(function (p) { return p.name === me; });
    return (r.standings || []).some(function (s) { return s.name === me; });
  }

  function renderRoom() {
    if (!lastRoom) return;
    var r = lastRoom;
    $("qmRoomEmoji").textContent = r.theme_emoji || "🎯";
    $("qmRoomTitle").textContent = r.theme_name || "—";
    var body = $("qmRoomBody"); if (!body) return;

    if (r.state === "idle") { stopRefresh(); renderIdle(body, r); return; }
    if (r.state === "countdown") { startRefresh(); renderCountdown(body, r); return; }
    if (r.state === "playing") {
      startRefresh();
      if (amParticipant(r) && play) renderPlaying(body, r);
      else renderSpectator(body, r);
      return;
    }
    if (r.state === "podium") { startRefresh(); renderPodium(body, r); return; }
  }

  function renderIdle(body, r) {
    var me = getPseudo();
    var inRoom = (r.players || []).some(function (p) { return p.name === me; });
    var auto = r.auto_start_in_ms > 0 ? Math.ceil(r.auto_start_in_ms / 1000) : 0;
    body.innerHTML =
      '<div class="qm-card">' +
        '<p class="qm-rule">30 secondes · <b class="g">bonne +1</b> · <b class="r">mauvaise −1</b> · <b>passe 0</b></p>' +
      '</div>' +
      '<div class="qm-card">' +
        '<h3>Joueurs (' + (r.players || []).length + ')</h3>' +
        renderPills(r.players) +
      '</div>' +
      (inRoom
        ? '<button class="qm-primary qm-xl" id="qmStart">▶️ Démarrer</button>' +
          (auto > 0 ? '<p class="qm-hint">Départ auto dans ' + auto + ' s</p>' : '<p class="qm-hint">Tu peux lancer seul, ou attendre des joueurs.</p>')
        : '<button class="qm-primary qm-xl" id="qmJoin">🎮 Rejoindre</button>') +
      renderRoomTop(r.top);
    var sb = $("qmStart"); if (sb) sb.onclick = function () { if (socket) socket.emit("msg", { t: "demarrer" }); };
    var jb = $("qmJoin"); if (jb) jb.onclick = function () { if (socket && currentRoomId) socket.emit("join_room", { id: currentRoomId }); };
  }

  function renderCountdown(body, r) {
    var n = Math.ceil(r.countdown_remaining_ms / 1000);
    body.innerHTML =
      '<div class="qm-card qm-center-card">' +
        '<div class="qm-go">' + (n > 0 ? n : "GO !") + '</div>' +
        '<p class="qm-lead">Prépare-toi…</p>' +
      '</div>' +
      '<div class="qm-card"><h3>Joueurs (' + (r.players || []).length + ')</h3>' + renderPills(r.players) + '</div>';
  }

  function renderPlaying(body, r) {
    var qs = r.questions || [];
    var timeLeft = Math.max(0, r.time_left_ms || 0);
    var secs = Math.ceil(timeLeft / 1000);
    var pct = r.blitz_total_ms ? Math.max(0, Math.min(100, (timeLeft / r.blitz_total_ms) * 100)) : 0;
    var myScore = play.correct - play.wrong;

    if (play.locked) {
      // shouldn't happen during playing (locked only at time-up), but be safe
      renderSpectator(body, r); return;
    }

    var q = qs.length ? qs[play.idx % qs.length] : null;
    var timerCls = secs <= 5 ? " danger" : (secs <= 10 ? " warn" : "");
    body.innerHTML =
      '<div class="qm-timerbar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="qm-playhead">' +
        '<div class="qm-clock' + timerCls + '">' + secs + ' s</div>' +
        '<div class="qm-myscore">Score <b>' + myScore + '</b></div>' +
      '</div>' +
      '<div class="qm-card qm-qcard">' +
        '<div class="qm-q">' + (q ? esc(q.q) : "…") + '</div>' +
        '<div class="qm-choices" id="qmChoices">' +
          (q ? q.choices.map(function (o, i) { return '<button class="qm-choice" data-i="' + i + '">' + esc(o) + '</button>'; }).join("") : "") +
        '</div>' +
        '<button class="qm-skip" id="qmSkip">Je passe ⏭️</button>' +
      '</div>' +
      '<div class="qm-card"><h3>Classement en direct</h3>' + renderLiveStandings(r) + '</div>';

    var choices = $("qmChoices");
    if (choices && q) {
      Array.prototype.forEach.call(choices.querySelectorAll("button"), function (btn) {
        btn.onclick = function () {
          var i = parseInt(btn.getAttribute("data-i"), 10);
          var ok = i === q.correct;
          if (ok) { play.correct++; play.curStreak++; if (play.curStreak > play.streak) play.streak = play.curStreak; }
          else { play.wrong++; play.curStreak = 0; }
          flashThenNext(btn, ok);
        };
      });
    }
    var skip = $("qmSkip");
    if (skip) skip.onclick = function () { play.skipped++; play.curStreak = 0; advance(); };
  }

  function flashThenNext(btn, ok) {
    // brief visual feedback, then advance. Lock the grid to prevent double-tap.
    var grid = $("qmChoices");
    if (grid) Array.prototype.forEach.call(grid.querySelectorAll("button"), function (b) { b.disabled = true; });
    btn.classList.add(ok ? "good" : "bad");
    if (navigator.vibrate) { try { navigator.vibrate(ok ? 25 : [30, 30, 30]); } catch (e) {} }
    setTimeout(advance, 180);
  }

  function advance() {
    play.idx++;
    sendProgress();
    // Re-render immediately (optimistic) so the next question shows fast.
    if (lastRoom && lastRoom.state === "playing") renderRoom();
  }

  function sendProgress() {
    if (socket) socket.emit("msg", { t: "progress", correct: play.correct, wrong: play.wrong, skipped: play.skipped, streak: play.streak });
  }

  function renderSpectator(body, r) {
    var secs = Math.ceil((r.time_left_ms || 0) / 1000);
    body.innerHTML =
      '<div class="qm-card qm-center-card">' +
        '<div class="qm-big">🔥 Partie en cours</div>' +
        '<p class="qm-lead">Tu joueras à la prochaine manche' + (secs ? ' (' + secs + ' s restantes)' : '') + '.</p>' +
      '</div>' +
      '<div class="qm-card"><h3>Classement en direct</h3>' + renderLiveStandings(r) + '</div>' +
      renderRoomTop(r.top);
  }

  function renderPodium(body, r) {
    var s = Math.ceil(r.podium_remaining_ms / 1000);
    var sum = r.summary || {};
    var st = sum.standings || [];
    var me = getPseudo();
    var mvp = sum.mvp;
    var extras = sum.extras || [];
    var totals = sum.totals || {};

    var mvpHtml = mvp
      ? '<div class="qm-mvp"><div class="qm-mvp-emoji">' + esc(mvp.emoji) + '</div>' +
        '<div class="qm-mvp-label">' + esc(mvp.label) + '</div>' +
        '<div class="qm-mvp-name">' + esc(mvp.name) + '</div>' +
        '<div class="qm-mvp-val">' + esc(mvp.value) + '</div></div>'
      : '';

    var extrasHtml = extras.length
      ? '<div class="qm-extras">' + extras.map(function (x) {
          return '<div class="qm-extra"><span class="e">' + esc(x.emoji) + '</span>' +
            '<span class="l">' + esc(x.label) + '</span>' +
            '<span class="n">' + esc(x.name) + '</span>' +
            '<span class="v">' + esc(x.value) + '</span></div>';
        }).join("") + '</div>'
      : '';

    var rowsHtml = st.length
      ? '<div class="qm-standings">' + st.map(function (row, i) {
          return '<div class="qm-srow' + (row.name === me ? " me" : "") + (i === 0 ? " gold" : "") + '">' +
            '<span class="rank">' + medal(i) + '</span>' +
            '<span class="who">' + esc(row.name) + '</span>' +
            '<span class="detail">' + row.correct + '✓ ' + row.wrong + '✗ · ' + row.accuracy + '%</span>' +
            '<b class="score">' + (row.score > 0 ? "+" : "") + row.score + '</b></div>';
        }).join("") + '</div>'
      : '<p class="qm-hint">Aucun joueur.</p>';

    var totalsHtml = totals.total_seen
      ? '<p class="qm-hint">' + totals.total_seen + ' questions vues · ' + totals.total_correct + ' bonnes au total</p>'
      : '';

    body.innerHTML =
      '<div class="qm-card qm-center-card"><div class="qm-big">🏁 Terminé !</div></div>' +
      (mvpHtml ? '<div class="qm-card">' + mvpHtml + '</div>' : '') +
      (extrasHtml ? '<div class="qm-card">' + extrasHtml + '</div>' : '') +
      '<div class="qm-card"><h3>Classement</h3>' + rowsHtml + totalsHtml + '</div>' +
      '<p class="qm-hint">Nouvelle manche dans ' + s + ' s…</p>' +
      renderRoomTop(r.top);
  }

  // ---------- shared blocks ----------
  function renderPills(players) {
    var me = getPseudo();
    if (!players || !players.length) return '<p class="qm-hint">—</p>';
    return '<div class="qm-pills">' + players.map(function (p) {
      return '<span class="qm-pill' + (p.name === me ? " me" : "") + '">' + esc(p.name) + '</span>';
    }).join("") + '</div>';
  }

  function renderLiveStandings(r) {
    var me = getPseudo();
    var st = (r.standings || []).slice();
    // During play, fold in my own optimistic score so I see myself move instantly.
    if (play && r.state === "playing") {
      var mine = st.find(function (x) { return x.name === me; });
      var myScore = play.correct - play.wrong;
      if (mine) { mine.correct = play.correct; mine.wrong = play.wrong; mine.score = myScore; }
      st.sort(function (a, b) { return (b.score || 0) - (a.score || 0) || (a.wrong || 0) - (b.wrong || 0); });
    }
    if (!st.length) return '<p class="qm-hint">—</p>';
    return '<div class="qm-standings">' + st.map(function (row, i) {
      return '<div class="qm-srow' + (row.name === me ? " me" : "") + '">' +
        '<span class="rank">' + medal(i) + '</span>' +
        '<span class="who">' + esc(row.name) + '</span>' +
        '<b class="score">' + ((row.score || 0) > 0 ? "+" : "") + (row.score || 0) + '</b></div>';
    }).join("") + '</div>';
  }

  function renderRoomTop(top) {
    if (!top || !top.length) return '<div class="qm-card"><h3>🏆 Records du thème</h3><p class="qm-hint">Aucun record. Sois le premier !</p></div>';
    return '<div class="qm-card"><h3>🏆 Records du thème</h3><ol class="qm-top-list">' + top.map(function (e, i) {
      return '<li><span class="rank">' + medal(i) + '</span><span class="who">' + esc(e.name) + '</span><b class="pts">' + esc(e.displayValue || "") + '</b></li>';
    }).join("") + '</ol></div>';
  }

  // ---------- refresh loop (smooth countdowns) ----------
  function startRefresh() { if (refreshTick) return; refreshTick = setInterval(function () { if (lastRoom) renderRoom(); }, 250); }
  function stopRefresh() { if (refreshTick) { clearInterval(refreshTick); refreshTick = null; } }

  // ---------- bootstrap ----------
  document.addEventListener("DOMContentLoaded", function () {
    setWho();
    setupPseudo();
    $("qmBack").onclick = leaveRoom;
    connect();
    if (getPseudo()) enterHall(); else show("s-pseudo");
  });
})();
