// Les comptes : un pseudo, un code de reprise à 4 chiffres, et rien d'autre.
//
// Le modèle voulu par Kevin : « le plus simple possible, c'est un jeu ».
// Pas d'e-mail. Le credential de tous les jours, c'est l'APPAREIL (un cid
// tiré au hasard, gardé dans le navigateur) ; le code de reprise ne sert que
// depuis un autre téléphone. Chaque compte a son propre sel, donc deux
// personnes peuvent choisir le même code sans que ça n'apprenne rien à
// personne — le risque n'est pas le partage, c'est la devinabilité.

exports.titre = "Comptes et code de reprise";

exports.run = async (t) => {
  const { players } = t.modules();

  t.section("Ce qui fait un code valide");
  t.check("Quatre chiffres : accepté", players.PIN_RE.test("4827"));
  t.check("Trois chiffres : refusé", !players.PIN_RE.test("482"));
  t.check("Des lettres : refusé", !players.PIN_RE.test("48a7"));
  t.check("Cinq chiffres : refusé", !players.PIN_RE.test("48271"));

  t.section("Les codes trop devinables sont refusés à la création");
  // Cinq essais suffisent à ouvrir un compte protégé par 1234 : le refus à la
  // création est ce qui rend l'attaque à cinq coups sans objet.
  for (const [pin, pourquoi] of [["1234", "courant"], ["0000", "courant"], ["1111", "courant"],
                                 ["3333", "répété"], ["4321", "suite descendante"]]) {
    t.check("Refusé (" + pourquoi + ") : " + pin, players.weakPin(pin) !== null, String(players.weakPin(pin)));
  }
  for (const bon of ["4827", "7391", "5261", "3947", "8264"]) {
    t.check("Accepté : " + bon, players.weakPin(bon) === null, String(players.weakPin(bon)));
  }
  // La proportion compte : si on refusait un code sur dix, choisir deviendrait
  // pénible. On mesure vraiment, plutôt que de le supposer.
  let refuses = 0;
  for (let i = 0; i < 10000; i++) if (players.weakPin(String(i).padStart(4, "0"))) refuses++;
  t.check("Moins de 1 % des codes sont refusés (" + refuses + "/10000)", refuses < 100, String(refuses));
  t.check("… mais les plus évidents le sont bien", refuses >= 20, String(refuses));

  t.section("Créer un compte");
  const cid = "cid-kevin-telephone";
  const a = players.authenticate("Kevin", cid, "4827");
  t.check("Un pseudo libre avec un bon code crée le compte", a.ok === true, JSON.stringify(a));
  t.check("Le compte est protégé", players.isProtected("Kevin") === true);
  const brut = players.getAccount("Kevin");
  t.check("Le code n'est jamais stocké en clair", brut && brut.pinHash && !JSON.stringify(brut).includes("4827"));
  t.check("Chaque compte a son propre sel", brut && typeof brut.salt === "string" && brut.salt.length >= 8);

  const b = players.authenticate("Marie", "cid-marie", "4827");
  t.check("Une autre personne peut choisir le MÊME code", b.ok === true);
  t.check("… et les empreintes diffèrent (sels différents)",
    players.getAccount("Marie").pinHash !== brut.pinHash);

  t.section("Revenir, depuis le même téléphone ou un autre");
  t.check("Le même appareil rentre sans code", players.authenticate("Kevin", cid, null).ok === true);
  t.check("Un autre appareil avec le bon code rentre", players.authenticate("Kevin", "cid-autre", "4827").ok === true);
  const mauvais = players.authenticate("Kevin", "cid-inconnu", "0001");
  t.check("Un autre appareil avec un mauvais code est refusé", mauvais.ok === false, JSON.stringify(mauvais));
  const sansPin = players.authenticate("Kevin", "cid-inconnu", null);
  t.check("Un autre appareil sans code se voit demander le code",
    sansPin.ok === false && sansPin.reason === "pin_required", JSON.stringify(sansPin));
  // Deux motifs distincts, et c'est voulu : « pin_needed » = ce pseudo est
  // libre, choisis-toi un code ; « pin_required » = ce pseudo est protégé,
  // donne le sien. Les confondre dirait à un inconnu si le pseudo existe.
  t.check("Un pseudo LIBRE sans code répond « pin_needed », pas « pin_required »",
    players.authenticate("PseudoLibre", "cid-z", null).reason === "pin_needed");

  // Le dernier appareil qui a prouvé le code devient l'appareil connu : c'est
  // ce qui fait qu'on change de téléphone une fois, pas à chaque ouverture.
  t.check("Le nouvel appareil devient l'appareil connu",
    players.getAccount("Kevin").ownerCid === "cid-autre" || players.authenticate("Kevin", "cid-autre", null).ok === true);

  t.section("Un code faible reste utilisable s'il existait déjà");
  // On durcit la CRÉATION, jamais la vérification : un compte créé au temps de
  // « 1234 » doit continuer à s'ouvrir, sinon on enferme des gens dehors.
  const vieux = players.getAccount("Kevin");
  const crypto = require("crypto");
  vieux.salt = "aaaaaaaaaaaaaaaa";
  vieux.pinHash = crypto.createHash("sha256").update(vieux.salt + ":" + "1234").digest("hex");
  t.check("Un ancien compte en 1234 s'ouvre toujours",
    players.authenticate("Kevin", "cid-encore-autre", "1234").ok === true);
  t.check("… mais on ne peut pas REDÉFINIR son code sur 1234", players.setPin("Kevin", "1234") === false);
  t.check("… alors qu'un bon code passe", players.setPin("Kevin", "5836") === true);

  t.section("Le pseudo");
  t.check("Un pseudo vide est refusé", players.authenticate("", "cid-x", "4827").ok === false);
  // Le pseudo est rangé sous une clé normalisée : « Zoé », « ZOÉ » et « zoé »
  // sont le même compte, sinon deux personnes croiraient avoir le leur.
  players.authenticate("Zoé", "cid-zoe", "6483");
  t.check("« ZOÉ », « zoé » et «  Zoé  » désignent le même compte",
    players.getAccount("ZOÉ") === players.getAccount("zoé") &&
    players.getAccount("  Zoé  ") === players.getAccount("Zoé"));
  t.check("… et le pseudo affiché garde la casse choisie", players.getAccount("zoé").name === "Zoé",
    players.getAccount("zoé").name);

  t.section("Le profil ne fuit pas");
  const prof = players.profile("Kevin", {});
  t.check("Un profil existe", !!prof);
  t.check("Il ne contient ni empreinte ni sel",
    prof && !JSON.stringify(prof).includes(players.getAccount("Kevin").pinHash) &&
    !JSON.stringify(prof).includes(players.getAccount("Kevin").salt));
  t.check("Le profil d'un inconnu est nul", players.profile("PersonneIci", {}) === null);

  players._reset();
};
