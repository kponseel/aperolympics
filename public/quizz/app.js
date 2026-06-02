// QuizzMaster SPA. Socket.IO namespace /qm, 3 screens (pseudo / hall / room),
// state-driven inner content in the room screen (idle, prerace, racing as
// participant or spectator, podium).

(function () {
  "use strict";

  // ---- persistent identity ----
  function uuid() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, function (c) {
      return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
    });
  }
  function getCid() {
    var c = localStorage.getItem("qm.cid");
    if (!c) { c = uuid(); localStorage.setItem("qm.cid", c); }
    return c;
  }
  function getPseudo() { return (localStorage.getItem("qm.pseudo") || "").trim(); }
  function setPseudo(name) { localStorage.setItem("qm.pseudo", name); }

  // ---- DOM helpers ----
  function $(id) { return document.getElementById(id); }
  function show(screenId) {
    ["s-pseudo", "s-hall", "s-room"].forEach(function (s) {
      var el = $(s); if (el) el.classList.toggle("on", s === screenId);
    });
    var back = $("qmBack");
    if (back) back.style.display = (screenId === "s-room") ? "" : "none";
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function setStatus(t) { var el = $("qmStatus"); if (el) el.textContent = t || ""; }
  function setWho() {
    var el = $("qmWho"); if (!el) return;
    var p = getPseudo();
    el.textContent = p ? "👋 " + p : "";
  }

  // ---- socket + session ----
  var socket = null;
  var connected = false;
  var lastLobby = null;       // last lobby_state payload
  var lastRoom = null;        // last room_state payload
  var currentRoomId = null;
  var stopwatchTick = null;   // setInterval handle for live timer redraw
  var clientAnswer = -1;      // local memory of which option we tapped this question
  var clientAnswered = false;
  var clientCorrect = 0;
  var clientWrong = 0;

  function connect() {
    if (socket) return;
    socket = io("/qm", { transports: ["websocket", "polling"] });
    socket.on("connect", function () {
      connected = true; setStatus("");
      socket.emit("set_identity", { cid: getCid(), name: getPseudo() });
    });
    socket.on("disconnect", function () { connected = false; setStatus("Connexion perdue — reconnexion…"); });
    socket.on("identity_ok", function () {
      // After identity, send what we're doing now.
      if (currentRoomId) socket.emit("join_room", { id: currentRoomId });
      else socket.emit("join_lobby");
    });
    socket.on("error_msg", function (m) { setStatus(m && m.msg ? "Erreur : " + m.msg : "Erreur"); });
    socket.on("lobby_state", function (m) { lastLobby = m || {}; renderLobby(); });
    socket.on("room_state", function (m) {
      lastRoom = m || {};
      window.__qmLastRoom = lastRoom; // debug/test hook
      // Reset local answer tracking when a new race starts (engine phase
      // transitions from non-playing → playing).
      var ep = lastRoom.engine_phase;
      var st = lastRoom.state;
      if (st === "prerace") {
        clientAnswered = false; clientAnswer = -1; clientCorrect = 0; clientWrong = 0;
      }
      renderRoom();
    });
  }

  // ---- pseudo screen ----
  function setupPseudo() {
    var input = $("qmName"); if (!input) return;
    input.value = getPseudo();
    $("qmContinue").onclick = function () {
      var n = (input.value || "").trim().slice(0, 16);
      if (!n) { $("qmPseudoError").textContent = "Choisis un pseudo."; return; }
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

  // ---- hall renderer ----
  function stateLabel(card) {
    if (card.state === "racing") return { txt: "🔥 Course en cours", cls: "live" };
    if (card.state === "prerace") {
      var s = Math.ceil(card.prerace_remaining_ms / 1000);
      return { txt: "🚦 Démarrage dans " + s + " s", cls: "prerace" };
    }
    if (card.state === "podium") return { txt: "🏆 Podium…", cls: "podium" };
    if (card.player_count > 0) return { txt: "⏳ " + card.player_count + " en attente", cls: "" };
    return { txt: "💤 Aucun joueur", cls: "" };
  }

  function renderLobby() {
    if (!lastLobby) return;
    var rooms = lastLobby.rooms || [];
    var qq = $("qmRoomsQuiz"), qs = $("qmRoomsSolo");
    if (!qq || !qs) return;
    qq.innerHTML = ""; qs.innerHTML = "";
    rooms.forEach(function (card) {
      var st = stateLabel(card);
      var el = document.createElement("button");
      el.type = "button";
      el.className = "qm-room-card" + (card.state === "racing" ? " live" : "");
      el.innerHTML =
        '<div class="qm-rc-head"><span class="qm-rc-emoji">' + escapeHtml(card.theme_emoji) + '</span>' +
        '<span>' + escapeHtml(card.theme_name) + '</span></div>' +
        '<div class="qm-rc-state ' + st.cls + '">' + escapeHtml(st.txt) + '</div>';
      el.onclick = function () { enterRoom(card.id); };
      (card.mode === "quiz" ? qq : qs).appendChild(el);
    });
    // Global top
    var top = (lastLobby.global_top || []);
    var ol = $("qmGlobalTop");
    if (!top.length) {
      ol.innerHTML = '<li class="qm-top-empty">Aucun score enregistré pour le moment.</li>';
    } else {
      var medals = ["🥇", "🥈", "🥉"];
      ol.innerHTML = top.map(function (e, i) {
        var rank = medals[i] || ("#" + (i + 1));
        return '<li><span class="rank">' + rank + '</span>' +
               '<span class="who">' + escapeHtml(e.name) + '</span>' +
               '<b class="pts">' + (e.points | 0) + ' pts</b></li>';
      }).join("");
    }
  }

  // ---- room: join / leave ----
  function enterRoom(id) {
    currentRoomId = id;
    if (socket && connected) {
      socket.emit("leave_lobby");
      socket.emit("join_room", { id: id });
    }
    show("s-room");
  }
  function leaveRoom() {
    if (socket && connected && currentRoomId) socket.emit("leave_room");
    currentRoomId = null;
    lastRoom = null;
    stopStopwatch();
    enterHall();
  }

  // ---- room renderer (state-driven inner content) ----
  function renderRoom() {
    if (!lastRoom) return;
    var r = lastRoom;
    $("qmRoomEmoji").textContent = r.theme_emoji || "🎯";
    $("qmRoomTitle").textContent = r.theme_name || "—";
    $("qmRoomSub").textContent = (r.mode_emoji || "") + " " + (r.mode_name || "");
    var body = $("qmRoomBody"); if (!body) return;
    var me = r.players && r.players.find(function (p) { return p.cid === getCid(); });
    var inRoom = !!me;
    if (r.state === "idle") {
      renderIdle(body, r, inRoom);
      stopStopwatch();
    } else if (r.state === "prerace") {
      renderPrerace(body, r, inRoom);
      startStopwatch();
    } else if (r.state === "racing") {
      if (inRoom && joinedBeforeRaceStart(r)) renderRaceParticipant(body, r);
      else renderRaceSpectator(body, r);
      startStopwatch();
    } else if (r.state === "podium") {
      renderPodium(body, r);
      startStopwatch();
    } else {
      body.innerHTML = "<p class='muted center'>État inconnu.</p>";
      stopStopwatch();
    }
  }

  // We treat "in the players list" as eligible. The engine snapshot already
  // includes only players who joined before the race started (since latejoins
  // don't get added to eligibleNames in the engine).
  // For Speed Quiz, anyone in the room participates in answers — but the engine
  // also limits answering to "currently active". Simpler heuristic: if we have
  // sent any answer for the current round, we're a participant.
  function joinedBeforeRaceStart(r) {
    // For Contre-la-montre, the engine pre-snapshots eligibleNames at countdown.
    // The progress list shows only eligible players; check if we're in there.
    if (r.mode === "quiz_solo") {
      var prog = (r.round && r.round.progress) || [];
      var myName = getPseudo();
      return prog.some(function (p) { return p.name === myName; });
    }
    // Speed Quiz: anyone in the room can answer the next question. Treat as
    // participant if we're in the players list (we are if `me` was found).
    return true;
  }

  function renderIdle(body, r, inRoom) {
    var auto = (r.auto_start_in_ms > 0) ? Math.ceil(r.auto_start_in_ms / 1000) : 0;
    var html =
      '<div class="qm-section">' +
        '<h3>👥 Présents</h3>' +
        renderPlayerPills(r.players) +
        (r.players.length === 0 ? '<p class="muted center">Aucun joueur pour le moment. Lance la course en solo !</p>' : '') +
      '</div>' +
      (inRoom
        ? '<button class="qm-primary" id="qmStart">▶️ Démarrer maintenant</button>' +
          (auto > 0 ? '<p class="muted center" style="margin-top:8px">Démarrage automatique dans ' + auto + ' s si personne ne clique.</p>' : '')
        : '<button class="qm-primary" id="qmJoin">🎮 Rejoindre cette salle</button>') +
      renderRoomTop(r.top);
    body.innerHTML = html;
    var startBtn = $("qmStart");
    if (startBtn) startBtn.onclick = function () { if (socket) socket.emit("msg", { t: "demarrer" }); };
    var joinBtn = $("qmJoin");
    if (joinBtn) joinBtn.onclick = function () { if (socket && currentRoomId) socket.emit("join_room", { id: currentRoomId }); };
  }

  function renderPrerace(body, r, inRoom) {
    var s = Math.ceil(r.prerace_remaining_ms / 1000);
    body.innerHTML =
      '<div class="qm-section">' +
        '<div class="qm-bigger">Démarrage dans ' + s + '</div>' +
        '<p class="muted center">Le quiz commence dans quelques secondes — rejoins-nous !</p>' +
      '</div>' +
      '<div class="qm-section">' +
        '<h3>👥 Présents (' + r.players.length + ')</h3>' +
        renderPlayerPills(r.players) +
      '</div>' +
      (inRoom ? '' :
        '<button class="qm-primary" id="qmJoin">🎮 Rejoindre cette salle</button>') +
      renderRoomTop(r.top);
    var joinBtn = $("qmJoin");
    if (joinBtn) joinBtn.onclick = function () { if (socket && currentRoomId) socket.emit("join_room", { id: currentRoomId }); };
  }

  function renderRaceParticipant(body, r) {
    if (r.mode === "quiz_solo") renderSoloParticipant(body, r);
    else renderQuizParticipant(body, r);
  }

  function renderRaceSpectator(body, r) {
    var remain = "—";
    if (r.mode === "quiz" && r.round && r.round.time_left_ms != null) {
      remain = Math.ceil(r.round.time_left_ms / 1000) + " s sur cette question";
    }
    body.innerHTML =
      '<div class="qm-section">' +
        '<div class="qm-big">🔥 Course en cours</div>' +
        '<p class="muted center">Tu rejoindras la prochaine course. ' + escapeHtml(remain) + '</p>' +
      '</div>' +
      '<div class="qm-section">' +
        '<h3>👥 Participants</h3>' +
        renderLiveProgress(r) +
      '</div>' +
      renderRoomTop(r.top);
  }

  // --- Contre-la-montre participant ---
  function renderSoloParticipant(body, r) {
    var round = r.round || {};
    var qs = round.questions || [];
    var raceStart = round.race_start_at || 0;
    var elapsed = raceStart ? Math.max(0, Date.now() - raceStart) : 0;
    var done = (function () {
      var myName = getPseudo();
      var entry = (round.progress || []).find(function (p) { return p.name === myName; });
      return entry && entry.finished_ms != null;
    })();

    // Pre-race countdown if race_start_at in the future
    if (raceStart && Date.now() < raceStart) {
      var n = Math.ceil((raceStart - Date.now()) / 1000);
      body.innerHTML =
        '<div class="qm-section">' +
          '<div class="qm-bigger">' + (n > 0 ? n : "GO !") + '</div>' +
          '<p class="muted center">Préparez-vous…</p>' +
        '</div>' +
        '<div class="qm-section"><h3>👥 Présents (' + r.players.length + ')</h3>' + renderPlayerPills(r.players) + '</div>';
      return;
    }

    var q = qs[clientCorrect + clientWrong];
    if (done) {
      var entry = (round.progress || []).find(function (p) { return p.name === getPseudo(); });
      var ms = entry ? entry.finished_ms : 0;
      body.innerHTML =
        '<div class="qm-section">' +
          '<div class="qm-big">🏁 Bravo — tu as fini en ' + (ms / 1000).toFixed(2) + ' s !</div>' +
          '<p class="muted center">Attends la fin de la course pour la prochaine.</p>' +
        '</div>' +
        '<div class="qm-section">' +
          '<h3>👥 Progression</h3>' + renderLiveProgress(r) +
        '</div>';
      return;
    }
    if (!q) {
      body.innerHTML = '<div class="qm-section"><div class="qm-big">Chargement…</div></div>';
      return;
    }
    body.innerHTML =
      '<div class="qm-section">' +
        '<div class="qm-topbar-info"><span class="qm-time">' + (elapsed / 1000).toFixed(1) + ' s</span>' +
        '<span class="muted">' + clientCorrect + ' / 5 bonnes</span></div>' +
        '<div class="qm-q">' + escapeHtml(q.q) + '</div>' +
        '<div class="qm-grid" id="qmGrid">' +
          (q.choices || []).map(function (o, i) { return '<button data-idx="' + i + '">' + escapeHtml(o) + '</button>'; }).join("") +
        '</div>' +
      '</div>' +
      '<div class="qm-section"><h3>👥 Progression</h3>' + renderLiveProgress(r) + '</div>';
    var grid = $("qmGrid");
    if (grid) {
      Array.from(grid.querySelectorAll("button")).forEach(function (btn) {
        btn.onclick = function () {
          var idx = parseInt(btn.getAttribute("data-idx"), 10);
          if (idx === q.correct) { clientCorrect++; btn.classList.add("good"); }
          else { clientWrong++; btn.classList.add("bad"); }
          // Disable to prevent double-click; the next render will replace the grid.
          Array.from(grid.querySelectorAll("button")).forEach(function (b) { b.disabled = true; });
          socket.emit("msg", { t: "answer_progress", correct: clientCorrect, wrong: clientWrong });
        };
      });
    }
  }

  // --- Speed Quiz participant ---
  function renderQuizParticipant(body, r) {
    var round = r.round || {};
    var phase = r.engine_phase || "playing";
    if (phase === "lobby") {
      // Shouldn't really happen during racing, but be safe.
      renderIdle(body, r, true);
      return;
    }
    if (phase === "playing") {
      var timeLeft = Math.max(0, round.time_left_ms || 0);
      var totalQs = round.total || 10;
      var idx = (round.idx || 0) + 1;
      body.innerHTML =
        '<div class="qm-section">' +
          '<div class="qm-topbar-info">' +
            '<span class="qm-time">' + (timeLeft / 1000).toFixed(1) + ' s</span>' +
            '<span class="muted">Q' + idx + ' / ' + totalQs + '</span>' +
            '<span class="qm-points">' + (round.points_now || 0) + ' pts</span>' +
          '</div>' +
          '<div class="qm-q">' + escapeHtml(round.q || "…") + '</div>' +
          '<div class="qm-grid" id="qmGrid">' +
            (round.options || []).map(function (o, i) { return '<button data-idx="' + i + '"' + (clientAnswered ? ' disabled' : '') + '>' + escapeHtml(o) + '</button>'; }).join("") +
          '</div>' +
          (clientAnswered ? '<p class="muted center">Réponse envoyée — on attend les autres…</p>' : '') +
        '</div>' +
        '<div class="qm-section"><h3>📊 Scores</h3>' + renderScoreList(r.players) + '</div>';
      var grid = $("qmGrid");
      if (grid) {
        Array.from(grid.querySelectorAll("button")).forEach(function (btn) {
          btn.onclick = function () {
            if (clientAnswered) return;
            var idx = parseInt(btn.getAttribute("data-idx"), 10);
            clientAnswer = idx; clientAnswered = true;
            socket.emit("msg", { t: "answer", choice: idx });
            // Disable immediately for snappy feedback.
            Array.from(grid.querySelectorAll("button")).forEach(function (b) { b.disabled = true; });
            btn.style.outline = "2px solid #5b6cff";
          };
        });
      }
      return;
    }
    if (phase === "reveal") {
      var correctIdx = round.correct;
      body.innerHTML =
        '<div class="qm-section">' +
          '<div class="qm-q">' + escapeHtml(round.q || "") + '</div>' +
          '<div class="qm-grid">' +
            (round.options || []).map(function (o, i) {
              var cls = "";
              if (i === correctIdx) cls = "good";
              else if (i === clientAnswer && i !== correctIdx) cls = "bad";
              return '<button class="' + cls + '" disabled>' + escapeHtml(o) + '</button>';
            }).join("") +
          '</div>' +
          '<p class="center" style="margin-top:10px">' +
            (clientAnswer === correctIdx ? '<b style="color:#26890c">✅ Bonne réponse !</b>' : '<b style="color:#ff7a7a">❌ Raté</b>') +
          '</p>' +
        '</div>' +
        '<div class="qm-section"><h3>📊 Scores</h3>' + renderScoreList(r.players) + '</div>';
      clientAnswered = false; // reset for next Q
      clientAnswer = -1;
      return;
    }
    // finished — handled by podium screen state="podium" below
    body.innerHTML = '<div class="qm-section"><div class="qm-big">Question terminée…</div></div>';
  }

  function renderPodium(body, r) {
    var s = Math.ceil(r.podium_remaining_ms / 1000);
    var sum = r.last_summary || {};
    var medals = ["🥇", "🥈", "🥉"];
    var rows = "";
    if (r.mode === "quiz_solo" && sum.progress) {
      // Sort by finished_ms (lowest first), then by correct desc.
      var sorted = (sum.progress || []).slice().sort(function (a, b) {
        var af = a.finished_ms == null ? Infinity : a.finished_ms;
        var bf = b.finished_ms == null ? Infinity : b.finished_ms;
        if (af !== bf) return af - bf;
        return (b.correct || 0) - (a.correct || 0);
      });
      rows = sorted.slice(0, 5).map(function (p, i) {
        var rank = medals[i] || ("#" + (i + 1));
        var v = p.finished_ms != null ? (p.finished_ms / 1000).toFixed(2) + " s" : (p.correct || 0) + "/5";
        return '<div class="qm-podium-row' + (i === 0 ? ' gold' : '') + '">' +
          '<span class="rank">' + rank + '</span>' +
          '<span class="who">' + escapeHtml(p.name) + '</span>' +
          '<span class="pts">' + v + '</span></div>';
      }).join("");
    } else {
      var ps = (sum.players || []).slice().sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
      rows = ps.slice(0, 5).map(function (p, i) {
        var rank = medals[i] || ("#" + (i + 1));
        return '<div class="qm-podium-row' + (i === 0 ? ' gold' : '') + '">' +
          '<span class="rank">' + rank + '</span>' +
          '<span class="who">' + escapeHtml(p.name) + '</span>' +
          '<span class="pts">' + (p.score || 0) + ' pts</span></div>';
      }).join("");
    }
    if (!rows) rows = '<p class="muted center">Personne n\'a marqué.</p>';
    body.innerHTML =
      '<div class="qm-section">' +
        '<div class="qm-big">🏁 Course terminée</div>' +
        '<div class="qm-progress" style="margin-top:12px">' + rows + '</div>' +
        '<p class="muted center" style="margin-top:10px">Prochaine course dans ' + s + ' s.</p>' +
      '</div>' +
      renderRoomTop(r.top);
  }

  // ---- shared building blocks ----
  function renderPlayerPills(players) {
    var me = getPseudo();
    if (!players || !players.length) return '<p class="muted">—</p>';
    return '<div class="qm-player-pills">' +
      players.map(function (p) {
        return '<span class="qm-pill' + (p.name === me ? ' me' : '') + '">' + escapeHtml(p.name) + '</span>';
      }).join("") + '</div>';
  }

  function renderScoreList(players) {
    var me = getPseudo();
    var sorted = (players || []).slice().sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
    return '<div class="qm-progress">' +
      sorted.map(function (p) {
        return '<div class="qm-progress-row' + (p.name === me ? ' me' : '') + '">' +
          '<span class="who">' + escapeHtml(p.name) + '</span>' +
          '<span class="qm-points">' + (p.score || 0) + ' pts</span></div>';
      }).join("") + '</div>';
  }

  function renderLiveProgress(r) {
    var me = getPseudo();
    if (r.mode === "quiz_solo") {
      var prog = (r.round && r.round.progress) || [];
      return '<div class="qm-progress">' +
        prog.map(function (p) {
          var pips = "";
          for (var i = 0; i < 5; i++) pips += '<span class="qm-pip ' + (i < (p.correct || 0) ? "on" : "") + '"></span>';
          var v = p.finished_ms != null ? '<span class="qm-finish-ms">' + (p.finished_ms / 1000).toFixed(2) + ' s</span>' : '<span class="muted">' + (p.correct || 0) + '/5</span>';
          return '<div class="qm-progress-row' + (p.name === me ? ' me' : '') + '">' +
            '<span class="who">' + escapeHtml(p.name) + '</span>' +
            '<span class="qm-pips">' + pips + '</span>' +
            v + '</div>';
        }).join("") + '</div>';
    }
    return renderScoreList(r.players);
  }

  function renderRoomTop(top) {
    if (!top || !top.length) return '<div class="qm-section"><h3>🏆 Top 10 du thème</h3><p class="muted center">Aucun score pour cette salle. Sois le premier !</p></div>';
    var medals = ["🥇", "🥈", "🥉"];
    var rows = top.map(function (e, i) {
      var rank = medals[i] || ("#" + (i + 1));
      return '<li><span class="rank">' + rank + '</span>' +
             '<span class="who">' + escapeHtml(e.name) + '</span>' +
             '<b class="pts">' + escapeHtml(e.displayValue || "") + '</b></li>';
    }).join("");
    return '<div class="qm-section"><h3>🏆 Top 10 du thème</h3><ol class="qm-top-list">' + rows + '</ol></div>';
  }

  // ---- stopwatch tick (smooth countdowns when no state event arrives) ----
  function startStopwatch() {
    if (stopwatchTick) return;
    stopwatchTick = setInterval(function () {
      if (!lastRoom) return;
      // Tick down the visible countdowns locally between server broadcasts.
      // Easiest: just re-render the room. It's cheap enough at 250 ms cadence.
      renderRoom();
    }, 250);
  }
  function stopStopwatch() {
    if (stopwatchTick) { clearInterval(stopwatchTick); stopwatchTick = null; }
  }

  // ---- bootstrap ----
  document.addEventListener("DOMContentLoaded", function () {
    setWho();
    setupPseudo();
    $("qmBack").onclick = leaveRoom;
    connect();
    if (getPseudo()) {
      enterHall();
    } else {
      show("s-pseudo");
    }
  });
})();
