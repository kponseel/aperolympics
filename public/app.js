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
  // Build tag — single source of truth for the version badge in the corner.
  // Bump in lockstep with sw.js CACHE on every release; this is what surfaces
  // at the bottom-right so a tester can quickly confirm which build is live.
  var APP_VERSION = "v32";
  var APP_BUILD = "2026-05-29";

  var socket, myName = "", myRoom = "", state = null, currentRendererId = null, rejoining = false, wasHost = null, toastTimer = null, lastResultsSig = "";
  // Visibility chosen on the Create card; toggled by the .vis-btn group.
  var createVisibility = "public";
  // Snapshot of the last public-rooms list pushed by the server. Re-rendered
  // every time it changes (or the user opens the Choice screen).
  var publicRooms = [];
  var publicPollTimer = null;

  function $(id) { return document.getElementById(id); }
  function setStatus(t) { $("status").textContent = t; }
  function send(o) { if (socket && socket.connected) socket.emit("msg", o); }
  function escapeHtml(t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }

  var SHELL = ["s-pseudo", "s-choice", "s-hub", "s-lobby", "game-area"];
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
  function openOverlay(id) {
    $(id).classList.add("on");
    // Re-sync the 🏆 tab strip .on class to the persisted boardTab var on every
    // open — otherwise closing on "Soirée" and reopening shows session data
    // under a still-highlighted "Manche" button.
    if (id === "ov-board") {
      document.querySelectorAll(".board-tab").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-bt") === boardTab); });
      renderBoard();
    }
    if (id === "ov-help") renderHelp();
    if (id === "ov-history") renderHistory();
  }
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

  // Match history overlay. Reverse-chronological list of past games, each
  // showing the rich end-of-game payoff (winner banner + MVP + top-3 podium
  // or "Partie jouée — N joueurs"). A session recap at the top surfaces the
  // overall champ (most #1 finishes in scored games) + MVP of the soirée
  // (most distinct MVP labels collected), but only once at least 2 games
  // have been played — single-game sessions don't need a recap.
  function renderHistory() {
    var body = $("historyBody"); body.innerHTML = "";
    var h = (state && state.history) ? state.history.slice().reverse() : [];
    $("historyEmpty").style.display = h.length ? "none" : "block";

    if (h.length >= 2) {
      var trophies = {}, mvps = {};
      h.forEach(function (e) {
        if (e.standings && e.standings.length && e.standings[0].score > 0) {
          var champ = e.standings[0].name;
          trophies[champ] = (trophies[champ] || 0) + 1;
        }
        if (e.mvp && e.mvp.name) mvps[e.mvp.name] = (mvps[e.mvp.name] || 0) + 1;
      });
      function topOf(o) {
        var best = null;
        Object.keys(o).forEach(function (k) { if (!best || o[k] > o[best]) best = k; });
        return best;
      }
      var champ = topOf(trophies), mvp = topOf(mvps);
      var bits = [];
      if (champ) bits.push('<div>🥇 <b>Champion·ne :</b> ' + escapeHtml(champ) +
        ' <span class="muted">(' + trophies[champ] + ' trophée' + (trophies[champ] > 1 ? 's' : '') + ')</span></div>');
      if (mvp) bits.push('<div>⭐ <b>MVP de la soirée :</b> ' + escapeHtml(mvp) +
        ' <span class="muted">(' + mvps[mvp] + ' distinction' + (mvps[mvp] > 1 ? 's' : '') + ')</span></div>');
      if (bits.length) {
        var recap = document.createElement("div");
        recap.className = "hist-recap";
        recap.innerHTML = '<div class="hist-recap-head">Récap de la session — ' + h.length + ' parties</div>' + bits.join("");
        body.appendChild(recap);
      }
    }

    var medals = ["🥇", "🥈", "🥉"];
    h.forEach(function (e) {
      var g = window.Apero.games[e.game] || {};
      var scored = (e.standings || []).some(function (s) { return s.score > 0; });
      var rows;
      if (scored) {
        rows = (e.standings || []).slice(0, 3).map(function (s, i) {
          return '<li><span>' + (medals[i] || (i + 1) + ".") + ' ' + escapeHtml(s.name) + '</span><b>' + s.score + '</b></li>';
        }).join("");
      } else {
        rows = '<li><span class="muted">Partie jouée — ' + (e.standings || []).length + ' joueur(s)</span></li>';
      }
      var banner = "";
      if (e.winner_banner && e.winner_banner.text) {
        banner = '<div class="hist-banner">' +
          (e.winner_banner.emoji ? escapeHtml(e.winner_banner.emoji) + ' ' : '') +
          escapeHtml(e.winner_banner.text) + '</div>';
      }
      var mvpLine = "";
      if (e.mvp && e.mvp.label) {
        mvpLine = '<div class="hist-mvp">' +
          (e.mvp.emoji ? escapeHtml(e.mvp.emoji) + ' ' : '') +
          '<b>' + escapeHtml(e.mvp.name || '') + '</b> <span class="muted">— ' + escapeHtml(e.mvp.label) +
          (e.mvp.value != null && e.mvp.value !== '' ? ' · ' + escapeHtml(String(e.mvp.value)) : '') +
          '</span></div>';
      }
      var div = document.createElement("div");
      div.className = "hist-entry";
      div.innerHTML = '<div class="hist-head">' + (g.emoji || "🎮") + ' <b>' + escapeHtml(g.name || e.game) + '</b></div>' +
        banner + mvpLine + '<ol>' + rows + '</ol>';
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

  // The 🏆 overlay has two tabs:
  //   "round"   → live scores of the current game (zeroed when a new game is picked)
  //   "session" → cumulative wins / podiums / MVPs / points across every game
  //              played in this room since it was created
  // Switching tabs swaps which <ol> is visible; the corresponding "empty" hint
  // shows when its source data is empty (no players / no games finished yet).
  var boardTab = "round";
  function renderBoard() {
    if (boardTab === "session") { renderBoardSession(); return; }
    renderBoardRound();
  }
  function renderBoardRound() {
    $("boardList").style.display = "";
    $("boardSessionList").style.display = "none";
    $("boardSessionEmpty").style.display = "none";
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
  function renderBoardSession() {
    $("boardList").style.display = "none";
    $("boardEmpty").style.display = "none";
    $("boardSessionList").style.display = "";
    var ol = $("boardSessionList"); ol.innerHTML = "";
    var totals = (state && state.sessionTotals) || {};
    // Server keys by lowercased name; each entry carries its display `name`.
    // Build a flat list of entries for sorting (the key itself is throwaway).
    var entries = Object.keys(totals).map(function (k) {
      var t = totals[k]; return { name: (t && t.name) || k, wins: (t && t.wins) || 0, mvps: (t && t.mvps) || 0, podiums: (t && t.podiums) || 0, points: (t && t.points) || 0 };
    });
    if (!entries.length) { $("boardSessionEmpty").style.display = "block"; return; }
    $("boardSessionEmpty").style.display = "none";
    // Ranked by: wins desc, mvps desc, podiums desc, points desc, name asc.
    // Wins beat everything else so the player who actually won most games sits
    // on top even if a quiz savant has higher raw points without any wins.
    entries.sort(function (a, b) {
      return (b.wins - a.wins) || (b.mvps - a.mvps) || (b.podiums - a.podiums) || (b.points - a.points) || (a.name < b.name ? -1 : 1);
    });
    var connectedSet = {};
    (state && state.players || []).forEach(function (p) { if (p.connected) connectedSet[p.name] = true; });
    var medals = ["🥇", "🥈", "🥉"];
    entries.forEach(function (t, i) {
      var bits = [];
      if (t.wins) bits.push('🏆×' + t.wins);
      if (t.mvps) bits.push('⭐×' + t.mvps);
      if (t.podiums) bits.push('🥉×' + t.podiums);
      var stats = bits.length ? '<span class="bd-stats">' + bits.join(' · ') + '</span>' : '';
      var li = document.createElement("li");
      li.className = connectedSet[t.name] ? "" : "off";
      li.innerHTML = '<span class="rank">' + (medals[i] || (i + 1)) + '</span>' +
        '<span class="who">' + escapeHtml(t.name) + ' ' + stats + '</span>' +
        '<b class="pts">' + (t.points || 0) + '</b>';
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
    // Surface what's playable RIGHT NOW: sort games into 2 buckets
    // (jouable au compteur courant / encore X joueurs manquants), playable
    // ones go first. Inside each bucket, original definition order is kept.
    var ids = Object.keys(window.Apero.games);
    var playable = [], blocked = [];
    ids.forEach(function (id) {
      var g = window.Apero.games[id];
      var min = g.minPlayers || 1;
      if (connected >= min) playable.push(id); else blocked.push(id);
    });
    // A small header at the boundary so users see the "Encore X joueurs"
    // group as a deliberate section rather than greyed-out chaos.
    function appendDivider(label) {
      var div = document.createElement("div");
      div.className = "gc-divider";
      div.textContent = label;
      list.appendChild(div);
    }
    if (playable.length && blocked.length) {
      appendDivider("✨ Jouable maintenant (" + playable.length + ")");
    }
    playable.concat(["__sep__"]).concat(blocked).forEach(function (id, idx) {
      if (id === "__sep__") {
        if (playable.length && blocked.length) {
          appendDivider("👥 Encore des joueurs requis (" + blocked.length + ")");
        }
        return;
      }
      var g = window.Apero.games[id];
      var min = g.minPlayers || 1;
      var enough = connected >= min;
      var card = document.createElement("div");
      // .ready marks playable cards (bright accent); .below-min dims and
      // reveals the amber "Need K more" tag. Mutually exclusive.
      card.className = "game-card" +
        (iAmHost ? "" : " disabled") +
        (enough ? " ready" : " below-min");
      var needMore = enough ? "" : (min - connected);
      var minBadge = enough
        ? '<span class="gc-min ok" title="Jouable avec ' + connected + ' joueurs">👥 ' + min + '+ ✓</span>'
        : '<span class="gc-min" title="' + needMore + ' joueur(s) supplémentaire(s) requis">👥 ' + min + '+ · encore <b>' + needMore + '</b></span>';
      card.innerHTML = '<div class="icon">' + g.emoji + '</div>' +
        '<div class="gc-body"><div class="name">' + escapeHtml(g.name) + ' ' + minBadge + '</div>' +
        '<div class="muted">' + escapeHtml(g.desc || "") + '</div></div>' +
        (iAmHost && enough ? '<div class="gc-go">Jouer ›</div>' : '') +
        '<button type="button" class="info gc-info" title="Voir les règles">?</button>';
      // Tappable only when host AND enough players (avoids a "tap → nothing
      // visible" dead-end when the user picks a blocked card).
      if (iAmHost && enough) card.onclick = function () { send({ t: "select_game", id: id }); };
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
    var hn = (state && state.hostId) || "l'hôte";
    // Ready-state card: progress bar + count + status. Class toggle drives the
    // amber→green colour swap; bar caps at 100% so an over-subscribed lobby
    // (10/4) doesn't overflow its track.
    var lr = $("lobbyReady");
    lr.classList.toggle("ready", enough);
    lr.classList.toggle("waiting", !enough);
    var pct = Math.min(100, min ? Math.round(connected / min * 100) : 100);
    $("lrFill").style.width = pct + "%";
    $("lrProgress").setAttribute("aria-valuenow", String(pct));
    $("lrCount").textContent = connected + " / " + min + " joueur" + (min > 1 ? "s" : "") + (enough && connected > min ? " (+" + (connected - min) + ")" : "");
    $("lrStatus").innerHTML = enough
      ? (iAmHost
          ? "✅ Prêt à démarrer — clique <b>Démarrer</b> quand tout le monde est là"
          : "✅ Prêt — en attente de 👑 " + escapeHtml(hn))
      : "⏳ Il manque <b>" + (min - connected) + "</b> joueur" + (min - connected > 1 ? "s" : "") + " — partage le code ci-dessus";
    $("startBtn").style.display = iAmHost ? "block" : "none";
    $("startBtn").disabled = !enough;
    $("backToHubBtn").style.display = iAmHost ? "block" : "none";
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
    // 🏁 "Terminer la session" — only meaningful for loop-only games that
    // declare `endable: true` and only while playing/reveal (host's call).
    var endDef = inGame ? window.Apero.games[state.game] : null;
    var endableNow = !!(endDef && endDef.endable && amHost() && state.phase !== "lobby" && state.phase !== "finished");
    $("navEndBtn").style.display = endableNow ? "" : "none";
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
    if (!state || !findMe()) {
      // Not in a room — landing flow. Pseudo is the gate: stage 1 if missing,
      // stage 2 (choice: rejoindre / créer) otherwise.
      if (myName) { renderChoice(); updateChrome(); return; }
      show("s-pseudo"); stopPublicPoll(); updateChrome(); return;
    }
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

  // --- landing (pseudo → choice) --------------------------------------------
  // Stage 2: greet the user, show the live public-rooms counter + list, and
  // wire the join-by-code / create-with-visibility cards. Polls the server
  // every 5 s for a fresh list while this screen is on.
  function renderChoice() {
    show("s-choice");
    $("choiceWho").textContent = myName;
    renderPublicList();
    startPublicPoll();
    // The card already greets the player; keep the top sub-line as guidance
    // (not a duplicate "Salut <name>").
    setStatus("Rejoins une partie ou crée la tienne 🎉");
  }
  function renderPublicList() {
    var n = publicRooms.length;
    // Build the whole sentence as one text node (the counter is an inline-flex
    // row with a gap, so separate spans would get gap-spaced → "partie s").
    // French: singular for 0 and 1, plural from 2.
    var plural = n >= 2 ? "s" : "";
    $("choiceCount").textContent = n + " partie" + plural + " publique" + plural + " en cours";
    var ul = $("pubList"); ul.innerHTML = "";
    $("pubEmpty").style.display = n === 0 ? "" : "none";
    publicRooms.forEach(function (r) {
      var g = (r.gameId && window.Apero.games[r.gameId]) || null;
      var phaseLabel = !r.gameId ? "menu" : (r.phase === "lobby" ? "lobby" : (r.phase === "finished" ? "fin de partie" : "en cours"));
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pub-item";
      btn.innerHTML =
        '<div class="pi-emoji">' + (g ? g.emoji : "🎮") + '</div>' +
        '<div class="pi-body">' +
          '<div class="pi-game">' + escapeHtml(g ? g.name : "Salon") + '</div>' +
          '<div class="pi-meta"><span class="pi-code">' + escapeHtml(r.code) + '</span> · ' + r.players + ' joueur' + (r.players > 1 ? 's' : '') + ' · ' + phaseLabel + '</div>' +
        '</div>' +
        '<div class="pi-go">Rejoindre →</div>';
      btn.onclick = function () { joinByCode(r.code); };
      ul.appendChild(btn);
    });
  }
  function requestPublicList() { send({ t: "list_public" }); }
  function startPublicPoll() {
    if (publicPollTimer) return;
    requestPublicList();
    publicPollTimer = setInterval(requestPublicList, 5000);
  }
  function stopPublicPoll() {
    if (publicPollTimer) { clearInterval(publicPollTimer); publicPollTimer = null; }
  }
  function joinByCode(code) {
    var c = String(code || "").trim().toUpperCase();
    if (!c) { $("joinError").textContent = "Entre un code de partie"; return; }
    if (!myName) { $("joinError").textContent = "Entre d'abord un pseudo"; return; }
    rejoining = false; myRoom = c; $("joinError").textContent = "";
    send({ t: "join", name: myName, room: c });
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
      else if (myName) { setStatus("Rejoins une partie ou crée la tienne 🎉"); requestPublicList(); }
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
      if (findMe()) { rejoining = false; hideReconnecting(); saveSession(); stopPublicPoll(); }
      render();
    });
    socket.on("private", function (m) { if (state) { state._private = m.round || {}; render(); } });
    // Server's snapshot of joinable public rooms. Rendered immediately if the
    // user is on the choice screen; otherwise just stashed for the next open.
    socket.on("public_rooms", function (m) {
      publicRooms = (m && m.rooms) || [];
      if ($("s-choice").classList.contains("on")) renderPublicList();
    });
    socket.on("error_msg", function (m) {
      // An auto-rejoin failed: the room was swept after inactivity, or the
      // server restarted and lost all rooms. Clear the dead-room handle (but
      // KEEP the pseudo, which lives in its own localStorage key) and drop to
      // the choice screen with a gentle explanation.
      if (rejoining) {
        rejoining = false; clearSession(); myRoom = ""; state = null;
        if (currentRendererId) switchTo(null);
        hideReconnecting(); render();
        $("joinError").textContent = "La partie n'existe plus — crée une nouvelle partie ou rejoins avec un code.";
        if (myName) requestPublicList();
        return;
      }
      var e = $("joinError"); if (e) e.textContent = (m && m.msg) ? m.msg : "Erreur";
    });
  }

  // Leave the room: drop our session (server marks us offline) and reset to the
  // landing screen with a fresh socket that won't auto-rejoin.
  function leaveRoom() {
    myRoom = ""; state = null; rejoining = false; clearSession();
    if (currentRendererId) switchTo(null);
    hideReconnecting(); document.body.classList.remove("offline");
    closeOverlay("ov-board"); closeOverlay("ov-help"); closeOverlay("ov-history");
    if (socket) { socket.disconnect(); socket.connect(); }
    $("code").value = ""; $("joinError").textContent = "";
    render(); updateChrome();
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

  // Pseudo persistence — separate key from the room session. Survives ✕ Quitter
  // so a returning player lands straight on the choice screen with the same
  // name. Wiped only by an explicit "modifier" then empty submit.
  var PSEUDO_KEY = "apero.pseudo";
  function savePseudo(n) { try { if (n) localStorage.setItem(PSEUDO_KEY, n); } catch (e) {} }
  function clearPseudo() { try { localStorage.removeItem(PSEUDO_KEY); } catch (e) {} }
  function loadPseudo() { try { return localStorage.getItem(PSEUDO_KEY) || ""; } catch (e) { return ""; } }

  // One delegated click handler for: closing overlays, copy-to-clipboard,
  // and tap-to-toggle tooltips (mobile-friendly — no hover needed).
  function initDelegated() {
    var tip = null;
    document.addEventListener("click", function (e) {
      if (tip) { tip.parentNode && tip.parentNode.removeChild(tip); tip = null; }
      var close = e.target.closest && e.target.closest("[data-close]");
      if (close) { closeOverlay(close.getAttribute("data-close")); return; }
      // Backdrop click → close the overlay. The .overlay sits behind the
      // .sheet; if the user tapped the overlay element itself (not its
      // children), it's a backdrop tap and we dismiss. Common mobile-sheet
      // expectation; without this users have to find the tiny ✕ button.
      // The reconnect overlay is excluded (modal, must be dismissed via
      // its own "Recommencer à zéro" button).
      if (e.target.classList && e.target.classList.contains("overlay") &&
          e.target.id !== "ov-reconnect" && e.target.classList.contains("on")) {
        closeOverlay(e.target.id);
        return;
      }
      // 🏆 overlay tab switch (round vs session totals)
      var bt = e.target.closest && e.target.closest("[data-bt]");
      if (bt) {
        var name = bt.getAttribute("data-bt");
        if (name !== boardTab) {
          boardTab = name;
          document.querySelectorAll(".board-tab").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-bt") === name); });
          renderBoard();
        }
        return;
      }
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
    // Escape key closes any open dismissable overlay (board / history / help).
    // The reconnect overlay is excluded — same reason as the backdrop guard.
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var open = document.querySelector(".overlay.on:not(#ov-reconnect)");
      if (open) closeOverlay(open.id);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    prefillFromUrl();
    // Pre-fill the pseudo input from the persistent localStorage key (separate
    // from the room session). The user can still edit before validating.
    var savedPseudo = loadPseudo();
    if (savedPseudo) $("name").value = savedPseudo;
    // Auto-rejoin if a full session (pseudo + room) is saved. A /r/CODE link
    // for a *different* room wins over the saved one (we don't auto-rejoin).
    (function () {
      var saved = loadSession();
      if (!saved) {
        // No room to rejoin, but we may have the pseudo — that primes stage 2
        // (s-choice) so the user skips re-typing on every visit.
        if (savedPseudo) myName = savedPseudo;
        return;
      }
      var urlCode = ($("code").value || "").trim().toUpperCase();
      if (!urlCode || urlCode === saved.room) {
        myName = saved.name; myRoom = saved.room;
        showReconnecting(myRoom);
      } else {
        if (saved.name) myName = saved.name;
      }
    })();

    // Stage 1 → Stage 2 promotion: validate the pseudo, persist it, switch
    // to the choice screen, and ask the server for the public-rooms list.
    // A blank submit is treated as "forget the saved pseudo" (keeps memory and
    // localStorage in sync — otherwise the next visit would pre-fill a stale name).
    function commitPseudo() {
      var n = ($("name").value || "").trim();
      if (!n) {
        myName = "";
        clearPseudo();
        $("pseudoError").textContent = "Entre un pseudo pour continuer";
        return;
      }
      myName = n.substring(0, 16);
      savePseudo(myName);
      $("pseudoError").textContent = "";
      render();
      requestPublicList();
    }
    $("continueBtn").onclick = commitPseudo;
    $("name").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commitPseudo(); }
    });
    // "modifier" link on the choice screen: go back to stage 1 to change the
    // pseudo. We don't wipe localStorage; only an empty submit on stage 1 will.
    $("editPseudoBtn").onclick = function () {
      // Preserve the current pseudo as the input default so editing is a
      // tweak, not a fresh type-in. User can clear it to fully reset.
      $("name").value = myName;
      myName = "";
      $("pseudoError").textContent = "";
      stopPublicPoll();
      // Also reset the create-visibility toggle to its default so a stale
      // "Cachée" choice from a previous round-trip can't silently apply on
      // the next Créer click (DOM may have re-rendered but the module var
      // would otherwise survive).
      createVisibility = "public";
      document.querySelectorAll(".vis-btn").forEach(function (x) {
        var on = x.getAttribute("data-vis") === "public";
        x.classList.toggle("on", on);
        x.setAttribute("aria-checked", on ? "true" : "false");
      });
      render();
      setTimeout(function () { try { $("name").focus(); } catch (e) {} }, 0);
    };

    // Visibility toggle on the Create card (Public ↔ Cachée).
    document.querySelectorAll(".vis-btn").forEach(function (b) {
      b.onclick = function () {
        createVisibility = b.getAttribute("data-vis") === "private" ? "private" : "public";
        document.querySelectorAll(".vis-btn").forEach(function (x) {
          var on = x.getAttribute("data-vis") === createVisibility;
          x.classList.toggle("on", on);
          x.setAttribute("aria-checked", on ? "true" : "false");
        });
      };
    });

    $("createBtn").onclick = function () {
      if (!myName) { $("joinError").textContent = "Entre d'abord un pseudo"; return; }
      // A deliberate create supersedes any in-flight auto-rejoin (see error_msg).
      rejoining = false;
      send({ t: "create", name: myName, visibility: createVisibility });
    };
    $("joinBtn").onclick = function () {
      var c = ($("code").value || "").trim().toUpperCase();
      if (!myName) { $("joinError").textContent = "Entre d'abord un pseudo"; return; }
      if (!c) { $("joinError").textContent = "Entre un code de partie"; return; }
      rejoining = false; myRoom = c; $("joinError").textContent = "";
      send({ t: "join", name: myName, room: c });
    };
    $("refreshPubBtn").onclick = function () { requestPublicList(); };
    $("code").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); $("joinBtn").click(); }
    });

    $("startBtn").onclick = function () { send({ t: "next" }); };
    $("backToHubBtn").onclick = function () { send({ t: "select_game", id: "" }); };
    $("navMenuBtn").onclick = function () { if (amHost()) send({ t: "select_game", id: "" }); };
    $("navBoardBtn").onclick = function () { openOverlay("ov-board"); };
    $("navHistoryBtn").onclick = function () { openOverlay("ov-history"); };
    $("navHelpBtn").onclick = function () { openOverlay("ov-help"); };
    $("navLeaveBtn").onclick = function () { if (!inRoom() || window.confirm("Quitter la partie ?")) leaveRoom(); };
    $("navEndBtn").onclick = function () { if (amHost() && window.confirm("Terminer la session et voir les stats ?")) send({ t: "end" }); };
    // Escape hatch from the reconnecting overlay: abandon the restore and start fresh.
    $("reconnectFreshBtn").onclick = function () { leaveRoom(); };

    initDelegated();
    // Populate the discreet version badge in the corner from the build
    // constants above. Updated once at boot; never re-rendered.
    $("versionTag").textContent = APP_VERSION + " · " + APP_BUILD;
    connect();
    // Initial screen choice: if we have a pseudo (and no auto-rejoin in flight),
    // skip stage 1 and land on the choice screen immediately.
    if (myName && !myRoom) { renderChoice(); }
    else if (!myName) { show("s-pseudo"); }
    updateChrome();
  });
})();
