// QuizzMaster SPA — single "Blitz 60 s" mode, mobile-first, accessible 60+.
// Socket.IO /qm. Screens: pseudo(+PIN) / hall / room. Room states:
// idle → countdown(3-2-1) → playing(60s) → podium. PIN-protected names,
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
  function setWho() {
    var el = $("qmWho"); if (!el) return;
    var p = getPseudo();
    el.textContent = p ? (myProtected ? "🔒 " : "👋 ") + p : "";
    el.style.display = p ? "" : "none";
    el.onclick = function () { if (p) requestStats(p); };
    var me = $("qmMe"); if (me) me.style.display = p ? "" : "none";
    var rn = $("qmRename"); if (rn) rn.style.display = p ? "" : "none";
    var pr = $("qmProtect"); if (pr) pr.style.display = (p && !myProtected) ? "" : "none";
  }

  // ---------- socket + session ----------
  var socket = null, connected = false;
  var lastLobby = null, lastRoom = null, currentRoomId = null;
  var refreshTick = null;
  var clockSkewMs = 0;                // server_now - client_now, refreshed on each state
  function serverNow() { return Date.now() + clockSkewMs; }
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
      enterPinMode(m && m.name, "🔒 Ce pseudo est protégé. Entre ton code PIN.");
    });
    socket.on("pin_wrong", function (m) {
      enterPinMode(m && m.name, "❌ Code incorrect. Il te reste " + (m && m.attempts_left) + " essai" + ((m && m.attempts_left) > 1 ? "s" : "") + ".");
      var pin = $("qmPin"); if (pin) { pin.value = ""; pin.focus(); }
    });
    socket.on("identity_locked", function () {
      pinMode = false; show("s-pseudo");
      $("qmPseudoError").textContent = "";
      $("qmLocked").style.display = "block";
    });
    socket.on("pin_set", function () { myProtected = true; updateNameBadge(); toast("🔒 Pseudo protégé !"); });
    socket.on("rename_ok", function (m) {
      var newName = m && m.name; if (!newName) return;
      setPseudo(newName);
      myProtected = !!(m && m.protected);
      setWho(); updateNameBadge();
      toast("✏️ Nom mis à jour : " + newName);
    });
    socket.on("rename_failed", function (m) {
      var r = m && m.reason;
      if (r === "name_taken") toast("Ce pseudo est déjà pris.");
      else if (r === "not_owner") toast("Tu n'es pas propriétaire de ce compte.");
      else if (r === "same_name") toast("C'est déjà ton pseudo 🙂");
      else if (r === "no_account") toast("Aucun compte à renommer.");
      else toast("Renommage refusé.");
    });
    socket.on("account_deleted", function (m) {
      var name = (m && m.name) || "";
      // Wipe everything tied to this identity so the next session opens fresh.
      try { localStorage.removeItem("qm.pseudo"); } catch (e) {}
      myProtected = false;
      currentRoomId = null; lastRoom = null; pinMode = false;
      closeHelp();
      setWho(); updateNameBadge();
      toast("🗑️ Compte « " + name + " » supprimé.");
      // Bounce back to the pseudo screen — they can register a fresh name now.
      $("qmName").value = "";
      $("qmPin").value = "";
      $("qmPseudoError").textContent = "";
      $("qmContinue").textContent = "C'est parti →";
      show("s-pseudo");
    });
    socket.on("delete_failed", function (m) {
      var r = m && m.reason;
      var err = $("qmDelErr");
      var msg = (r === "pin_required") ? "Saisis ton PIN à 4 chiffres."
              : (r === "pin_wrong") ? "PIN incorrect."
              : (r === "not_owner") ? "Tu n'es pas propriétaire de ce compte."
              : (r === "no_account") ? "Aucun compte à supprimer."
              : "Suppression refusée.";
      if (err) err.textContent = msg;
      else toast(msg);
    });
    socket.on("error_msg", function (m) {
      var code = m && m.msg;
      if (code === "bad_identity" || code === "no_identity") return;
      if (code === "bad_pin") { toast("PIN invalide (4 chiffres)."); return; }
      if (code === "not_owner") { toast("Ce pseudo appartient à un autre joueur."); return; }
      setStatus(code ? "Erreur : " + code : "Erreur");
    });
    socket.on("lobby_state", function (m) { lastLobby = m || {}; renderLobby(); });
    socket.on("stats", function (m) {
      if (!m || m.ok === false) { toast("Pas encore de stats pour ce joueur."); return; }
      openProfile(m.stats);
    });
    socket.on("room_state", function (m) {
      var prev = lastRoom; lastRoom = m || {}; window.__qmLastRoom = lastRoom;
      // Track clock skew (server_now - client_now) so the client can compute
      // local "remaining ms" from absolute server timestamps without drifting.
      if (lastRoom && lastRoom.server_now_ms) {
        clockSkewMs = lastRoom.server_now_ms - Date.now();
      }
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
    if (!name) { $("qmPseudoError").textContent = "Entre ton pseudo."; return; }
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

  function updateNameBadge() { setWho(); }

  function enterHall() {
    currentRoomId = null; pinMode = false;
    $("qmContinue").textContent = "C'est parti →";
    if (socket && connected) socket.emit("join_lobby");
    updateNameBadge();
    show("s-hall");
  }

  // ---------- in-app sheet (replaces window.prompt — more reliable in PWA standalone mode) ----------
  // Opens the existing overlay with custom title + body HTML; `onMount` is
  // called with the body element so the caller can wire form events.
  function openSheet(title, bodyHtml, onMount) {
    $("qmSheetTitle").textContent = title;
    var body = $("qmSheetBody"); body.innerHTML = bodyHtml;
    $("qmOverlay").style.display = "flex";
    if (typeof onMount === "function") onMount(body);
  }

  // ---------- protect-name (set PIN) ----------
  function protectName() {
    openSheet("🔒 Protéger « " + getPseudo() + " »",
      '<p>Choisis un code PIN à 4 chiffres. Tu en auras besoin pour utiliser ton pseudo depuis un autre appareil.</p>' +
      '<input id="qmFormPin" type="tel" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off" pattern="[0-9]*" />' +
      '<button type="button" class="qm-primary" id="qmFormSubmit">🔒 Protéger</button>' +
      '<div class="qm-error center" id="qmFormErr"></div>',
      function (body) {
        var input = body.querySelector("#qmFormPin");
        var submit = body.querySelector("#qmFormSubmit");
        var err = body.querySelector("#qmFormErr");
        setTimeout(function () { input.focus(); }, 80);
        function go() {
          var pin = (input.value || "").trim();
          if (!/^\d{4}$/.test(pin)) { err.textContent = "Le PIN doit faire 4 chiffres."; input.focus(); return; }
          if (socket) socket.emit("set_pin", { pin: pin });
          closeHelp();
        }
        submit.onclick = go;
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
      });
  }

  // ---------- rename (keeps PIN + stats) ----------
  function renameMe() {
    openSheet("✏️ Renommer mon compte",
      '<p>Choisis un nouveau pseudo (16 caractères max). <b>Tes stats et ton PIN sont conservés.</b></p>' +
      '<input id="qmFormName" type="text" maxlength="16" autocomplete="off" />' +
      '<button type="button" class="qm-primary" id="qmFormSubmit">✏️ Renommer</button>' +
      '<div class="qm-error center" id="qmFormErr"></div>',
      function (body) {
        var input = body.querySelector("#qmFormName");
        var submit = body.querySelector("#qmFormSubmit");
        var err = body.querySelector("#qmFormErr");
        input.value = getPseudo();
        setTimeout(function () { input.focus(); input.select(); }, 80);
        function go() {
          var next = (input.value || "").trim().slice(0, 16);
          if (!next) { err.textContent = "Entre un pseudo."; return; }
          if (next.toLowerCase() === getPseudo().toLowerCase()) { err.textContent = "C'est déjà ton pseudo."; return; }
          if (socket) socket.emit("rename", { name: next });
          closeHelp();
        }
        submit.onclick = go;
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
      });
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
      var themes = (e.themes | 0);
      var themesTxt = themes + ' thème' + (themes > 1 ? 's' : '');
      return '<li class="qm-clickable ' + (e.name === me ? "me" : "") + '" data-name="' + esc(e.name) + '" title="Voir le profil">' +
        '<span class="rank">' + medal(i) + '</span>' +
        '<span class="who">' + (e.locked ? "🔒 " : "") + esc(e.name) + '</span>' +
        '<span class="qm-pstats">' + e.games + ' parties · ' + themesTxt + ' · record ' + e.best + '</span>' +
        '<b class="pts">' + (e.points | 0) + '</b></li>';
    }).join("");
    Array.prototype.forEach.call(ol.querySelectorAll("li.qm-clickable"), function (li) {
      li.onclick = function () { requestStats(li.getAttribute("data-name")); };
    });
  }

  function requestStats(name) {
    if (!socket || !connected || !name) return;
    socket.emit("get_stats", { name: name });
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
      '<div class="qm-card"><p class="qm-rule">60 secondes · <b class="g">bonne +1</b> · <b class="r">mauvaise −1</b> · <b>passe 0</b></p></div>' +
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
    // Compute remaining locally from the absolute go_at_ms timestamp so the
    // countdown ticks down smoothly between server broadcasts.
    var remain = r.go_at_ms ? Math.max(0, r.go_at_ms - serverNow()) : (r.countdown_remaining_ms || 0);
    var n = Math.ceil(remain / 1000);
    // Split structure (built once) from the live number (updated each tick)
    // so the big digit is independent of the rest.
    var sig = "countdown:" + (r.players || []).length;
    if (roomStructSig !== sig) {
      roomStructSig = sig;
      $("qmRoomBody").innerHTML =
        '<div class="qm-card qm-center-card"><div class="qm-go" id="qmGo">' + (n > 0 ? n : "GO !") + '</div><p class="qm-lead">Prépare-toi…</p></div>' +
        '<div class="qm-card"><h3>Joueurs (' + (r.players || []).length + ')</h3>' + renderPills(r.players) + '</div>';
    } else {
      var g = $("qmGo"); if (g) g.textContent = (n > 0 ? n : "GO !");
    }
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
    // Prefer absolute end_at_ms (computed locally) over the snapshot's
    // server-side remaining_ms, which is stale between broadcasts.
    var timeLeft = r.end_at_ms ? Math.max(0, r.end_at_ms - serverNow()) : Math.max(0, r.time_left_ms || 0);
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
    var remain = r.end_at_ms ? Math.max(0, r.end_at_ms - serverNow()) : Math.max(0, r.time_left_ms || 0);
    var secs = Math.ceil(remain / 1000);
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
    var podRemain = r.podium_end_at_ms ? Math.max(0, r.podium_end_at_ms - serverNow()) : Math.max(0, r.podium_remaining_ms || 0);
    var s = Math.ceil(podRemain / 1000);
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
      "<p><b>Blitz 60 secondes.</b> Tu as 60 secondes pour répondre à un max de questions.</p>" +
      "<ul><li><b class='g'>Bonne réponse : +1</b></li><li><b class='r'>Mauvaise réponse : −1</b></li><li><b>Je passe : 0</b> — utilise-le quand tu hésites pour éviter le −1 !</li></ul>" +
      "<p>À plusieurs, tout le monde reçoit <b>les mêmes questions dans le même ordre</b>. Le classement s'affiche en direct.</p>" +
      "<p>🔒 <b>Protège ton pseudo</b> avec un code PIN à 4 chiffres pour que personne d'autre ne l'utilise.</p>" },
    pin: { title: "Le code PIN 🔒", body:
      "<p>Le PIN (4 chiffres) <b>réserve ton pseudo</b>. Si quelqu'un d'autre essaie de jouer avec, il devra connaître ton PIN.</p>" +
      "<p>C'est <b>facultatif</b> — laisse vide si tu ne veux pas protéger ton pseudo. Tu pourras le faire plus tard depuis le bouton 🔒 en haut à droite.</p>" +
      "<p>Tes <b>stats</b> et ton <b>record</b> restent attachés à ton pseudo.</p>" },
    ranking: { title: "Classement général 🏆", body:
      "<p>Ton <b>score de classement</b> = la <b>somme de ton meilleur score dans chaque thème</b>.</p>" +
      "<p>⚠️ Rejouer un thème ne compte que si tu <b>bats ton propre record</b> : impossible de farmer un seul thème pour monter ! Pour grimper, il faut <b>progresser</b> et <b>varier les thèmes</b>.</p>" +
      "<p>Pour chaque joueur on affiche aussi : <b>nombre de parties</b>, <b>thèmes joués</b> et <b>meilleur score</b> en une partie.</p>" +
      "<p>👉 <b>Touche un joueur</b> (ou ton propre pseudo en haut) pour voir son profil détaillé : thèmes préférés, bête noire, victoires, meilleure série…</p>" +
      "<p>🔒 = pseudo protégé par un PIN. Les records par thème sont visibles dans chaque salle.</p>" },
  };
  function openHelp(key) {
    var h = HELP[key] || HELP.main;
    $("qmSheetTitle").textContent = h.title;
    $("qmSheetBody").innerHTML = h.body;
    $("qmOverlay").style.display = "flex";
  }
  function closeHelp() { $("qmOverlay").style.display = "none"; }

  // ---------- player profile card ----------
  function fmtSigned(n) { n = n | 0; return (n > 0 ? "+" : "") + n; }
  function fmtAvg(n) { var s = (n >= 0 ? "+" : "") + n.toFixed(1); return s; }
  function plurPts(n) { return n + " pt" + (Math.abs(n) > 1 ? "s" : ""); }
  function plurGames(n) { return n + " partie" + (n > 1 ? "s" : ""); }

  function openProfile(s) {
    if (!s) return;
    var me = getPseudo();
    var isMe = s.name === me;
    $("qmSheetTitle").textContent = (s.locked ? "🔒 " : "") + s.name + (isMe ? " (toi)" : "");

    // Big top numbers. "Score" = sum of best-per-theme (the anti-grind ranking
    // score), distinct from "record" (best single game).
    var themesN = (s.themesPlayed | 0);
    var head =
      '<div class="qm-prof-top">' +
        '<div class="qm-prof-stat"><b>' + (s.points | 0) + '</b><span>score classement</span></div>' +
        '<div class="qm-prof-stat"><b>' + (s.games | 0) + '</b><span>parties</span></div>' +
        '<div class="qm-prof-stat"><b>' + plurPts(s.best | 0) + '</b><span>record</span></div>' +
        '<div class="qm-prof-stat"><b>' + (s.accuracy | 0) + '%</b><span>précision</span></div>' +
      '</div>' +
      '<p class="qm-prof-sub">🏅 Score = somme de ton meilleur score dans chaque thème (' + themesN + ' thème' + (themesN > 1 ? 's' : '') + ' joué' + (themesN > 1 ? 's' : '') + ')</p>';

    // Trophies row (wins / podiums / streak) — only shown if non-zero.
    var trophies = [];
    if (s.wins > 0)      trophies.push({ e: "🏆", l: "Victoire" + (s.wins > 1 ? "s" : ""), v: s.wins });
    if (s.podiums > 0)   trophies.push({ e: "🥉", l: "Podium" + (s.podiums > 1 ? "s" : ""), v: s.podiums });
    if (s.streakBest > 0) trophies.push({ e: "🔥", l: "Série record", v: s.streakBest + " d'affilée" });
    var trophiesHtml = trophies.length
      ? '<div class="qm-prof-trophies">' + trophies.map(function (t) {
          return '<div class="qm-trophy"><span class="e">' + t.e + '</span><span class="v">' + esc(String(t.v)) + '</span><span class="l">' + esc(t.l) + '</span></div>';
        }).join("") + '</div>'
      : "";

    // Favorites: top 3 themes by cumulative points.
    var favHtml = "";
    if (s.favorites && s.favorites.length) {
      favHtml = '<h4 class="qm-prof-h">⭐ Thèmes de prédilection</h4>' +
        '<div class="qm-prof-list">' + s.favorites.map(function (t, i) {
          return '<div class="qm-prof-row">' +
            '<span class="rk">' + (i + 1) + '.</span>' +
            '<span class="emo">' + esc(t.emoji) + '</span>' +
            '<span class="nm">' + esc(t.themeName) + '</span>' +
            '<span class="meta">' + (t.points | 0) + ' pts · record ' + (t.best | 0) + ' · ' + plurGames(t.games | 0) + '</span>' +
          '</div>';
        }).join("") + '</div>';
    }

    // Nemesis (bête noire). Only if multiple themes played enough.
    var nemHtml = "";
    if (s.nemesis) {
      var n = s.nemesis;
      nemHtml = '<h4 class="qm-prof-h">😅 Bête noire</h4>' +
        '<div class="qm-prof-list">' +
          '<div class="qm-prof-row nemesis">' +
            '<span class="emo">' + esc(n.emoji) + '</span>' +
            '<span class="nm">' + esc(n.themeName) + '</span>' +
            '<span class="meta">' + fmtAvg(n.avg) + '/partie · ' + plurGames(n.games | 0) + '</span>' +
          '</div>' +
        '</div>';
    }

    // All themes mini-grid.
    var allHtml = "";
    if (s.themes && s.themes.length) {
      allHtml = '<h4 class="qm-prof-h">📊 Tous les thèmes joués</h4>' +
        '<div class="qm-prof-themes">' + s.themes.map(function (t) {
          return '<div class="qm-prof-theme">' +
            '<span class="emo">' + esc(t.emoji) + '</span>' +
            '<span class="nm">' + esc(t.themeName) + '</span>' +
            '<span class="meta">record ' + (t.best | 0) + ' · ' + plurGames(t.games | 0) + '</span>' +
          '</div>';
        }).join("") + '</div>';
    }

    var emptyHtml = (s.games | 0) === 0
      ? '<p class="qm-hint">Aucune partie terminée pour l\'instant.</p>'
      : "";

    // Self-destruct button — only visible on the user's own profile.
    var dangerHtml = isMe
      ? '<div class="qm-prof-danger"><button type="button" class="qm-danger" id="qmDelete">🗑️ Supprimer mon compte</button>' +
        '<p class="qm-hint">Efface définitivement ton pseudo, ton PIN, tes stats et tes records.</p></div>'
      : '';

    $("qmSheetBody").innerHTML = '<div class="qm-profile">' + head + trophiesHtml + favHtml + nemHtml + allHtml + emptyHtml + dangerHtml + '</div>';
    $("qmOverlay").style.display = "flex";
    if (isMe) {
      var del = $("qmDelete");
      if (del) del.onclick = function () { confirmDelete(s); };
    }
  }

  // Two-step confirmation for account deletion. PIN-protected accounts must
  // re-enter their PIN as a second factor (so a borrowed phone can't nuke the
  // account in one tap).
  function confirmDelete(s) {
    var locked = !!s.locked;
    openSheet("🗑️ Supprimer « " + getPseudo() + " »",
      '<p class="warn"><b>Action définitive.</b> Tu perdras ton pseudo, ton PIN, tes stats et tous tes records. Personne ne pourra les récupérer.</p>' +
      (locked
        ? '<p>Ce pseudo est protégé. Saisis ton PIN pour confirmer :</p>' +
          '<input id="qmDelPin" type="tel" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off" pattern="[0-9]*" />'
        : '') +
      '<button type="button" class="qm-danger" id="qmDelGo">🗑️ Oui, supprimer définitivement</button>' +
      '<button type="button" class="qm-secondary" id="qmDelCancel">Annuler</button>' +
      '<div class="qm-error center" id="qmDelErr"></div>',
      function (body) {
        var pinInput = body.querySelector("#qmDelPin");
        var go = body.querySelector("#qmDelGo");
        var cancel = body.querySelector("#qmDelCancel");
        var err = body.querySelector("#qmDelErr");
        if (pinInput) setTimeout(function () { pinInput.focus(); }, 80);
        cancel.onclick = closeHelp;
        go.onclick = function () {
          var pin = pinInput ? (pinInput.value || "").trim() : "";
          if (locked && !/^\d{4}$/.test(pin)) { err.textContent = "Saisis ton PIN à 4 chiffres."; if (pinInput) pinInput.focus(); return; }
          if (socket) socket.emit("delete_account", { pin: pin });
        };
      });
  }

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

  // ---------- PWA install (plein écran) ----------
  var deferredPrompt = null;
  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
           (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches) ||
           window.navigator.standalone === true;
  }
  function isiOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream; }
  function installDismissed() { try { return localStorage.getItem("qm.installHidden") === "1"; } catch (e) { return false; } }
  function setupInstall() {
    var bar = $("qmInstall"), btn = $("qmInstallBtn"), txt = $("qmInstallTxt"), x = $("qmInstallX");
    if (!bar) return;
    if (isStandalone() || installDismissed()) { bar.style.display = "none"; return; }
    x.onclick = function () { bar.style.display = "none"; try { localStorage.setItem("qm.installHidden", "1"); } catch (e) {} };

    if (isiOS()) {
      // iOS Safari: no programmatic install — show the gesture.
      btn.style.display = "none";
      txt.innerHTML = "📲 Pour jouer en plein écran : appuie sur <b>Partager</b> puis <b>« Sur l'écran d'accueil »</b>.";
      bar.style.display = "flex";
      return;
    }
    // Android/Chrome: wait for the install prompt to be available.
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault(); deferredPrompt = e;
      if (!isStandalone() && !installDismissed()) bar.style.display = "flex";
    });
    btn.onclick = function () {
      if (!deferredPrompt) { toast("Utilise le menu ⋮ du navigateur → « Installer l'application »."); return; }
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; bar.style.display = "none"; });
    };
    window.addEventListener("appinstalled", function () { bar.style.display = "none"; toast("✅ QuizzMaster installé !"); });
  }

  // ---------- bootstrap ----------
  document.addEventListener("DOMContentLoaded", function () {
    setWho();
    setupPseudo();
    setupInstall();
    $("qmBack").onclick = leaveRoom;
    $("qmHelp").onclick = function () { openHelp("main"); };
    $("qmSheetClose").onclick = closeHelp;
    $("qmOverlay").addEventListener("click", function (e) { if (e.target === $("qmOverlay")) closeHelp(); });
    $("qmProtect").onclick = protectName;
    $("qmRename").onclick = renameMe;
    // delegated (?) info buttons
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains("qm-info")) { e.preventDefault(); openHelp(t.getAttribute("data-help")); }
    });
    connect();
    if (getPseudo()) enterHall(); else show("s-pseudo");
  });
})();
