// Are We A Match? v2 — SPA. Socket.IO namespace /match.
// Écrans : pseudo + PIN / mes parties / une partie / répondre (scène puis
// reveal) / résultats.
//
// Le différé en trois règles (voir server/match/games.js) :
//   - on ne voit les réponses des autres à une scène qu'après avoir validé la
//     sienne, et une réponse validée ne se change plus ;
//   - les résultats finaux portent sur les joueurs qui ont fini ; une
//     compatibilité provisoire s'affiche avec ceux en cours ;
//   - une partie reste ouverte tant que l'hôte ne la ferme pas.

(function () {
  "use strict";

  // ---------- identité ----------
  function uuid() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function (c) {
      return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
    });
  }
  var memCid = null, memPseudo = "";
  function getCid() {
    try {
      var c = localStorage.getItem("am.cid");
      if (!c) { c = uuid(); localStorage.setItem("am.cid", c); }
      return c;
    } catch (e) { if (!memCid) memCid = uuid(); return memCid; }
  }
  function getPseudo() { try { return (localStorage.getItem("am.pseudo") || "").trim(); } catch (e) { return memPseudo; } }
  function setPseudo(n) { try { localStorage.setItem("am.pseudo", n); } catch (e) { memPseudo = n; } }

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  var SCREENS = ["s-pseudo", "s-home", "s-game", "s-play", "s-results"];
  var screen = "s-pseudo";
  function show(id) {
    screen = id;
    SCREENS.forEach(function (s) { var el = $(s); if (el) el.classList.toggle("on", s === id); });
    var back = $("amBack"); if (back) back.style.display = (id === "s-game" || id === "s-play" || id === "s-results") ? "" : "none";
    window.scrollTo(0, 0);
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function setStatus(t) { var el = $("amStatus"); if (el) el.textContent = t || ""; }
  function medal(i) { return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1); }
  // Accord par paires entre deux classements de la même scène (même calcul
  // que le moteur côté serveur) : sur 3 options, 3 comparaisons.
  function pairAgree(a, b) {
    if (!a || !b || a.length !== b.length) return null;
    var n = a.length, pa = [], pb = [], agree = 0, total = 0;
    for (var i = 0; i < n; i++) { pa[a[i]] = i; pb[b[i]] = i; }
    for (var x = 0; x < n; x++) for (var y = x + 1; y < n; y++) { total++; if ((pa[x] < pa[y]) === (pb[x] < pb[y])) agree++; }
    return { agree: agree, total: total };
  }
  // « 🏔️ Rando et grand air » → « 🏔️ » (sinon le numéro de l'option).
  function emojiOf(label, idx) {
    var m = /^(\S+)\s/.exec(label || "");
    return (m && /^[^\w\d]/.test(m[1])) ? m[1] : String(idx + 1);
  }
  function fmtDay(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return iso || "";
    var mois = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    var d = parseInt(m[3], 10);
    return (d === 1 ? "1er" : d) + " " + mois[parseInt(m[2], 10) - 1] + " " + m[1];
  }
  function fmtAgo(ts) {
    if (!ts) return "";
    var s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return "à l'instant";
    if (s < 3600) return "il y a " + Math.round(s / 60) + " min";
    if (s < 86400) return "il y a " + Math.round(s / 3600) + " h";
    return "il y a " + Math.round(s / 86400) + " j";
  }
  function gameUrl(code) { return location.origin + "/AreWeAMatch/g/" + code; }
  // Empreinte de la progression de tout le monde : si elle change, les
  // résultats affichés sont à recalculer.
  function progressSig(g) {
    return (g && g.players ? g.players.map(function (p) { return p.name + ":" + p.progress + (p.finished ? "f" : ""); }).join("|") : "") + "#" + (g && g.closedAt ? "c" : "");
  }
  function gameTitle(g) { return g.title || ("Partie de " + g.hostName); }
  function bandFor(pct) {
    if (pct == null) return { label: "—", emoji: "❔" };
    if (pct >= 90) return { label: "Âmes sœurs", emoji: "💞" };
    if (pct >= 75) return { label: "Très compatibles", emoji: "💘" };
    if (pct >= 60) return { label: "Bonne entente", emoji: "🙂" };
    if (pct >= 40) return { label: "Ça dépend des jours", emoji: "🤷" };
    return { label: "Opposés", emoji: "⚔️" };
  }
  function bandClass(b) { return "b-" + ((b && b.key) || "mixed"); }
  function cellColor(pct) {
    if (pct == null) return "#2c2742";
    if (pct >= 90) return "#5c1440";
    if (pct >= 75) return "#4a1450";
    if (pct >= 60) return "#12402f";
    if (pct >= 40) return "#2c2742";
    return "#3f1414";
  }

  // ---------- état ----------
  var socket = null, connected = false, identified = false, booted = false;
  var myProtected = false, pinMode = false, pendingCode = null, currentCode = null;
  var gamesCache = null, game = null, lastResults = null, refreshTimer = null;
  // La scène en cours de réponse.
  var play = { code: null, index: 0, myRank: [], submitted: false, reveal: null, finished: false };
  // Mode dev.
  var devOn = false, devInfo = null, devBots = 2;
  function getDevToken() { try { return localStorage.getItem("am.devToken") || ""; } catch (e) { return ""; } }
  function setDevToken(t) { try { if (t) localStorage.setItem("am.devToken", t); else localStorage.removeItem("am.devToken"); } catch (e) {} }

  // Le code d'une partie dans l'adresse : /AreWeAMatch/g/CODE ou ?g=CODE.
  function codeFromUrl() {
    var m = /\/AreWeAMatch\/g\/([A-Za-z0-9-]+)/.exec(location.pathname);
    if (m) return m[1].toUpperCase();
    var q = /[?&](?:g|code)=([A-Za-z0-9-]+)/.exec(location.search);
    return q ? q[1].toUpperCase() : null;
  }
  function setUrl(code) {
    try { history.replaceState(null, "", code ? "/AreWeAMatch/g/" + code : "/AreWeAMatch/"); } catch (e) {}
  }

  // ---------- socket ----------
  function connect() {
    if (socket) return;
    socket = io("/match", { transports: ["websocket", "polling"] });
    socket.on("connect", function () {
      connected = true; setStatus("");
      if (getPseudo()) socket.emit("set_identity", { cid: getCid(), name: getPseudo() });
    });
    socket.on("disconnect", function () { connected = false; identified = false; setStatus("Connexion perdue — reconnexion…"); });

    socket.on("identity_ok", function (m) {
      setStatus(""); pinMode = false; identified = true;
      myProtected = !!(m && m.protected);
      if (m && m.name) setPseudo(m.name);
      $("amLocked").style.display = "none";
      $("amContinue").textContent = "C'est parti →";
      updateMe();
      // Compte d'avant la v2, sans PIN : on en impose un avant d'aller plus loin.
      if (m && m.needs_pin) { protectName(true); return; }
      afterIdentity();
    });
    socket.on("pin_needed", function () {
      show("s-pseudo");
      $("amPseudoError").className = "am-error center warn";
      $("amPseudoError").textContent = "Ce pseudo est libre ! Choisis un code PIN à 4 chiffres pour le protéger.";
      var pin = $("amPin"); if (pin) { pin.value = ""; pin.focus(); }
    });
    socket.on("name_taken", function (m) {
      show("s-pseudo");
      $("amPseudoError").className = "am-error center";
      $("amPseudoError").textContent = "Le pseudo « " + (m && m.name) + " » est déjà pris. Choisis-en un autre.";
      var nm = $("amName"); if (nm) nm.focus();
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
    socket.on("pin_set", function () { myProtected = true; updateMe(); closeSheet(); toast("🔒 Pseudo protégé !"); if (!booted) afterIdentity(); });

    // --- parties ---
    socket.on("games_list", function (m) {
      gamesCache = (m && m.games) || [];
      renderVersion(m && m.app);
      if (m && m.dev_enabled === false) { devOn = false; }
      renderHome();
    });
    socket.on("games_changed", function () {
      // Quelqu'un a répondu ou fini dans une de mes parties : l'accueil se rafraîchit.
      if (screen === "s-home" && socket) {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(function () { socket.emit("my_games"); }, 400);
      }
    });
    socket.on("game_created", function (m) {
      if (!m || !m.code) return;
      currentCode = m.code; setUrl(m.code);
      if (m.test) toast("🧪 Partie de test créée");
    });
    socket.on("game_state", function (m) {
      if (!m || !m.code) return;
      if (currentCode && m.code !== currentCode) return;
      currentCode = m.code;
      var prev = game;
      game = m;
      window.__amGame = game;
      if (screen === "s-game" || screen === "s-pseudo" || screen === "s-home") { renderGame(); }
      else if (screen === "s-results" && lastResults && prev && progressSig(prev) !== progressSig(m)) {
        // Quelqu'un a répondu ou fini : les résultats (finaux ou provisoires)
        // se recalculent, sans que le joueur ait rien à faire.
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(function () { if (socket && screen === "s-results") socket.emit("game_results", { code: m.code }); }, 500);
      }
      else if (screen === "s-play") {
        updatePlayMeta();
        // Le serveur fait autorité sur « où j'en suis ». S'il n'est pas
        // d'accord avec l'écran — même compte ouvert sur un deuxième
        // appareil, ou reprise après un redémarrage du serveur — on se recale
        // sur SA scène. Jamais pendant qu'une réponse est en vol ni pendant un
        // reveal : on ne retire pas l'écran des mains du joueur.
        if (!play.submitted && !play.reveal && m.me && m.me.joined && m.me.nextIndex !== play.index) {
          play.index = m.me.nextIndex; play.myRank = [];
          renderScene();
        }
      }
    });
    socket.on("answer_ack", function (m) {
      if (!m) return;
      if (!m.ok) {
        play.submitted = false;
        if (m.reason === "already_answered") { toast("Déjà répondu à cette scène."); play.index += 1; play.myRank = []; renderScene(); return; }
        if (m.reason === "closed") { toast("Cette partie est fermée."); openGame(play.code); return; }
        toast("Réponse non prise en compte, réessaie."); renderScene(); return;
      }
      play.finished = !!m.finished;
      play.reveal = m.reveal;
      // Personne d'autre n'a encore répondu à cette scène : pas d'écran vide,
      // on enchaîne, avec un mot.
      if (play.reveal && play.reveal.answers.length <= 1 && !play.finished) {
        toast("🥇 Tu es le premier à répondre à cette scène — les autres apparaîtront ici après coup.");
        play.index = (m.index != null) ? m.index : play.index + 1;
        play.myRank = []; play.submitted = false; play.reveal = null;
        renderScene();
        return;
      }
      renderReveal();
    });
    socket.on("game_results", function (m) {
      if (!m || (currentCode && m.code !== currentCode)) return;
      lastResults = m;
      window.__amResults = m;
      if (screen === "s-results") renderResults();
    });
    socket.on("scene_reveals", function (m) {
      if (!m || (currentCode && m.code !== currentCode)) return;
      renderScenesSheet(m.reveals || []);
    });
    socket.on("game_closed", function (m) {
      if (!m || !m.ok) { toast("Impossible de fermer la partie."); return; }
      if (m.deleted) { toast("Partie de test supprimée"); goHome(); return; }
      toast("Partie fermée");
    });
    socket.on("player_removed", function (m) { if (m && m.ok) toast(m.name + " a été retiré de la partie."); });
    socket.on("game_hidden", function (m) { if (m && m.ok) { toast("Partie masquée"); goHome(); } });
    socket.on("game_gone", function (m) {
      if (!m || m.code !== currentCode) return;
      toast(m.reason === "removed" ? "Tu as été retiré de cette partie." : "Cette partie n'existe plus.");
      goHome();
    });
    socket.on("profile", function (m) {
      if (!m || m.ok === false) { toast("Pas encore de profil."); return; }
      openProfile(m);
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
      closeSheet(); renderDevCard();
      toast("🧪 Mode dev activé");
    });
    socket.on("error_msg", function (m) {
      var code = m && m.msg;
      if (code === "bad_identity" || code === "no_identity") return;
      if (code === "bad_pin") { toast("PIN invalide (4 chiffres)."); return; }
      if (code === "not_owner") { toast("Ce pseudo appartient à un autre appareil."); return; }
      if (code === "unknown_game") { toast("Aucune partie avec ce code."); if (pendingCode) { pendingCode = null; setUrl(null); goHome(); } return; }
      if (code === "slow_down") { toast("Trop de codes essayés, attends un peu."); return; }
      if (code === "closed") { toast("Cette partie est fermée : on ne peut plus la rejoindre."); return; }
      if (code === "dev_locked") { toast("Mode dev verrouillé."); return; }
      setStatus(code ? "Erreur : " + code : "Erreur");
    });
  }

  // Après l'identité : la partie demandée par l'adresse, sinon l'accueil.
  // Sur une reconnexion en cours de partie, on ré-ouvre juste la partie.
  function afterIdentity() {
    if (booted) {
      if (currentCode && socket) socket.emit("open_game", { code: currentCode });
      else if (screen === "s-home" && socket) socket.emit("my_games");
      return;
    }
    booted = true;
    if (pendingCode) { var c = pendingCode; pendingCode = null; openGame(c); }
    else goHome();
  }

  // ---------- toast ----------
  var toastTimer = null;
  function toast(msg) {
    setStatus(msg);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { setStatus(""); }, 3000);
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
    $("amPseudoError").className = "am-error center";
    if (!name) { $("amPseudoError").textContent = "Entre ton pseudo."; return; }
    if (!/^\d{4}$/.test(pin)) { $("amPseudoError").textContent = "Ton code PIN : 4 chiffres, obligatoire. C'est ta clé pour reprendre tes parties sur n'importe quel téléphone."; $("amPin").focus(); return; }
    $("amPseudoError").textContent = "";
    if (socket) socket.emit("set_identity", { cid: getCid(), name: name, pin: pin });
  }
  function updateMe() {
    var el = $("amWho"); if (!el) return;
    var p = getPseudo();
    el.textContent = p ? (myProtected ? "🔒 " : "👋 ") + p : "";
    el.style.display = p ? "" : "none";
    el.onclick = function () { if (p && socket) socket.emit("get_profile", { name: p }); };
    var me = $("amMe"); if (me) me.style.display = p ? "" : "none";
  }

  // ---------- overlay ----------
  var sheetLocked = false;
  function openSheet(title, html, onMount, locked) {
    sheetLocked = !!locked;
    $("amSheetTitle").textContent = title;
    $("amSheetClose").style.display = locked ? "none" : "";
    var body = $("amSheetBody"); body.innerHTML = html;
    $("amOverlay").style.display = "flex";
    if (typeof onMount === "function") onMount(body);
  }
  function closeSheet() { if (sheetLocked) return; $("amOverlay").style.display = "none"; }
  function forceCloseSheet() { sheetLocked = false; $("amOverlay").style.display = "none"; }

  // Choisir (ou changer) son PIN. `mandatory` : compte d'avant la v2 sans PIN,
  // la feuille ne se ferme pas tant qu'un PIN n'est pas posé.
  function protectName(mandatory) {
    openSheet("🔒 " + (mandatory ? "Choisis ton code PIN" : "Ton code PIN"),
      '<p>' + (mandatory ? "Depuis cette version, chaque pseudo a un code PIN : c'est ta clé pour reprendre tes parties sur n'importe quel téléphone, et personne d'autre ne peut prendre ton pseudo." : "Choisis un nouveau code PIN à 4 chiffres.") + '</p>' +
      '<input id="amFormPin" type="tel" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off" pattern="[0-9]*" />' +
      '<button type="button" class="am-primary" id="amFormGo">🔒 ' + (mandatory ? "C'est mon PIN" : "Changer") + '</button>' +
      '<div class="am-error center" id="amFormErr"></div>',
      function (body) {
        var input = body.querySelector("#amFormPin");
        var err = body.querySelector("#amFormErr");
        setTimeout(function () { input.focus(); }, 80);
        function go() {
          var pin = (input.value || "").trim();
          if (!/^\d{4}$/.test(pin)) { err.textContent = "Le PIN doit faire 4 chiffres."; input.focus(); return; }
          if (socket) socket.emit("set_pin", { pin: pin });
          sheetLocked = false;
        }
        body.querySelector("#amFormGo").onclick = go;
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
      }, !!mandatory);
  }

  // ---------- accueil : mes parties ----------
  function goHome() {
    currentCode = null; game = null; lastResults = null; setUrl(null);
    if (socket && connected) { socket.emit("close_view"); socket.emit("my_games"); }
    show("s-home");
    if (gamesCache) renderHome();
  }
  function renderVersion(app) {
    var ver = $("amVersion"); if (!ver) return;
    ver.textContent = (app && app.version) ? "v" + app.version + " · màj " + fmtDay(app.date) : "";
    ver.title = ((app && app.sha) ? "commit " + app.sha + " · " : "") + "touche pour le mode dev";
    ver.classList.add("clickable");
    ver.onclick = openDevSheet;
  }
  function renderHome() {
    updateMe();
    var wrap = $("amGames"); if (!wrap) return;
    var list = gamesCache || [];
    if (!list.length) {
      wrap.innerHTML = '<div class="am-empty">Aucune partie pour l\'instant.<br>Crée la première et partage son QR, ou rejoins celle d\'un ami avec son code.</div>';
      return;
    }
    wrap.innerHTML = list.map(function (g) {
      var pct = g.sceneCount ? Math.round((g.progress / g.sceneCount) * 100) : 0;
      var state = g.finished ? "✓ terminé" : (g.progress ? g.progress + "/" + g.sceneCount : "pas commencé");
      var meta = [
        "👥 " + g.playerCount + (g.finishedCount ? " · " + g.finishedCount + " fini" + (g.finishedCount > 1 ? "s" : "") : ""),
        state,
        g.closed ? "🔒 fermée" : "",
        g.test ? "🧪 test" : "",
        fmtAgo(g.updatedAt),
      ].filter(Boolean);
      return '<button type="button" class="am-game-card' + (g.hasNew ? " new" : "") + '" data-code="' + esc(g.code) + '">' +
        '<div class="top"><span class="title">' + esc(gameTitle(g)) + '</span>' +
          (g.hasNew ? '<span class="badge-new">Nouveaux résultats</span>' : '') +
          '<span class="code">' + esc(g.code) + '</span></div>' +
        '<div class="meta">' + meta.map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("") + '</div>' +
        (g.teaser ? '<div class="meta"><span>💘 ' + esc(g.teaser.name) + ' : ' + g.teaser.pct + ' % sur vos ' + g.teaser.shared + ' scènes en commun · termine pour voir tout</span></div>' : '') +
        '<div class="am-progress' + (g.finished ? " done" : "") + '"><i style="width:' + pct + '%"></i></div>' +
        '</button>';
    }).join("");
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-code]"), function (b) {
      b.onclick = function () { openGame(b.getAttribute("data-code")); };
    });
  }
  function createGameSheet() {
    openSheet("➕ Nouvelle partie",
      '<p>20 scènes tirées au sort, les mêmes pour tout le monde. Tu seras l\'hôte : tu partages le QR, chacun répond quand il veut.</p>' +
      '<input id="amFormTitle" maxlength="40" placeholder="Un titre (facultatif) : Soirée du 12, Les colocs…" autocomplete="off" />' +
      '<button type="button" class="am-primary" id="amFormGo">🎲 Créer la partie</button>',
      function (body) {
        var input = body.querySelector("#amFormTitle");
        function go() { if (!socket || !connected) { toast("Pas de connexion."); return; } socket.emit("create_game", { title: (input.value || "").trim() }); closeSheet(); }
        body.querySelector("#amFormGo").onclick = go;
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
      });
  }
  function joinSheet() {
    openSheet("🔗 Rejoindre une partie",
      '<p>Tape le code de la partie (il est sous le QR de ton ami), ou scanne son QR avec l\'appareil photo.</p>' +
      '<input id="amFormCode" class="am-codein" maxlength="8" placeholder="7QX3M" autocomplete="off" autocapitalize="characters" />' +
      '<button type="button" class="am-primary" id="amFormGo">Ouvrir la partie</button>' +
      '<div class="am-error center" id="amFormErr"></div>',
      function (body) {
        var input = body.querySelector("#amFormCode");
        setTimeout(function () { input.focus(); }, 80);
        input.addEventListener("input", function () { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); });
        function go() {
          var code = (input.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
          if (code.length < 4) { body.querySelector("#amFormErr").textContent = "Le code fait 5 caractères."; return; }
          closeSheet(); openGame(code);
        }
        body.querySelector("#amFormGo").onclick = go;
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
      });
  }

  // ---------- une partie ----------
  function openGame(code) {
    currentCode = String(code || "").toUpperCase(); game = null; lastResults = null;
    setUrl(currentCode);
    if (socket && connected) socket.emit("open_game", { code: currentCode });
    show("s-game");
    $("amGameTitle").textContent = "…";
    $("amGameBody").innerHTML = '<p class="am-hint center">Chargement…</p>';
  }
  function drawQR(canvas, text) {
    if (typeof qrcode !== "function" || !canvas) return false;
    try {
      var qr = qrcode(0, "M"); qr.addData(text); qr.make();
      var n = qr.getModuleCount(), size = canvas.width;
      var cell = Math.floor(size / (n + 2)), off = Math.floor((size - cell * n) / 2);
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#120f1e";
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(off + c * cell, off + r * cell, cell, cell);
      return true;
    } catch (e) { return false; }
  }
  function shareGame(g) {
    var url = gameUrl(g.code);
    var text = (g.hostName === getPseudo() ? "Fais mon test Are We A Match ? " : "Rejoins la partie Are We A Match ? de " + g.hostName + " ") + ": 20 scènes à classer, quand tu veux, on verra qui se ressemble → " + url;
    if (navigator.share) { navigator.share({ title: "Are We A Match ?", text: text, url: url }).catch(function () {}); return; }
    copyText(url);
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast("Copié !"); }, function () { toast(t); });
    else toast(t);
  }
  function renderGame() {
    if (!game) return;
    var g = game, me = g.me || {};
    $("amGameTitle").textContent = gameTitle(g);
    var badge = $("amDevBadge"); if (badge) badge.style.display = g.test ? "" : "none";
    if (screen !== "s-game") show("s-game");
    var body = "";
    var finishedNames = g.players.filter(function (p) { return p.finished; }).length;

    if (!me.joined) {
      body += '<div class="am-invite"><b>' + esc(g.hostName) + '</b> t\'invite à sa partie : <b>' + g.sceneCount + ' scènes</b> à classer, quand tu veux. ' +
        (g.players.length ? g.players.length + ' joueur' + (g.players.length > 1 ? 's' : '') + ' déjà' + (finishedNames ? ', ' + finishedNames + ' fini' + (finishedNames > 1 ? 's' : '') : '') + '.' : '') + '</div>';
      if (g.closedAt) body += '<div class="am-card am-center-card"><div class="am-big">🔒</div><p class="am-lead">Cette partie est fermée, on ne peut plus la rejoindre.</p></div>';
      else body += '<button class="am-primary xl" id="amJoinGame">🎮 Rejoindre la partie</button>';
      body += '<div class="am-card"><h3>Joueurs (' + g.players.length + ')</h3>' + renderPlayerRows(g, false) + '</div>';
      $("amGameBody").innerHTML = body;
      var jb = $("amJoinGame"); if (jb) jb.onclick = function () { if (socket) socket.emit("join_game", { code: g.code }); };
      return;
    }

    // Bouton principal selon où j'en suis.
    var action = "";
    if (g.closedAt && !me.finished) action = '<div class="am-card am-center-card"><div class="am-big">🔒</div><p class="am-lead">Partie fermée par l\'hôte.</p></div>';
    else if (me.finished) action = '<button class="am-primary xl" id="amResults">💘 Voir les résultats</button>';
    else if (me.progress > 0) action = '<button class="am-primary xl" id="amPlay">▶️ Continuer (' + me.progress + '/' + g.sceneCount + ')</button>';
    else action = '<button class="am-primary xl" id="amPlay">🎬 Répondre aux ' + g.sceneCount + ' scènes</button>';

    // Partager : QR + lien + code.
    var share = '<div class="am-card am-share"><h3>Inviter</h3>' +
      '<div class="am-qr"><canvas id="amQR" width="400" height="400"></canvas></div>' +
      '<div class="am-code-big">' + esc(g.code) + '</div>' +
      '<p class="am-hint">Scanne, ou tape ce code dans « Rejoindre ».</p>' +
      '<div class="am-share-row"><button class="am-primary" id="amShare">Partager le lien</button><button class="am-ghost" id="amCopy">Copier</button></div></div>';

    // Seul dans sa partie et rien de commencé : inviter d'abord, c'est le geste
    // qui donne un sens à la suite. Sinon, l'action d'abord.
    var alone = g.players.length <= 1 && me.progress === 0 && !me.finished && !g.closedAt;
    body += alone ? share + action : action;
    if (me.teaser) body += '<div class="am-teaser">💘 <b>' + esc(me.teaser.name) + '</b> : <span class="pct">' + me.teaser.pct + '%</span> sur vos ' + me.teaser.shared + ' scènes en commun. <span class="am-soft">Termine pour voir tout.</span></div>';
    if (me.finished && finishedNames < 2) body += '<p class="am-hint center">Tu as fini ! Dès qu\'un autre joueur aura fini, vous verrez votre compatibilité.</p>';
    if (!alone) body += share;

    body += '<div class="am-card"><h3>Joueurs (' + g.players.length + ')' + (finishedNames ? ' <span class="am-soft">· ' + finishedNames + ' fini' + (finishedNames > 1 ? 's' : '') + '</span>' : '') + '</h3>' + renderPlayerRows(g, me.host) + '</div>';

    body += '<p class="am-hint center">' + (g.closedAt ? 'Fermée ' + fmtAgo(g.closedAt) : 'Ouverte · ' + g.sceneCount + ' scènes · réponds quand tu veux, tes réponses sont sauvées') + '</p>';
    if (me.host && !g.closedAt) body += '<button class="am-ghost" id="amClose">' + (g.test ? '🗑️ Supprimer la partie de test' : '🔒 Fermer la partie (plus personne ne peut rejoindre)') + '</button>';
    if (!me.host) body += '<button class="am-ghost" id="amHide">Masquer cette partie de ma liste</button>';
    $("amGameBody").innerHTML = body;

    drawQR($("amQR"), gameUrl(g.code));
    var pb = $("amPlay"); if (pb) pb.onclick = startPlay;
    var rb = $("amResults"); if (rb) rb.onclick = openResults;
    var sb = $("amShare"); if (sb) sb.onclick = function () { shareGame(g); };
    var cb = $("amCopy"); if (cb) cb.onclick = function () { copyText(gameUrl(g.code)); };
    var xb = $("amClose"); if (xb) xb.onclick = function () {
      if (g.test || window.confirm("Fermer la partie ? Plus personne ne pourra la rejoindre ni répondre. Les résultats restent visibles.")) socket.emit("close_game", { code: g.code });
    };
    var hb = $("amHide"); if (hb) hb.onclick = function () { if (window.confirm("Masquer cette partie de ta liste ?")) socket.emit("hide_game", { code: g.code }); };
    Array.prototype.forEach.call($("amGameBody").querySelectorAll("[data-kick]"), function (b) {
      b.onclick = function () { var n = b.getAttribute("data-kick"); if (window.confirm("Retirer " + n + " de la partie ?")) socket.emit("remove_player", { code: g.code, name: n }); };
    });
  }
  function renderPlayerRows(g, canKick) {
    if (!g.players.length) return '<p class="am-hint">Personne pour l\'instant.</p>';
    return '<div class="am-plist">' + g.players.map(function (p) {
      var st = p.finished ? '<span class="st done">✓ fini</span>' : '<span class="st">' + p.progress + '/' + g.sceneCount + '</span>';
      return '<div class="am-prow' + (p.me ? ' me' : '') + '"><span class="who">' + (p.host ? '👑 ' : '') + esc(p.name) + (p.me ? ' <span class="am-soft">(toi)</span>' : '') + '</span>' + st +
        (canKick && !p.host && !p.me ? '<button type="button" class="kick" data-kick="' + esc(p.name) + '">retirer</button>' : '') + '</div>';
    }).join("") + '</div>';
  }

  // ---------- répondre ----------
  function startPlay() {
    if (!game || !game.me || !game.me.joined) return;
    play = { code: game.code, index: game.me.nextIndex || 0, myRank: [], submitted: false, reveal: null, finished: !!game.me.finished };
    show("s-play");
    renderScene();
  }
  function othersAnswered(index) {
    // Chacun répond dans l'ordre : ceux dont la progression dépasse l'index
    // ont répondu à cette scène.
    return (game.players || []).filter(function (p) { return !p.me && p.progress > index; }).length;
  }
  function updatePlayMeta() {
    var el = $("amPlayOthers");
    if (el && game) { var n = othersAnswered(play.index); el.textContent = n ? n + " ont déjà répondu" : "personne n'a encore répondu"; }
  }
  function renderScene() {
    if (!game || !game.scenes) return;
    if (play.index >= game.scenes.length) { openResults(); return; }
    var q = game.scenes[play.index];
    var n = q.o.length;
    var body = "";
    body += '<div class="am-qmeta"><span>Scène ' + (play.index + 1) + ' / ' + game.scenes.length + '</span><span id="amPlayOthers"></span></div>';
    body += '<div class="am-progress"><i style="width:' + Math.round((play.index / game.scenes.length) * 100) + '%"></i></div>';
    body += '<div class="am-q" style="margin-top:14px">' + esc(q.q) + '</div>' + (q.ctx ? '<p class="am-qctx">' + esc(q.ctx) + '</p>' : '');
    if (play.submitted) {
      body += '<div class="am-opts">' + q.o.map(function (label, i) {
        var pos = play.myRank.indexOf(i);
        return '<div class="am-opt ranked' + (pos === 0 ? " r1" : "") + '"><span class="am-rankbadge">' + (pos + 1) + '</span><span class="am-opttext">' + esc(label) + '</span></div>';
      }).join("") + '</div><p class="am-hint center">Envoi…</p>';
    } else {
      body += '<div class="am-opts" id="amOpts">' + q.o.map(function (label, i) {
        var pos = play.myRank.indexOf(i), ranked = pos >= 0;
        return '<button type="button" class="am-opt' + (ranked ? " ranked" : "") + (pos === 0 ? " r1" : "") + '" data-i="' + i + '">' +
          '<span class="am-rankbadge">' + (ranked ? (pos + 1) : "·") + '</span><span class="am-opttext">' + esc(label) + '</span></button>';
      }).join("") + '</div>';
      body += '<p class="am-ranknote">' + (play.myRank.length === 0 ? "Touche les réponses dans ton ordre de préférence (1 = ta préférée)."
        : (play.myRank.length < n ? "Encore " + (n - play.myRank.length) + " à classer… (touche une réponse classée pour l'enlever)" : "Classement complet !")) + '</p>';
      body += '<button class="am-primary" id="amValid"' + (play.myRank.length === n ? "" : " disabled") + '>✅ Valider</button>';
      body += '<p class="am-hint center">Une fois validée, ta réponse ne change plus : tu verras alors celles des autres.</p>';
    }
    $("amPlayBody").innerHTML = body;
    updatePlayMeta();
    var opts = $("amOpts");
    if (opts) Array.prototype.forEach.call(opts.querySelectorAll("button"), function (btn) {
      btn.onclick = function () {
        var i = parseInt(btn.getAttribute("data-i"), 10);
        var at = play.myRank.indexOf(i);
        if (at >= 0) play.myRank.splice(at, 1); else if (play.myRank.length < n) play.myRank.push(i);
        renderScene();
      };
    });
    var vb = $("amValid");
    if (vb) vb.onclick = function () {
      if (play.myRank.length !== n || !socket) return;
      if (!connected) { toast("Pas de connexion là — réessaie dans un instant."); return; }
      play.submitted = true;
      socket.emit("answer", { code: play.code, qid: q.id, ranking: play.myRank.slice() });
      renderScene();
    };
  }
  // Le reveal d'une scène : ce que les autres ont répondu, et mon accord avec chacun.
  function revealHtml(rv, mine, compact) {
    var q = rv.question;
    var rows = rv.answers.slice().sort(function (x, y) { return (x.me ? -1 : y.me ? 1 : 0) || x.name.localeCompare(y.name); });
    var html = '';
    html += rows.map(function (x) {
      var ag = (!x.me && mine) ? pairAgree(mine, x.ranking) : null;
      var badge = x.me ? '<span class="am-agree me">toi</span>'
        : (ag ? '<span class="am-agree a' + ag.agree + '">' + (ag.agree === ag.total ? "✨ " : "") + ag.agree + "/" + ag.total + '</span>' : '<span class="am-agree">—</span>');
      return '<div class="am-ans-row' + (x.me ? " me" : "") + '"><span class="who">' + esc(x.name) + '</span>' +
        '<span class="picks">' + x.ranking.map(function (o) { return '<span class="pick">' + esc(emojiOf(q.o[o], o)) + '</span>'; }).join('<span class="sep">›</span>') + '</span>' + badge + '</div>';
    }).join("");
    html += '<p class="am-hint am-legend">' + q.o.map(function (l, i) { return '<span>' + esc(emojiOf(l, i)) + ' ' + esc(l.replace(/^\S+\s/, "")) + '</span>'; }).join(" · ") + '</p>';
    if (!compact) {
      if (rv.perfect && rv.perfect.length) html += '<div class="am-perfect">✨ Accord parfait : ' + rv.perfect.map(function (p) { return "<b>" + esc(p.a) + " & " + esc(p.b) + "</b>"; }).join(", ") + '</div>';
      if (rv.answers.length >= 2) html += '<div class="am-card" style="margin-top:12px"><h3>🏅 Le classement du groupe</h3>' + rv.group.map(function (g, i) {
        var mark = (mine && mine[0] === g.option) ? ' <span class="am-badge b-high">ton n°1</span>' : "";
        return '<div class="am-reveal-row"><span class="pos">' + (i + 1) + '.</span><span class="lbl">' + esc(g.label) + mark + '</span><span class="cnt">' + g.score + ' pt' + (g.score > 1 ? "s" : "") + '</span></div>';
      }).join("") + '</div>';
      if (rv.missing && rv.missing.length) html += '<p class="am-hint center">' + esc(rv.missing.join(", ")) + (rv.missing.length > 1 ? " n'ont" : " n'a") + ' pas encore répondu à celle-ci.</p>';
    }
    return html;
  }
  function renderReveal() {
    var rv = play.reveal; if (!rv) { renderScene(); return; }
    var body = '';
    body += '<div class="am-qmeta"><span>Scène ' + (play.index + 1) + ' / ' + game.scenes.length + '</span><span>' + rv.answers.length + ' réponse' + (rv.answers.length > 1 ? 's' : '') + '</span></div>';
    body += '<div class="am-q" style="margin-top:14px">' + esc(rv.question.q) + '</div>';
    body += '<div class="am-card"><h3>👀 Les réponses</h3>' + revealHtml(rv, play.myRank, false) + '</div>';
    body += '<button class="am-primary" id="amNext">' + (play.finished ? "🏁 Voir les résultats" : "Scène suivante →") + '</button>';
    $("amPlayBody").innerHTML = body;
    $("amNext").onclick = function () {
      if (play.finished) { openResults(); return; }
      play.index += 1; play.myRank = []; play.submitted = false; play.reveal = null;
      renderScene();
    };
  }

  // ---------- résultats ----------
  function openResults() {
    if (!currentCode) return;
    lastResults = null;
    show("s-results");
    $("amResTitle").textContent = game ? gameTitle(game) : "Résultats";
    $("amResultsBody").innerHTML = '<p class="am-hint center">Calcul…</p>';
    if (socket) socket.emit("game_results", { code: currentCode });
  }
  function renderResults() {
    var r = lastResults; if (!r) return;
    var me = getPseudo();
    var body = "";
    var pending = r.players.filter(function (p) { return !p.finished && !p.me; });

    if (r.locked) {
      body += '<div class="am-card am-center-card"><div class="am-big">🔒</div><p class="am-lead">Termine tes ' + r.sceneCount + ' scènes pour voir les résultats.</p><p class="am-hint">Tu en es à ' + r.progress + '/' + r.sceneCount + '.</p></div>';
      if (r.teaser) body += '<div class="am-teaser">💘 <b>' + esc(r.teaser.name) + '</b> : <span class="pct">' + r.teaser.pct + '%</span> sur vos ' + r.teaser.shared + ' scènes en commun.</div>';
      body += '<button class="am-primary xl" id="amPlay2">▶️ Continuer</button>';
      $("amResultsBody").innerHTML = body;
      $("amPlay2").onclick = function () { if (game) startPlay(); else openGame(currentCode); };
      return;
    }

    var f = r.final || {};
    if (r.finishedCount < 2) {
      body += '<div class="am-card am-center-card"><div class="am-big">🎉</div><p class="am-lead">Tu as fini !</p><p class="am-hint">Dès qu\'un autre joueur aura terminé ses ' + r.sceneCount + ' scènes, votre compatibilité apparaîtra ici toute seule.</p></div>';
    }
    if (f.top) {
      var tb = bandFor(f.top.pct);
      body += '<div class="am-top-duo"><div class="lbl">🏆 Le duo le plus compatible</div><div class="names">' + esc(f.top.a) + " 💞 " + esc(f.top.b) + '</div><div class="pct">' + f.top.pct + '%</div><div class="band">' + tb.emoji + " " + tb.label + '</div>' +
        (f.top.sameTop ? '<div class="lbl">' + f.top.sameTop + ' coup' + (f.top.sameTop > 1 ? "s" : "") + ' de cœur en commun</div>' : "") + '</div>';
    }
    var perso = r.personal;
    if (perso && perso.best) {
      body += '<div class="am-personal"><div class="am-pack-tag">💘 TON meilleur match</div><div class="names" style="font-size:1.3rem;font-weight:900;margin:4px 0">' + esc(perso.best.name) + '</div><div class="pct">' + perso.best.pct + '%</div>' +
        '<div><span class="am-badge ' + bandClass(perso.best.band) + '">' + esc(perso.best.band.emoji + " " + perso.best.band.label) + '</span></div>' +
        (perso.average != null ? '<p class="am-hint">Ta compatibilité moyenne avec le groupe : ' + perso.average + '%</p>' : "") + '</div>';
    }
    if (perso && perso.ranking && perso.ranking.length > 1) {
      body += '<div class="am-card"><h3>Toi et chacun</h3>' + perso.ranking.map(function (e, i) {
        return '<div class="am-duo-row"><span class="rank">' + medal(i) + '</span><span class="who">' + esc(e.name) + '</span><span class="pct">' + e.pct + '%</span></div>';
      }).join("") + '</div>';
    }
    if (r.provisional && r.provisional.length) {
      body += '<div class="am-card am-provisional"><h3>⏳ Provisoire <span class="am-soft">· ils n\'ont pas fini</span></h3>' + r.provisional.map(function (p) {
        return '<div class="am-duo-row"><span class="who">' + esc(p.name) + ' <span class="am-soft">· ' + p.shared + ' scènes en commun · ' + p.progress + '/' + r.sceneCount + '</span></span><span class="pct">' + p.pct + '%</span></div>';
      }).join("") + '</div>';
    }
    if (f.podium && f.podium.length > 1) {
      body += '<div class="am-card"><h3>Podium des duos</h3>' + f.podium.map(function (p, i) {
        var isMine = (p.a === me || p.b === me);
        return '<div class="am-duo-row"' + (isMine ? ' style="border-color:var(--accent2)"' : "") + '><span class="rank">' + medal(i) + '</span><span class="who">' + esc(p.a) + " & " + esc(p.b) + '</span><span class="pct">' + p.pct + '%</span></div>';
      }).join("") + '</div>';
    }
    var extras = [];
    if (f.groupSoul) extras.push({ e: "🫂", l: "L'âme sœur du groupe", n: f.groupSoul.name, v: f.groupSoul.pct + "%" });
    if (f.freeSpirit) extras.push({ e: "🛸", l: "L'électron libre", n: f.freeSpirit.name, v: f.freeSpirit.pct + "%" });
    if (f.opposites) extras.push({ e: "⚔️", l: "Les opposés", n: f.opposites.a + " & " + f.opposites.b, v: f.opposites.pct + "%" });
    if (r.moments) {
      if (r.moments.divisive) extras.push({ e: "🔥", l: "La scène qui divise", n: r.moments.divisive.q, v: r.moments.divisive.pct + "%" });
      if (r.moments.unanimous) extras.push({ e: "🫂", l: "La scène unanime", n: r.moments.unanimous.q, v: r.moments.unanimous.voters + " sur " + r.moments.unanimous.voters });
      if (r.moments.perfectPair) extras.push({ e: "✨", l: "Le duo en accord parfait", n: r.moments.perfectPair.pair, v: r.moments.perfectPair.count + "×" });
    }
    if (extras.length) {
      body += '<div class="am-card"><h3>Les titres de la partie</h3><div class="am-extras">' + extras.map(function (x) {
        return '<div class="am-extra"><span class="e">' + x.e + '</span><span class="l">' + esc(x.l) + '</span><span class="v">' + esc(x.v) + '</span><span class="n">' + esc(x.n) + '</span></div>';
      }).join("") + '</div></div>';
    }
    var names = f.names || [];
    if (names.length >= 2) {
      var head = '<tr><th class="rowh"></th>' + names.map(function (n) { return '<th>' + esc(n.slice(0, 6)) + '</th>'; }).join("") + '</tr>';
      var rows = names.map(function (a) {
        return '<tr><th class="rowh">' + esc(a) + '</th>' + names.map(function (b) {
          if (a === b) return '<td class="self">—</td>';
          var v = (f.matrix[a] || {})[b];
          return '<td><span class="am-mcell" style="background:' + cellColor(v) + '">' + (v == null ? "–" : v + "%") + '</span></td>';
        }).join("") + '</tr>';
      }).join("");
      body += '<div class="am-card"><h3>📊 Tout le monde contre tout le monde</h3><div class="am-matrix-wrap"><table class="am-matrix">' + head + rows + '</table></div></div>';
    }
    if (pending.length) {
      body += '<p class="am-hint center">' + pending.map(function (p) { return esc(p.name) + ' ' + p.progress + '/' + r.sceneCount; }).join(" · ") + '<br>' + (pending.length > 1 ? "Ils apparaîtront" : "Il apparaîtra") + ' ici dès que ce sera fini.</p>';
    }
    body += '<button class="am-ghost" id="amScenes">👀 Scène par scène</button>';
    body += '<button class="am-ghost" id="amShare2">Partager la partie</button>';
    $("amResultsBody").innerHTML = body;
    $("amScenes").onclick = function () { if (socket) socket.emit("get_reveals", { code: currentCode }); };
    $("amShare2").onclick = function () { if (game) shareGame(game); else copyText(gameUrl(currentCode)); };
  }
  // « Scène par scène » : tous les reveals, y compris ceux qui se sont remplis après coup.
  function renderScenesSheet(reveals) {
    var me = getPseudo();
    var html = reveals.length ? reveals.map(function (rv) {
      var mine = null; rv.answers.forEach(function (a) { if (a.me) mine = a.ranking; });
      return '<div class="am-scene-item"><div class="q">' + (rv.index + 1) + '. ' + esc(rv.question.q) + '</div>' + revealHtml(rv, mine, true) + '</div>';
    }).join("") : '<p class="am-hint">Réponds d\'abord à quelques scènes.</p>';
    openSheet("👀 Scène par scène", html);
  }

  // ---------- profil ----------
  function openProfile(m) {
    var p = m.profile;
    var html = '<div class="am-card"><h3>' + (p.locked ? "🔒 " : "") + esc(p.name) + '</h3>' +
      '<p class="am-hint">' + p.games + ' partie' + (p.games > 1 ? "s" : "") + ' finie' + (p.games > 1 ? "s" : "") + ' · ' + p.answered + ' réponses enregistrées</p></div>' +
      '<button type="button" class="am-ghost" id="amChangePin">🔒 Changer mon code PIN</button>';
    openSheet("👤 Profil", html, function (body) {
      body.querySelector("#amChangePin").onclick = function () { protectName(false); };
    });
  }

  // ---------- mode dev ----------
  function devSheetError(msg) { var err = $("amDevErr"); if (err) err.textContent = msg; else if (msg) toast(msg); }
  function openDevSheet() {
    if (devOn) {
      openSheet("🧪 Mode dev", '<p>Le mode dev est <b>actif</b> sur cet appareil : la carte 🧪 de l\'accueil crée une partie de test avec des bots.</p><button type="button" class="am-ghost" id="amDevOff">Désactiver le mode dev</button>',
        function (body) { body.querySelector("#amDevOff").onclick = function () { devOn = false; devInfo = null; setDevToken(""); renderDevCard(); closeSheet(); toast("Mode dev désactivé"); }; });
      return;
    }
    openSheet("🧪 Mode dev",
      '<p>Une <b>partie de test</b> : des bots qui ont déjà répondu à tout, pour relire les scènes et voir la page de résultats pleine. <b>Rien n\'est enregistré</b> dans les profils. Réservé à l\'admin.</p>' +
      '<input id="amDevPw" type="password" placeholder="Mot de passe admin" autocomplete="current-password" />' +
      '<button type="button" class="am-primary" id="amDevGo">Déverrouiller</button><div class="am-error center" id="amDevErr"></div>',
      function (body) {
        var input = body.querySelector("#amDevPw");
        setTimeout(function () { input.focus(); }, 80);
        function go() {
          var pw = input.value || "";
          if (!pw) { devSheetError("Entre le mot de passe admin."); return; }
          if (!socket || !connected) { devSheetError("Pas de connexion."); return; }
          devSheetError(""); socket.emit("dev_unlock", { password: pw });
        }
        body.querySelector("#amDevGo").onclick = go;
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
      });
  }
  function renderDevCard() {
    var host = $("amDev"); if (!host) return;
    if (!devOn || !devInfo) { host.innerHTML = ""; return; }
    var maxBots = devInfo.max_bots || 4;
    host.innerHTML = '<div class="am-card am-devcard"><h3>🧪 Mode dev — partie de test</h3>' +
      '<p class="am-hint">Des bots qui ont déjà répondu à tout (Bot A = ton ordre si tu classes dans l\'ordre affiché, Bot B = l\'inverse). Rien n\'est enregistré.</p>' +
      '<div class="am-devrow"><label for="amDevBots">Bots</label><input id="amDevBots" type="number" inputmode="numeric" min="0" max="' + maxBots + '" value="' + devBots + '" /></div>' +
      '<button type="button" class="am-primary" id="amDevGo">🧪 Créer une partie de test</button></div>';
    $("amDevGo").onclick = function () {
      var v = parseInt($("amDevBots").value, 10); if (isNaN(v)) v = 2; devBots = Math.max(0, Math.min(maxBots, v));
      if (!socket || !connected) { toast("Pas de connexion."); return; }
      socket.emit("dev_start", { bots: devBots });
    };
  }

  // ---------- aide ----------
  var HELP = {
    main: { title: "Comment ça marche", body:
      "<p><b>Une partie = 20 scènes</b>, les mêmes pour tout le monde. Quelqu'un la crée et partage son QR ; chacun répond <b>quand il veut</b>.</p>" +
      "<p><b>Chaque scène propose 3 réponses.</b> Tu les classes : <b>1re</b> = ta préférée, <b>3e</b> = celle que tu aimes le moins. Une fois validée, ta réponse ne change plus, et tu découvres celles des autres.</p>" +
      "<p><b>Le calcul :</b> pour chaque scène on fait les 3 comparaisons possibles (A/B, A/C, B/C) ; 1 point par accord. Ta compatibilité avec quelqu'un = points obtenus / points possibles. Deux personnes au hasard tournent autour de 50 %.</p>" +
      "<p><b>Les résultats</b> se calculent sur ceux qui ont fini, et se mettent à jour à chaque nouvelle arrivée. En attendant, une compatibilité provisoire s'affiche dès 5 scènes en commun.</p>" +
      "<p>🔒 <b>Ton PIN</b> protège ton pseudo et te permet de reprendre tes parties sur n'importe quel téléphone.</p>" },
    pin: { title: "Le code PIN 🔒", body:
      "<p>Le PIN (4 chiffres) <b>réserve ton pseudo</b> : personne d'autre ne peut le prendre, et toi tu peux reprendre tes parties sur un autre téléphone.</p>" +
      "<p>Il est obligatoire. Si tu l'oublies, tu peux en choisir un nouveau depuis le téléphone où tu as créé le pseudo (bouton profil).</p>" },
  };
  function openHelp(k) { var h = HELP[k] || HELP.main; openSheet(h.title, h.body); }

  // ---------- bootstrap ----------
  document.addEventListener("DOMContentLoaded", function () {
    pendingCode = codeFromUrl();
    var input = $("amName");
    if (input) input.value = getPseudo();
    if (pendingCode) { var note = $("amInviteNote"); if (note) { note.style.display = ""; note.textContent = "On t'invite à une partie (" + pendingCode + "). Entre ton pseudo et ton PIN pour la rejoindre."; } }
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
    $("amBack").onclick = function () {
      if (screen === "s-play") { openGame(currentCode); return; }
      if (screen === "s-results") { openGame(currentCode); return; }
      goHome();
    };
    $("amHelp").onclick = function () { openHelp("main"); };
    $("amSheetClose").onclick = closeSheet;
    $("amOverlay").addEventListener("click", function (e) { if (e.target === $("amOverlay")) closeSheet(); });
    $("amCreate").onclick = createGameSheet;
    $("amJoinBtn").onclick = joinSheet;
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains("am-info")) { e.preventDefault(); openHelp(t.getAttribute("data-help")); }
    });
    connect();
    if (!getPseudo()) show("s-pseudo");
    else show("s-home");
    if (getDevToken()) { var tk = getDevToken(); socket.on("identity_ok", function () { if (getDevToken() === tk && !devOn) socket.emit("dev_unlock", { token: tk }); }); }
    if (/[?&]dev(=|&|$)/.test(location.search)) setTimeout(openDevSheet, 400);
    window.__amForceCloseSheet = forceCloseSheet;
  });
})();
