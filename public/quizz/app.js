// QuizzMaster SPA — single "Blitz 30 s" mode, mobile-first, accessible 60+.
// Socket.IO /qm. Screens: pseudo(+PIN) / hall / room. Room states:
// idle → countdown(3-2-1) → playing(30s) → podium. PIN-protected names,
// persistent per-player stats, in-app help.

(function () {
  "use strict";

  // ---------- identity ----------
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
  function medal(i) { return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1); }
  function setWho() { var el = $("qmWho"); if (el) { var p = getPseudo(); el.textContent = p ? "👋 " + p : ""; } }

  // ---------- socket + session ----------
  var socket = null, connected = false;
  var lastLobby = null, lastRoom = null, currentRoomId = null;
  var refreshTick = null;
  var myProtected = false;           // is my current name PIN-protected?
  var pinMode = false;               // pseudo screen is asking for a PIN to unlock
  var play = null;                   // local blitz state
  // room render memo (so we don't rebuild the answer grid every tick)
  var roomStructSig = "";

  function connect() {
    if (socket) return;
    socket = io("/qm", { transports: ["websocket", "polling"] });
    socket.on("connect", function () {
      connected = true; setStatus("");
      if (getPseudo()) socket.emit("set_identity", { cid: getCid(), name: getPseudo() });
    });
    socket.on("disconnect", function () { connected = false; setStatus("Connexion perdue — reconnexion…"); });

    socket.on("identity_ok", function (m) {
      setStatus(""); pinMode = false;
      myProtected = !!(m && m.protected);
      $("qmLocked").style.display = "none";
      $("qmContinue").textContent = "C'est parti →";
      if (currentRoomId) { show("s-room"); socket.emit("join_room", { id: currentRoomId }); }
      else enterHall();   // covers fresh login AND PIN unlock
      updateNameBadge();
    });
    socket.on("pin_required", function (m) {
      enterPinMode(m && m.name, "🔒 Ce nom est protégé. Entre ton code PIN.");
    });
    socket.on("pin_wrong", function (m) {
      enterPinMode(m && m.name, "❌ Code incorrect. Il te reste " + (m && m.attempts_left) + " essai" + ((m && m.attempts_left) > 1 ? "s" : "") + ".");
      var pin = $("qmPin"); if (pin) { pin.value = ""; pin.focus(); }
    });
    socket.on("identity_locked", function (m) {
      pinMode = false; show("s-pseudo");
      $("qmPseudoError").textContent = "";
      $("qmLocked").style.display = "block";
      var wa = $("qmWhats");
      if (m && m.whatsapp) { wa.href = "https://wa.me/" + String(m.whatsapp).replace(/\D/g, ""); wa.style.display = ""; }
      else { wa.href = "mailto:kevin.ponseel@gmail.com"; wa.textContent = "✉️ Contacter Kevin P."; }
    });
    socket.on("pin_set", function () { myProtected = true; updateNameBadge(); toast("🔒 Nom protégé !"); });
    socket.on("error_msg", function (m) {
      var code = m && m.msg;
      if (code === "bad_identity" || code === "no_identity") return;
      if (code === "bad_pin") { toast("PIN invalide (4 chiffres)."); return; }
      if (code === "not_owner") { toast("Ce nom appartient à un autre joueur."); return; }
      setStatus(code ? "Erreur : " + code : "Erreur");
    });
    socket.on("lobby_state", function (m) { lastLobby = m || {}; renderLobby(); });
    socket.on("room_state", function (m) {
      var prev = lastRoom; lastRoom = m || {}; window.__qmLastRoom = lastRoom;
      if (lastRoom.state === "countdown" && (!prev || prev.state === "idle" || prev.state === "podium")) {
        play = { idx: 0, correct: 0, wrong: 0, skipped: 0, streak: 0, curStreak: 0 };
      }
      roomStructSig = ""; // force structural re-render on a real server update
      renderRoom();
    });
  }

  // ---------- toast ----------
  var toastTimer = null;
  function toast(msg) {
    setStatus(msg);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { setStatus(""); }, 2500);
  }

  // ---------- pseudo + PIN ----------
  function enterPinMode(name, msg) {
    pinMode = true; show("s-pseudo");
    $("qmLocked").style.display = "none";
    if (name) $("qmName").value = name;
    $("qmPinLabel").innerHTML = "🔒 Code PIN <span class='qm-soft'>(4 chiffres)</span>";
    $("qmPseudoError").textContent = msg || "";
    $("qmPseudoError").className = "qm-error center warn";
    var pin = $("qmPin"); if (pin) { pin.value = ""; setTimeout(function () { pin.focus(); }, 50); }
    $("qmContinue").textContent = "Déverrouiller 🔓";
  }

  function submitPseudo() {
    var name = ($("qmName").value || "").trim().slice(0, 16);
    var pin = ($("qmPin").value || "").trim();
    if (!name) { $("qmPseudoError").textContent = "Entre ton prénom."; return; }
    if (pin && !/^\d{4}$/.test(pin)) { $("qmPseudoError").textContent = "Le PIN doit faire 4 chiffres."; return; }
    setPseudo(name); setWho();
    $("qmPseudoError").textContent = ""; $("qmPseudoError").className = "qm-error center";
    if (socket) socket.emit("set_identity", { cid: getCid(), name: name, pin: pin });
    // optimistic: if not in pin-mode, move on; identity_ok confirms / pin_required bounces back
    if (!pinMode) enterHall();
  }

  function setupPseudo() {
    var input = $("qmName"); if (!input) return;
    input.value = getPseudo();
    $("qmContinue").onclick = submitPseudo;
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("qmPin").focus(); } });
    $("qmPin").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submitPseudo(); } });
    $("qmNewName").onclick = function () {
      $("qmLocked").style.display = "none"; pinMode = false;
      $("qmName").value = ""; $("qmPin").value = "";
      $("qmContinue").textContent = "C'est parti →";
      $("qmName").focus();
    };
  }

  function updateNameBadge() {
    var b = $("qmNameBadge"); if (!b) return;
    b.textContent = (myProtected ? "🔒 " : "") + getPseudo();
    var pb = $("qmProtect");
    if (pb) pb.style.display = myProtected ? "none" : "";
  }

  function enterHall() {
    currentRoomId = null; pinMode = false;
    $("qmContinue").textContent = "C'est parti →";
    if (socket && connected) socket.emit("join_lobby");
    updateNameBadge();
    show("s-hall");
  }

  // ---------- protect-name (set PIN) ----------
  function protectName() {
    var pin = prompt("Choisis un code PIN à 4 chiffres pour protéger « " + getPseudo() + " » :");
    if (pin == null) return;
    pin = String(pin).trim();
    if (!/^\d{4}$/.test(pin)) { toast("Le PIN doit faire exactement 4 chiffres."); return; }
    if (socket) socket.emit("set_pin", { pin: pin });
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
    updateNameBadge();
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
    if (!top.length) { ol.innerHTML = '<li class="qm-top-empty">Aucun score pour l\'instant. Sois le premier !</li>'; return; }
    var me = getPseudo();
    ol.innerHTML = top.map(function (e, i) {
      return '<li class="' + (e.name === me ? "me" : "") + '">' +
        '<span class="rank">' + medal(i) + '</span>' +
        '<span class="who">' + (e.locked ? "🔒 " : "") + esc(e.name) + '</span>' +
        '<span class="qm-pstats">' + e.games + ' parties · ' + e.accuracy + '% · record ' + e.best + '</span>' +
        '<b class="pts">' + (e.points | 0) + '</b></li>';
    }).join("");
  }

  // ---------- room ----------
  function enterRoom(id) {
    currentRoomId = id; play = null; roomStructSig = "";
    if (socket && connected) { socket.emit("leave_lobby"); socket.emit("join_room", { id: id }); }
    show("s-room");
  }
  function leaveRoom() {
    if (socket && connected && currentRoomId) socket.emit("leave_room");
    currentRoomId = null; lastRoom = null; stopRefresh();
    enterHall();
  }

  function amParticipant(r) {
    var me = getPseudo();
    if (r.state === "countdown") return (r.players || []).some(function (p) { return p.name === me; });
    return (r.standings || []).some(function (s) { return s.name === me; });
  }

  function renderRoom() {
    if (!lastRoom) return;
    var r = lastRoom;
    $("qmRoomEmoji").textContent = r.theme_emoji || "🎯";
    $("qmRoomTitle").textContent = r.theme_name || "—";
    if (r.state === "idle") { stopRefresh(); renderIdle(r); return; }
    if (r.state === "countdown") { startRefresh(); renderCountdown(r); return; }
    if (r.state === "playing") {
      startRefresh();
      if (amParticipant(r) && play) renderPlaying(r); else renderSpectator(r);
      return;
    }
    if (r.state === "podium") { startRefresh(); renderPodium(r); return; }
  }

  function renderIdle(r) {
    var body = $("qmRoomBody");
    var me = getPseudo();
    var inRoom = (r.players || []).some(function (p) { return p.name === me; });
    var auto = r.auto_start_in_ms > 0 ? Math.ceil(r.auto_start_in_ms / 1000) : 0;
    body.innerHTML =
      '<div class="qm-card"><p class="qm-rule">30 secondes · <b class="g">bonne +1</b> · <b class="r">mauvaise −1</b> · <b>passe 0</b></p></div>' +
      '<div class="qm-card"><h3>Joueurs (' + (r.players || []).length + ')</h3>' + renderPills(r.players) + '</div>' +
      (inRoom
        ? '<button class="qm-primary qm-xl" id="qmStart">▶️ Démarrer</button>' +
          (auto > 0 ? '<p class="qm-hint">Départ auto dans ' + auto + ' s</p>' : '<p class="qm-hint">Tu peux lancer seul, ou attendre des joueurs.</p>')
        : '<button class="qm-primary qm-xl" id="qmJoin">🎮 Rejoindre</button>') +
      renderRoomTop(r.top);
    var sb = $("qmStart"); if (sb) sb.onclick = function () { if (socket) socket.emit("msg", { t: "demarrer" }); };
    var jb = $("qmJoin"); if (jb) jb.onclick = function () { if (socket && currentRoomId) socket.emit("join_room", { id: currentRoomId }); };
  }

  function renderCountdown(r) {
    var n = Math.ceil(r.countdown_remaining_ms / 1000);
    $("qmRoomBody").innerHTML =
      '<div class="qm-card qm-center-card"><div class="qm-go">' + (n > 0 ? n : "GO !") + '</div><p class="qm-lead">Prépare-toi…</p></div>' +
      '<div class="qm-card"><h3>Joueurs (' + (r.players || []).length + ')</h3>' + renderPills(r.players) + '</div>';
  }

  // Split render: build the static structure once per question; update the
  // live bits (timer, score, standings) every tick WITHOUT touching the grid,
  // so a tap can never land on a button that's being rebuilt under the finger.
  function renderPlaying(r) {
    var qs = r.questions || [];
    var q = qs.length ? qs[play.idx % qs.length] : null;
    var sig = "play:" + (q ? q.q : "none");
    if (roomStructSig !== sig) {
      roomStructSig = sig;
      $("qmRoomBody").innerHTML =
        '<div class="qm-timerbar"><i id="qmBar"></i></div>' +
        '<div class="qm-playhead"><div class="qm-clock" id="qmClock">–</div><div class="qm-myscore">Score <b id="qmScore">0</b></div></div>' +
        '<div class="qm-card qm-qcard">' +
          '<div class="qm-q">' + (q ? esc(q.q) : "…") + '</div>' +
          '<div class="qm-choices" id="qmChoices">' +
            (q ? q.choices.map(function (o, i) { return '<button class="qm-choice" data-i="' + i + '">' + esc(o) + '</button>'; }).join("") : "") +
          '</div>' +
          '<button class="qm-skip" id="qmSkip">Je passe ⏭️</button>' +
        '</div>' +
        '<div class="qm-card"><h3>Classement en direct</h3><div id="qmLive"></div></div>';
      var choices = $("qmChoices");
      if (choices && q) {
        Array.prototype.forEach.call(choices.querySelectorAll("button"), function (btn) {
          btn.onclick = function () {
            if (btn.disabled) return;
            var i = parseInt(btn.getAttribute("data-i"), 10);
            var ok = i === q.correct;
            if (ok) { play.correct++; play.curStreak++; if (play.curStreak > play.streak) play.streak = play.curStreak; }
            else { play.wrong++; play.curStreak = 0; }
            Array.prototype.forEach.call(choices.querySelectorAll("button"), function (b) { b.disabled = true; });
            btn.classList.add(ok ? "good" : "bad");
            if (navigator.vibrate) { try { navigator.vibrate(ok ? 25 : [25, 25, 25]); } catch (e) {} }
            setTimeout(advance, 170);
          };
        });
      }
      var skip = $("qmSkip");
      if (skip) skip.onclick = function () { play.skipped++; play.curStreak = 0; advance(); };
    }
    updatePlayingLive(r);
  }

  function updatePlayingLive(r) {
    var timeLeft = Math.max(0, r.time_left_ms || 0);
    var secs = Math.ceil(timeLeft / 1000);
    var clock = $("qmClock");
    if (clock) {
      clock.textContent = secs + " s";
      clock.className = "qm-clock" + (secs <= 5 ? " danger" : (secs <= 10 ? " warn" : ""));
    }
    var bar = $("qmBar");
    if (bar) bar.style.width = (r.blitz_total_ms ? Math.max(0, Math.min(100, (timeLeft / r.blitz_total_ms) * 100)) : 0) + "%";
    var sc = $("qmScore"); if (sc && play) sc.textContent = (play.correct - play.wrong);
    var live = $("qmLive"); if (live) live.innerHTML = liveStandingsHtml(r);
  }

  function advance() {
    play.idx++;
    if (socket) socket.emit("msg", { t: "progress", correct: play.correct, wrong: play.wrong, skipped: play.skipped, streak: play.streak });
    if (lastRoom && lastRoom.state === "playing") { roomStructSig = ""; renderRoom(); }
  }

  function renderSpectator(r) {
    var secs = Math.ceil((r.time_left_ms || 0) / 1000);
    var sig = "spec";
    if (roomStructSig !== sig) {
      roomStructSig = sig;
      $("qmRoomBody").innerHTML =
        '<div class="qm-card qm-center-card"><div class="qm-big">🔥 Partie en cours</div><p class="qm-lead" id="qmSpecMsg"></p></div>' +
        '<div class="qm-card"><h3>Classement en direct</h3><div id="qmLive"></div></div>' +
        renderRoomTop(r.top);
    }
    var msg = $("qmSpecMsg"); if (msg) msg.textContent = "Tu joueras à la prochaine manche" + (secs ? " (" + secs + " s restantes)" : "") + ".";
    var live = $("qmLive"); if (live) live.innerHTML = liveStandingsHtml(r);
  }

  function renderPodium(r) {
    var s = Math.ceil(r.podium_remaining_ms / 1000);
    var sum = r.summary || {};
    var st = sum.standings || [];
    var me = getPseudo();
    var mvp = sum.mvp, extras = sum.extras || [], totals = sum.totals || {};
    var mvpHtml = mvp
      ? '<div class="qm-mvp"><div class="qm-mvp-emoji">' + esc(mvp.emoji) + '</div><div class="qm-mvp-label">' + esc(mvp.label) + '</div>' +
        '<div class="qm-mvp-name">' + esc(mvp.name) + '</div><div class="qm-mvp-val">' + esc(mvp.value) + '</div></div>' : '';
    var extrasHtml = extras.length
      ? '<div class="qm-extras">' + extras.map(function (x) {
          return '<div class="qm-extra"><span class="e">' + esc(x.emoji) + '</span><span class="l">' + esc(x.label) + '</span>' +
            '<span class="n">' + esc(x.name) + '</span><span class="v">' + esc(x.value) + '</span></div>';
        }).join("") + '</div>' : '';
    var rowsHtml = st.length
      ? '<div class="qm-standings">' + st.map(function (row, i) {
          return '<div class="qm-srow' + (row.name === me ? " me" : "") + (i === 0 ? " gold" : "") + '">' +
            '<span class="rank">' + medal(i) + '</span><span class="who">' + esc(row.name) + '</span>' +
            '<span class="detail">' + row.correct + '✓ ' + row.wrong + '✗ · ' + row.accuracy + '%</span>' +
            '<b class="score">' + (row.score > 0 ? "+" : "") + row.score + '</b></div>';
        }).join("") + '</div>' : '<p class="qm-hint">Aucun joueur.</p>';
    var totalsHtml = totals.total_seen ? '<p class="qm-hint">' + totals.total_seen + ' questions vues · ' + totals.total_correct + ' bonnes au total</p>' : '';
    $("qmRoomBody").innerHTML =
      '<div class="qm-card qm-center-card"><div class="qm-big">🏁 Terminé !</div></div>' +
      (mvpHtml ? '<div class="qm-card">' + mvpHtml + '</div>' : '') +
      (extrasHtml ? '<div class="qm-card">' + extrasHtml + '</div>' : '') +
      '<div class="qm-card"><h3>Classement</h3>' + rowsHtml + totalsHtml + '</div>' +
      '<p class="qm-hint">Nouvelle manche dans ' + s + ' s…</p>' +
      renderRoomTop(r.top);
  }

  // ---------- shared blocks ----------
  function renderPills(playersArr) {
    var me = getPseudo();
    if (!playersArr || !playersArr.length) return '<p class="qm-hint">—</p>';
    return '<div class="qm-pills">' + playersArr.map(function (p) {
      return '<span class="qm-pill' + (p.name === me ? " me" : "") + '">' + esc(p.name) + '</span>';
    }).join("") + '</div>';
  }

  function liveStandingsHtml(r) {
    var me = getPseudo();
    var st = (r.standings || []).slice();
    if (play && r.state === "playing") {
      var mine = st.find(function (x) { return x.name === me; });
      if (mine) { mine.correct = play.correct; mine.wrong = play.wrong; mine.score = play.correct - play.wrong; }
      st.sort(function (a, b) { return (b.score || 0) - (a.score || 0) || (a.wrong || 0) - (b.wrong || 0); });
    }
    if (!st.length) return '<p class="qm-hint">—</p>';
    return '<div class="qm-standings">' + st.map(function (row, i) {
      return '<div class="qm-srow' + (row.name === me ? " me" : "") + '">' +
        '<span class="rank">' + medal(i) + '</span><span class="who">' + esc(row.name) + '</span>' +
        '<b class="score">' + ((row.score || 0) > 0 ? "+" : "") + (row.score || 0) + '</b></div>';
    }).join("") + '</div>';
  }

  function renderRoomTop(top) {
    if (!top || !top.length) return '<div class="qm-card"><h3>🏆 Records du thème</h3><p class="qm-hint">Aucun record. Sois le premier !</p></div>';
    var me = getPseudo();
    return '<div class="qm-card"><h3>🏆 Records du thème</h3><ol class="qm-top-list">' + top.map(function (e, i) {
      return '<li class="' + (e.name === me ? "me" : "") + '"><span class="rank">' + medal(i) + '</span><span class="who">' + (e.locked ? "🔒 " : "") + esc(e.name) + '</span><b class="pts">' + esc(e.displayValue || "") + '</b></li>';
    }).join("") + '</ol></div>';
  }

  // ---------- help overlay ----------
  var HELP = {
    main: { title: "Comment jouer", body:
      "<p><b>Blitz 30 secondes.</b> Tu as 30 secondes pour répondre à un max de questions.</p>" +
      "<ul><li><b class='g'>Bonne réponse : +1</b></li><li><b class='r'>Mauvaise réponse : −1</b></li><li><b>Je passe : 0</b> — utilise-le quand tu hésites pour éviter le −1 !</li></ul>" +
      "<p>À plusieurs, tout le monde reçoit <b>les mêmes questions dans le même ordre</b>. Le classement s'affiche en direct.</p>" +
      "<p>🔒 <b>Protège ton prénom</b> avec un code PIN à 4 chiffres pour que personne d'autre ne l'utilise.</p>" },
    pin: { title: "Le code PIN 🔒", body:
      "<p>Le PIN (4 chiffres) <b>réserve ton prénom</b>. Si quelqu'un d'autre essaie de jouer sous ton nom, il devra connaître ton PIN.</p>" +
      "<p>C'est <b>facultatif</b> — laisse vide si tu ne veux pas protéger ton nom. Tu pourras le faire plus tard depuis l'écran des thèmes.</p>" +
      "<p>Tes <b>stats</b> et ton <b>record</b> restent attachés à ton prénom.</p>" },
    ranking: { title: "Classement général 🏆", body:
      "<p>Le classement cumule tes <b>points</b> de toutes tes parties (une partie négative compte 0).</p>" +
      "<p>Pour chaque joueur on affiche : <b>nombre de parties</b>, <b>précision moyenne</b> et <b>meilleur score</b>.</p>" +
      "<p>🔒 = prénom protégé par un PIN. Les records par thème sont visibles dans chaque salle.</p>" },
  };
  function openHelp(key) {
    var h = HELP[key] || HELP.main;
    $("qmSheetTitle").textContent = h.title;
    $("qmSheetBody").innerHTML = h.body;
    $("qmOverlay").style.display = "flex";
  }
  function closeHelp() { $("qmOverlay").style.display = "none"; }

  // ---------- refresh loop ----------
  function startRefresh() {
    if (refreshTick) return;
    refreshTick = setInterval(function () {
      if (!lastRoom) return;
      // Only the live bits during play/spectate; full render otherwise (cheap).
      if (lastRoom.state === "playing" && amParticipant(lastRoom) && play) updatePlayingLive(lastRoom);
      else renderRoom();
    }, 250);
  }
  function stopRefresh() { if (refreshTick) { clearInterval(refreshTick); refreshTick = null; } }

  // ---------- bootstrap ----------
  document.addEventListener("DOMContentLoaded", function () {
    setWho();
    setupPseudo();
    $("qmBack").onclick = leaveRoom;
    $("qmHelp").onclick = function () { openHelp("main"); };
    $("qmSheetClose").onclick = closeHelp;
    $("qmOverlay").addEventListener("click", function (e) { if (e.target === $("qmOverlay")) closeHelp(); });
    $("qmProtect").onclick = protectName;
    // delegated (?) info buttons
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains("qm-info")) { e.preventDefault(); openHelp(t.getAttribute("data-help")); }
    });
    connect();
    if (getPseudo()) enterHall(); else show("s-pseudo");
  });
})();
