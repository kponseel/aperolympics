// Choisir la longueur d'une partie : 5, 10 ou 20 scènes.
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

  t.section("Les longueurs proposées");
  t.check("Ce sont 5, 10 et 20", JSON.stringify(games.SCENE_CHOICES) === "[5,10,20]", JSON.stringify(games.SCENE_CHOICES));
  t.check("Aucune n'est sous MIN_SHARED", games.SCENE_CHOICES.every((n) => n >= games.MIN_SHARED),
    "MIN_SHARED = " + games.MIN_SHARED);
  t.check("Aucune ne dépasse la banque", games.SCENE_CHOICES.every((n) => n <= games.BANK_SIZE));
  t.check("La longueur par défaut reste " + games.SCENES_PER_GAME,
    games.SCENE_CHOICES.includes(games.SCENES_PER_GAME));

  t.section("Une partie est bien tirée à la longueur demandée");
  for (const n of games.SCENE_CHOICES) {
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
  // Le client propose trois choix ; n'importe qui peut en envoyer un autre.
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
  t.check("Une longueur plus grande que la banque est ramenée à la banque",
    games.createGame({ hostName: "X4", sceneCount: 99999 }).game.sceneIds.length === games.BANK_SIZE);

  // Et par le socket : le handler ne doit accepter QUE les trois valeurs.
  const hs = await get(srv.base + "/socket.io/?EIO=4&transport=polling");
  const sid = (/"sid":"([^"]+)"/.exec(hs.text || "") || [])[1];
  t.check("La poignée de main Socket.IO passe", !!sid);

  t.section("Le serveur annonce les longueurs au client");
  // Une seule source de vérité : le client affiche ce que le serveur propose.
  const src = require("fs").readFileSync(require("path").join(require("../lib/harness").RACINE, "server/match/index.js"), "utf8");
  t.check("games_list transporte scene_choices", /scene_choices: games\.SCENE_CHOICES/.test(src));
  t.check("create_game n'accepte qu'une valeur de SCENE_CHOICES",
    /SCENE_CHOICES\.includes\(Number\(m && m\.sceneCount\)\)/.test(src));

  const client = require("fs").readFileSync(require("path").join(require("../lib/harness").RACINE, "public/AreWeAMatch/app.js"), "utf8");
  t.check("Le client envoie sceneCount à la création", /create_game", \{ title: [^}]*sceneCount: sceneChoice/.test(client));
  t.check("Il reprend la liste annoncée par le serveur", /m\.scene_choices/.test(client));

  t.section("Plus rien n'affirme « 20 scènes »");
  // Une partie peut en faire 5 : les textes qui disaient 20 mentaient.
  const html = require("fs").readFileSync(require("path").join(require("../lib/harness").RACINE, "public/AreWeAMatch/index.html"), "utf8");
  t.check("La page d'accueil ne promet plus 20 scènes", !/20 scènes|Vingt scènes/.test(html),
    (html.match(/.{0,40}(20 scènes|Vingt scènes).{0,40}/) || [])[0]);
  // Dans app.js, « 20 » ne doit plus subsister que comme valeur de repli et
  // dans la liste des longueurs.
  const affirmations = (client.match(/[^0-9]20 scènes/g) || []);
  t.check("Le client n'affirme plus « 20 scènes » comme une règle",
    affirmations.length === 0 || /5, 10 ou 20 scènes/.test(client),
    affirmations.join(" | "));

  games._reset();
};
