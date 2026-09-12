// Les règles du jeu en différé, dans games.js.
//
// Trois règles font que jouer chacun de son côté reste équitable :
//   1. tout le monde voit les MÊMES scènes, dans le MÊME ordre ;
//   2. on ne voit les réponses des autres à une scène qu'APRÈS avoir validé
//      la sienne ;
//   3. une réponse validée ne change plus — sauf dans l'unique fenêtre où
//      revenir n'apprend rien : quand on est le seul à avoir répondu.
// Si l'une saute, le score de compatibilité ne veut plus rien dire.

exports.titre = "Les règles d'une partie";

exports.run = async (t) => {
  const { games } = t.modules();
  const rep = [0, 1, 2];

  t.section("Créer et rejoindre");
  const { game } = games.createGame({ hostName: "Kevin" });
  const code = game.code;
  t.check("Le code fait " + games.CODE_LEN + " caractères", code.length === games.CODE_LEN, code);
  t.check("L'hôte est inscrit d'office", games.isPlayer(code, "Kevin"));
  t.check("La partie tire " + games.SCENES_PER_GAME + " scènes", game.sceneIds.length === games.SCENES_PER_GAME);
  t.check("Rejoindre une partie inconnue est refusé", games.joinGame("ZZZZZ", "Max").reason === "unknown_game");
  t.check("Max rejoint", games.joinGame(code, "Max").ok);
  t.check("Rejoindre deux fois ne duplique personne",
    games.joinGame(code, "Max").ok && games.state(code, "Max").players.length === 2);
  t.check("Le code est insensible à la casse et aux espaces",
    games.getGame(" " + code.toLowerCase() + " ") !== null);

  t.section("Règle 1 — les mêmes scènes, dans le même ordre");
  const vuesK = games.state(code, "Kevin").scenes.map((s) => s.id);
  const vuesM = games.state(code, "Max").scenes.map((s) => s.id);
  t.check("Kevin et Max voient exactement la même liste", vuesK.join() === vuesM.join());
  t.check("… et c'est celle de la partie", vuesK.join() === game.sceneIds.join());

  t.section("Règle 2 — on ne voit rien avant d'avoir répondu");
  const q0 = game.sceneIds[0];
  t.check("Avant de répondre, le reveal est refusé", games.reveal(code, "Kevin", q0) === null);
  const a1 = games.answer(code, "Kevin", q0, rep);
  t.check("Kevin répond", a1.ok);
  t.check("… et découvre alors la scène", games.reveal(code, "Kevin", q0) !== null);
  t.check("Max, lui, ne voit toujours rien", games.reveal(code, "Max", q0) === null);
  games.answer(code, "Max", q0, [2, 1, 0]);
  const rv = games.reveal(code, "Max", q0);
  t.check("Une fois Max répondu, il voit les deux réponses", rv && rv.answers.length === 2);
  t.check("Le reveal ne contient jamais de réponse d'un joueur qui n'a pas répondu",
    rv.answers.every((a) => a.ranking && a.ranking.length === 3));

  t.section("Un classement doit être un vrai classement");
  const q1 = game.sceneIds[1];
  for (const [libelle, mauvais] of [
    ["une option en double", [0, 0, 1]],
    ["une option de trop", [0, 1, 2, 2]],
    ["une option manquante", [0, 1]],
    ["un index hors bornes", [0, 1, 5]],
    ["pas un tableau", "012"],
    ["des valeurs non entières", [0, 1, "2x"]],
  ]) t.check("Refusé : " + libelle, !games.answer(code, "Kevin", q1, mauvais).ok, JSON.stringify(mauvais));
  t.check("Une scène qui n'est pas dans la partie est refusée",
    !games.answer(code, "Kevin", "am-nexistepas", rep).ok);
  t.check("Un non-joueur ne peut pas répondre", games.answer(code, "Inconnue", q1, rep).reason === "not_in_game");

  t.section("Règle 3 — une réponse validée ne change plus");
  t.check("Répondre deux fois à la même scène est refusé",
    games.answer(code, "Kevin", q0, [1, 2, 0]).reason === "already_answered");
  const enBase = games.getGame(code).players.kevin.answers[q0];
  t.check("… et la première réponse est intacte", JSON.stringify(enBase) === JSON.stringify(rep));

  t.section("L'exception : revenir tant qu'on est seul");
  const solo = games.createGame({ hostName: "Solo" }).game;
  const s0 = solo.sceneIds[0];
  const aSolo = games.answer(solo.code, "Solo", s0, rep);
  t.check("Répondre seul annonce que la scène reste révisable", aSolo.undoable === true);
  t.check("L'état la liste parmi les révisables", games.state(solo.code, "Solo").me.undoable.includes(0));
  const u = games.unanswer(solo.code, "Solo", s0);
  t.check("On peut revenir dessus", u.ok && u.progress === 0 && u.index === 0);
  t.check("Et on repart sur cette scène", games.state(solo.code, "Solo").me.nextIndex === 0);
  games.answer(solo.code, "Solo", s0, [2, 1, 0]);
  games.joinGame(solo.code, "Autre");
  games.answer(solo.code, "Autre", s0, rep);
  t.check("Dès que quelqu'un d'autre répond, la fenêtre se referme",
    !games.state(solo.code, "Solo").me.undoable.includes(0));
  t.check("… et revenir est refusé : « revealed »", games.unanswer(solo.code, "Solo", s0).reason === "revealed");
  t.check("La réponse corrigée est bien celle qui reste",
    JSON.stringify(games.getGame(solo.code).players.solo.answers[s0]) === JSON.stringify([2, 1, 0]));
  t.check("Défaire une scène jamais répondue est refusé", games.unanswer(solo.code, "Autre", solo.sceneIds[3]).reason === "not_answered");

  t.section("Finir une partie");
  const fin = games.createGame({ hostName: "Fin" }).game;
  for (const id of fin.sceneIds) games.answer(fin.code, "Fin", id, rep);
  const etat = games.state(fin.code, "Fin");
  t.check("La progression atteint le total", etat.me.progress === games.SCENES_PER_GAME);
  t.check("Le joueur est marqué comme ayant fini", etat.me.finished === true);
  t.check("Une fois fini, plus aucune scène n'est révisable", etat.me.undoable.length === 0);
  // Rouvrir une partie finie ferait recompter la partie dans le profil.
  t.check("… et revenir en arrière est refusé : « finished »",
    games.unanswer(fin.code, "Fin", fin.sceneIds[0]).reason === "finished");

  t.section("Fermer les inscriptions ne ferme pas la partie");
  // Règle posée par Kevin : fermer empêche de NOUVEAUX joueurs d'arriver, mais
  // ceux qui sont là gardent tout leur temps pour finir.
  const cl = games.createGame({ hostName: "Hote" }).game;
  games.joinGame(cl.code, "Dedans");
  t.check("Seul l'hôte peut fermer", games.closeGame(cl.code, "Dedans").reason === "not_host");
  t.check("L'hôte ferme", games.closeGame(cl.code, "Hote").ok);
  t.check("Un nouveau ne peut plus rejoindre", games.joinGame(cl.code, "Tard").reason === "closed");
  t.check("Mais celui qui était là peut toujours répondre",
    games.answer(cl.code, "Dedans", cl.sceneIds[0], rep).ok);
  t.check("L'hôte peut rouvrir", games.reopenGame(cl.code, "Hote").ok);
  t.check("… et un nouveau rejoint de nouveau", games.joinGame(cl.code, "Tard").ok);

  t.section("Supprimer une partie (hôte seulement)");
  const sup = games.createGame({ hostName: "Chef" }).game;
  games.joinGame(sup.code, "Invite");
  games.answer(sup.code, "Invite", sup.sceneIds[0], rep);
  const impact = games.deletionImpact(sup.code, "Chef");
  t.check("L'hôte voit l'impact avant de supprimer", impact && impact.host === true && impact.others === 1 && impact.othersAnswers === 1,
    JSON.stringify(impact));
  t.check("Un invité ne voit pas d'impact d'hôte", games.deletionImpact(sup.code, "Invite").host === false);
  t.check("Un invité ne peut pas supprimer", games.deleteGameAsHost(sup.code, "Invite").reason === "not_host");
  t.check("L'hôte supprime", games.deleteGameAsHost(sup.code, "Chef").ok);
  t.check("La partie n'existe plus", games.getGame(sup.code) === null);

  t.section("Masquer, c'est pour soi seulement");
  const msk = games.createGame({ hostName: "A" }).game;
  games.joinGame(msk.code, "B");
  games.hideGame(msk.code, "A");
  t.check("La partie disparaît de la liste de A", !games.listFor("A").some((g) => g.code === msk.code));
  t.check("… mais reste dans celle de B", games.listFor("B").some((g) => g.code === msk.code));
  t.check("… et la partie existe toujours", games.getGame(msk.code) !== null);

  games._reset();
};
