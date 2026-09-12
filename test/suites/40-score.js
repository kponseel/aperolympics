// Le score de compatibilité : ce qu'il vaut, et ce qu'il refuse de dire.
//
// Le score est une part d'accords PAR PAIRES : sur trois options il y a trois
// comparaisons (A/B, A/C, B/C), et on compte celles où deux joueurs tombent
// dans le même sens. Deux inconnus tournent donc autour de 50 %, pas de 0 %.
//
// L'audit de la v2 avait trouvé que le score mentait dans deux cas : quand il
// s'appuyait sur trop peu de scènes communes, et quand il comparait des gens
// qui n'avaient pas répondu aux mêmes. MIN_SHARED existe pour ça.

exports.titre = "Le score de compatibilité";

exports.run = async (t) => {
  const { games, players } = t.modules();
  const moteur = require(require("path").join(require("../lib/harness").RACINE, "server/match/engine.js"));

  t.section("L'accord par paires, sur une scène");
  const eq = (a, b) => moteur.pairAgreement(a, b, 3);
  t.check("Deux classements identiques : 3 accords sur 3", eq([0, 1, 2], [0, 1, 2]).agree === 3);
  t.check("Deux classements inverses : 0 sur 3", eq([0, 1, 2], [2, 1, 0]).agree === 0);
  t.check("Une seule paire inversée : 2 sur 3", eq([0, 1, 2], [1, 0, 2]).agree === 2);
  t.check("Le total est toujours 3 pour 3 options", eq([0, 1, 2], [2, 0, 1]).total === 3);
  t.check("L'accord est symétrique",
    eq([0, 2, 1], [1, 0, 2]).agree === eq([1, 0, 2], [0, 2, 1]).agree);

  t.section("Deux joueurs identiques, deux joueurs opposés");
  const N = games.SCENES_PER_GAME;
  const g = games.createGame({ hostName: "Alice" }).game;
  games.joinGame(g.code, "Clone");
  games.joinGame(g.code, "Miroir");
  for (const id of g.sceneIds) {
    games.answer(g.code, "Alice", id, [0, 1, 2]);
    games.answer(g.code, "Clone", id, [0, 1, 2]);
    games.answer(g.code, "Miroir", id, [2, 1, 0]);
  }
  const r = games.results(g.code, "Alice");
  t.check("Les résultats sont débloqués pour qui a fini", r && r.locked === false);
  // La matrice est un dictionnaire nom → nom → pourcentage.
  const M = r.final.matrix;
  t.check("Le clone est à 100 %", M.Alice && M.Alice.Clone === 100, JSON.stringify(M.Alice));
  t.check("Le miroir est à 0 %", M.Alice && M.Alice.Miroir === 0, JSON.stringify(M.Alice));
  t.check("La matrice est symétrique", M.Clone.Alice === M.Alice.Clone && M.Miroir.Alice === M.Alice.Miroir);
  t.check("Elle couvre les trois joueurs, chacun face aux deux autres",
    Object.keys(M).length === 3 && Object.values(M).every((l) => Object.keys(l).length === 2), JSON.stringify(Object.keys(M)));
  t.check("Le meilleur match d'Alice est le clone", r.personal && r.personal.best && r.personal.best.name === "Clone",
    JSON.stringify(r.personal && r.personal.best));
  t.check("Son opposé est le miroir", r.personal.worst && r.personal.worst.name === "Miroir");
  t.check("Sa moyenne est entre les deux", r.personal.average === 50, String(r.personal.average));
  t.check("Le duo le plus compatible est annoncé", r.final.top && r.final.top.pct === 100 && r.final.top.shared === N,
    JSON.stringify(r.final.top));

  t.section("Les moments de la partie");
  // Alice et Clone sont d'accord partout, Miroir contre eux : aucune scène
  // n'est unanime, et chacune vaut 1 paire d'accord sur 3, soit 33 %.
  t.check("Aucune scène n'est unanime quand quelqu'un répond à l'inverse", r.moments.unanimous === null,
    JSON.stringify(r.moments.unanimous));
  t.check("La scène qui divise le plus est nommée, avec son score",
    r.moments.divisive && typeof r.moments.divisive.q === "string" && r.moments.divisive.pct === 33,
    JSON.stringify(r.moments.divisive));
  t.check("Le duo en accord parfait est Alice & Clone, sur les " + N + " scènes",
    r.moments.perfectPair && r.moments.perfectPair.pair === "Alice & Clone" && r.moments.perfectPair.count === N,
    JSON.stringify(r.moments.perfectPair));

  // Et quand tout le monde répond pareil, la scène unanime EST trouvée.
  const una = games.createGame({ hostName: "U1" }).game;
  games.joinGame(una.code, "U2");
  for (const id of una.sceneIds) { games.answer(una.code, "U1", id, [1, 0, 2]); games.answer(una.code, "U2", id, [1, 0, 2]); }
  const ru = games.results(una.code, "U1");
  t.check("Quand tout le monde répond pareil, la scène unanime est repérée",
    ru.moments.unanimous && ru.moments.unanimous.voters === 2, JSON.stringify(ru.moments.unanimous));

  t.section("Tant qu'on n'a pas fini, rien n'est révélé");
  const g2 = games.createGame({ hostName: "Bob" }).game;
  games.joinGame(g2.code, "Carla");
  for (const id of g2.sceneIds) games.answer(g2.code, "Carla", id, [0, 1, 2]);
  for (const id of g2.sceneIds.slice(0, 3)) games.answer(g2.code, "Bob", id, [0, 1, 2]);
  const rb = games.results(g2.code, "Bob");
  t.check("Bob n'a pas fini : ses résultats sont verrouillés", rb.locked === true);
  t.check("… et ne contiennent aucun classement final", rb.final === undefined);
  t.check("… mais il voit où en sont les autres",
    rb.players.some((p) => p.name === "Carla" && p.finished === true));

  t.section("MIN_SHARED : pas de score sur trois scènes");
  // Le teaser (le score provisoire) ne s'affiche qu'à partir de MIN_SHARED
  // scènes en commun : sur trois réponses, deux inconnus peuvent être à 100 %
  // par pur hasard, et ce chiffre-là ment.
  t.check("MIN_SHARED vaut au moins 5", games.MIN_SHARED >= 5, String(games.MIN_SHARED));
  t.check("Avec 3 scènes en commun, aucun aperçu n'est donné",
    rb.teaser === null || rb.teaser === undefined, JSON.stringify(rb.teaser));
  for (const id of g2.sceneIds.slice(3, games.MIN_SHARED + 1)) games.answer(g2.code, "Bob", id, [0, 1, 2]);
  const rb2 = games.results(g2.code, "Bob");
  t.check("Passé MIN_SHARED, l'aperçu apparaît", rb2.teaser && rb2.teaser.name === "Carla", JSON.stringify(rb2.teaser));
  t.check("… et il dit sur combien de scènes il se fonde", rb2.teaser.shared >= games.MIN_SHARED);

  t.section("Le profil ne compte une partie qu'une fois");
  // Revenir sur une réponse, recharger, rouvrir les résultats : rien de tout
  // cela ne doit faire recompter la partie dans les statistiques du compte.
  const g3 = games.createGame({ hostName: "Uni" }).game;
  for (const id of g3.sceneIds) games.answer(g3.code, "Uni", id, [0, 1, 2]);
  games.results(g3.code, "Uni");
  games.results(g3.code, "Uni");
  games.results(g3.code, "Uni");
  const compte = players.getAccount("Uni");
  t.check("Trois ouvertures des résultats = une seule partie comptée",
    !compte || !compte.stats || compte.stats.games <= 1, JSON.stringify(compte && compte.stats));

  games._reset();
};
