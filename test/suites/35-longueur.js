// Choisir la longueur d'une partie : de 5 à 50 scènes.
//
// La longueur se choisit À LA CRÉATION et jamais après : les scènes sont
// tirées une fois pour toutes, et la première règle du jeu est que tout le
// monde voie les mêmes, dans le même ordre.
//
// 5 est le plancher voulu, et il n'est pas arbitraire : c'est MIN_SHARED, le
// nombre de scènes en dessous duquel le score de compatibilité ne repose sur
// rien. En dessous, l'app afficherait un pourcentage qui ment.

exports.titre = "La longueur d'une partie";

exports.run = async (t) => {
  const { games } = t.modules();

  t.section("La fourchette proposée");
  t.check("Elle va de 5 à 50", games.SCENE_MIN === 5 && games.SCENE_MAX === 50,
    games.SCENE_MIN + " → " + games.SCENE_MAX);
  t.check("Le plancher n'est pas sous MIN_SHARED", games.SCENE_MIN >= games.MIN_SHARED,
    "MIN_SHARED = " + games.MIN_SHARED);
  t.check("Le plafond ne dépasse pas la banque", games.SCENE_MAX <= games.BANK_SIZE,
    games.SCENE_MAX + " / " + games.BANK_SIZE);
  t.check("La longueur par défaut est dans la fourchette",
    games.SCENES_PER_GAME >= games.SCENE_MIN && games.SCENES_PER_GAME <= games.SCENE_MAX);
  t.check("Le cran du curseur tombe juste sur les deux bouts",
    (games.SCENE_MAX - games.SCENE_MIN) % games.SCENE_STEP === 0, "cran = " + games.SCENE_STEP);

  t.section("Une partie est bien tirée à la longueur demandée");
  for (const n of [games.SCENE_MIN, 10, 20, 35, games.SCENE_MAX]) {
    const g = games.createGame({ hostName: "H" + n, sceneCount: n }).game;
    t.check("Demander " + n + " scènes en donne " + n, g.sceneIds.length === n, String(g.sceneIds.length));
    t.check("… toutes distinctes", new Set(g.sceneIds).size === n);
    // L'équilibre par axe doit tenir même sur une partie courte : sinon une
    // partie de 5 pourrait être entièrement sur l'argent.
    const vues = games.state(g.code, "H" + n).scenes;
    t.check("… et l'état en annonce autant au client", vues.length === n, String(vues.length));
  }

  t.section("Sur une partie courte, les axes restent variés");
  // 5 scènes, 6 axes : on ne peut pas tous les avoir, mais on ne doit pas
  // tomber trois fois sur le même.
  const packs = t.modules().packs;
  const toutes = [];
  for (const k of ["amis", "date", "piquant"]) toutes.push(...packs[k].bank);
  const axeDe = (id) => (toutes.find((q) => q.id === id) || {}).axis;
  let pireRepetition = 0;
  for (let i = 0; i < 40; i++) {
    const g = games.createGame({ hostName: "C" + i, sceneCount: 5 }).game;
    const compte = {};
    for (const id of g.sceneIds) compte[axeDe(id)] = (compte[axeDe(id)] || 0) + 1;
    pireRepetition = Math.max(pireRepetition, Math.max(...Object.values(compte)));
  }
  t.check("Sur 40 parties de 5 scènes, jamais plus de 2 scènes du même axe",
    pireRepetition <= 2, "vu jusqu'à " + pireRepetition);

  t.section("Le serveur ne croit pas le client");
  // Le client propose un curseur ; n'importe qui peut envoyer autre chose.
  const { get, pause } = require("../lib/harness");
  const http = require("http");
  const srv = await t.serveur();
  // On passe par le module plutôt que par le socket pour les valeurs limites :
  // c'est la même fonction, et c'est lisible.
  t.check("Une longueur absurde retombe sur la valeur par défaut",
    games.createGame({ hostName: "X1", sceneCount: 0 }).game.sceneIds.length === games.SCENES_PER_GAME);
  t.check("Une longueur négative aussi (elle donnait une partie d'UNE scène)",
    games.createGame({ hostName: "X2", sceneCount: -7 }).game.sceneIds.length === games.SCENES_PER_GAME,
    String(games.createGame({ hostName: "X2b", sceneCount: -7 }).game.sceneIds.length));
  t.check("Une longueur valide mais trop courte est remontée à MIN_SHARED",
    games.createGame({ hostName: "X5", sceneCount: 1 }).game.sceneIds.length === games.MIN_SHARED,
    String(games.createGame({ hostName: "X5b", sceneCount: 1 }).game.sceneIds.length));
  t.check("Un texte aussi",
    games.createGame({ hostName: "X3", sceneCount: "beaucoup" }).game.sceneIds.length === games.SCENES_PER_GAME);
  t.check("Une longueur au-dessus du plafond est ramenée au plafond",
    games.createGame({ hostName: "X4", sceneCount: 99999 }).game.sceneIds.length === games.SCENE_MAX,
    String(games.createGame({ hostName: "X4b", sceneCount: 99999 }).game.sceneIds.length));
  t.check("… y compris juste au-dessus (51 ne doit pas passer)",
    games.createGame({ hostName: "X6", sceneCount: games.SCENE_MAX + 1 }).game.sceneIds.length === games.SCENE_MAX);

  // Et par le socket : le handler ne doit accepter QUE la fourchette.
  const hs = await get(srv.base + "/socket.io/?EIO=4&transport=polling");
  const sid = (/"sid":"([^"]+)"/.exec(hs.text || "") || [])[1];
  t.check("La poignée de main Socket.IO passe", !!sid);

  t.section("Le serveur annonce les longueurs au client");
  // Une seule source de vérité : le client affiche ce que le serveur propose.
  const src = require("fs").readFileSync(require("path").join(require("../lib/harness").RACINE, "server/match/index.js"), "utf8");
  t.check("games_list transporte la fourchette",
    /scene_min: games\.SCENE_MIN/.test(src) && /scene_max: games\.SCENE_MAX/.test(src));
  // Le point sensible : le handler doit exiger un ENTIER dans la fourchette.
  // Sans Number.isInteger, « 7.5 » passait et donnait une partie de 7 scènes ;
  // sans les bornes, n'importe qui se créait une partie d'une scène.
  t.check("create_game n'accepte qu'un entier dans la fourchette",
    /Number\.isInteger\(brut\) && brut >= games\.SCENE_MIN && brut <= games\.SCENE_MAX/.test(src));

  const client = require("fs").readFileSync(require("path").join(require("../lib/harness").RACINE, "public/AreWeAMatch/app.js"), "utf8");
  t.check("Le client envoie sceneCount à la création", /create_game", \{ title: [^}]*sceneCount: sceneChoice/.test(client));
  t.check("Il reprend la fourchette annoncée par le serveur", /m\.scene_min/.test(client) && /m\.scene_max/.test(client));
  t.check("Le curseur couvre toute la fourchette",
    /min="' \+ sceneMin \+ '" max="' \+ sceneMax \+ '"/.test(client));

  t.section("Plus rien n'affirme une longueur fixe");
  // Une partie peut en faire 5 : les textes qui disaient 20 mentaient.
  const RACINE2 = require("../lib/harness").RACINE;
  const html2 = require("fs").readFileSync(require("path").join(RACINE2, "public/AreWeAMatch/index.html"), "utf8");
  const dico2 = require("fs").readFileSync(require("path").join(RACINE2, "public/AreWeAMatch/i18n.js"), "utf8");
  const html = html2;
  t.check("La page d'accueil ne promet plus 20 scènes", !/20 scènes|Vingt scènes/.test(html),
    (html.match(/.{0,40}(20 scènes|Vingt scènes).{0,40}/) || [])[0]);
  // Ce qu'on traque ici, c'est une phrase qui annonce une longueur comme si
  // elle était LA règle. « dès 5 scènes en commun » n'en est pas une : c'est
  // MIN_SHARED, le seuil du score provisoire, et il ne bouge pas avec la
  // longueur choisie. On vise donc les tournures qui définissent la partie.
  const fixes = /une partie = \d+|partie de \d+ scènes|toujours \d+ scènes|\d+, \d+ ou \d+ scènes|[Cc]inq, dix ou vingt/;
  for (const [quoi, src2] of [["Le client", client], ["La page d'accueil", html2], ["Le dictionnaire", dico2]]) {
    const m = fixes.exec(src2);
    t.check(quoi + " n'annonce pas de longueur fixe", !m, m && m[0]);
  }

  games._reset();
};
