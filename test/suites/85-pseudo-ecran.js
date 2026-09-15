// Changer de pseudo et effacer son compte, dans un vrai navigateur.
//
// La suite 55 prouve que les modules font le bon travail. Celle-ci prouve que
// la chaîne tient de bout en bout : la feuille s'ouvre, le socket fait
// l'aller-retour, et surtout — c'est le point — que l'AUTRE joueur voit le
// changement sans avoir rien fait. Un renommage qui ne serait pas rediffusé
// laisserait Tom devant un nom qui n'existe plus, jusqu'à ce qu'il recharge.
//
// On joue aussi les deux refus : un pseudo déjà pris, et un code de reprise
// faux. Ce sont eux qu'on écrit le plus vite et qu'on teste le moins.

exports.navigateur = true;
exports.titre = "Pseudo : changer, effacer (à l'écran)";

exports.run = async (t) => {
  const b = await t.navigateur();
  if (!b) return;
  const srv = await t.serveur({ MATCH_SCENES: "5" });
  const soucis = [];

  const ouvrir = async (nom, url) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => soucis.push(nom + " — erreur JS : " + e.message));
    p.on("console", (m) => { if (m.type() === "error") soucis.push(nom + " — console : " + m.text()); });
    await p.goto(url || srv.base + "/AlterEgo/", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(250);
    if (await p.evaluate(() => getComputedStyle(document.getElementById("amOnb")).display !== "none")) {
      await p.click("#amOnbSkip"); await p.waitForTimeout(200);
    }
    return p;
  };
  // Après le pseudo, on n'atterrit pas toujours au même endroit : arrivé par
  // un lien de partie, on tombe directement sur la partie.
  const entrer = async (p, nom, pin) => {
    await p.fill("#amName", nom); await p.fill("#amPin", pin); await p.click("#amContinue");
    await p.waitForFunction(() => ["s-home", "s-game"].some((i) => document.getElementById(i).classList.contains("on")),
      null, { timeout: 10000 });
  };
  const profil = async (p) => {
    await p.click("#amWho");
    await p.waitForSelector("#amRename", { timeout: 8000 });
  };
  const listeJoueurs = (p) => p.evaluate(() =>
    [...document.querySelectorAll("#amGameBody .am-prow .who")].map((x) => x.textContent.replace(/\s+/g, " ").trim()).join(" | "));

  // --- deux joueuses dans la même partie ------------------------------------
  const M = await ouvrir("Marie");
  await entrer(M, "Marie", "4827");
  await M.click("#amCreate");
  await M.waitForSelector("#amFormGo", { timeout: 8000 });
  await M.click("#amFormGo");
  await M.waitForFunction(() => document.querySelector(".am-code-big"), null, { timeout: 10000 });
  const code = (await M.textContent(".am-code-big")).trim();

  const T2 = await ouvrir("Tom", srv.base + "/AlterEgo/g/" + code);
  await entrer(T2, "Tom", "7391");
  await T2.waitForSelector("#amJoinGame", { timeout: 10000 });
  await T2.click("#amJoinGame");
  await T2.waitForSelector("#amPlay", { timeout: 10000 });

  t.section("Le pseudo se change depuis le profil");
  await profil(M);
  t.check("Le bouton « changer mon pseudo » est dans le profil", !!(await M.$("#amRename")));
  t.check("… et celui pour supprimer le compte aussi", !!(await M.$("#amDelMe")));

  await M.click("#amRename");
  await M.waitForSelector("#amRenameIn", { timeout: 8000 });
  // Un pseudo déjà pris doit être refusé AVEC une raison lisible, pas par un
  // silence ni par un renommage à moitié fait.
  await M.fill("#amRenameIn", "Tom");
  await M.click("#amRenameGo");
  await M.waitForTimeout(700);
  const err = (await M.textContent("#amRenameErr")).trim();
  t.check("Un pseudo déjà pris est refusé, et c'est écrit", /Tom/.test(err) && err.length > 10, err);
  t.check("… la feuille reste ouverte pour réessayer", !!(await M.$("#amRenameIn")));
  t.check("… et le pseudo n'a pas bougé", /Marie/.test(await M.textContent("#amWho")), await M.textContent("#amWho"));

  await M.fill("#amRenameIn", "Marion");
  await M.click("#amRenameGo");
  await M.waitForFunction(() => /Marion/.test(document.getElementById("amWho").textContent), null, { timeout: 8000 });
  t.check("Un pseudo libre passe", /Marion/.test(await M.textContent("#amWho")), await M.textContent("#amWho"));
  // La feuille se ferme en masquant son cadre, pas en vidant son contenu :
  // chercher l'absence du champ dans le DOM le trouverait toujours, et le
  // contrôle serait vert quoi qu'il arrive.
  t.check("… et la feuille s'est refermée",
    (await M.evaluate(() => getComputedStyle(document.getElementById("amOverlay")).display)) === "none");
  // Le pseudo est gardé sur l'appareil : sans ça, rouvrir l'app reviendrait
  // sous l'ancien nom et le serveur ne le reconnaîtrait plus.
  t.check("… le téléphone a retenu le nouveau nom",
    (await M.evaluate(() => localStorage.getItem("am.pseudo"))) === "Marion",
    await M.evaluate(() => localStorage.getItem("am.pseudo")));

  t.section("L'autre joueur le voit, sans rien faire");
  // LE contrôle de la rediffusion. Tom n'a pas rechargé, pas cliqué : c'est le
  // serveur qui doit lui repousser l'état de la partie.
  await T2.waitForFunction(() => /Marion/.test(document.getElementById("amGameBody").textContent), null, { timeout: 8000 })
    .catch(() => {});
  const vuParTom = await listeJoueurs(T2);
  t.check("Tom voit « Marion » dans la liste des joueurs", /Marion/.test(vuParTom), vuParTom);
  t.check("… et plus « Marie »", !/Marie\b/.test(vuParTom), vuParTom);
  t.check("… sans avoir rechargé la page",
    (await T2.evaluate(() => performance.getEntriesByType("navigation").length)) === 1);

  t.section("Supprimer son compte : l'écran annonce les dégâts");
  await profil(M);
  await M.click("#amDelMe");
  await M.waitForSelector("#amDelMeIn", { timeout: 8000 });
  const texte = (await M.textContent(".am-sheet-body")).replace(/\s+/g, " ");
  t.check("La feuille dit ce qui sera effacé", /effac/i.test(texte), texte.slice(0, 120));
  t.check("… annonce la partie concernée", /1 partie|partie/.test(texte), texte.slice(0, 160));
  t.check("… et prévient que les autres perdent quelque chose",
    /recalcul|sans toi/i.test(texte), texte.slice(0, 200));
  // Marie héberge, mais Tom est là : la partie doit lui revenir, pas mourir.
  t.check("… et annonce le transfert plutôt qu'une suppression",
    /plus tôt|continuent sans toi/i.test(texte) && !/sera supprimée/.test(texte), texte.slice(0, 260));

  const go = await M.$("#amDelMeGo");
  t.check("Le bouton est bloqué tant que rien n'est tapé", await go.isDisabled());
  await M.fill("#amDelMeIn", "0000");
  await M.waitForTimeout(150);
  t.check("… débloqué dès que le code a 4 chiffres", !(await go.isDisabled()));
  await M.click("#amDelMeGo");
  await M.waitForTimeout(800);
  const errDel = (await M.textContent("#amDelMeErr")).trim();
  t.check("Un mauvais code de reprise est refusé", errDel.length > 5, errDel);
  t.check("… et le compte existe toujours", /Marion/.test(await M.textContent("#amWho")), await M.textContent("#amWho"));

  t.section("Le bon code, et tout part");
  await M.fill("#amDelMeIn", "4827");
  await M.waitForTimeout(150);
  await M.click("#amDelMeGo");
  // La page se recharge sur l'accueil : le compte n'existe plus, ce téléphone
  // ne doit plus rien porter qui le ferait revenir sous ce pseudo.
  await M.waitForFunction(() => document.getElementById("s-pseudo").classList.contains("on"), null, { timeout: 10000 });
  t.check("Le téléphone est revenu sur l'écran du pseudo", true);
  t.check("… et n'a plus rien gardé",
    (await M.evaluate(() => localStorage.getItem("am.pseudo"))) === null &&
    (await M.evaluate(() => localStorage.getItem("am.cid"))) === null);

  t.section("Chez Tom, la partie continue — sans elle");
  await T2.waitForFunction(() => !/Marion/.test(document.getElementById("amGameBody").textContent), null, { timeout: 10000 })
    .catch(() => {});
  const apres = await listeJoueurs(T2);
  t.check("Marion a disparu de la liste", !/Marion/.test(apres), apres);
  t.check("Tom est toujours là", /Tom/.test(apres), apres);
  // Le transfert d'hôte, vu de l'écran : la couronne doit être passée à Tom,
  // sinon plus personne ne peut fermer ni supprimer la partie.
  t.check("… et il en est devenu l'hôte (la couronne)", /👑/.test(apres) && /👑\s*Tom/.test(apres), apres);

  t.section("Le pseudo libéré peut être repris");
  const N = await ouvrir("Nouvelle");
  await entrer(N, "Marion", "5261");
  t.check("Quelqu'un d'autre peut prendre « Marion »",
    /Marion/.test(await N.textContent("#amWho")), await N.textContent("#amWho"));

  t.check("Aucune erreur dans les navigateurs", soucis.length === 0, soucis.slice(0, 3).join(" | "));
};
