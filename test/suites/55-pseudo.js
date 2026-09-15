// Changer de pseudo, effacer son compte.
//
// Le pseudo n'est pas une étiquette : c'est la CLÉ. Les réponses sont rangées
// sous lui dans le compte (players.json) et sous lui aussi dans chaque partie
// (games.json), avec l'hôte désigné par la même clé. Un renommage qui ne
// ferait qu'une moitié laisserait des réponses orphelines — et personne ne le
// verrait tout de suite : l'app continuerait de tourner, simplement le joueur
// aurait perdu ses réponses dans d'anciennes parties.
//
// La suppression, elle, touche aux données des AUTRES : effacer ses réponses
// change leurs scores. Kevin a tranché pour « tout effacer » plutôt que pour
// l'anonymisation. Reste le cas qui n'a pas de bonne réponse évidente :
// l'hôte qui s'en va. Une partie sans hôte ne peut plus être ni fermée ni
// supprimée par personne — elle resterait là pour toujours. D'où le transfert
// au joueur arrivé le plus tôt, et la suppression quand il n'y a plus
// personne.

exports.titre = "Changer de pseudo, effacer son compte";

// Fait répondre un joueur à ses n premières scènes.
function repond(games, code, nom, n) {
  const st = games.state(code, nom, "fr");
  for (let i = 0; i < n; i++) games.answer(code, nom, st.scenes[i].id, [0, 1, 2], "fr");
}

exports.run = async (t) => {
  const { games, players } = t.modules({ MATCH_SCENES: "5" });

  t.section("Renommer : le compte suit");
  players.authenticate("Marie", "cid-marie", "4827");
  players.recordAnswersByPack("Marie", "cid-marie", { amis: { "go-x": [0, 1, 2] } });
  const avant = players.getAccount("Marie");
  const r1 = players.rename("Marie", "Mariette");
  t.check("Le renommage réussit", r1.ok === true, JSON.stringify(r1));
  t.check("L'ancien pseudo n'existe plus", players.getAccount("Marie") === null);
  t.check("Le nouveau porte le compte", (players.getAccount("Mariette") || {}).name === "Mariette");
  // C'est le MÊME enregistrement qui a bougé, pas une copie : le code de
  // reprise, les réponses mémorisées et les stats voyagent avec.
  t.check("… le même enregistrement, déplacé", players.getAccount("Mariette") === avant);
  t.check("… donc le code de reprise est toujours bon",
    players.checkPin("Mariette", "4827").ok === true, JSON.stringify(players.checkPin("Mariette", "4827")));
  t.check("… et les réponses mémorisées sont là",
    !!(players.getAccount("Mariette").answers || {}).amis);

  t.section("Renommer : ce que le serveur refuse");
  players.authenticate("Tom", "cid-tom", "7391");
  t.check("Un pseudo déjà pris est refusé", players.rename("Mariette", "Tom").reason === "name_taken");
  t.check("… et n'a rien cassé au passage", (players.getAccount("Tom") || {}).name === "Tom"
    && (players.getAccount("Mariette") || {}).name === "Mariette");
  t.check("Un pseudo vide est refusé", players.rename("Mariette", "   ").reason === "bad_name");
  t.check("Le même pseudo à l'identique est refusé", players.rename("Mariette", "Mariette").reason === "same");
  // Changer la casse ne déplace rien (la clé est la même) : sans ce cas à
  // part, le pseudo se serait déclaré « déjà pris » par lui-même.
  const rc = players.rename("Mariette", "MARIETTE");
  t.check("Changer juste la casse marche", rc.ok === true && rc.name === "MARIETTE", JSON.stringify(rc));
  t.check("… et le compte est toujours le même", players.getAccount("mariette") === avant);
  players.rename("MARIETTE", "Mariette");

  t.section("Renommer : les parties suivent, réponses comprises");
  const g = games.createGame({ hostName: "Mariette" });
  const code = g.game.code;
  games.joinGame(code, "Tom");
  repond(games, code, "Mariette", 3);
  repond(games, code, "Tom", 3);

  const rj = games.renamePlayer("Mariette", "Marion");
  players.rename("Mariette", "Marion");
  t.check("La partie est signalée comme touchée", rj.ok === true && rj.codes.indexOf(code) >= 0, JSON.stringify(rj));
  const apres = games.getGame(code);
  t.check("L'ancienne clé a disparu de la partie", !apres.players["mariette"]);
  t.check("Le joueur est rangé sous la nouvelle", !!apres.players["marion"]);
  t.check("… avec le nom affiché à jour", apres.players["marion"].name === "Marion");
  // LE point : les réponses ont voyagé. Sans ça, le joueur se serait retrouvé
  // à zéro dans une partie déjà commencée, sans un message d'erreur.
  t.check("… et ses 3 réponses avec lui", Object.keys(apres.players["marion"].answers).length === 3,
    String(Object.keys(apres.players["marion"].answers).length));
  t.check("L'hôte reste l'hôte", apres.hostKey === "marion" && apres.hostName === "Marion",
    apres.hostKey + " / " + apres.hostName);
  const etat = games.state(code, "Marion", "fr");
  t.check("Les autres le voient sous son nouveau nom",
    etat.players.some((p) => p.name === "Marion") && !etat.players.some((p) => p.name === "Mariette"),
    etat.players.map((p) => p.name).join(", "));

  t.section("Effacer son compte : ce qui disparaît");
  // Une deuxième partie où Marion n'est QUE joueuse : la suppression doit la
  // sortir des deux, pas seulement de celle qu'elle a créée.
  const g2 = games.createGame({ hostName: "Tom" });
  const code2 = g2.game.code;
  games.joinGame(code2, "Marion");
  repond(games, code2, "Marion", 2);

  const impact = games.purgeImpact("Marion");
  t.check("L'impact annoncé compte les deux parties", impact.parties === 2, JSON.stringify(impact));
  t.check("… et les 5 réponses", impact.reponses === 5, JSON.stringify(impact));
  t.check("… dont une partie qu'elle héberge", impact.hote === 1, JSON.stringify(impact));
  t.check("… qu'elle n'héberge pas seule, donc rien ne sera perdu", impact.perdues === 0, JSON.stringify(impact));

  const purge = games.purgePlayer("Marion");
  players.deleteAccount("Marion");
  t.check("Le compte n'existe plus", players.getAccount("Marion") === null);
  t.check("Le pseudo est de nouveau libre",
    players.authenticate("Marion", "cid-quelquun-dautre", "5261").ok === true);
  const p1 = games.getGame(code), p2 = games.getGame(code2);
  t.check("Elle est sortie de la partie qu'elle hébergeait", !p1.players["marion"]);
  t.check("… et de celle où elle jouait", !p2.players["marion"]);
  t.check("Ses réponses sont parties avec elle",
    JSON.stringify(p1.players).indexOf("marion") < 0 && JSON.stringify(p2.players).indexOf("marion") < 0);
  t.check("Les deux parties sont signalées comme touchées", purge.codes.length === 2, JSON.stringify(purge.codes));

  t.section("L'hôte qui s'en va : la partie passe au suivant");
  // Sans transfert, la partie n'aurait plus d'hôte : plus personne ne pourrait
  // la fermer ni la supprimer, et elle resterait là indéfiniment.
  t.check("La partie hébergée existe toujours", !!p1);
  t.check("… et Tom en est devenu l'hôte", p1.hostKey === "tom" && p1.hostName === "Tom",
    p1.hostKey + " / " + p1.hostName);
  t.check("… ce que le transfert annonce", purge.transferees.length === 1 && purge.transferees[0].to === "Tom",
    JSON.stringify(purge.transferees));
  // Et l'hôte tout neuf peut vraiment agir : un transfert qui ne donnerait pas
  // les droits ne servirait à rien.
  t.check("Le nouvel hôte peut fermer la partie", games.closeGame(p1.code, "Tom").ok === true);

  t.section("L'hôte seul : la partie n'a plus de raison d'exister");
  players.authenticate("Solo", "cid-solo", "3947");
  const g3 = games.createGame({ hostName: "Solo" });
  const code3 = g3.game.code;
  repond(games, code3, "Solo", 2);
  const purge3 = games.purgePlayer("Solo");
  players.deleteAccount("Solo");
  t.check("La partie est supprimée", games.getGame(code3) === null);
  t.check("… et c'est annoncé comme tel", purge3.supprimees.indexOf(code3) >= 0, JSON.stringify(purge3));

  t.section("Les bots ne comptent pas comme des joueurs");
  // Une partie de test n'est peuplée que de bots. Leur passer la main
  // laisserait une partie que plus AUCUN humain ne peut fermer.
  players.authenticate("Testeur", "cid-test", "5261");
  const dev = games.createTestGame("Testeur", games.MAX_BOTS);
  const cd = dev.game.code;
  const av = games.getGame(cd);
  const bots = Object.keys(av.players).filter((k) => av.players[k].bot);
  // Sans ce contrôle, le suivant passerait au vert pour la mauvaise raison :
  // une partie vide est supprimée de toute façon. Il faut qu'il reste
  // vraiment quelqu'un à qui on REFUSE de passer la main.
  t.check("La partie de test est bien peuplée de bots", bots.length >= 2, JSON.stringify(Object.keys(av.players)));
  const purgeDev = games.purgePlayer("Testeur");
  t.check("Elle est supprimée, pas léguée à un bot", games.getGame(cd) === null);
  t.check("… et annoncée comme supprimée", purgeDev.supprimees.indexOf(cd) >= 0, JSON.stringify(purgeDev));
  t.check("… donc aucun bot n'a été promu hôte", purgeDev.transferees.length === 0, JSON.stringify(purgeDev.transferees));

  t.section("Le code de reprise, vérifié pour une action irréversible");
  t.check("Le bon code passe", players.checkPin("Tom", "7391").ok === true);
  t.check("Un mauvais code est refusé", players.checkPin("Tom", "7392").reason === "pin_wrong");
  t.check("Un code mal formé est refusé", players.checkPin("Tom", "73").reason === "pin_wrong");
  t.check("Un pseudo inconnu est refusé", players.checkPin("Fantome", "7391").reason === "bad_name");
  // Un compte d'avant la v2 n'a pas de code : il ne peut rien prouver avec.
  // L'appelant doit demander autre chose, et c'est « no_pin » qui le lui dit.
  players.adminResetPin("Tom");
  t.check("Un compte sans code le dit, plutôt que de refuser bêtement",
    players.checkPin("Tom", "7391").reason === "no_pin", JSON.stringify(players.checkPin("Tom", "7391")));
};
