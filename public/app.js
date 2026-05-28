// Aperolympics SPA core (Socket.IO transport).
//
// Responsibilities:
//  - Socket.IO connection (auto long-polling fallback if WS is blocked)
//  - Single source of truth: the latest server `state` message
//  - Room flow (create / join by code or /r/CODE link) + leave
//  - Routing between shell screens (join / hub / lobby) and the game area
//  - App chrome: top-bar nav (menu / leaderboard / help / leave), live
//    leaderboard, rules & onboarding help, and tap-to-show tooltips
//  - Dispatching renders to the currently-selected game module
//
// A game renderer registers via window.Apero.register(id, {name, emoji, desc,
// rules, mount(area, helpers), render(state, helpers), unmount?(area)}).
// The helpers object is identical to the ESP32 GamesHub one, so renderers port
// over unchanged.

window.Apero = window.Apero || { games: {} };
window.Apero.register = function (id, def) { this.games[id] = def; };
window.GamesHub = window.Apero; // compat alias: ported renderers can keep window.GamesHub.register

(function () {
  var socket, myName = "", myRoom = "", state = null, currentRendererId = null, rejoining = false, wasHost = null, toastTimer = null, lastResultsSig = "";

  function $(id) { return document.getElementById(id); }
  function setStatus(t) { $("status").textContent = t; }
  function send(o) { if (socket && socket.connected) socket.emit("msg", o); }
  function escapeHtml(t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }

  var SHELL = ["s-join", "s-hub", "s-lobby", "game-area"];
  function show(id) { SHELL.forEach(function (s) { $(s).classList.toggle("on", s === id); }); }

  function findMe() {
    if (!state || !myName) return null;
    for (var i = 0; i < state.players.length; i++)
      if (state.players[i].name === myName) return state.players[i];
    return null;
  }
  function amHost() { var me = findMe(); return !!(me && me.host); }
  function inRoom() { return !!(state && findMe()); }

  var helpers = { $: $, send: send, setStatus: setStatus, escapeHtml: escapeHtml, findMe: findMe, amHost: amHost };

  // --- overlays (leaderboard / help) -----------------------------------------
  function openOverlay(id) { $(id).classList.add("on"); if (id === "ov-board") renderBoard(); if (id === "ov-help") renderHelp(); if (id === "ov-history") renderHistory(); }
  function closeOverlay(id) { $(id).classList.remove("on"); }
  function boardOpen() { return $("ov-board").classList.contains("on"); }

  // While a saved session is being restored, cover the landing form with a
  // "reconnecting" card so its "Créer" button can't be mis-tapped (which would
  // spawn a new room and abandon the game). Hidden as soon as we're back in.
  function showReconnecting(room) { $("reconnectRoom").textContent = room || ""; $("ov-reconnect").classList.add("on"); }
  function hideReconnecting() { $("ov-reconnect").classList.remove("on"); }

  // Brief auto-dismissing notice (e.g. host hand-off).
  function toast(msg) {
    var el = $("toast"); el.textContent = msg; el.classList.add("on");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove("on"); }, 4000);
  }

  function renderHistory() {
    var body = $("historyBody"); body.innerHTML = "";
    var h = (state && state.history) ? state.history.slice().reverse() : [];
    $("historyEmpty").style.display = h.length ? "none" : "block";
    var medals = ["🥇", "🥈", "🥉"];
    h.forEach(function (e) {
      var g = window.Apero.games[e.game] || {};
      var scored = (e.standings || []).some(function (s) { return s.score > 0; });
      var rows;
      if (scored) {
        rows = (e.standings || []).slice(0, 5).map(function (s, i) {
          return '<li><span>' + (medals[i] || (i + 1) + ".") + ' ' + escapeHtml(s.name) + '</span><b>' + s.score + '</b></li>';
        }).join("");
      } else {
        rows = '<li><span class="muted">Partie jouée — ' + (e.standings || []).length + ' joueur(s)</span></li>';
      }
      var div = document.createElement("div");
      div.className = "hist-entry";
      div.innerHTML = '<div class="hist-head">' + (g.emoji || "🎮") + ' <b>' + escapeHtml(g.name || e.game) + '</b></div><ol>' + rows + '</ol>';
      body.appendChild(div);
    });
  }

  function roomShare() {
    var code = (state && state.room) || myRoom;
    return { code: code, url: location.origin + "/r/" + code };
  }
  function renderRoomBadge(targetId) {
    var el = $(targetId); if (!el) return; var s = roomShare();
    el.innerHTML = '<div class="rb-label">Code de la partie</div>' +
      '<div class="rb-code">' + escapeHtml(s.code) + '</div>' +
      '<div class="rb-share"><span class="muted">' + escapeHtml(s.url) + '</span>' +
      '<button type="button" class="mini" data-copy="' + escapeHtml(s.url) + '">Copier le lien</button></div>';
  }

  function sortedPlayers() {
    return (state ? state.players.slice() : []).sort(function (a, b) {
      return (b.score - a.score) || (a.name < b.name ? -1 : 1);
    });
  }

  function renderPlayerChips(targetId) {
    var el = $(targetId); el.innerHTML = "";
    sortedPlayers().forEach(function (p) {
      var c = document.createElement("span");
      c.className = "chip" + (p.connected ? "" : " off");
      c.innerHTML = (p.host ? "<span class=crown>&#x1F451;</span> " : "") + escapeHtml(p.name) +
        ' <b class="chip-score">' + (p.score || 0) + '</b>';
      el.appendChild(c);
    });
  }

  function renderBoard() {
    var ol = $("boardList"); var ps = sortedPlayers();
    ol.innerHTML = "";
    $("boardEmpty").style.display = ps.length ? "none" : "block";
    var medals = ["🥇", "🥈", "🥉"];
    ps.forEach(function (p, i) {
      var li = document.createElement("li");
      li.className = p.connected ? "" : "off";
      li.innerHTML = '<span class="rank">' + (medals[i] || (i + 1)) + '</span>' +
        '<span class="who">' + (p.host ? '<span class="crown">&#x1F451;</span> ' : '') + escapeHtml(p.name) + '</span>' +
        '<b class="pts">' + (p.score || 0) + '</b>';
      ol.appendChild(li);
    });
  }

  function showGameRules(id) { $("ov-help").classList.add("on"); renderHelp(id); }

  function renderHelp(forceId) {
    var html = '<ol class="steps">' +
      '<li><span class="num">1</span> <b>Crée</b> une partie ou <b>rejoins</b>-en une avec le code à 4 lettres (ou le lien) de l\'hôte.</li>' +
      '<li><span class="num">2</span> L\'<b>hôte</b> 👑 (le 1er arrivé) choisit une <b>épreuve</b> dans le menu 🏠.</li>' +
      '<li><span class="num">3</span> Tout le monde joue depuis son téléphone. Le <b>classement</b> 🏆 se met à jour en direct.</li>' +
      '</ol>';
    var gid = forceId || (state && state.game);
    var g = gid && window.Apero.games[gid];
    if (g && g.rules) {
      html += '<div class="rules"><h4>' + (g.emoji || '🎮') + ' ' + escapeHtml(g.name) + ' — règles</h4>' + g.rules + '</div>';
    } else {
      var ids = Object.keys(window.Apero.games);
      html += '<div class="rules"><h4>🎮 Les épreuves</h4>';
      if (ids.length) {
        html += '<ul class="bullets">';
        ids.forEach(function (id) { var x = window.Apero.games[id]; html += '<li>' + (x.emoji || '') + ' <b>' + escapeHtml(x.name) + '</b> — ' + escapeHtml(x.desc || '') + '</li>'; });
        html += '</ul>';
      }
      html += '</div>';
    }
    html += '<p class="muted center" style="margin-top:12px">Astuce : 🏠 revient au menu, ✕ quitte la partie. État en mémoire — un redémarrage du serveur remet les parties à zéro.</p>';
    $("helpBody").innerHTML = html;
  }

  function renderHub() {
    show("s-hub"); renderRoomBadge("hubRoom");
    var list = $("gameList"); list.innerHTML = "";
    var iAmHost = amHost();
    var connected = (state ? state.players.filter(function (p) { return p.connected; }).length : 0);
    Object.keys(window.Apero.games).forEach(function (id) {
      var g = window.Apero.games[id];
      var min = g.minPlayers || 1;
      var enough = connected >= min;
      var card = document.createElement("div");
      // .below-min recolours the "👥 N+" badge so the host sees at-a-glance
      // which games can't start with the current player count.
      card.className = "game-card" + (iAmHost ? "" : " disabled") + (enough ? "" : " below-min");
      var minBadge = '<span class="gc-min" title="' + min + '+ joueurs requis">👥 ' + min + '+</span>';
      card.innerHTML = '<div class="icon">' + g.emoji + '</div>' +
        '<div class="gc-body"><div class="name">' + escapeHtml(g.name) + ' ' + minBadge + '</div>' +
        '<div class="muted">' + escapeHtml(g.desc || "") + '</div></div>' +
        (iAmHost ? '<div class="gc-go">Jouer ›</div>' : '') +
        '<button type="button" class="info gc-info" title="Voir les règles">?</button>';
      if (iAmHost) card.onclick = function () { send({ t: "select_game", id: id }); };
      (function (gid) { card.querySelector(".gc-info").onclick = function (e) { e.stopPropagation(); showGameRules(gid); }; })(id);
      list.appendChild(card);
    });
    var hn = (state && state.hostId) || "l'hôte";
    $("hubHint").textContent = iAmHost ? "Tu es l'hôte 👑 — touche une épreuve pour la lancer. (? = règles)" : ("En attente que 👑 " + hn + " choisisse une épreuve… (? pour lire les règles)");
    renderPlayerChips("hubPlayers");
    setStatus("Salle " + ((state && state.room) || myRoom) + " — " + myName);
  }

  function renderLobby() {
    show("s-lobby"); renderRoomBadge("lobbyRoom");
    var g = window.Apero.games[state.game];
    $("lobbyEmoji").textContent = g ? g.emoji : "";
    $("lobbyName").textContent = g ? g.name : "";
    if ($("lobbyRules")) $("lobbyRules").innerHTML = (g && g.rules) ? '<h4>📖 Comment jouer</h4>' + g.rules : '';
    renderPlayerChips("lobbyPlayers");
    var iAmHost = amHost();
    var connected = state.players.filter(function (p) { return p.connected; }).length;
    var min = (g && g.minPlayers) || 1;
    var enough = connected >= min;
    var need = "Il faut au moins " + min + " joueurs connectés (actuellement " + connected + ").";
    var hn = (state && state.hostId) || "l'hôte";
    $("startBtn").style.display = iAmHost ? "block" : "none";
    $("startBtn").disabled = !enough;
    $("backToHubBtn").style.display = iAmHost ? "block" : "none";
    $("lobbyHint").textContent = !enough ? need
      : (iAmHost ? "Quand tout le monde est là, clique Démarrer." : ("En attente de 👑 " + hn + "…"));
    setStatus("Lobby — " + myName);
  }

  function switchTo(id) {
    var area = $("game-area");
    if (currentRendererId) {
      var prev = window.Apero.games[currentRendererId];
      if (prev && prev.unmount) try { prev.unmount(area, helpers); } catch (e) {}
    }
    area.innerHTML = ""; currentRendererId = null;
    if (id && window.Apero.games[id]) {
      currentRendererId = id;
      var def = window.Apero.games[id];
      if (def.mount) def.mount(area, helpers);
    }
  }

  // Top-bar buttons adapt to context; refresh the leaderboard if it is open.
  function updateChrome() {
    var roomed = inRoom();
    var inGame = roomed && !!(state && state.game);
    // Tell a player when the crown lands on them (e.g. the host left), since
    // turn-based games otherwise stall waiting on a host who doesn't know.
    if (roomed) {
      var nowHost = amHost();
      if (wasHost !== null && nowHost && !wasHost) toast("👑 Tu es l'hôte maintenant — à toi de continuer !");
      wasHost = nowHost;
    } else { wasHost = null; }
    $("navLeaveBtn").style.display = roomed ? "" : "none";
    $("navBoardBtn").style.display = roomed ? "" : "none";
    $("navMenuBtn").style.display = (inGame && amHost()) ? "" : "none";
    $("navHistoryBtn").style.display = (roomed && state && state.history && state.history.length) ? "" : "none";
    if (boardOpen()) renderBoard();
    if ($("ov-history").classList.contains("on")) renderHistory();
  }

  // Shared "fin de partie" screen — shown whenever a game ends. Reads optional
  // `round.mvp` (a per-game stat) and `round.winner_banner` (role games) from
  // the server, so every game gets a consistent payoff without per-renderer
  // code. Reserved phase==="finished" keys on state.round: `mvp`, `winner_banner`.
  // A game can also implement `renderFinishedExtras(area, state, helpers)` to
  // layer game-specific reveal content (e.g. wolves' role roster).
  function renderResults() {
    var area = $("game-area");
    var def = (state && state.game) ? window.Apero.games[state.game] : null;
    var round = (state && state.round) || {};
    var emoji = (def && def.emoji) || "🏁";
    var name = (def && def.name) || "";
    var ps = sortedPlayers();
    var iAmHost = amHost();
    var hostName = (state && state.hostId) || "l'hôte";

    // Skip identical re-renders so a peer's mid-game broadcast doesn't replace
    // a button the host has just tapped (the touch would land on a detached node).
    var sig = JSON.stringify([
      name, iAmHost, hostName, round.mvp || 0, round.winner_banner || 0,
      ps.map(function (p) { return [p.name, p.score, p.host, p.connected]; }),
    ]);
    if (lastResultsSig === sig) return;
    lastResultsSig = sig;

    var scored = !!(def && def.scored);
    var medals = ["🥇", "🥈", "🥉"];
    var podiumHtml = scored
      ? '<ol class="podium">' +
          ps.slice(0, 3).map(function (p, i) {
            return '<li><span class="rank">' + medals[i] + '</span>' +
              '<span class="who">' + (p.host ? '<span class="crown">&#x1F451;</span> ' : '') + escapeHtml(p.name) + '</span>' +
              '<b class="pts">' + (p.score || 0) + '</b></li>';
          }).join("") +
        '</ol>'
      : '<div class="muted center">Partie jouée — ' + ps.length + ' joueur' + (ps.length === 1 ? '' : 's') + '</div>';

    var w = round.winner_banner;
    var winnerHtml = (w && w.text)
      ? '<div class="winner-banner">' + (w.emoji ? escapeHtml(w.emoji) + ' ' : '') + escapeHtml(w.text) + '</div>'
      : '';

    var s = round.mvp;
    var mvpHtml = (s && s.label)
      ? '<div class="mvp">' +
          '<div class="mvp-label">' + escapeHtml(s.label) + '</div>' +
          '<div class="mvp-name">' + (s.emoji ? escapeHtml(s.emoji) + ' ' : '') + escapeHtml(s.name || '') +
            (s.value != null && s.value !== '' ? ' <span class="mvp-value">' + escapeHtml(String(s.value)) + '</span>' : '') +
          '</div>' +
        '</div>'
      : '';

    var actions = iAmHost
      ? '<button class="primary" id="resReplayBtn">Rejouer</button>' +
        '<button id="resMenuBtn">← Choisir une autre épreuve</button>'
      : '<div class="muted center">En attente de 👑 ' + escapeHtml(hostName) + '…</div>';

    area.innerHTML =
      '<section class="results">' +
        '<div class="results-head">' +
          '<div class="results-emoji">' + escapeHtml(emoji) + '</div>' +
          '<h2>Partie terminée</h2>' +
          '<div class="muted">' + escapeHtml(name) + '</div>' +
        '</div>' +
        winnerHtml + podiumHtml + mvpHtml +
        '<div id="resExtras"></div>' +
        '<div class="results-actions">' + actions + '</div>' +
      '</section>';

    if (def && def.renderFinishedExtras) {
      try { def.renderFinishedExtras($("resExtras"), state, helpers); } catch (e) {}
    }
    if (iAmHost) {
      $("resReplayBtn").onclick = function () { send({ t: "reset" }); };
      $("resMenuBtn").onclick = function () { send({ t: "select_game", id: "" }); };
    }
  }

  function render() {
    if (!state || !findMe()) { show("s-join"); updateChrome(); return; }
    if (state.game) {
      if (state.phase === "lobby") { if (currentRendererId) switchTo(null); renderLobby(); updateChrome(); return; }
      if (state.phase === "finished") {
        // Re-entering finished from a different phase: drop the renderer and
        // force a fresh results paint (clearing the re-render-skip signature).
        if (currentRendererId) { switchTo(null); lastResultsSig = ""; }
        show("game-area"); renderResults(); updateChrome(); return;
      }
      if (state.game !== currentRendererId) switchTo(state.game);
      show("game-area");
      var def = window.Apero.games[state.game];
      if (def && def.render) def.render(state, helpers);
      updateChrome();
      return;
    }
    if (currentRendererId) switchTo(null);
    renderHub();
    updateChrome();
  }

  function connect() {
    socket = io({ transports: ["polling", "websocket"] });
    socket.on("connect", function () {
      document.body.classList.remove("offline");
      // Auto-rejoin the same room under the same pseudo (score kept). Covers a
      // dropped socket AND a full page refresh (session restored from
      // localStorage before we connect). `rejoining` lets error_msg below tell
      // a failed auto-rejoin (room gone) apart from a manual bad code.
      if (myName && myRoom) { rejoining = true; send({ t: "join", name: myName, room: myRoom }); setStatus("Reconnexion — " + myName + "…"); }
      else setStatus("Choisis ton pseudo");
    });
    socket.on("disconnect", function () {
      // Only flag a real in-game drop (loud status + dimmed board) so taps
      // aren't silently swallowed. On the landing screen / right after leaving,
      // stay quiet. Socket.IO auto-reconnects and we re-join above.
      if (!inRoom()) return;
      document.body.classList.add("offline");
      setStatus("Connexion perdue — reconnexion…");
    });
    socket.on("state", function (m) {
      // Keep the private role payload across a reconnect re-render (same game +
      // phase) so hidden-role games don't flash "(privé)" before `private` lands.
      var keepPriv = (state && state._private && state.game === m.game && state.phase === m.phase) ? state._private : null;
      state = m; myRoom = m.room || myRoom;
      if (keepPriv && !state._private) state._private = keepPriv;
      if (findMe()) { rejoining = false; hideReconnecting(); saveSession(); }
      render();
    });
    socket.on("private", function (m) { if (state) { state._private = m.round || {}; render(); } });
    socket.on("error_msg", function (m) {
      // An auto-rejoin failed: the room was swept after inactivity, or the
      // server restarted and lost all rooms. Clear the dead session and drop to
      // the landing screen with a gentle explanation instead of a blank reset.
      if (rejoining) {
        rejoining = false; clearSession(); myName = ""; myRoom = ""; state = null;
        if (currentRendererId) switchTo(null);
        hideReconnecting(); render();
        $("joinError").textContent = "La partie n'existe plus — crée une nouvelle partie ou rejoins avec un code.";
        setStatus("Choisis ton pseudo"); return;
      }
      var e = $("joinError"); if (e) e.textContent = (m && m.msg) ? m.msg : "Erreur";
    });
  }

  // Leave the room: drop our session (server marks us offline) and reset to the
  // landing screen with a fresh socket that won't auto-rejoin.
  function leaveRoom() {
    myName = ""; myRoom = ""; state = null; rejoining = false; clearSession();
    if (currentRendererId) switchTo(null);
    hideReconnecting(); document.body.classList.remove("offline");
    closeOverlay("ov-board"); closeOverlay("ov-help"); closeOverlay("ov-history");
    if (socket) { socket.disconnect(); socket.connect(); }
    $("code").value = ""; $("joinError").textContent = ""; syncCreateJoin();
    show("s-join"); updateChrome(); setStatus("Choisis ton pseudo");
  }

  function prefillFromUrl() {
    var m = location.pathname.match(/^\/r\/([A-Za-z0-9]{3,8})/);
    if (m) $("code").value = m[1].toUpperCase();
  }

  // Session persistence: remember {pseudo, room} so a page refresh silently
  // rejoins the same room. The server keeps each player by lowercased pseudo
  // (score and all), so re-sending "join" with the same name+code restores us.
  var SESSION_KEY = "apero.session", savedSig = "";
  function saveSession() {
    if (!myName || !myRoom) return;
    var sig = myName + " " + myRoom;
    if (sig === savedSig) return; // state arrives often; skip redundant writes
    savedSig = sig;               // set first so a throwing store (private mode) isn't retried every frame
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ name: myName, room: myRoom })); } catch (e) {}
  }
  function clearSession() {
    savedSig = "";
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }
  function loadSession() {
    try { var s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); return (s && s.name && s.room) ? s : null; } catch (e) { return null; }
  }

  // Landing CTA reflects intent: an empty code means "create a room", a typed
  // code means "join one". Emphasize the matching button and block create while
  // a code is present, so a typed code can't accidentally spawn a new room.
  function syncCreateJoin() {
    var hasCode = !!($("code").value || "").trim();
    $("createBtn").classList.toggle("primary", !hasCode);
    $("createBtn").disabled = hasCode;
    $("joinBtn").classList.toggle("primary", hasCode);
  }

  // One delegated click handler for: closing overlays, copy-to-clipboard,
  // and tap-to-toggle tooltips (mobile-friendly — no hover needed).
  function initDelegated() {
    var tip = null;
    document.addEventListener("click", function (e) {
      if (tip) { tip.parentNode && tip.parentNode.removeChild(tip); tip = null; }
      var close = e.target.closest && e.target.closest("[data-close]");
      if (close) { closeOverlay(close.getAttribute("data-close")); return; }
      var copy = e.target.closest && e.target.closest("[data-copy]");
      if (copy) {
        var url = copy.getAttribute("data-copy");
        if (navigator.clipboard) navigator.clipboard.writeText(url).catch(function () {});
        var old = copy.textContent; copy.textContent = "Copié ✓";
        setTimeout(function () { copy.textContent = old; }, 1500);
        return;
      }
      var trig = e.target.closest && e.target.closest("[data-tip]");
      if (trig) {
        e.preventDefault();
        tip = document.createElement("div");
        tip.className = "tipbubble";
        tip.textContent = trig.getAttribute("data-tip");
        document.body.appendChild(tip);
        var r = trig.getBoundingClientRect();
        var left = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, r.left));
        tip.style.left = left + "px";
        tip.style.top = (r.bottom + 8) + "px";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    prefillFromUrl();
    syncCreateJoin();
    $("code").addEventListener("input", syncCreateJoin);
    // Restore a saved session so refreshing rejoins the same room. A /r/CODE
    // link for a *different* room wins over the saved one.
    (function () {
      var saved = loadSession();
      if (!saved) return;
      if (!$("name").value.trim()) $("name").value = saved.name;
      var urlCode = ($("code").value || "").trim().toUpperCase();
      if (!urlCode || urlCode === saved.room) {
        myName = saved.name; myRoom = saved.room;
        // Cover the landing form until the rejoin resolves (or the user opts out).
        showReconnecting(myRoom);
      }
    })();
    $("createBtn").onclick = function () {
      var n = $("name").value.trim();
      if (!n) { $("joinError").textContent = "Entre un pseudo"; return; }
      // A deliberate create supersedes any in-flight auto-rejoin (see error_msg).
      rejoining = false; myName = n.substring(0, 16); send({ t: "create", name: myName });
    };
    $("joinBtn").onclick = function () {
      var n = $("name").value.trim();
      var c = ($("code").value || "").trim().toUpperCase();
      if (!n) { $("joinError").textContent = "Entre un pseudo"; return; }
      if (!c) { $("joinError").textContent = "Entre un code de partie"; return; }
      rejoining = false; myName = n.substring(0, 16); myRoom = c; send({ t: "join", name: myName, room: c });
    };
    $("startBtn").onclick = function () { send({ t: "next" }); };
    $("backToHubBtn").onclick = function () { send({ t: "select_game", id: "" }); };
    $("navMenuBtn").onclick = function () { if (amHost()) send({ t: "select_game", id: "" }); };
    $("navBoardBtn").onclick = function () { openOverlay("ov-board"); };
    $("navHistoryBtn").onclick = function () { openOverlay("ov-history"); };
    $("navHelpBtn").onclick = function () { openOverlay("ov-help"); };
    $("navLeaveBtn").onclick = function () { if (!inRoom() || window.confirm("Quitter la partie ?")) leaveRoom(); };
    // Escape hatch from the reconnecting overlay: abandon the restore and start fresh.
    $("reconnectFreshBtn").onclick = function () { leaveRoom(); };
    // Desktop affordance: Enter in the landing inputs submits (join if a code is typed, else create).
    function landingSubmit() { (($("code").value || "").trim() ? $("joinBtn") : $("createBtn")).click(); }
    ["name", "code"].forEach(function (id) {
      $(id).addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); landingSubmit(); } });
    });
    initDelegated();
    connect(); show("s-join"); updateChrome();
  });
})();
