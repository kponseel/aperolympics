// Are We A Match? — SPA. Socket.IO namespace /match.
// Écrans : pseudo(+PIN) / packs / salle.
// États salle : idle → question (classer 3 options) → reveal (5 s) → … → results.
//
// L'état public ne contient jamais le classement d'un autre joueur pendant la
// phase `question` : le payload personnel arrive par `private_state`.

(function () {
  "use strict";

  // ---------- identité ----------
  function uuid() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function (c) {
      return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
    });
  }
  // Repli en mémoire : un navigateur qui bloque localStorage (mode privé
  // strict, quota plein) ne doit pas empêcher de jouer CE soir — juste ne
  // rien retenir pour la prochaine fois.
  var memCid = null, memPseudo = "";
  function getCid() {
    try {
      var c = localStorage.getItem("am.cid");
      if (!c) { c = uuid(); localStorage.setItem("am.cid", c); }
      return c;
    } catch (e) { if (!memCid) memCid = uuid(); return memCid; }
  }
  function getPseudo() {
    try { return (localStorage.getItem("am.pseudo") || "").trim(); }
    catch (e) { return memPseudo; }
  }
  function setPseudo(n) {
    try { localStorage.setItem("am.pseudo", n); } catch (e) { memPseudo = n; }
  }

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function show(screenId) {
    ["s-pseudo", "s-hall", "s-room"].forEach(function (s) { var el = $(s); if (el) el.classList.toggle("on", s === screenId); });
    var back = $("amBack"); if (back) back.style.display = (screenId === "s-room") ? "" : "none";
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function setStatus(t) { var el = $("amStatus"); if (el) el.textContent = t || ""; }
  function medal(i) { return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1); }
  // Accord par paires entre deux classements de la même question — le même
  // calcul que le moteur côté serveur : sur 3 options, 3 comparaisons.
  function pairAgree(a, b) {
    if (!a || !b || a.length !== b.length) return null;
    var n = a.length, pa = [], pb = [], agree = 0, total = 0;
    for (var i = 0; i < n; i++) { pa[a[i]] = i; pb[b[i]] = i; }
    for (var x = 0; x < n; x++) for (var y = x + 1; y < n; y++) { total++; if ((pa[x] < pa[y]) === (pb[x] < pb[y])) agree++; }
    return { agree: agree, total: total };
  }
  // « 🏔️ Rando et grand air » → « 🏔️ » : le pictogramme de tête suffit à
  // relire un classement d'un coup d'œil (sinon, le numéro de l'option).
  function emojiOf(label, idx) {
    var m = /^(\S+)\s/.exec(label || "");
    return (m && /^[^\w\d]/.test(m[1])) ? m[1] : String(idx + 1);
  }

  // ---------- état ----------
  var socket = null, connected = false;
  var lastLobby = null, lastRoom = null, lastPrivate = {}, currentRoomId = null;
  var myProtected = false, pinMode = false;
  var clockSkewMs = 0;
  var refreshTick = null;
  var roomStructSig = "";
  // Classement en cours de saisie : indices d'options dans l'ordre de préférence.
  var myRank = [];
  var lastQuestionId = null;
  var submitted = false;
  // Mode dev : jeton mémorisé (12 h côté serveur), infos renvoyées au
  // déverrouillage (packs, bots max, salle encore en vie) et réglages de la
  // salle de test.
  var devOn = false, devInfo = null;
  var devForm = { pack: "amis", order: "file", start_at: 1, count: 0, bots: 2 };
  function getDevToken() { try { return localStorage.getItem("am.devToken") || ""; } catch (e) { return ""; } }
  function setDevToken(t) { try { if (t) localStorage.setItem("am.devToken", t); else localStorage.removeItem("am.devToken"); } catch (e) {} }

  function serverNow() { return Date.now() + clockSkewMs; }

  function connect() {
    if (socket) return;
    socket = io("/match", { transports: ["websocket", "polling"] });
    socket.on("connect", function () {
      connected = true; setStatus("");
      if (getPseudo()) socket.emit("set_identity", { cid: getCid(), name: getPseudo() });
    });
    socket.on("disconnect", function () { connected = false; setStatus("Connexion perdue — reconnexion…"); });

    socket.on("identity_ok", function (m) {
      setStatus(""); pinMode = false;
      myProtected = !!(m && m.protected);
      // On adopte le pseudo CANONIQUE renvoyé par le serveur — jamais la
      // saisie brute. Sans ça, une différence de casse ("Alice" tapé,
      // "alice" déjà en base) faisait dérailler la comparaison "suis-je
      // l'hôte ?" (host_name === getPseudo()) : impossible de lancer sa
      // propre partie. On ne mémorise le pseudo qu'ICI, une fois confirmé —
      // jamais avant, sinon une simple faute de frappe restait collée au
      // téléphone pour la prochaine fois.
      if (m && m.name) setPseudo(m.name);
      $("amLocked").style.display = "none";
      $("amContinue").textContent = "C'est parti →";
      if (currentRoomId) { show("s-room"); socket.emit("join_room", { id: currentRoomId }); }
      else enterHall();
      updateMe();
      // Un jeton dev mémorisé rouvre le mode dev sans retaper le mot de passe.
      if (getDevToken()) socket.emit("dev_unlock", { token: getDevToken() });
    });
    socket.on("pin_required", function (m) { enterPinMode(m && m.name, "🔒 Ce pseudo est protégé. Entre ton code PIN."); });
    socket.on("pin_wrong", function (m) {
      enterPinMode(m && m.name, "❌ Code incorrect. Il te reste " + (m && m.attempts_left) + " essai" + ((m && m.attempts_left) > 1 ? "s" : "") + ".");
      var pin = $("amPin"); if (pin) { pin.value = ""; pin.focus(); }
    });
    socket.on("identity_locked", function () {
      pinMode = false; show("s-pseudo");
      $("amPseudoError").textContent = "";
      $("amLocked").style.display = "block";
    });
    socket.on("pin_set", function () { myProtected = true; updateMe(); toast("🔒 Pseudo protégé !"); });

    socket.on("lobby_state", function (m) { lastLobby = m || {}; renderHall(); });
    socket.on("room_state", function (m) {
      // On ignore tout état qui ne concerne pas la salle affichée : un
      // room_state en retard (changement de salle en cours, message
      // rejoué après une coupure) ne doit jamais faire afficher — ni faire
      // voter — sur la question d'un autre pack.
      if (!m || m.id !== currentRoomId) return;
      var prev = lastRoom;
      lastRoom = m;
      window.__amLastRoom = lastRoom;
      if (lastRoom.server_now_ms) clockSkewMs = lastRoom.server_now_ms - Date.now();
      // Nouvelle question → on réinitialise la saisie locale ET le classement
      // privé de la question précédente (sinon le badge « ton n°1 » du
      // reveal continuait d'afficher un choix qui n'est plus d'actualité).
      var qid = lastRoom.question ? lastRoom.question.id : null;
      if (qid !== lastQuestionId) {
        lastQuestionId = qid;
        myRank = [];
        submitted = false;
        lastPrivate = {};
      }
      if (!prev || prev.state !== lastRoom.state) roomStructSig = "";
      renderRoom();
    });
    socket.on("private_state", function (m) {
      lastPrivate = m || {};
      window.__amPrivate = lastPrivate;
      // Le serveur confirme notre classement → on verrouille l'UI.
      if (lastPrivate.my_ranking) { myRank = lastPrivate.my_ranking.slice(); submitted = true; }
      roomStructSig = "";
      renderRoom();
    });
    socket.on("profile", function (m) {
      if (!m || m.ok === false) { toast("Pas encore de profil pour ce joueur."); return; }
      openProfile(m);
    });
    // Accusé explicite pour chaque "msg" (demarrer/skip/rank) envoyé : le
    // classement se verrouille de façon optimiste dès l'envoi ("Classement
    // envoyé ✅"), donc un rejet resté muet laissait l'UI mentir sans que
    // rien ne le détrompe — un vote refusé (même appareil, 2 onglets ; ou
    // arrivé sur une question qui n'est déjà plus la bonne) semblait accepté.
    socket.on("msg_ack", function (m) {
      if (!m || m.ok || m.t !== "rank") return;
      // On déverrouille et on prévient : le joueur peut reclasser pour de
      // vrai, plutôt que de rester bloqué à croire que c'est fait.
      submitted = false;
      roomStructSig = ""; renderRoom();
      if (m.reason === "already_answered") toast("Déjà envoyé depuis un autre onglet sur cet appareil.");
      else if (m.reason === "stale") toast("La question a changé entre-temps — reclasse pour valider.");
      else toast("Classement non pris en compte, réessaie.");
    });
    // --- mode dev ---
    socket.on("dev_state", function (m) {
      if (!m || m.enabled === false) {
        devOn = false; devInfo = null; setDevToken(""); renderDevCard();
        devSheetError("Mode dev désactivé sur ce serveur (ADMIN_PASSWORD n'est pas défini).");
        return;
      }
      if (!m.ok) {
        if (m.reason === "bad_token") setDevToken("");
        devSheetError(m.reason === "locked" ? "Trop d'essais — réessaie dans 15 minutes."
          : m.reason === "bad_token" ? "Session dev expirée : retape le mot de passe."
          : "Mot de passe incorrect.");
        return;
      }
      devOn = true; devInfo = m;
      if (m.token) setDevToken(m.token);
      if (m.packs && m.packs.length && !m.packs.some(function (p) { return p.id === devForm.pack; })) devForm.pack = m.packs[0].id;
      closeSheet(); renderDevCard();
      toast("🧪 Mode dev activé");
    });
    // Le serveur vient de créer NOTRE salle de test et nous y a placés : on
    // l'affiche (son état arrive juste derrière par room_state).
    socket.on("dev_room", function (m) {
      if (!m || !m.id) return;
      currentRoomId = m.id; roomStructSig = ""; myRank = []; submitted = false; lastQuestionId = null; lastPrivate = {}; lastRoom = null;
      show("s-room");
    });
    socket.on("error_msg", function (m) {
      var code = m && m.msg;
      if (code === "bad_identity" || code === "no_identity") return;
      if (code === "dev_locked") { toast("Mode dev verrouillé — déverrouille-le d'abord."); return; }
      if (code === "unknown_pack" || code === "dev_too_many_rooms") { toast("Impossible de créer la salle de test (" + code + ")."); return; }
      if (code === "bad_pin") { toast("PIN invalide (4 chiffres)."); return; }
      if (code === "not_owner") { toast("Ce pseudo appartient à un autre joueur."); return; }
      setStatus(code ? "Erreur : " + code : "Erreur");
    });
  }

  // ---------- toast ----------
  var toastTimer = null;
  function toast(msg) {
    setStatus(msg);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { setStatus(""); }, 2500);
  }

  // ---------- pseudo / PIN ----------
  function enterPinMode(name, msg) {
    pinMode = true; show("s-pseudo");
    $("amLocked").style.display = "none";
    if (name) $("amName").value = name;
    $("amPinLabel").innerHTML = "🔒 Code PIN <span class='am-soft'>(4 chiffres)</span>";
    $("amPseudoError").textContent = msg || "";
    $("amPseudoError").className = "am-error center warn";
    var pin = $("amPin"); if (pin) { pin.value = ""; setTimeout(function () { pin.focus(); }, 50); }
    $("amContinue").textContent = "Déverrouiller 🔓";
  }
  function submitPseudo() {
    var name = ($("amName").value || "").trim().slice(0, 16);
    var pin = ($("amPin").value || "").trim();
    if (!name) { $("amPseudoError").textContent = "Entre ton pseudo."; return; }
    if (pin && !/^\d{4}$/.test(pin)) { $("amPseudoError").textContent = "Le PIN doit faire 4 chiffres."; return; }
    // Le pseudo n'est mémorisé qu'à la confirmation serveur (identity_ok) —
    // pas ici : une faute de frappe ou un pseudo déjà pris ne doit pas
    // rester collé au téléphone avant même d'avoir été validé.
    $("amPseudoError").textContent = ""; $("amPseudoError").className = "am-error center";
    if (socket) socket.emit("set_identity", { cid: getCid(), name: name, pin: pin });
    if (!pinMode) enterHall();
  }
  function updateMe() {
    var el = $("amWho"); if (!el) return;
    var p = getPseudo();
    el.textContent = p ? (myProtected ? "🔒 " : "👋 ") + p : "";
    el.style.display = p ? "" : "none";
    el.onclick = function () { if (p && socket) socket.emit("get_profile", { name: p, pack: currentRoomId || null }); };
    var me = $("amMe"); if (me) me.style.display = p ? "" : "none";
    var pr = $("amProtect"); if (pr) pr.style.display = (p && !myProtected) ? "" : "none";
  }
  function enterHall() {
    currentRoomId = null; pinMode = false;
    $("amContinue").textContent = "C'est parti →";
    if (socket && connected) socket.emit("join_lobby");
    updateMe();
    show("s-hall");
    stopRefresh();
  }

  // ---------- overlay ----------
  function openSheet(title, html, onMount) {
    $("amSheetTitle").textContent = title;
    var body = $("amSheetBody"); body.innerHTML = html;
    $("amOverlay").style.display = "flex";
    if (typeof onMount === "function") onMount(body);
  }
  function closeSheet() { $("amOverlay").style.display = "none"; }

  function protectName() {
    openSheet("🔒 Protéger « " + getPseudo() + " »",
      '<p>Choisis un code PIN à 4 chiffres. Il te servira à récupérer ton pseudo (et ton historique de matchs) depuis un autre appareil.</p>' +
      '<input id="amFormPin" type="tel" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off" pattern="[0-9]*" />' +
      '<button type="button" class="am-primary" id="amFormGo">🔒 Protéger</button>' +
      '<div class="am-error center" id="amFormErr"></div>',
      function (body) {
        var input = body.querySelector("#amFormPin");
        var err = body.querySelector("#amFormErr");
        setTimeout(function () { input.focus(); }, 80);
        function go() {
          var pin = (input.value || "").trim();
          if (!/^\d{4}$/.test(pin)) { err.textContent = "Le PIN doit faire 4 chiffres."; input.focus(); return; }
          if (socket) socket.emit("set_pin", { pin: pin });
          closeSheet();
        }
        body.querySelector("#amFormGo").onclick = go;
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
      });
  }

  // ---------- hall ----------
  function packStateLabel(card) {
    if (card.state === "question" || card.state === "reveal") {
      return { txt: "🔥 En cours (" + (card.q_index + 1) + "/" + card.q_count + ")", cls: "live" };
    }
    if (card.state === "results") return { txt: "💘 Résultats…", cls: "live" };
    if (card.player_count > 0) return { txt: "⏳ " + card.player_count + " en attente", cls: "" };
    return { txt: "Touche pour jouer", cls: "" };
  }
  // "2026-09-02" → "2 sept. 2026". Sans passer par Date : une date sans
  // heure serait décalée d'un jour selon le fuseau du téléphone.
  function fmtDay(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return iso || "";
    var mois = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    var d = parseInt(m[3], 10);
    return (d === 1 ? "1er" : d) + " " + mois[parseInt(m[2], 10) - 1] + " " + m[1];
  }
  function renderHall() {
    if (!lastLobby) return;
    updateMe();
    // Version + date de la dernière mise à jour, en petit tout en bas du hall.
    var ver = $("amVersion"), app = lastLobby.app;
    if (ver) {
      ver.textContent = (app && app.version) ? "v" + app.version + " · màj " + fmtDay(app.date) : "";
      ver.title = ((app && app.sha) ? "commit " + app.sha + " · " : "") + "touche pour le mode dev";
      // Entrée discrète du mode dev : toucher la ligne de version.
      ver.classList.add("clickable");
      ver.onclick = openDevSheet;
    }
    var wrap = $("amPacks"); if (!wrap) return;
    wrap.innerHTML = "";
    (lastLobby.rooms || []).forEach(function (card) {
      var st = packStateLabel(card);
      var el = document.createElement("button");
      el.type = "button";
      el.className = "am-pack-card" + (st.cls === "live" ? " live" : "");
      el.innerHTML =
        '<span class="am-pack-emoji">' + esc(card.pack_emoji) + '</span>' +
        '<span class="am-pack-body">' +
          '<span class="am-pack-name">' + esc(card.pack_name) + '</span>' +
          '<span class="am-pack-tag">' + esc(card.pack_tagline || "") + '</span>' +
          '<span class="am-pack-state ' + st.cls + '">' + esc(st.txt) + '</span>' +
        '</span>';
      el.onclick = function () { enterRoom(card.id); };
      wrap.appendChild(el);
    });
  }

  // ---------- salle ----------
  function enterRoom(id) {
    currentRoomId = id; roomStructSig = ""; myRank = []; submitted = false; lastQuestionId = null; lastPrivate = {};
    if (socket && connected) { socket.emit("leave_lobby"); socket.emit("join_room", { id: id }); }
    show("s-room");
  }
  function leaveRoom() {
    if (socket && connected && currentRoomId) socket.emit("leave_room");
    currentRoomId = null; lastRoom = null; lastPrivate = {};
    enterHall();
  }
  function amHost() {
    var r = lastRoom; if (!r) return false;
    return !!(r.host_name && r.host_name === getPseudo());
  }

  function renderRoom() {
    if (!lastRoom) return;
    var r = lastRoom;
    $("amRoomEmoji").textContent = r.pack_emoji || "💘";
    $("amRoomTitle").textContent = r.pack_name || "—";
    var badge = $("amDevBadge"); if (badge) badge.style.display = r.dev ? "" : "none";
    if (r.state === "idle") { stopRefresh(); renderIdle(r); return; }
    if (r.state === "question") { startRefresh(); renderQuestion(r); return; }
    if (r.state === "reveal") { startRefresh(); renderReveal(r); return; }
    if (r.state === "results") { startRefresh(); renderResults(r); return; }
  }

  function renderPills(list, hostName, answeredNames) {
    var me = getPseudo();
    if (!list || !list.length) return '<p class="am-hint">—</p>';
    return '<div class="am-pills">' + list.map(function (p) {
      var isHost = hostName && p.name === hostName;
      var done = answeredNames && answeredNames.indexOf(p.name) >= 0;
      return '<span class="am-pill' + (p.name === me ? " me" : "") + (isHost ? " host" : "") + (done ? " done" : "") + (p.bot ? " bot" : "") + '">' +
        (isHost ? "👑 " : "") + esc(p.name) + (done ? " ✓" : "") + '</span>';
    }).join("") + '</div>';
  }

  function renderIdle(r) {
    var me = getPseudo();
    var players = r.players || [];
    var inRoom = players.some(function (p) { return p.name === me; });
    var host = r.host_name || "";
    var isHost = inRoom && host === me;
    var enough = players.length >= (r.min_players || 2);
    // Le principe, expliqué là où on attend que tout le monde arrive.
    var concept =
      '<div class="am-card am-concept"><h3>💡 Le principe</h3>' +
      '<ol class="am-steps compact">' +
      '<li><span class="num">1</span><span><b>Classe 3 options</b> à chaque question, de ta préférée à la moins aimée. Pas de bonne réponse : juste toi.</span></li>' +
      '<li><span class="num">2</span><span><b>Après chaque question</b>, tu vois les réponses de chacun, ton accord avec chacun, et votre compatibilité jusque-là.</span></li>' +
      '<li><span class="num">3</span><span><b>À la fin</b> : qui est le plus compatible avec qui, tout le monde contre tout le monde.</span></li>' +
      '</ol>' +
      '<p class="am-hint">' + (r.dev ? "" : "10 questions · ~5 minutes · ") + 'l\'hôte 👑 lance la partie et peut passer à la question suivante.</p></div>';
    $("amRoomBody").innerHTML =
      '<div class="am-card"><p class="am-hint center">' + esc(r.pack_tagline || "") + '</p></div>' +
      '<div class="am-card"><h3>Joueurs (' + players.length + ')</h3>' + renderPills(players, host) + '</div>' +
      concept +
      (inRoom
        ? (isHost
          ? (enough
            ? '<button class="am-primary xl" id="amStart">' + (r.dev ? "🧪 Lancer la salle de test" : "💘 Lancer la partie") + '</button>' +
              '<p class="am-hint center">' + (r.dev ? devIdleHint(r) : "10 questions · tu contrôles le rythme 👑") + '</p>'
            : '<div class="am-card am-center-card"><div class="am-big">👥</div>' +
                '<p class="am-lead">Il faut au moins <b>' + (r.min_players || 2) + ' joueurs</b>.</p>' +
                '<p class="am-hint">Partage le lien pour qu\'on te rejoigne !</p></div>')
          : '<div class="am-card am-center-card"><div class="am-big">⏳</div>' +
              '<p class="am-lead">En attente de <b>👑 ' + esc(host || "l\'hôte") + '</b>…</p>' +
              '<p class="am-hint">Seul l\'hôte peut lancer la partie.</p></div>')
        : '<button class="am-primary xl" id="amJoin">🎮 Rejoindre</button>');
    var sb = $("amStart"); if (sb) sb.onclick = function () { if (socket) socket.emit("msg", { t: "demarrer" }); };
    var jb = $("amJoin"); if (jb) jb.onclick = function () { if (socket && currentRoomId) socket.emit("join_room", { id: currentRoomId }); };
  }

  // --- question : tap-to-rank ---
  function renderQuestion(r) {
    var q = r.question;
    if (!q) return;
    var sig = "q:" + q.id + ":" + (submitted ? "done" : myRank.join(",")) ;
    if (roomStructSig !== sig) {
      roomStructSig = sig;
      var body = "";
      body += '<div class="am-qmeta"><span>Question ' + (r.q_index + 1) + " / " + r.q_count + '</span>' +
              '<span id="amAnswered">' + (r.answered || 0) + " / " + (r.answered_total || 0) + ' ont répondu</span></div>';
      body += '<div class="am-timerbar" id="amBar"><i></i></div>';
      body += '<div class="am-q">' + esc(q.q) + '</div>' +
              (q.ctx ? '<p class="am-qctx">' + esc(q.ctx) + '</p>' : '');

      if (submitted) {
        // Classement verrouillé : on l'affiche en lecture seule.
        body += '<div class="am-opts">' + q.o.map(function (label, i) {
          var pos = myRank.indexOf(i);
          return '<div class="am-opt ranked' + (pos === 0 ? " r1" : "") + '">' +
            '<span class="am-rankbadge">' + (pos + 1) + '</span>' +
            '<span class="am-opttext">' + esc(label) + '</span></div>';
        }).join("") + '</div>';
        body += '<div class="am-waiting"><div class="am-big">✅</div><p class="am-lead">Classement envoyé — on attend les autres…</p></div>';
      } else {
        body += '<div class="am-opts" id="amOpts">' + q.o.map(function (label, i) {
          var pos = myRank.indexOf(i);
          var ranked = pos >= 0;
          return '<button type="button" class="am-opt' + (ranked ? " ranked" : "") + (pos === 0 ? " r1" : "") + '" data-i="' + i + '">' +
            '<span class="am-rankbadge">' + (ranked ? (pos + 1) : "·") + '</span>' +
            '<span class="am-opttext">' + esc(label) + '</span></button>';
        }).join("") + '</div>';
        body += '<p class="am-ranknote">' + (myRank.length === 0
          ? "Touche les options dans ton ordre de préférence (1 = ton préféré)."
          : (myRank.length < q.o.length ? "Encore " + (q.o.length - myRank.length) + " à classer… (touche une option classée pour l'enlever)" : "Classement complet !")) + '</p>';
        body += '<button class="am-primary" id="amValid"' + (myRank.length === q.o.length ? "" : " disabled") + '>✅ Valider mon classement</button>';
      }
      // L'hôte peut clore la question (quelqu'un bloque, ou tout le monde a
      // fini sans valider) ; en salle de test, c'est aussi le moyen de relire
      // un pack sans classer 45 fois.
      if (amHost()) body += '<button class="am-ghost" id="amSkipQ">' + (r.dev ? "⏭️ Question suivante (sans répondre)" : "⏭️ Clore la question pour tout le monde") + '</button>';
      $("amRoomBody").innerHTML = body;
      var sq = $("amSkipQ"); if (sq) sq.onclick = function () { if (socket) socket.emit("msg", { t: "skip", state: "question", q_index: r.q_index }); };

      var opts = $("amOpts");
      if (opts) {
        Array.prototype.forEach.call(opts.querySelectorAll("button"), function (btn) {
          btn.onclick = function () {
            var i = parseInt(btn.getAttribute("data-i"), 10);
            var at = myRank.indexOf(i);
            if (at >= 0) myRank.splice(at, 1); else if (myRank.length < q.o.length) myRank.push(i);
            roomStructSig = ""; renderRoom();
          };
        });
      }
      var vb = $("amValid");
      if (vb) vb.onclick = function () {
        if (myRank.length !== q.o.length || !socket) return;
        if (!connected) { toast("Pas de connexion là — réessaie dans un instant."); return; }
        submitted = true;
        // qid : si ce message est mis en file par une coupure et rejoué après
        // coup, le serveur doit pouvoir voir que la question a changé entre
        // temps plutôt que d'appliquer aveuglément un vieux classement à une
        // autre question.
        socket.emit("msg", { t: "rank", qid: q.id, ranking: myRank.slice() });
        roomStructSig = ""; renderRoom();
      };
    }
    updateQuestionLive(r);
  }

  function updateQuestionLive(r) {
    var total = r.question_total_ms || 30000;
    var left = r.deadline_ms ? Math.max(0, r.deadline_ms - serverNow()) : 0;
    var bar = $("amBar");
    if (bar) {
      var pct = Math.max(0, Math.min(100, (left / total) * 100));
      var i = bar.querySelector("i");
      if (i) i.style.width = pct + "%";
      var secs = Math.ceil(left / 1000);
      bar.className = "am-timerbar" + (secs <= 5 ? " danger" : (secs <= 10 ? " warn" : ""));
    }
    var a = $("amAnswered");
    if (a) a.textContent = (r.answered || 0) + " / " + (r.answered_total || 0) + " ont répondu";
  }

  // --- reveal (5 s) ---
  function renderReveal(r) {
    var q = r.question, rv = r.reveal;
    if (!q || !rv) return;
    var me = getPseudo();
    var mine = lastPrivate && lastPrivate.my_ranking;
    // Le classement privé peut arriver juste après l'état public : on
    // re-rend alors, pour afficher l'accord avec chacun.
    var sig = "rv:" + q.id + ":" + (mine ? "m" : "-") + ":" + ((rv.rankings || []).length);
    if (roomStructSig !== sig) {
      roomStructSig = sig;
      var body = "";
      body += '<div class="am-qmeta"><span>Question ' + (r.q_index + 1) + " / " + r.q_count + '</span><span id="amRvCount"></span></div>';
      body += '<div class="am-q">' + esc(q.q) + '</div>' +
              (q.ctx ? '<p class="am-qctx">' + esc(q.ctx) + '</p>' : '');

      // 1) Les réponses de chacun : le classement en pictogrammes, et
      //    l'accord avec le mien sur CETTE question (n/3).
      var rows = (rv.rankings || []).slice().sort(function (x, y) {
        return (x.name === me ? -1 : y.name === me ? 1 : 0) || x.name.localeCompare(y.name);
      });
      body += '<div class="am-card"><h3>👀 Les réponses</h3>';
      if (!rows.length) body += '<p class="am-hint">Personne n\'a répondu à temps.</p>';
      body += rows.map(function (x) {
        var isMe = x.name === me;
        var ag = (!isMe && mine) ? pairAgree(mine, x.ranking) : null;
        var badge = isMe ? '<span class="am-agree me">toi</span>'
          : (ag ? '<span class="am-agree a' + ag.agree + '">' + (ag.agree === ag.total ? "✨ " : "") + ag.agree + "/" + ag.total + '</span>'
                : '<span class="am-agree">—</span>');
        return '<div class="am-ans-row' + (isMe ? " me" : "") + '"><span class="who">' + esc(x.name) + '</span>' +
          '<span class="picks">' + x.ranking.map(function (o) { return '<span class="pick">' + esc(emojiOf(q.o[o], o)) + '</span>'; }).join('<span class="sep">›</span>') + '</span>' +
          badge + '</div>';
      }).join("");
      body += '<p class="am-hint am-legend">' + q.o.map(function (l, i) {
        return '<span>' + esc(emojiOf(l, i)) + ' ' + esc(l.replace(/^\S+\s/, "")) + '</span>';
      }).join(" · ") + '</p>';
      if (mine && rows.length > 1) body += '<p class="am-hint">n/3 = comparaisons où vous êtes d\'accord, toi et l\'autre, sur cette question.</p>';
      body += '</div>';

      // 2) Compatibilité jusqu'ici (cumulée depuis le début de la manche).
      var sf = rv.so_far || { asked: r.q_index + 1, pairs: [] };
      var withMe = (sf.pairs || []).filter(function (p) { return p.a === me || p.b === me; })
        .map(function (p) { return { name: p.a === me ? p.b : p.a, pct: p.pct, shared: p.shared }; })
        .sort(function (x, y) { return y.pct - x.pct || y.shared - x.shared; });
      var top = (sf.pairs || []).slice().sort(function (x, y) { return y.pct - x.pct || y.shared - x.shared; })[0];
      if (withMe.length || top) {
        body += '<div class="am-card"><h3>💘 Compatibilité jusqu\'ici <span class="am-soft">(' + sf.asked + ' question' + (sf.asked > 1 ? "s" : "") + ')</span></h3>';
        body += withMe.map(function (w) {
          return '<div class="am-duo-row"><span class="who">' + esc(w.name) + ' <span class="am-soft">· ' + w.shared + ' en commun</span></span><span class="pct">' + w.pct + '%</span></div>';
        }).join("");
        if (top && (sf.pairs || []).length > 1) {
          body += '<p class="am-hint">🏆 Duo en tête pour l\'instant : <b>' + esc(top.a) + ' & ' + esc(top.b) + '</b> (' + top.pct + '%)</p>';
        }
        body += '</div>';
      }

      // 3) Ce que le groupe préfère (score de Borda), puis les accords parfaits.
      body += '<div class="am-card"><h3>🏅 Le classement du groupe</h3>' +
        rv.group.map(function (g, i) {
          var mineMark = (mine && mine[0] === g.option) ? ' <span class="am-badge b-high">ton n°1</span>' : "";
          // Le tri se fait sur le score de Borda (pondéré par le rang donné
          // par chacun) — c'est LUI qu'on affiche, pas le nombre de 1ers
          // choix : sinon l'ordre à l'écran pouvait sembler faux (un 2e
          // choix massif l'emportant sur un 1er choix minoritaire).
          return '<div class="am-reveal-row"><span class="pos">' + (i + 1) + '.</span>' +
            '<span class="lbl">' + esc(g.label) + mineMark + '</span>' +
            '<span class="cnt">' + g.score + ' pt' + (g.score > 1 ? "s" : "") + '</span></div>';
        }).join("") + '</div>';
      if (rv.perfect && rv.perfect.length) {
        body += '<div class="am-perfect">✨ Accord parfait sur cette question : ' +
          rv.perfect.map(function (p) { return "<b>" + esc(p.a) + " & " + esc(p.b) + "</b>"; }).join(", ") + '</div>';
      }
      // L'hôte fait avancer dès que tout le monde a vu (sinon le chrono le fait).
      if (amHost()) body += '<button class="am-ghost" id="amSkipR">' + (r.q_index + 1 >= r.q_count ? "🏁 Voir les résultats" : "⏭️ Question suivante") + '</button>';
      $("amRoomBody").innerHTML = body;
      var sr = $("amSkipR"); if (sr) sr.onclick = function () { if (socket) socket.emit("msg", { t: "skip", state: "reveal", q_index: r.q_index }); };
    }
    var left = r.deadline_ms ? Math.max(0, r.deadline_ms - serverNow()) : 0;
    var c = $("amRvCount");
    if (c) c.textContent = "Suite dans " + Math.ceil(left / 1000) + " s";
  }

  // --- results ---
  function bandClass(b) { return "b-" + ((b && b.key) || "mixed"); }
  function cellColor(pct) {
    if (pct == null) return "#2c2742";
    if (pct >= 90) return "#5c1440";
    if (pct >= 75) return "#4a1450";
    if (pct >= 60) return "#12402f";
    if (pct >= 40) return "#2c2742";
    return "#3f1414";
  }

  function renderResults(r) {
    var res = r.results;
    if (!res) return;
    var sig = "res:" + (res.top ? res.top.a + res.top.b + res.top.pct : "none") + ":" + (lastPrivate.personal ? "p" : "-");
    if (roomStructSig !== sig) {
      roomStructSig = sig;
      var me = getPseudo();
      var body = "";

      // 🏆 le duo phare
      if (res.top) {
        var tb = bandFor(res.top.pct);
        body += '<div class="am-top-duo">' +
          '<div class="lbl">🏆 Le duo le plus compatible</div>' +
          '<div class="names">' + esc(res.top.a) + " 💞 " + esc(res.top.b) + '</div>' +
          '<div class="pct">' + res.top.pct + '%</div>' +
          '<div class="band">' + tb.emoji + " " + tb.label + '</div>' +
          (res.top.sameTop ? '<div class="lbl">' + res.top.sameTop + ' coup' + (res.top.sameTop > 1 ? "s" : "") + ' de cœur en commun</div>' : "") +
          '</div>';
      }

      // 💘 mon match personnel (payload privé)
      var perso = lastPrivate.personal;
      if (perso && perso.best) {
        body += '<div class="am-personal">' +
          '<div class="am-pack-tag">💘 TON meilleur match</div>' +
          '<div class="names" style="font-size:1.3rem;font-weight:900;margin:4px 0">' + esc(perso.best.name) + '</div>' +
          '<div class="pct">' + perso.best.pct + '%</div>' +
          '<div><span class="am-badge ' + bandClass(perso.best.band) + '">' + esc(perso.best.band.emoji + " " + perso.best.band.label) + '</span></div>' +
          (perso.average != null ? '<p class="am-hint">Ta compatibilité moyenne avec le groupe : ' + perso.average + '%</p>' : "") +
          '</div>';
      }

      // 🥇 podium des duos — n'a de sens qu'à partir de 2 PAIRES (donc 3+
      // joueurs) : à 2 joueurs il n'existe qu'un seul duo possible, déjà mis
      // en avant juste au-dessus ; un "podium" à une seule marche ne fait que
      // répéter le même nombre sous un habillage différent.
      if (res.podium && res.podium.length > 1) {
        body += '<div class="am-card"><h3>Podium des duos</h3>' +
          res.podium.map(function (p, i) {
            var isMine = (p.a === me || p.b === me);
            return '<div class="am-duo-row"' + (isMine ? ' style="border-color:var(--accent2)"' : "") + '>' +
              '<span class="rank">' + medal(i) + '</span>' +
              '<span class="who">' + esc(p.a) + " & " + esc(p.b) + '</span>' +
              '<span class="pct">' + p.pct + '%</span></div>';
          }).join("") + '</div>';
      }

      // ⚡ extras
      var extras = [];
      if (res.groupSoul) extras.push({ e: "🫂", l: "L'âme sœur du groupe", n: res.groupSoul.name, v: res.groupSoul.pct + "%" });
      if (res.freeSpirit) extras.push({ e: "🛸", l: "L'électron libre", n: res.freeSpirit.name, v: res.freeSpirit.pct + "%" });
      if (res.opposites) extras.push({ e: "⚔️", l: "Les opposés", n: res.opposites.a + " & " + res.opposites.b, v: res.opposites.pct + "%" });
      if (extras.length) {
        body += '<div class="am-card"><h3>Les titres de la soirée</h3><div class="am-extras">' +
          extras.map(function (x) {
            return '<div class="am-extra"><span class="e">' + x.e + '</span>' +
              '<span class="l">' + esc(x.l) + '</span><span class="v">' + esc(x.v) + '</span>' +
              '<span class="n">' + esc(x.n) + '</span></div>';
          }).join("") + '</div></div>';
      }

      // 📊 la matrice (tout le monde vs tout le monde)
      var names = res.names || [];
      if (names.length >= 2) {
        var head = '<tr><th class="rowh"></th>' + names.map(function (n) { return '<th>' + esc(n.slice(0, 6)) + '</th>'; }).join("") + '</tr>';
        var rows = names.map(function (a) {
          return '<tr><th class="rowh">' + esc(a) + '</th>' + names.map(function (b) {
            if (a === b) return '<td class="self">—</td>';
            var v = (res.matrix[a] || {})[b];
            return '<td><span class="am-mcell" style="background:' + cellColor(v) + '">' + (v == null ? "–" : v + "%") + '</span></td>';
          }).join("") + '</tr>';
        }).join("");
        body += '<div class="am-card"><h3>📊 Tout le monde vs tout le monde</h3>' +
          '<div class="am-matrix-wrap"><table class="am-matrix">' + head + rows + '</table></div></div>';
      }

      // 🕰️ matchs historiques (autres soirées, même pack)
      var hist = lastPrivate.historic;
      if (hist && hist.length) {
        body += '<div class="am-card"><h3>🕰️ Tes matchs historiques</h3>' +
          '<p class="am-hint">Sur tout ce que tu as répondu dans ce pack, même hors de cette partie.</p>' +
          hist.slice(0, 5).map(function (h, i) {
            return '<div class="am-duo-row"><span class="rank">' + medal(i) + '</span>' +
              '<span class="who">' + esc(h.name) + ' <span class="am-badge ' + bandClass(h.band) + '">' + esc(h.band.label) + '</span></span>' +
              '<span class="pct">' + h.pct + '%</span></div>';
          }).join("") + '</div>';
      }

      if (r.dev) body += '<p class="am-hint center">🧪 Salle de test : rien n\'a été enregistré.</p>';
      body += '<p class="am-hint center" id="amResCount"></p>';
      if (amHost()) body += '<button class="am-ghost" id="amAgain">↩️ Retour au salon</button>';

      $("amRoomBody").innerHTML = body;
      var ag = $("amAgain"); if (ag) ag.onclick = function () { if (socket) socket.emit("msg", { t: "skip", state: r.state }); };
    }
    var left = r.deadline_ms ? Math.max(0, r.deadline_ms - serverNow()) : 0;
    var c = $("amResCount");
    if (c) c.textContent = "Nouvelle partie possible dans " + Math.ceil(left / 1000) + " s";
  }

  function bandFor(pct) {
    if (pct == null) return { label: "—", emoji: "❔" };
    if (pct >= 90) return { label: "Âmes sœurs", emoji: "💞" };
    if (pct >= 75) return { label: "Très compatibles", emoji: "💘" };
    if (pct >= 60) return { label: "Bonne entente", emoji: "🙂" };
    if (pct >= 40) return { label: "Ça dépend des jours", emoji: "🤷" };
    return { label: "Opposés", emoji: "⚔️" };
  }

  // ---------- profil ----------
  function openProfile(m) {
    var p = m.profile;
    var hist = m.historic || [];
    var html = '<div class="am-card"><h3>' + (p.locked ? "🔒 " : "") + esc(p.name) + '</h3>' +
      '<p class="am-hint">' + p.games + ' partie' + (p.games > 1 ? "s" : "") + ' · ' + p.answered + ' réponses enregistrées</p></div>';
    if (p.packs && p.packs.length) {
      html += '<div class="am-card"><h3>Packs joués</h3>' + p.packs.map(function (x) {
        return '<div class="am-duo-row"><span class="rank">' + esc(x.emoji) + '</span>' +
          '<span class="who">' + esc(x.name) + '</span><span class="pct">' + x.answered + '</span></div>';
      }).join("") + '</div>';
    }
    if (hist.length) {
      html += '<div class="am-card"><h3>🕰️ Meilleurs matchs (ce pack)</h3>' + hist.slice(0, 8).map(function (h, i) {
        return '<div class="am-duo-row"><span class="rank">' + medal(i) + '</span>' +
          '<span class="who">' + esc(h.name) + '</span><span class="pct">' + h.pct + '%</span></div>';
      }).join("") + '</div>';
    } else {
      html += '<p class="am-hint">Joue quelques parties pour débloquer tes matchs historiques (5 questions communes minimum).</p>';
    }
    openSheet("👤 Profil", html);
  }

  // ---------- mode dev ----------
  function devSheetError(msg) {
    var err = $("amDevErr");
    if (err) err.textContent = msg; else if (msg) toast(msg);
  }
  function devIdleHint(r) {
    var d = r.dev || {};
    var parts = [d.count + " question" + (d.count > 1 ? "s" : "")];
    parts.push(d.order === "file" ? "ordre du fichier" + (d.start_at ? " dès la n°" + (d.start_at + 1) : "") : "aléatoire");
    parts.push(d.bots + " bot" + (d.bots > 1 ? "s" : ""));
    parts.push("rien n'est enregistré");
    return parts.join(" · ");
  }
  function openDevSheet() {
    if (devOn) {
      openSheet("🧪 Mode dev",
        '<p>Le mode dev est <b>actif</b> sur cet appareil : la carte 🧪 du hall lance une salle de test privée.</p>' +
        '<button type="button" class="am-ghost" id="amDevOff">Désactiver le mode dev</button>',
        function (body) {
          body.querySelector("#amDevOff").onclick = function () {
            devOn = false; devInfo = null; setDevToken(""); renderDevCard(); closeSheet(); toast("Mode dev désactivé");
          };
        });
      return;
    }
    openSheet("🧪 Mode dev",
      '<p>Une <b>salle de test privée</b> : toi + des bots, les questions dans l\'ordre du fichier, et <b>rien n\'est enregistré</b>. Réservé à l\'admin.</p>' +
      '<input id="amDevPw" type="password" placeholder="Mot de passe admin" autocomplete="current-password" />' +
      '<button type="button" class="am-primary" id="amDevGo">Déverrouiller</button>' +
      '<div class="am-error center" id="amDevErr"></div>',
      function (body) {
        var input = body.querySelector("#amDevPw");
        setTimeout(function () { input.focus(); }, 80);
        function go() {
          var pw = input.value || "";
          if (!pw) { devSheetError("Entre le mot de passe admin."); return; }
          if (!socket || !connected) { devSheetError("Pas de connexion."); return; }
          devSheetError("");
          socket.emit("dev_unlock", { password: pw });
        }
        body.querySelector("#amDevGo").onclick = go;
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
      });
  }
  // La carte 🧪 du hall. Construite à la demande, PAS à chaque lobby_state :
  // on ne veut pas perdre la saisie en cours à chaque rafraîchissement.
  function renderDevCard() {
    var host = $("amDev"); if (!host) return;
    if (!devOn || !devInfo) { host.innerHTML = ""; return; }
    var packs = devInfo.packs || [];
    var cur = packs.filter(function (p) { return p.id === devForm.pack; })[0] || packs[0] || { id: "amis", bank_size: 45 };
    var maxBots = devInfo.max_bots || 4;
    host.innerHTML =
      '<div class="am-card am-devcard"><h3>🧪 Mode dev — salle de test</h3>' +
      '<p class="am-hint">Toi + des bots. Rien n\'est enregistré, personne d\'autre ne voit cette salle.</p>' +
      '<div class="am-devrow"><label>Pack</label><div class="am-seg" id="amDevPacks">' + packs.map(function (p) {
        return '<button type="button" data-pack="' + esc(p.id) + '"' + (p.id === cur.id ? ' class="on"' : '') + '>' + esc(p.emoji + " " + p.name) + '</button>';
      }).join("") + '</div></div>' +
      '<div class="am-devrow"><label>Ordre</label><div class="am-seg" id="amDevOrder">' +
        '<button type="button" data-order="file"' + (devForm.order === "file" ? ' class="on"' : '') + '>Ordre du fichier</button>' +
        '<button type="button" data-order="random"' + (devForm.order === "random" ? ' class="on"' : '') + '>Aléatoire</button></div></div>' +
      '<div class="am-devrow"><label for="amDevStart">Commencer à la question n°</label><input id="amDevStart" type="number" inputmode="numeric" min="1" max="' + cur.bank_size + '" value="' + devForm.start_at + '" /></div>' +
      '<div class="am-devrow"><label for="amDevCount">Nombre de questions <span class="am-soft">(0 = tout le pack, ' + cur.bank_size + ')</span></label><input id="amDevCount" type="number" inputmode="numeric" min="0" max="' + cur.bank_size + '" value="' + devForm.count + '" /></div>' +
      '<div class="am-devrow"><label for="amDevBots">Bots</label><input id="amDevBots" type="number" inputmode="numeric" min="0" max="' + maxBots + '" value="' + devForm.bots + '" /></div>' +
      (devInfo.room ? '<button type="button" class="am-ghost" id="amDevResume">↩️ Reprendre la salle de test en cours</button>' : '') +
      '<button type="button" class="am-primary" id="amDevGo">🧪 Lancer la salle de test</button></div>';
    Array.prototype.forEach.call(host.querySelectorAll("#amDevPacks button"), function (b) {
      b.onclick = function () { devForm.pack = b.getAttribute("data-pack"); devForm.start_at = 1; devForm.count = 0; renderDevCard(); };
    });
    Array.prototype.forEach.call(host.querySelectorAll("#amDevOrder button"), function (b) {
      b.onclick = function () { devForm.order = b.getAttribute("data-order"); renderDevCard(); };
    });
    function num(id, lo, hi, dflt) { var v = parseInt(($(id) || {}).value, 10); if (isNaN(v)) v = dflt; return Math.max(lo, Math.min(hi, v)); }
    var resume = $("amDevResume");
    if (resume) resume.onclick = function () { enterRoom(devInfo.room); };
    $("amDevGo").onclick = function () {
      if (!socket || !connected) { toast("Pas de connexion."); return; }
      devForm.start_at = num("amDevStart", 1, cur.bank_size, 1);
      devForm.count = num("amDevCount", 0, cur.bank_size, 0);
      devForm.bots = num("amDevBots", 0, maxBots, 2);
      socket.emit("dev_start", { pack: cur.id, order: devForm.order, start_at: devForm.start_at,
        count: devForm.count || cur.bank_size, bots: devForm.bots });
    };
  }

  // ---------- aide ----------
  var HELP = {
    main: { title: "Comment ça marche", body:
      "<p><b>Chaque question propose 3 options.</b> Tu les classes : <b>1er</b> = ton préféré, <b>3e</b> = celui que tu aimes le moins.</p>" +
      "<p>À la fin, on compare ton classement à celui de <b>chaque</b> autre joueur.</p>" +
      "<p><b>Le calcul :</b> pour chaque question on fait les 3 comparaisons possibles (A/B, A/C, B/C). Pour chacune : « avez-vous mis la même option devant ? » → 1 point par accord. Ta compatibilité = points obtenus / points possibles.</p>" +
      "<p>💡 Deux personnes au hasard tournent autour de <b>50 %</b> : ce qui compte, c'est <b>qui</b> arrive en tête de ton classement, pas le chiffre brut.</p>" +
      "<p>🔒 <b>Protège ton pseudo</b> avec un PIN pour garder ton historique de matchs.</p>" },
    pin: { title: "Le code PIN 🔒", body:
      "<p>Le PIN (4 chiffres) <b>réserve ton pseudo</b> et protège ton historique de réponses.</p>" +
      "<p>C'est <b>facultatif</b> — laisse vide si tu ne veux pas. Tu pourras le faire plus tard avec le bouton 🔒 en haut à droite.</p>" },
  };
  function openHelp(k) {
    var h = HELP[k] || HELP.main;
    openSheet(h.title, h.body);
  }

  // ---------- boucle de rafraîchissement ----------
  function startRefresh() {
    if (refreshTick) return;
    refreshTick = setInterval(function () {
      if (!lastRoom) return;
      if (lastRoom.state === "question") updateQuestionLive(lastRoom);
      else renderRoom();
    }, 250);
  }
  function stopRefresh() { if (refreshTick) { clearInterval(refreshTick); refreshTick = null; } }

  // ---------- bootstrap ----------
  document.addEventListener("DOMContentLoaded", function () {
    var input = $("amName");
    if (input) input.value = getPseudo();
    updateMe();
    $("amContinue").onclick = submitPseudo;
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("amPin").focus(); } });
    $("amPin").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submitPseudo(); } });
    $("amNewName").onclick = function () {
      $("amLocked").style.display = "none"; pinMode = false;
      $("amName").value = ""; $("amPin").value = "";
      $("amContinue").textContent = "C'est parti →";
      $("amName").focus();
    };
    $("amBack").onclick = leaveRoom;
    $("amHelp").onclick = function () { openHelp("main"); };
    $("amSheetClose").onclick = closeSheet;
    $("amOverlay").addEventListener("click", function (e) { if (e.target === $("amOverlay")) closeSheet(); });
    $("amProtect").onclick = protectName;
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains("am-info")) { e.preventDefault(); openHelp(t.getAttribute("data-help")); }
    });
    connect();
    if (getPseudo()) enterHall(); else show("s-pseudo");
    // /AreWeAMatch/?dev ouvre directement la feuille du mode dev.
    if (/[?&]dev(=|&|$)/.test(location.search)) setTimeout(openDevSheet, 400);
  });
})();
