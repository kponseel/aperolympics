// Are We A Match? v2 — SPA. Socket.IO namespace /match.
// Écrans : pseudo + code de reprise / mes parties / une partie / répondre (scène puis
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
  function fmtDelay(min) {
    if (min < 60) return min + " minutes";
    if (min < 1440) return Math.round(min / 60) + " heure" + (min >= 120 ? "s" : "");
    return Math.round(min / 1440) + " jour" + (min >= 2880 ? "s" : "");
  }
  function gameUrl(code) { return location.origin + "/AreWeAMatch/g/" + code; }
  // Le lien qui ramène droit à l'écran final (la progression de tout le monde,
  // les résultats dès qu'on a fini). Même page : on ajoute juste ?r=1, que le
  // serveur ignore et que le client lit au démarrage.
  function resultsUrl(code) { return gameUrl(code) + "?r=1"; }
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
  var myProtected = false, pinMode = false, pendingCode = null, pendingResults = false, currentCode = null;
  var gamesCache = null, game = null, lastResults = null, refreshTimer = null, sceneCountHint = 20;
  // La scène en cours de réponse.
  var play = { code: null, index: 0, myRank: [], submitted: false, reveal: null, finished: false, sent: {} };
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
  function wantsResultsFromUrl() { return /[?&]r=1(?:&|$)/.test(location.search); }
  function setUrl(code, results) {
    var to = code ? "/AreWeAMatch/g/" + code + (results ? "?r=1" : "") : "/AreWeAMatch/";
    try { history.replaceState(null, "", to); } catch (e) {}
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
    socket.on("pin_weak", function (m) {
      var msg = weakPinMsg(m && m.why);
      var err = $("amFormErr");             // si la feuille « code de reprise » est ouverte
      if (err && $("amOverlay").style.display !== "none") { err.textContent = msg; return; }
      show("s-pseudo");
      $("amPseudoError").className = "am-error center warn";
      $("amPseudoError").textContent = msg;
      var pin = $("amPin"); if (pin) { pin.value = ""; pin.focus(); }
    });
    socket.on("pin_needed", function () {
      show("s-pseudo");
      $("amPseudoError").className = "am-error center warn";
      $("amPseudoError").textContent = "Ce pseudo est libre ! Choisis un code de reprise à 4 chiffres pour te le réserver.";
      var pin = $("amPin"); if (pin) { pin.value = ""; pin.focus(); }
    });
    socket.on("name_taken", function (m) {
      show("s-pseudo");
      $("amPseudoError").className = "am-error center";
      $("amPseudoError").textContent = "Le pseudo « " + (m && m.name) + " » est déjà pris. Choisis-en un autre.";
      var nm = $("amName"); if (nm) nm.focus();
    });
    socket.on("pin_required", function (m) { enterPinMode(m && m.name, "🔒 Ce pseudo est déjà à quelqu\u2019un. Entre son code de reprise."); });
    socket.on("pin_wrong", function (m) {
      enterPinMode(m && m.name, "❌ Code incorrect. Il te reste " + (m && m.attempts_left) + " essai" + ((m && m.attempts_left) > 1 ? "s" : "") + ".");
      var pin = $("amPin"); if (pin) { pin.value = ""; pin.focus(); }
    });
    socket.on("identity_locked", function (m) {
      pinMode = false; show("s-pseudo");
      $("amPseudoError").textContent = "";
      $("amLocked").style.display = "block";
      var d = $("amLockedWhen");
      var mn = (m && m.ms) ? Math.max(1, Math.round(m.ms / 60000)) : 0;
      if (d) d.textContent = mn ? "Réessaie dans " + fmtDelay(mn) + "." + ((m.strikes || 0) > 1 ? " Chaque série d'essais ratés allonge l'attente." : "") : "";
    });
    socket.on("pin_set", function () { myProtected = true; updateMe(); closeSheet(); toast("🔒 Code de reprise enregistré."); if (!booted) afterIdentity(); });

    // --- parties ---
    socket.on("games_list", function (m) {
      gamesCache = (m && m.games) || [];
      if (m && m.scene_count > 0) sceneCountHint = m.scene_count;
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
      // Arrivé par le lien « voir la progression » (?r=1) : on file à l'écran
      // final dès qu'on sait que celui qui ouvre est bien un joueur. Sinon
      // (un invité qui découvre la partie), la page de la partie, comme d'habitude.
      if (pendingResults) {
        pendingResults = false;
        if (m.me && m.me.joined) { openResults(); return; }
        setUrl(m.code);
      }
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
        // Quelqu'un vient de répondre à la scène d'avant : la fenêtre de retour
        // se referme, le bouton doit disparaître tout de suite. Sinon il reste
        // affiché et ne marche plus — pire qu'une absence de bouton.
        else if (!play.submitted && !play.reveal && prev && undoSig(prev) !== undoSig(m)) renderScene();
      }
    });
    socket.on("answer_ack", function (m) {
      if (!m) return;
      if (!m.ok) {
        play.submitted = false;
        if (m.reason === "already_answered") { warn("Déjà répondu à cette scène."); play.index += 1; play.myRank = []; renderScene(); return; }
        if (m.reason === "closed") { warn("Cette partie est fermée."); openGame(play.code); return; }
        warn("Réponse non prise en compte, réessaie."); renderScene(); return;
      }
      play.finished = !!m.finished;
      play.reveal = m.reveal;
      // Personne d'autre n'a encore répondu à cette scène : pas d'écran vide,
      // on enchaîne. Le mot qui explique pourquoi on n'a rien vu est affiché
      // par renderScene, à côté du bouton de retour, et il reste tant que la
      // fenêtre est ouverte — en notice de trois secondes en haut de l'écran,
      // il disparaissait pendant qu'on le lisait.
      if (play.reveal && play.reveal.answers.length <= 1 && !play.finished) {
        // On sait déjà qu'on était seul sur cette scène : on ouvre la fenêtre
        // sans attendre l'état du serveur (envoyé juste après answer_ack), le
        // bloc est donc là dès le premier rendu au lieu de clignoter.
        if (game && game.me && game.me.undoable && game.me.undoable.indexOf(play.index) < 0) game.me.undoable.push(play.index);
        play.index = (m.index != null) ? m.index : play.index + 1;
        play.myRank = []; play.submitted = false; play.reveal = null;
        renderScene();
        return;
      }
      renderReveal();
    });
    // Retour sur une réponse : le serveur l'a effacée, on repose l'écran sur
    // cette scène, avec le classement qu'on avait envoyé — il suffit de
    // corriger ce qui n'allait pas plutôt que de tout refaire.
    socket.on("unanswer_ack", function (m) {
      if (!m) return;
      if (!m.ok) {
        if (m.reason === "revealed") warn("Trop tard : quelqu'un a répondu à cette scène, tu as vu sa réponse.");
        else if (m.reason === "finished") warn("Tu as terminé la partie : les réponses sont définitives.");
        else if (m.reason === "not_answered") warn("Tu n'as pas encore répondu à cette scène.");
        else warn("Impossible de revenir sur cette réponse.");
        return;
      }
      if (screen !== "s-play") return;
      play.index = (m.index != null) ? m.index : Math.max(0, play.index - 1);
      play.myRank = ((play.sent && play.sent[m.qid]) || []).slice();
      play.submitted = false; play.reveal = null; play.finished = false;
      renderScene();
      toast("↩️ Tu peux refaire ton classement.");
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
      if (!m || !m.ok) { warn("Impossible de fermer les inscriptions."); return; }
      if (m.deleted) { toast("Partie de test supprimée"); goHome(); return; }
      toast("🔒 Inscriptions fermées — tout le monde peut finir");
    });
    socket.on("game_reopened", function (m) {
      if (!m || !m.ok) { warn("Impossible de rouvrir les inscriptions."); return; }
      toast("🔓 Inscriptions rouvertes");
    });
    socket.on("player_removed", function (m) { if (m && m.ok) toast(m.name + " a été retiré de la partie."); });
    socket.on("game_hidden", function (m) { if (m && m.ok) { toast("Partie masquée — tu la retrouveras avec son code."); goHome(); } });
    socket.on("game_deleted", function (m) {
      if (m && m.ok) { closeSheet(); toast("🗑️ Partie supprimée."); goHome(); return; }
      var why = m && m.reason;
      var err = $("amDelErr");
      var msg = why === "not_host" ? "Seul l'hôte peut supprimer la partie."
        : why === "confirm_required" ? "Recopie exactement le code de la partie."
        : why === "unknown_game" ? "Cette partie n'existe déjà plus."
        : "Suppression impossible.";
      if (err) { err.textContent = msg; var g2 = $("amDelGo"); if (g2) g2.disabled = false; }
      else warn(msg);
    });
    socket.on("game_gone", function (m) {
      if (!m || m.code !== currentCode) return;
      warn(m.reason === "removed" ? "Tu as été retiré de cette partie." : "Cette partie n'existe plus.");
      goHome();
    });
    socket.on("profile", function (m) {
      if (!m || m.ok === false) { warn("Pas encore de profil."); return; }
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
      if (code === "bad_pin") { warn("Le code de reprise fait 4 chiffres."); return; }
      if (code === "not_owner") { warn("Ce pseudo appartient à un autre appareil."); return; }
      if (code === "unknown_game") {
        pendingResults = false; warn("Aucune partie avec ce code.");
        if (pendingCode) pendingCode = null;
        // openGame affiche « Chargement… » avant de savoir si le code existe :
        // sur un code qui n'existe pas, on y restait bloqué, avec un message
        // d'erreur et rien à faire. On revient à l'accueil.
        if (screen === "s-game" && !game) { currentCode = null; setUrl(null); goHome(); }
        return;
      }
      if (code === "slow_down") { warn("Trop de codes essayés, attends un peu."); return; }
      if (code === "closed") { warn("Les inscriptions de cette partie sont fermées."); return; }
      if (code === "dev_locked") { warn("Mode dev verrouillé."); return; }
      warn(code ? "Erreur : " + code : "Erreur");
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

  // ---------- notices ----------
  // Deux défauts corrigés ici, tous les deux visibles à l'usage.
  //
  // 1. Les messages passaient par #amStatus, une barre DANS LE FLUX, juste
  //    au-dessus du contenu : un message de trois lignes poussait tout l'écran
  //    vers le bas en apparaissant, puis le ramenait en disparaissant. La page
  //    sautait deux fois. Une notice est désormais superposée (position:
  //    fixed) : elle ne prend aucune place, donc elle ne décale rien.
  // 2. Tout s'effaçait après 3 secondes — on perdait le message en le lisant.
  //    Désormais un PROBLÈME reste jusqu'à ce qu'on le chasse (warn) ; seule
  //    une confirmation de ce qu'on vient de faire s'efface toute seule
  //    (toast) — on sait déjà ce qu'on a tapé.
  //
  // #amStatus ne sert plus qu'à l'état de la connexion, qui est durable : une
  // notice ne doit pas l'écraser, ni l'effacer en expirant. « Pas de connexion
  // là » suivi d'une barre vide, c'était le contraire de l'information utile.
  var toastTimer = null;
  // La notice est posée en bas de l'écran : on allonge la page de sa hauteur
  // pour que le dernier bouton reste atteignable en défilant. Allonger le bas
  // ne déplace rien de ce qui est déjà affiché.
  function placeNotices() {
    var host = $("amNotice");
    var card = host && host.firstChild;
    var h = card ? Math.ceil(card.getBoundingClientRect().height) + 18 : 0;
    document.documentElement.style.setProperty("--am-notice-h", h + "px");
  }
  function hideNotice() {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    var host = $("amNotice"); if (host) host.innerHTML = "";
    placeNotices();
  }
  function notice(msg, opts) {
    var host = $("amNotice");
    if (!host) { setStatus(msg); return; }            // repli : vieille coquille en cache
    var o = opts || {};
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    host.innerHTML = '<div class="am-toast' + (o.bad ? " bad" : "") + '">' +
      '<span class="t">' + esc(msg) + '</span><span class="x" aria-hidden="true">✕</span></div>';
    var el = host.firstChild;
    el.onclick = hideNotice;
    placeNotices();
    if (o.ms) toastTimer = setTimeout(hideNotice, o.ms);
  }
  // Confirmation de ce qu'on vient de faire : elle s'efface toute seule.
  function toast(msg) { notice(msg, { ms: 4000 }); }
  // Problème : elle reste affichée tant qu'on ne l'a pas chassée.
  function warn(msg) { notice(msg, { bad: true }); }
  // Rotation du téléphone, clavier qui s'ouvre : la barre du haut bouge, une
  // notice déjà affichée doit suivre.
  window.addEventListener("resize", placeNotices);

  // ---------- pseudo / code de reprise ----------
  // Le serveur refuse les codes trop courants (voir weakPin dans players.js).
  // Ici on n'en reproduit qu'assez pour ne jamais PROPOSER un code qu'il
  // refuserait : c'est lui qui tranche, pas nous.
  var OBVIOUS = ["1234", "1111", "0000", "1212", "7777", "1004", "2000", "4444", "2222",
    "6969", "9999", "3333", "5555", "6666", "1122", "1313", "8888", "4321", "2001", "1010"];
  function looksObvious(pin) {
    if (OBVIOUS.indexOf(pin) >= 0) return true;
    if (/^(\d)\1{3}$/.test(pin)) return true;
    var d = pin.split("").map(Number);
    var suite = function (step) {
      for (var i = 1; i < d.length; i++) if (d[i] !== (d[i - 1] + step + 10) % 10) return false;
      return true;
    };
    return suite(1) || suite(-1);
  }
  function suggestPin() {
    for (var i = 0; i < 50; i++) {
      var n = (crypto.getRandomValues(new Uint32Array(1))[0] % 10000);
      var p = String(n);
      while (p.length < 4) p = "0" + p;
      if (!looksObvious(p)) return p;
    }
    return "4827";
  }
  // Pourquoi un code est refusé — une phrase utile, pas un « non ».
  function weakPinMsg(why) {
    if (why === "repete") return "Quatre fois le même chiffre, c'est le deuxième code que quelqu'un essaie. Choisis-en un autre.";
    if (why === "suite") return "Une suite de chiffres, c'est trop deviné. Choisis-en un autre.";
    return "Ce code est l'un des plus utilisés au monde — c'est le premier que quelqu'un essaierait. Choisis-en un autre.";
  }
  function enterPinMode(name, msg) {
    pinMode = true; show("s-pseudo");
    $("amLocked").style.display = "none";
    if (name) $("amName").value = name;
    $("amPinLabel").innerHTML = "🔒 Code de reprise <span class='am-soft'>(4 chiffres)</span>";
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
    if (!/^\d{4}$/.test(pin)) { $("amPseudoError").textContent = "Ton code de reprise : 4 chiffres. Il ne sert que si tu changes de téléphone, mais il est obligatoire — c'est lui qui te réserve ton pseudo."; $("amPin").focus(); return; }
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

  // ---------- fenêtres par-dessus le jeu ----------
  // Deux choses qu'on attend d'une fenêtre modale sur un téléphone, et qui
  // manquaient :
  //   - la page ne doit pas défiler DERRIÈRE : glisser sur la fenêtre faisait
  //     bouger le fond (mesuré : 354 px) ;
  //   - le bouton « retour » doit la fermer, pas quitter le jeu. On empile
  //     une entrée d'historique par fenêtre ouverte, et on la retire nous-même
  //     quand la fenêtre se ferme autrement — sans quoi il faudrait appuyer
  //     deux fois sur « retour ».
  var modalDepth = 0, selfPops = 0;
  function anyModal() {
    return ($("amOverlay") && $("amOverlay").style.display !== "none") ||
      ($("amOnb") && $("amOnb").style.display !== "none");
  }
  // `overflow: hidden` ne suffit pas : la page reste défilable. On fige donc
  // le corps de page à sa position (position: fixed + décalage négatif), et on
  // le rend à l'endroit exact où on l'avait laissé. C'est aussi la seule
  // méthode qui tienne sur iOS.
  var lockY = 0;
  function syncModalLock() {
    var root = document.documentElement, veut = anyModal(), pose = root.classList.contains("am-modal");
    if (veut === pose) return;
    if (veut) {
      lockY = window.scrollY || window.pageYOffset || 0;
      document.body.style.top = -lockY + "px";
      root.classList.add("am-modal");
    } else {
      root.classList.remove("am-modal");
      document.body.style.top = "";
      window.scrollTo(0, lockY);
    }
  }
  function modalShown(el) {
    syncModalLock();
    if (el.getAttribute("data-am-pushed") === "1") return;   // déjà empilée
    el.setAttribute("data-am-pushed", "1");
    try { history.pushState({ am: 1 }, "", location.href); modalDepth++; } catch (e) {}
  }
  function modalHidden(el) {
    syncModalLock();
    if (el.getAttribute("data-am-pushed") !== "1") return;
    el.setAttribute("data-am-pushed", "");
    if (modalDepth > 0) { modalDepth--; selfPops++; try { history.back(); } catch (e) { selfPops--; } }
  }
  window.addEventListener("popstate", function () {
    if (selfPops > 0) { selfPops--; return; }     // c'est nous qui avons dépilé
    if (modalDepth <= 0) return;                  // pas notre entrée : on laisse faire
    modalDepth--;
    hideSheetRaw(); hideOnbRaw();
    syncModalLock();
  });

  var sheetLocked = false;
  function hideSheetRaw() { sheetLocked = false; $("amOverlay").style.display = "none"; $("amOverlay").setAttribute("data-am-pushed", ""); }
  function openSheet(title, html, onMount, locked) {
    sheetLocked = !!locked;
    $("amSheetTitle").textContent = title;
    $("amSheetClose").style.display = locked ? "none" : "";
    var body = $("amSheetBody"); body.innerHTML = html;
    $("amOverlay").style.display = "flex";
    $("amSheetBody").scrollTop = 0;
    modalShown($("amOverlay"));
    if (typeof onMount === "function") onMount(body);
  }
  function closeSheet() { if (sheetLocked) return; $("amOverlay").style.display = "none"; modalHidden($("amOverlay")); }
  function forceCloseSheet() { sheetLocked = false; $("amOverlay").style.display = "none"; modalHidden($("amOverlay")); }

  // Choisir (ou changer) son code de reprise. `mandatory` : compte d'avant la
  // v2 sans code, la feuille ne se ferme pas tant qu'il n'en a pas un.
  function protectName(mandatory) {
    openSheet("🔒 " + (mandatory ? "Choisis ton code de reprise" : "Ton code de reprise"),
      '<p>' + (mandatory ? "Chaque pseudo a un code de reprise. Tu ne le tapes jamais sur ce téléphone : il ne sert que le jour où tu ouvres ton pseudo ailleurs — et c'est lui qui empêche quelqu'un d'autre de le prendre." : "Choisis un nouveau code de reprise à 4 chiffres.") + '</p>' +
      '<input id="amFormPin" type="tel" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off" pattern="[0-9]*" />' +
      '<button type="button" class="am-primary" id="amFormGo">🔒 ' + (mandatory ? "C'est mon code" : "Changer") + '</button>' +
      '<p class="am-hint center"><button type="button" class="am-linkish" id="amFormSuggest">Propose-m\'en un au hasard</button></p>' +
      '<div class="am-error center" id="amFormErr"></div>',
      function (body) {
        var input = body.querySelector("#amFormPin");
        var err = body.querySelector("#amFormErr");
        setTimeout(function () { input.focus(); }, 80);
        function go() {
          var pin = (input.value || "").trim();
          if (!/^\d{4}$/.test(pin)) { err.textContent = "Le code doit faire 4 chiffres."; input.focus(); return; }
          if (socket) socket.emit("set_pin", { pin: pin });
          sheetLocked = false;
        }
        body.querySelector("#amFormGo").onclick = go;
        body.querySelector("#amFormSuggest").onclick = function () { input.value = suggestPin(); err.textContent = ""; input.focus(); };
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
    renderInstall();
    var wrap = $("amGames"); if (!wrap) return;
    var list = gamesCache || [];
    if (!list.length) {
      wrap.innerHTML = '<div class="am-empty"><b>Aucune partie pour l\'instant.</b><br>Crée la première et partage son QR — tes amis répondront quand ils auront le temps.<br>Ou rejoins celle de quelqu\'un avec son code à 5 caractères.</div>';
      return;
    }
    wrap.innerHTML = list.map(function (g) {
      var pct = g.sceneCount ? Math.round((g.progress / g.sceneCount) * 100) : 0;
      var state = g.finished ? "✓ terminé" : (g.progress ? g.progress + "/" + g.sceneCount : "pas commencé");
      var meta = [
        "👥 " + g.playerCount + " joueur" + (g.playerCount > 1 ? "s" : ""),
        g.finishedCount ? "✓ " + g.finishedCount + " fini" + (g.finishedCount > 1 ? "s" : "") : "",
        "toi : " + state,
        g.closed ? "🔒 inscriptions fermées" : "",
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
      '<p><b>' + sceneCountHint + ' scènes</b> tirées au sort, les mêmes pour tout le monde et dans le même ordre. Tu seras l\'hôte : tu partages le QR, chacun répond quand il veut, tu vois le groupe avancer.</p>' +
      '<p class="am-hint">Tu pourras fermer les inscriptions plus tard : ça empêche de nouveaux joueurs d\'entrer, sans jamais couper ceux qui ont commencé.</p>' +
      '<input id="amFormTitle" maxlength="40" placeholder="Un titre (facultatif) : Soirée du 12, Les colocs…" autocomplete="off" />' +
      '<button type="button" class="am-primary" id="amFormGo">🎲 Créer la partie</button>',
      function (body) {
        var input = body.querySelector("#amFormTitle");
        function go() { if (!socket || !connected) { warn("Pas de connexion."); return; } socket.emit("create_game", { title: (input.value || "").trim() }); closeSheet(); }
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
  // Un partage, un seul lien. Le lien vit DANS le texte, et on ne passe pas
  // « url » à navigator.share : les applications de messagerie collent l'url
  // à la suite du texte, donc un texte qui finit déjà par le lien le faisait
  // apparaître DEUX FOIS dans le message envoyé. Les aperçus de lien marchent
  // quand même, WhatsApp & co repèrent l'adresse dans le texte.
  function shareLink(text) {
    if (navigator.share) { navigator.share({ title: "Are We A Match ?", text: text }).catch(function () {}); return; }
    copyText(text);
  }
  // Le texte doit se suffire à lui-même : celui qui le reçoit n'a aucun
  // contexte, et personne ne sera là pour lui expliquer.
  function shareGame(g) {
    var n = g.sceneCount || 20;
    shareLink((g.hostName === getPseudo() ? "Fais mon test « Are We A Match ? »" : "Rejoins la partie « Are We A Match ? » de " + g.hostName)
      + " : " + n + " scènes, 3 réponses à classer à chaque fois. Tu réponds quand tu veux (2 min, ou demain), et on voit à quel point on fait pareil. Rien à installer → " + gameUrl(g.code));
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast("Copié !"); }, function () { notice(t); });
    else notice(t);
  }
  // Le compteur que tout le monde voit, joueur ou pas : combien ont rejoint,
  // combien ont fini, et où en est le groupe.
  function countsBar(g) {
    var n = g.playerCount != null ? g.playerCount : g.players.length;
    var fin = g.finishedCount != null ? g.finishedCount : g.players.filter(function (p) { return p.finished; }).length;
    var answered = g.players.reduce(function (s, p) { return s + p.progress; }, 0);
    var pct = (n && g.sceneCount) ? Math.round((answered / (n * g.sceneCount)) * 100) : 0;
    return '<div class="am-counts">' +
      '<div class="am-count"><span class="v">' + n + '</span><span class="l">' + (n > 1 ? "joueurs ont rejoint" : "joueur a rejoint") + '</span></div>' +
      '<div class="am-count"><span class="v">' + fin + '</span><span class="l">' + (fin > 1 ? "ont fini" : "a fini") + '</span></div>' +
      '<div class="am-count"><span class="v">' + g.sceneCount + '</span><span class="l">scènes</span></div>' +
      '</div><div class="am-progress group"><i style="width:' + pct + '%"></i></div>';
  }
  function renderGame() {
    if (!game) return;
    var g = game, me = g.me || {};
    $("amGameTitle").textContent = gameTitle(g);
    var badge = $("amDevBadge"); if (badge) badge.style.display = g.test ? "" : "none";
    if (screen !== "s-game") show("s-game");
    var body = "";
    var finishedNames = g.finishedCount != null ? g.finishedCount : g.players.filter(function (p) { return p.finished; }).length;

    if (!me.joined) {
      body += '<div class="am-invite"><b>' + esc(g.hostName) + '</b> t\'invite à sa partie.<br>' +
        '<b>' + g.sceneCount + ' scènes</b> : à chaque fois, 3 réponses à classer — le plus souvent de ta préférée à celle que tu aimes le moins, chaque scène le précise. ' +
        'Tu réponds <b>quand tu veux</b>, personne ne t\'attend. À la fin, on voit à quel point vous faites pareil.</div>';
      body += countsBar(g);
      if (g.closedAt) body += '<div class="am-card am-center-card"><div class="am-big">🔒</div><p class="am-lead">Les inscriptions sont fermées.</p><p class="am-hint">' + esc(g.hostName) + ' a fermé la porte : on ne peut plus rejoindre cette partie-là. Demande-lui de la rouvrir, ou crée la tienne.</p></div>';
      else body += '<button class="am-primary xl" id="amJoinGame">🎮 Rejoindre la partie</button><p class="am-hint center">Gratuit, sans pub, rien à installer. Tes réponses sont sauvées à chaque scène.</p>';
      body += '<div class="am-card"><h3>Qui joue (' + g.players.length + ')</h3>' + renderPlayerRows(g, false) + '</div>';
      body += '<button class="am-ghost" id="amHowto">💡 Comment ça marche ?</button>';
      $("amGameBody").innerHTML = body;
      var jb = $("amJoinGame"); if (jb) jb.onclick = function () { if (socket) socket.emit("join_game", { code: g.code }); };
      var hw = $("amHowto"); if (hw) hw.onclick = function () { openOnboarding(true); };
      return;
    }

    // Bouton principal selon où j'en suis. Une partie fermée ne bloque plus
    // celui qui a déjà rejoint : il a tout son temps pour finir.
    var action = "";
    if (me.finished) action = '<button class="am-primary xl" id="amResults">💘 Voir les résultats</button>';
    else if (me.progress > 0) action = '<button class="am-primary xl" id="amPlay">▶️ Continuer (' + me.progress + '/' + g.sceneCount + ')</button>';
    else action = '<button class="am-primary xl" id="amPlay">🎬 Répondre aux ' + g.sceneCount + ' scènes</button>';

    // Partager : QR + lien + code.
    var share = '<div class="am-card am-share"><h3>Inviter</h3>' +
      '<p class="am-hint">Montre ce QR, ou envoie le lien. Ceux qui le reçoivent peuvent répondre quand ils veulent, même dans plusieurs jours.</p>' +
      '<div class="am-qr"><canvas id="amQR" width="400" height="400"></canvas></div>' +
      '<div class="am-code-big">' + esc(g.code) + '</div>' +
      '<p class="am-hint">Scanne, ou tape ce code dans « Rejoindre ».</p>' +
      '<div class="am-share-row"><button class="am-primary" id="amShare">Partager le lien</button><button class="am-ghost" id="amCopy">Copier</button></div></div>';

    body += countsBar(g);
    // Seul dans sa partie et rien de commencé : inviter d'abord, c'est le geste
    // qui donne un sens à la suite. Sinon, l'action d'abord.
    var alone = g.players.length <= 1 && me.progress === 0 && !me.finished && !g.closedAt;
    body += alone ? share + action : action;
    if (me.teaser) body += '<div class="am-teaser">💘 <b>' + esc(me.teaser.name) + '</b> : <span class="pct">' + me.teaser.pct + '%</span> sur vos ' + me.teaser.shared + ' scènes en commun. <span class="am-soft">Termine pour voir tout.</span></div>';
    if (me.finished && finishedNames < 2) body += '<p class="am-hint center">Tu as fini ! Dès qu\'un autre joueur aura fini, vous verrez votre compatibilité — tu recevras la partie en « Nouveaux résultats » dans ta liste.</p>';
    if (!alone && !g.closedAt) body += share;

    body += '<div class="am-card"><h3>Qui joue (' + g.players.length + ')' + (finishedNames ? ' <span class="am-soft">· ' + finishedNames + ' fini' + (finishedNames > 1 ? 's' : '') + '</span>' : '') + '</h3>' + renderPlayerRows(g, me.host) + '</div>';

    body += '<p class="am-hint center">' + (g.closedAt
      ? '🔒 Inscriptions fermées ' + fmtAgo(g.closedAt) + ' — plus personne ne peut rejoindre, mais <b>tout le monde garde le temps qu\'il veut pour finir</b>.'
      : '🔓 Ouverte · ' + g.sceneCount + ' scènes · réponds quand tu veux, tes réponses sont sauvées à chaque scène') + '</p>';
    if (me.host && g.test) body += '<button class="am-ghost" id="amClose">🗑️ Supprimer la partie de test</button>';
    else if (me.host && !g.closedAt) body += '<button class="am-ghost" id="amClose">🔒 Fermer les inscriptions</button>';
    else if (me.host && g.closedAt) body += '<button class="am-ghost" id="amReopen">🔓 Rouvrir les inscriptions</button>';
    // Masquer existe pour tout le monde, l'hôte compris : sans cette sortie,
    // un hôte qui veut juste ranger sa liste n'avait que la suppression —
    // c'est-à-dire détruire la partie pour tous les autres.
    body += '<button class="am-ghost" id="amHide">Masquer cette partie de ma liste</button>';
    if (me.host && !g.test) body += '<button class="am-ghost am-danger" id="amDelete">🗑️ Supprimer la partie</button>';
    body += '<button class="am-ghost" id="amHowto">💡 Comment ça marche ?</button>';
    $("amGameBody").innerHTML = body;

    drawQR($("amQR"), gameUrl(g.code));
    var pb = $("amPlay"); if (pb) pb.onclick = startPlay;
    var rb = $("amResults"); if (rb) rb.onclick = openResults;
    var sb = $("amShare"); if (sb) sb.onclick = function () { shareGame(g); };
    var cb = $("amCopy"); if (cb) cb.onclick = function () { copyText(gameUrl(g.code)); };
    var hw2 = $("amHowto"); if (hw2) hw2.onclick = function () { openOnboarding(true); };
    var xb = $("amClose"); if (xb) xb.onclick = function () {
      if (g.test) { if (window.confirm("Supprimer la partie de test ?")) socket.emit("close_game", { code: g.code }); return; }
      if (window.confirm("Fermer les inscriptions ?\n\nPlus personne ne pourra rejoindre. Ceux qui ont déjà rejoint gardent tout leur temps pour finir, et les résultats continuent de se remplir.")) socket.emit("close_game", { code: g.code });
    };
    var ob = $("amReopen"); if (ob) ob.onclick = function () { socket.emit("reopen_game", { code: g.code }); };
    var hb = $("amHide"); if (hb) hb.onclick = function () { if (window.confirm("Masquer cette partie de ta liste ?\n\nElle continue d'exister pour les autres, et tu la retrouveras avec son code.")) socket.emit("hide_game", { code: g.code }); };
    var db = $("amDelete"); if (db) db.onclick = function () { deleteGameSheet(g); };
    Array.prototype.forEach.call($("amGameBody").querySelectorAll("[data-kick]"), function (b) {
      b.onclick = function () { var n = b.getAttribute("data-kick"); if (window.confirm("Retirer " + n + " de la partie ?")) socket.emit("remove_player", { code: g.code, name: n }); };
    });
  }
  // Supprimer une partie détruit AUSSI les réponses des autres. L'alerte dit
  // donc ce qui disparaît, chiffres à l'appui, plutôt qu'un « êtes-vous sûr ? »
  // qui n'apprend rien. Et quand quelqu'un d'autre a déjà répondu, il faut
  // recopier le code de la partie : le geste devient impossible par accident.
  function deleteGameSheet(g) {
    var others = (g.players || []).filter(function (p) { return !p.me && !p.bot; });
    var answers = others.reduce(function (n, p) { return n + p.progress; }, 0);
    var finished = others.filter(function (p) { return p.finished; }).length;
    var needCode = answers > 0;

    var what = "<p>La partie <b>" + esc(gameTitle(g)) + "</b> (" + esc(g.code) + ") disparaît <b>pour tout le monde</b>, définitivement.</p>";
    if (others.length) {
      what += "<p class='am-danger-box'>Tu effaces aussi le travail de <b>" + others.length + " autre" + (others.length > 1 ? "s" : "") + " joueur" + (others.length > 1 ? "s" : "") + "</b> : " +
        (answers ? "<b>" + answers + " réponse" + (answers > 1 ? "s" : "") + "</b> déjà données" : "aucune réponse pour l'instant") +
        (finished ? ", dont " + finished + " partie" + (finished > 1 ? "s" : "") + " terminée" + (finished > 1 ? "s" : "") : "") +
        ", et les résultats. Personne ne pourra les récupérer.</p>";
    } else {
      what += "<p class='am-hint'>Personne d'autre n'a rejoint : tu es seul à y perdre quelque chose.</p>";
    }
    what += "<p class='am-hint'>Si tu veux juste qu'elle sorte de ta liste, ferme cette fenêtre et choisis <b>Masquer</b> : la partie continue d'exister pour les autres.</p>";
    if (needCode) {
      what += '<label class="am-label" for="amDelCode">Recopie le code pour confirmer</label>' +
        '<input id="amDelCode" class="am-codein" maxlength="8" placeholder="' + esc(g.code) + '" autocomplete="off" autocapitalize="characters" />';
    }
    what += '<button type="button" class="am-primary am-danger-btn" id="amDelGo"' + (needCode ? " disabled" : "") + '>🗑️ Supprimer définitivement</button>' +
      '<button type="button" class="am-ghost" id="amDelNo">Annuler</button>' +
      '<div class="am-error center" id="amDelErr"></div>';

    openSheet("🗑️ Supprimer la partie", what, function (body) {
      var go = body.querySelector("#amDelGo");
      var input = body.querySelector("#amDelCode");
      body.querySelector("#amDelNo").onclick = closeSheet;
      if (input) {
        input.addEventListener("input", function () {
          input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
          go.disabled = input.value !== g.code;
        });
      }
      go.onclick = function () {
        if (go.disabled) return;
        if (!socket || !connected) { body.querySelector("#amDelErr").textContent = "Pas de connexion."; return; }
        go.disabled = true;
        socket.emit("delete_game", { code: g.code, confirm: input ? input.value : g.code });
      };
    });
  }

  function renderPlayerRows(g, canKick) {
    if (!g.players.length) return '<p class="am-hint">Personne pour l\'instant.</p>';
    return '<div class="am-plist">' + g.players.map(function (p) {
      var pct = g.sceneCount ? Math.round((p.progress / g.sceneCount) * 100) : 0;
      var st = p.finished ? '<span class="st done">✓ fini</span>' : '<span class="st">' + p.progress + '/' + g.sceneCount + '</span>';
      return '<div class="am-prow' + (p.me ? ' me' : '') + '"><span class="who">' + (p.host ? '👑 ' : '') + esc(p.name) + (p.me ? ' <span class="am-soft">(toi)</span>' : '') + '</span>' + st +
        (canKick && !p.host && !p.me ? '<button type="button" class="kick" data-kick="' + esc(p.name) + '">retirer</button>' : '') +
        '<div class="am-progress mini' + (p.finished ? ' done' : '') + '"><i style="width:' + pct + '%"></i></div></div>';
    }).join("") + '</div>';
  }

  // ---------- répondre ----------
  function startPlay() {
    if (!game || !game.me || !game.me.joined) return;
    play = { code: game.code, index: game.me.nextIndex || 0, myRank: [], submitted: false, reveal: null, finished: !!game.me.finished, sent: {} };
    show("s-play");
    renderScene();
  }
  // Peut-on revenir sur la scène d'avant ? Le serveur tranche (games.unanswer),
  // mais il nous dit d'avance lesquelles sont encore ouvertes : celles où on
  // est le seul à avoir répondu, donc où il n'y avait rien à voir.
  function canUndo(index) {
    var u = game && game.me && game.me.undoable;
    return !!(u && index >= 0 && u.indexOf(index) >= 0);
  }
  function undoSig(g) { return (g && g.me && g.me.undoable ? g.me.undoable : []).join(","); }
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
    // Première scène : on redit la règle du jeu, là où elle sert.
    if (play.index === 0 && !play.submitted) {
      // « Ordre de préférence » serait faux ici : chaque scène dit elle-même
      // dans quel sens classer (du plus rédhibitoire, du plus fréquent, du
      // plus vrai…). Le texte générique renvoie donc à la consigne de la
      // scène, il ne la contredit pas.
      body += '<div class="am-tip">👆 <b>Touche les 3 réponses dans l\'ordre demandé juste au-dessus</b> — la 1<sup>re</sup> que tu touches prend la place n°&nbsp;1. Pas de chrono : prends ton temps, tu peux fermer et revenir.</div>';
    }
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
      body += '<p class="am-ranknote">' + (play.myRank.length === 0 ? "Touche les réponses dans l'ordre demandé au-dessus : la première prend la place n° 1."
        : (play.myRank.length < n ? "Encore " + (n - play.myRank.length) + " à classer… (touche une réponse classée pour l'enlever)" : "Classement complet !")) + '</p>';
      body += '<button class="am-primary" id="amValid"' + (play.myRank.length === n ? "" : " disabled") + '>✅ Valider</button>';
      body += '<p class="am-hint center">En validant, tu découvres les réponses des autres — et ta réponse se fige. Tant que personne d\'autre n\'a répondu à une scène, tu peux encore y revenir.</p>';
      // Valider trop vite arrive. Tant que personne d'autre n'a répondu à la
      // scène d'avant, il n'y avait rien à voir : on peut y retourner.
      // L'explication est ici, à côté du bouton, et elle reste tant que la
      // fenêtre est ouverte : elle disparaît quand quelqu'un répond à cette
      // scène-là — c'est-à-dire au moment où elle cesse d'être vraie, et pas
      // trois secondes après s'être affichée.
      if (canUndo(play.index - 1)) {
        body += '<div class="am-tip am-first">🥇 <b>Tu es le premier sur la scène ' + play.index + '</b> — personne d\'autre n\'y a encore répondu, il n\'y avait donc rien à te montrer. Tant que ça dure, tu peux y revenir.</div>';
        body += '<button class="am-ghost" id="amUndo">↩️ Revenir sur la scène ' + play.index + '</button>';
      }
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
      if (!connected) { warn("Pas de connexion là — réessaie dans un instant."); return; }
      play.submitted = true;
      play.sent[q.id] = play.myRank.slice();   // pour repré-remplir si on revient dessus
      socket.emit("answer", { code: play.code, qid: q.id, ranking: play.myRank.slice() });
      renderScene();
    };
    var ub = $("amUndo");
    if (ub) ub.onclick = function () {
      if (!socket || !connected) { warn("Pas de connexion là — réessaie dans un instant."); return; }
      var prev = game.scenes[play.index - 1];
      if (prev) socket.emit("unanswer", { code: play.code, qid: prev.id });
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
    body += '<div class="am-card"><h3>👀 Les réponses</h3>' + revealHtml(rv, play.myRank, false) +
      '<p class="am-hint">Le badge à droite, c\'est <b>ton accord avec cette personne sur cette scène</b> : sur 3 comparaisons possibles, combien tombent pareil. <b>3/3</b> = exactement le même classement.</p></div>';
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
    setUrl(currentCode, true);
    $("amResTitle").textContent = game ? gameTitle(game) : "Résultats";
    $("amResultsBody").innerHTML = '<p class="am-hint center">Calcul…</p>';
    if (socket) socket.emit("game_results", { code: currentCode });
  }
  // « Où en sont les autres » : tous ceux qui n'ont pas fini, avec leur
  // avancée. C'est la promesse du différé — on voit le groupe avancer sans
  // avoir à demander à qui que ce soit.
  function pendingCard(r) {
    var prov = Object.create(null);
    (r.provisional || []).forEach(function (p) { prov[p.name] = p; });
    var pend = r.players.filter(function (p) { return !p.finished && !p.me; })
      .sort(function (a, b) { return b.progress - a.progress || a.name.localeCompare(b.name); });
    if (!pend.length) return "";
    return '<div class="am-card am-pending"><h3>⏳ Où en sont les autres</h3>' +
      '<p class="am-hint">Personne n\'est pressé : ils ont tout leur temps. Dès que l\'un d\'eux finit ses ' + r.sceneCount + ' scènes, cette page se met à jour toute seule.</p>' +
      pend.map(function (p) {
        var pct = r.sceneCount ? Math.round((p.progress / r.sceneCount) * 100) : 0;
        var pv = prov[p.name];
        return '<div class="am-prow wide"><span class="who">' + (p.host ? '👑 ' : '') + esc(p.name) + '</span>' +
          (pv ? '<span class="am-badge b-mixed" title="Sur vos ' + pv.shared + ' scènes en commun">' + pv.pct + ' % provisoire</span>' : '') +
          '<span class="st">' + p.progress + '/' + r.sceneCount + '</span>' +
          '<div class="am-progress mini"><i style="width:' + pct + '%"></i></div></div>';
      }).join("") + '</div>';
  }
  // Le lien qui ramène ici : à garder, à renvoyer au groupe, à ouvrir demain
  // pour voir où ça en est.
  function backLinkCard(r) {
    return '<div class="am-card am-share am-backlink"><h3>🔗 Revenir voir la progression</h3>' +
      '<p class="am-hint">Garde ce lien (ou ce QR) : il rouvre cette page, avec l\'avancée de chacun et les résultats à jour. Rien à réinstaller, ton pseudo et ton code de reprise suffisent.</p>' +
      '<div class="am-qr"><canvas id="amResQR" width="400" height="400"></canvas></div>' +
      '<div class="am-code-big">' + esc(r.code) + '</div>' +
      '<div class="am-share-row"><button class="am-primary" id="amShareRes">Partager cette page</button><button class="am-ghost" id="amCopyRes">Copier le lien</button></div></div>';
  }
  function wireResultsExtras(r) {
    drawQR($("amResQR"), resultsUrl(r.code));
    var sb = $("amShareRes");
    if (sb) sb.onclick = function () {
      shareLink("Où on en est sur « " + gameTitle(r) + " » (Are We A Match ?) : " + r.finishedCount + "/" + r.playerCount +
        " ont fini. Résultats en direct → " + resultsUrl(r.code));
    };
    var cb = $("amCopyRes"); if (cb) cb.onclick = function () { copyText(resultsUrl(r.code)); };
  }
  function renderResults() {
    var r = lastResults; if (!r) return;
    var me = getPseudo();
    var body = "";

    if (r.locked) {
      body += countsBar(r);
      body += '<div class="am-card am-center-card"><div class="am-big">🔒</div><p class="am-lead">Termine tes ' + r.sceneCount + ' scènes pour voir les résultats.</p><p class="am-hint">Tu en es à ' + r.progress + '/' + r.sceneCount + '. Le détail (ton meilleur match, le podium, les titres) s\'ouvre à la dernière scène.</p></div>';
      if (r.teaser) body += '<div class="am-teaser">💘 <b>' + esc(r.teaser.name) + '</b> : <span class="pct">' + r.teaser.pct + '%</span> sur vos ' + r.teaser.shared + ' scènes en commun.</div>';
      body += '<button class="am-primary xl" id="amPlay2">▶️ Continuer</button>';
      body += pendingCard(r);
      body += backLinkCard(r);
      $("amResultsBody").innerHTML = body;
      $("amPlay2").onclick = function () { if (game) startPlay(); else openGame(currentCode); };
      wireResultsExtras(r);
      return;
    }

    body += countsBar(r);
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
    body += pendingCard(r);
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
    body += '<p class="am-hint center">Le score, c\'est la part de vos comparaisons qui tombent pareil : 3 par scène (A/B, A/C, B/C), 1 point par accord. Deux personnes au hasard tournent autour de 50 %.</p>';
    body += backLinkCard(r);
    body += '<button class="am-ghost" id="amScenes">👀 Scène par scène</button>';
    body += installHtml();     // après les résultats, c'est là qu'on a envie de garder l'app
    $("amResultsBody").innerHTML = body;
    $("amScenes").onclick = function () { if (socket) socket.emit("get_reveals", { code: currentCode }); };
    wireInstall($("amResultsBody"));
    wireResultsExtras(r);
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
      '<button type="button" class="am-ghost" id="amChangePin">🔒 Changer mon code de reprise</button>' +
      '<button type="button" class="am-ghost" id="amLogout">🚪 Me déconnecter de ce téléphone</button>';
    openSheet("👤 Profil", html, function (body) {
      body.querySelector("#amChangePin").onclick = function () { protectName(false); };
      body.querySelector("#amLogout").onclick = logout;
    });
  }

  // Se déconnecter, pour de vrai : on oublie le pseudo ET l'identifiant
  // d'appareil. Garder l'identifiant ferait une fausse déconnexion — n'importe
  // qui reprenant le téléphone rentrerait sans code. Du coup, pour revenir il
  // faut le code de reprise : c'est exactement à ça qu'il sert.
  function logout() {
    if (!myProtected) {
      openSheet("🚪 Se déconnecter",
        "<p>Pose d'abord un code de reprise. Sans lui, ce téléphone ne pourrait plus rouvrir ton pseudo — et personne d'autre non plus.</p>" +
        '<button type="button" class="am-primary" id="amGoPin">🔒 Choisir mon code</button>',
        function (body) { body.querySelector("#amGoPin").onclick = function () { sheetLocked = false; protectName(false); }; });
      return;
    }
    openSheet("🚪 Se déconnecter",
      "<p>Ce téléphone va oublier <b>" + esc(getPseudo()) + "</b>. Pour revenir, il faudra ton pseudo <b>et</b> ton code de reprise.</p>" +
      "<p class='am-hint'>Rien n'est supprimé : tes parties, tes réponses et tes résultats restent intacts.</p>" +
      '<button type="button" class="am-primary" id="amLogoutGo">🚪 Me déconnecter</button>' +
      '<button type="button" class="am-ghost" id="amLogoutNo">Annuler</button>',
      function (body) {
        body.querySelector("#amLogoutNo").onclick = closeSheet;
        body.querySelector("#amLogoutGo").onclick = function () {
          try {
            localStorage.removeItem("am.pseudo");
            localStorage.removeItem("am.cid");      // sinon la déconnexion est cosmétique
            localStorage.removeItem("am.devToken");
          } catch (e) {}
          memPseudo = ""; memCid = null;
          // Rechargement sur l'adresse nue : pas de socket qui traîne avec
          // l'ancienne identité, et pas de code de partie dans l'URL.
          location.href = "/AreWeAMatch/";
        };
      });
  }

  // ---------- mode dev ----------
  function devSheetError(msg) { var err = $("amDevErr"); if (err) err.textContent = msg; else if (msg) warn(msg); }
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
      if (!socket || !connected) { warn("Pas de connexion."); return; }
      socket.emit("dev_start", { bots: devBots });
    };
  }

  // ---------- installation sur l'écran d'accueil ----------
  // L'app est installable depuis toujours (manifeste + service worker), mais
  // personne ne le savait : Chrome le range dans un sous-menu, et Safari ne
  // propose rien du tout. On le dit donc nous-mêmes, différemment selon le
  // téléphone, et jamais quand c'est déjà fait.
  var deferredInstall = null, installed = false;
  function isStandalone() {
    try {
      return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
             window.navigator.standalone === true;
    } catch (e) { return false; }
  }
  // Safari iOS n'émet jamais beforeinstallprompt et n'a pas d'API : la seule
  // chose possible est d'expliquer le geste.
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent || "") ||
           (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);   // iPad récent
  }
  function installState() {
    if (installed || isStandalone()) return "done";
    if (deferredInstall) return "prompt";
    if (isIOS()) return "ios";
    return "none";
  }
  function installHtml() {
    var st = installState();
    if (st === "done" || st === "none") return "";
    return '<button type="button" class="am-ghost am-install" data-install="' + st + '">📲 ' +
      (st === "ios" ? "Ajouter à l'écran d'accueil" : "Installer l'app") + '</button>';
  }
  function wireInstall(root) {
    var b = (root || document).querySelector("[data-install]");
    if (!b) return;
    b.onclick = function () { b.getAttribute("data-install") === "ios" ? iosInstallSheet() : runInstallPrompt(); };
  }
  function runInstallPrompt() {
    var e = deferredInstall;
    if (!e) { renderInstall(); return; }
    deferredInstall = null;                       // l'événement ne se rejoue pas
    try { e.prompt(); } catch (err) { renderInstall(); return; }
    var choice = e.userChoice && e.userChoice.then ? e.userChoice : null;
    if (choice) choice.then(function (r) {
      if (r && r.outcome === "accepted") { installed = true; toast("📲 C'est installé — regarde ton écran d'accueil."); }
      renderInstall();
    }, function () { renderInstall(); });
    else renderInstall();
  }
  function iosInstallSheet() {
    openSheet("📲 Sur ton iPhone",
      "<p>Safari ne sait pas installer tout seul : trois gestes, une fois pour toutes.</p>" +
      '<ol class="am-steps compact">' +
      '<li><span class="num">1</span> <span class="t">Touche <b>Partager</b> en bas de Safari — le carré avec la flèche vers le haut.</span></li>' +
      '<li><span class="num">2</span> <span class="t">Fais défiler et choisis <b>« Sur l\'écran d\'accueil »</b>.</span></li>' +
      '<li><span class="num">3</span> <span class="t">Touche <b>Ajouter</b>. L\'icône 💘 apparaît avec tes autres apps.</span></li>' +
      "</ol>" +
      "<p class='am-hint'>Ensuite l'app s'ouvre en plein écran, sans la barre du navigateur, et tes parties sont là — ton pseudo et ton code de reprise suffisent.</p>");
  }
  function renderInstall() {
    var host = $("amInstall");
    if (host) { host.innerHTML = installHtml(); wireInstall(host); }
    // Sur l'écran des résultats, le bloc est reconstruit avec le reste.
    if (screen === "s-results" && lastResults) {
      var inRes = document.querySelector("#amResultsBody [data-install]");
      if (inRes && installState() === "done") inRes.parentNode.removeChild(inRes);
    }
  }
  // Enregistré au chargement du script, pas dans DOMContentLoaded :
  // beforeinstallprompt peut arriver très tôt, et il ne se rejoue pas.
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstall = e;
    renderInstall();
  });
  window.addEventListener("appinstalled", function () {
    installed = true; deferredInstall = null;
    renderInstall();
    toast("📲 C'est installé — regarde ton écran d'accueil.");
  });

  // ---------- onboarding ----------
  // Personne ne sera là pour expliquer le jeu : il s'explique tout seul, une
  // fois, à la première ouverture — et se rouvre à la demande (« ? », ou
  // « Comment ça marche ? » sur la page d'une partie).
  var ONB = [
    { e: "💘", t: "20 scènes, 3 réponses",
      p: "Pas de bonne réponse : seulement la tienne. À chaque scène, tu ranges les 3 réponses <b>de ta préférée (1) à celle que tu aimes le moins (3)</b> — et quand la scène demande autre chose (la plus fréquente chez toi, la plus agaçante…), elle te le dit juste sous la question." },
    { e: "⏰", t: "Quand tu veux",
      p: "Rien n'est chronométré et personne ne t'attend. Tu réponds ce soir, ton ami demain dans le métro. <b>Chaque réponse est sauvée tout de suite</b> : tu peux fermer et revenir." },
    { e: "👀", t: "Le verdict après chaque scène",
      p: "Dès que tu valides, tu découvres <b>ce que les autres ont répondu</b> — et seulement à ce moment-là. Une réponse validée ne change plus : c'est ce qui rend le score honnête." },
    { e: "💞", t: "Qui te ressemble",
      p: "À la fin : ton <b>meilleur match</b>, le podium des duos, les titres de la partie. Les résultats se remplissent <b>au fur et à mesure</b> que les gens finissent — reviens quand tu veux." },
  ];
  var onbIndex = 0;
  function onbSeen() { try { return localStorage.getItem("am.onb") === "1"; } catch (e) { return false; } }
  function markOnbSeen() { try { localStorage.setItem("am.onb", "1"); } catch (e) {} }
  function renderOnb() {
    var s = ONB[onbIndex];
    $("amOnbSlide").innerHTML = '<div class="e">' + s.e + '</div><h2>' + s.t + '</h2><p>' + s.p + '</p>';
    $("amOnbDots").innerHTML = ONB.map(function (_, i) { return '<span class="dot' + (i === onbIndex ? " on" : "") + '"></span>'; }).join("");
    $("amOnbNext").textContent = onbIndex === ONB.length - 1 ? "C'est parti 🎉" : "Suivant →";
    $("amOnbSkip").textContent = onbIndex === ONB.length - 1 ? "Le détail du calcul" : "Passer";
  }
  function hideOnbRaw() { markOnbSeen(); $("amOnb").style.display = "none"; $("amOnb").setAttribute("data-am-pushed", ""); }
  function openOnboarding() { onbIndex = 0; $("amOnb").style.display = "flex"; renderOnb(); modalShown($("amOnb")); }
  function closeOnboarding() { markOnbSeen(); $("amOnb").style.display = "none"; modalHidden($("amOnb")); }

  // ---------- aide ----------
  var HELP = {
    main: { title: "Comment ça marche", body:
      "<p><b>Une partie = 20 scènes</b>, les mêmes pour tout le monde et dans le même ordre. Quelqu'un la crée et partage son QR ; chacun répond <b>quand il veut</b>.</p>" +
      "<p><b>Chaque scène propose 3 réponses.</b> Tu les classes de 1 à 3. Le sens du classement est écrit sous la question — le plus souvent <b>1</b> = ta préférée, parfois la plus fréquente chez toi ou celle qui t'agace le plus. Une fois validée, ta réponse ne change plus, et tu découvres celles des autres.</p>" +
      "<p><b>Le calcul :</b> pour chaque scène on fait les 3 comparaisons possibles (A/B, A/C, B/C) ; 1 point par accord. Ta compatibilité avec quelqu'un = points obtenus / points possibles. Deux personnes au hasard tournent autour de 50 %.</p>" +
      "<p><b>Les résultats</b> se calculent sur ceux qui ont fini, et se mettent à jour à chaque nouvelle arrivée. En attendant, une compatibilité provisoire s'affiche dès 5 scènes en commun.</p>" +
      "<p><b>Fermer les inscriptions</b> (l'hôte seulement) empêche de <i>nouveaux</i> joueurs de rejoindre. Ceux qui sont déjà là gardent tout leur temps pour finir.</p>" +
      "<p>🔒 <b>Ton code de reprise</b> te réserve ton pseudo, et te permet de le rouvrir sur un autre téléphone. Tu ne le tapes jamais sur celui-ci.</p>" },
    pin: { title: "Le code de reprise 🔒", body:
      "<p><b>Tu ne le taperas jamais sur ce téléphone</b> : il te reconnaît tout seul. Le code sert le jour où tu ouvres ton pseudo <b>ailleurs</b> — nouveau téléphone, téléphone d'un ami.</p>" +
      "<p>Il <b>réserve aussi ton pseudo</b> : personne d'autre ne peut le prendre.</p>" +
      "<p>Évite les codes évidents (1234, 0000, ton année de naissance) : ce sont les premiers que quelqu'un essaierait, et il connaît déjà ton pseudo puisqu'il joue avec toi. L'app les refuse, et peut t'en proposer un au hasard.</p>" +
      "<p>Il est obligatoire. Si tu l'oublies, tu peux en choisir un nouveau depuis le téléphone où tu as créé le pseudo (bouton profil).</p>" },
  };
  function openHelp(k) { var h = HELP[k] || HELP.main; openSheet(h.title, h.body); }

  // ---------- bootstrap ----------
  document.addEventListener("DOMContentLoaded", function () {
    pendingCode = codeFromUrl();
    pendingResults = !!(pendingCode && wantsResultsFromUrl());
    var input = $("amName");
    if (input) input.value = getPseudo();
    if (pendingCode) { var note = $("amInviteNote"); if (note) { note.style.display = ""; note.innerHTML = "🎟️ <b>On t'invite à une partie</b> (code " + esc(pendingCode) + ").<br>Choisis un pseudo et un code de reprise à 4 chiffres — c'est tout, il n'y a rien à installer."; } }
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
    $("amHelp").onclick = openOnboarding;
    $("amOnbNext").onclick = function () {
      if (onbIndex < ONB.length - 1) { onbIndex += 1; renderOnb(); return; }
      closeOnboarding();
    };
    $("amOnbSkip").onclick = function () {
      var last = onbIndex === ONB.length - 1;
      closeOnboarding();
      if (last) openHelp("main");
    };
    $("amSheetClose").onclick = closeSheet;
    $("amOverlay").addEventListener("click", function (e) { if (e.target === $("amOverlay")) closeSheet(); });
    $("amCreate").onclick = createGameSheet;
    $("amJoinBtn").onclick = joinSheet;
    $("amHowto2").onclick = openOnboarding;
    $("amPinSuggest").onclick = function () {
      $("amPin").value = suggestPin();
      $("amPseudoError").textContent = "";
      $("amPin").focus();
    };
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains("am-info")) { e.preventDefault(); openHelp(t.getAttribute("data-help")); }
    });
    connect();
    if (!getPseudo()) show("s-pseudo");
    else show("s-home");
    // Première ouverture : le jeu s'explique avant qu'on demande quoi que ce soit.
    if (!onbSeen()) openOnboarding();
    renderInstall();
    if (getDevToken()) { var tk = getDevToken(); socket.on("identity_ok", function () { if (getDevToken() === tk && !devOn) socket.emit("dev_unlock", { token: tk }); }); }
    if (/[?&]dev(=|&|$)/.test(location.search)) setTimeout(openDevSheet, 400);
    window.__amForceCloseSheet = forceCloseSheet;
  });
})();
