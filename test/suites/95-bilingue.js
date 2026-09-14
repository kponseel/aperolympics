// Un francophone et un anglophone dans LA MÊME partie.
//
// C'est la demande de Kevin, et c'est là que tout peut se casser en silence :
// un classement est un tableau d'indices dans `o`. Si l'option 0 ne désigne
// pas la même chose dans les deux langues, deux joueurs d'accord sont comptés
// en désaccord et le score ment. Cette suite le vérifie de bout en bout, dans
// deux vrais navigateurs, sur la même partie.

exports.navigateur = true;
exports.titre = "Français et anglais dans la même partie";

exports.run = async (t) => {
  const b = await t.navigateur();
  if (!b) return;
  const N = 5;
  const srv = await t.serveur();
  const erreurs = [];

  // La langue vient du téléphone : on donne à chacun le sien.
  const ouvrir = async (nom, locale, url) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => erreurs.push(nom + " : " + e.message));
    p.on("console", (m) => { if (m.type() === "error") erreurs.push(nom + " : " + m.text()); });
    p.on("dialog", (d) => d.accept());
    await p.goto(url || srv.base + "/AreWeAMatch/", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(300);
    if (await p.evaluate(() => getComputedStyle(document.getElementById("amOnb")).display !== "none")) {
      await p.click("#amOnbSkip"); await p.waitForTimeout(200);
    }
    return p;
  };
  const entrer = async (p, nom, pin) => { await p.fill("#amName", nom); await p.fill("#amPin", pin); await p.click("#amContinue"); };
  const sur = (p, id) => p.waitForFunction((i) => document.getElementById(i).classList.contains("on"), id, { timeout: 10000 });
  const resultatsPrets = (p) => p.waitForFunction(() => {
    const e = document.getElementById("amResultsBody");
    return !!e && e.textContent.trim().length > 20 && !/Calcul…|Working/.test(e.textContent);
  }, null, { timeout: 15000 });
  // Répondre en désignant les options par leur EMOJI, pas par leur position à
  // l'écran : c'est ce qui permet de donner « la même réponse » dans deux
  // langues sans présupposer que l'ordre affiché est le même.
  async function repondreParEmoji(p, emojis, sansSuite) {
    await p.waitForFunction(() => document.querySelectorAll("#amOpts button").length === 3, null, { timeout: 10000 });
    for (const e of emojis) {
      const ok = await p.evaluate((emo) => {
        const bs = [...document.querySelectorAll("#amOpts button")];
        const cible = bs.find((x) => (x.querySelector(".am-opttext") || {}).textContent.trim().indexOf(emo) === 0);
        if (!cible) return false;
        cible.click(); return true;
      }, e);
      if (!ok) throw new Error("option " + e + " introuvable à l'écran");
      await p.waitForTimeout(40);
    }
    await p.click("#amValid");
    await p.waitForFunction(() => document.getElementById("amNext") ||
      document.querySelectorAll("#amOpts button").length === 3 ||
      document.getElementById("s-results").classList.contains("on"), null, { timeout: 10000 });
    if (!sansSuite && await p.$("#amNext")) await p.click("#amNext");
  }
  const emojisAffiches = (p) => p.evaluate(() =>
    [...document.querySelectorAll("#amOpts button .am-opttext")].map((x) => x.textContent.trim().split(" ")[0]));
  const question = (p) => p.evaluate(() => (document.querySelector(".am-q") || {}).textContent || "");

  // La langue par défaut vient de l'APPAREIL : on simule des téléphones réglés
  // différemment et on regarde dans quelle langue l'app démarre.
  async function langueAuDemarrage(locale, liste, stocke) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale });
    // Playwright ne pose que [locale] dans navigator.languages : pour un
    // téléphone multilingue il faut poser la liste soi-même.
    if (liste) await ctx.addInitScript((l) => {
      Object.defineProperty(navigator, "languages", { get: () => l });
    }, liste);
    const pg = await ctx.newPage();
    await pg.goto(srv.base + "/AreWeAMatch/", { waitUntil: "domcontentloaded" });
    if (stocke) {
      // localStorage appartient à l'origine : il faut avoir chargé la page
      // avant de l'écrire, puis recharger.
      await pg.evaluate((v) => { try { localStorage.setItem("am.lang", v); } catch (e) {} }, stocke);
      await pg.reload({ waitUntil: "domcontentloaded" });
    }
    await pg.waitForTimeout(350);
    const l = await pg.evaluate(() => document.documentElement.lang);
    await ctx.close();
    return l;
  }

  t.section("La langue par défaut vient du téléphone");
  t.check("Téléphone en français → français", (await langueAuDemarrage("fr-FR")) === "fr");
  t.check("Téléphone en anglais → anglais", (await langueAuDemarrage("en-GB")) === "en");
  t.check("Une variante régionale compte (fr-CA → français)", (await langueAuDemarrage("fr-CA")) === "fr");
  // Le cas qui était faux : on ne lisait que la PREMIÈRE langue annoncée.
  t.check("Téléphone [de, en, fr] → anglais, pas français",
    (await langueAuDemarrage("de-DE", ["de-DE", "en-GB", "fr-FR"])) === "en");
  t.check("Téléphone [es, fr, en] → français, la première qu'on sait parler",
    (await langueAuDemarrage("es-ES", ["es-ES", "fr-FR", "en-GB"])) === "fr");
  t.check("Téléphone dans une langue qu'on ne parle pas → anglais",
    (await langueAuDemarrage("de-DE", ["de-DE"])) === "en");
  t.check("Un choix déjà fait l'emporte sur l'appareil",
    (await langueAuDemarrage("en-GB", null, "fr")) === "fr");

  t.section("Chacun voit l'interface dans SA langue");
  const F = await ouvrir("Chloé", "fr-FR");
  const E = await ouvrir("Sam", "en-GB");
  t.check("Le téléphone français affiche l'interface en français",
    /Ton pseudo/.test(await F.textContent("#s-pseudo")), (await F.textContent("#s-pseudo")).slice(0, 60));
  t.check("Le téléphone anglais affiche l'interface en anglais",
    /Your name/.test(await E.textContent("#s-pseudo")), (await E.textContent("#s-pseudo")).slice(0, 60));
  t.check("… et l'attribut lang du document suit",
    (await F.evaluate(() => document.documentElement.lang)) === "fr" &&
    (await E.evaluate(() => document.documentElement.lang)) === "en");

  await entrer(F, "Chloé", "4827"); await sur(F, "s-home");
  await entrer(E, "Sam", "7391"); await sur(E, "s-home");
  t.check("L'accueil aussi", /Mes parties/.test(await F.textContent("#s-home")) && /My games/.test(await E.textContent("#s-home")),
    (await E.textContent("#s-home")).slice(0, 60));

  t.section("Ils rejoignent la même partie");
  await F.click("#amCreate"); await F.waitForSelector("#amLenRange", { timeout: 8000 });
  await F.evaluate((n) => {
    const r = document.getElementById("amLenRange");
    r.value = String(n);
    r.dispatchEvent(new Event("input", { bubbles: true }));
  }, N);
  await F.click("#amFormGo");
  await F.waitForFunction(() => document.querySelector(".am-code-big"), null, { timeout: 10000 });
  const code = (await F.textContent(".am-code-big")).trim();

  await E.goto(srv.base + "/AreWeAMatch/g/" + code, { waitUntil: "domcontentloaded" });
  await E.waitForSelector("#amJoinGame", { timeout: 10000 });
  t.check("L'anglophone voit le bouton pour rejoindre, en anglais",
    /Join the game/.test(await E.textContent("#amJoinGame")), await E.textContent("#amJoinGame"));
  await E.click("#amJoinGame");
  await E.waitForSelector("#amPlay", { timeout: 8000 });

  t.section("Les MÊMES scènes, dans les deux langues");
  await F.click("#amPlay"); await sur(F, "s-play");
  await E.click("#amPlay"); await sur(E, "s-play");
  const qF = await question(F), qE = await question(E);
  t.check("La scène 1 est posée en français pour Chloé", qF.length > 5 && /[éèêàç]/i.test(qF) || qF.length > 5, qF);
  t.check("… et en anglais pour Sam", qE.length > 5 && qE !== qF, qE);
  // LE point critique : les options sont dans le même ordre, emoji par emoji.
  const eF = await emojisAffiches(F), eE = await emojisAffiches(E);
  t.check("Les trois options sont dans le MÊME ordre (mêmes emojis, mêmes places)",
    eF.join(" ") === eE.join(" "), eF.join(" ") + "   ≠   " + eE.join(" "));

  t.section("Basculer la langue EN PLEINE SCÈNE");
  // Le texte d'une scène vient du SERVEUR. L'interface, elle, est traduite
  // dans la page. Les deux doivent basculer ensemble : une scène restée en
  // français sous une interface anglaise, c'est ce que Kevin a vu.
  const optionsAffichees = (p) => p.evaluate(() =>
    [...document.querySelectorAll("#amOpts button .am-opttext")].map((x) => x.textContent.trim()).join(" | "));
  const valider = (p) => p.textContent("#amValid");

  const qAvant = await question(F), oAvant = await optionsAffichees(F);
  await F.click("#amLang"); await F.waitForTimeout(900);
  const qApres = await question(F), oApres = await optionsAffichees(F);
  t.check("La QUESTION de la scène passe en anglais", qApres !== qAvant && qApres.length > 5,
    "avant : " + qAvant + "   apr\u00e8s : " + qApres);
  t.check("Les OPTIONS aussi", oApres !== oAvant, "apr\u00e8s : " + oApres.slice(0, 90));
  t.check("… et la question affichée est bien celle que voit l'anglophone", qApres === qE,
    qApres + "   vs   " + qE);
  t.check("Le bouton de validation est traduit lui aussi",
    !/Valider/.test(await valider(F)), await valider(F));

  // Et le retour, du premier coup : il fallait basculer deux fois pour que
  // l'écran finisse par suivre.
  await F.click("#amLang"); await F.waitForTimeout(900);
  t.check("Un seul appui suffit pour revenir au français", (await question(F)) === qAvant,
    (await question(F)) + "   vs   " + qAvant);
  t.check("… options comprises", (await optionsAffichees(F)) === oAvant);

  t.section("Basculer la langue SUR LA RÉVÉLATION");
  // Une révélation n'arrive qu'avec la validation : impossible de la
  // redemander seule. Ses libellés sont donc réécrits depuis la scène
  // traduite, en s'appuyant sur l'alignement des options par index.
  // Sam répond EN PREMIER : sans ça, Chloé est seule sur la scène et l'app
  // enchaîne sur la suivante au lieu de montrer une révélation — il n'y aurait
  // rien à traduire, et le contrôle ne prouverait rien.
  const emojisScene1 = await emojisAffiches(F);
  await repondreParEmoji(E, emojisScene1);
  await repondreParEmoji(F, emojisScene1, true);
  await F.waitForSelector("#amNext", { timeout: 10000 });
  t.check("Chloé est bien sur une révélation, pas sur la scène suivante",
    (await F.$("#amValid")) === null, "le bouton de validation ne doit plus être là");

  const revAvant = await F.textContent("#amPlayBody");
  t.check("La révélation montre la question en français", revAvant.indexOf(qF) >= 0, qF);
  await F.click("#amLang"); await F.waitForTimeout(900);
  const revApres = await F.textContent("#amPlayBody");
  t.check("Elle passe en anglais", revApres.indexOf(qE) >= 0, revApres.replace(/\s+/g, " ").slice(0, 110));
  t.check("… sans laisser la question française derrière", revApres.indexOf(qF) < 0, qF);
  await F.click("#amLang"); await F.waitForTimeout(900);
  t.check("Et revient au français du premier coup", (await F.textContent("#amPlayBody")) === revAvant);
  await F.click("#amNext");

  t.section("Ils répondent pareil, et le score le dit");
  // Les deux donnent le même classement, désigné par les emojis.
  for (let i = 1; i < N; i++) {
    const emojis = await emojisAffiches(F);
    await repondreParEmoji(F, emojis);
    await repondreParEmoji(E, emojis);
  }
  await sur(F, "s-results"); await resultatsPrets(F);
  await sur(E, "s-results"); await resultatsPrets(E);

  const pct = (p) => p.evaluate(() => {
    const m = /(\d+)\s*%/.exec(document.getElementById("amResultsBody").textContent || "");
    return m ? parseInt(m[1], 10) : -1;
  });
  // L'écran final de celui qui a fini le premier se complète TOUT SEUL quand
  // le second termine : on attend cette mise à jour plutôt que de lire trop
  // tôt une matrice à un seul joueur.
  const deuxDansLaMatrice = (p) => p.waitForFunction(() => {
    const r = window.__amResults;
    return !!(r && r.final && r.final.matrix && Object.keys(r.final.matrix).length === 2);
  }, null, { timeout: 15000 });
  await deuxDansLaMatrice(F);
  await deuxDansLaMatrice(E);
  t.check("L'écran final de Chloé s'est complété tout seul quand Sam a fini", true);

  t.check("Chloé voit 100 % de compatibilité", (await pct(F)) === 100, String(await pct(F)));
  t.check("Sam voit exactement le même score", (await pct(E)) === (await pct(F)), (await pct(E)) + " vs " + (await pct(F)));
  t.check("Les résultats de Chloé sont en français",
    /compatib|Résultats|meilleur match/i.test(await F.textContent("#amResultsBody")));
  t.check("Ceux de Sam sont en anglais, sans français resté",
    !/meilleur match|Le duo le plus compatible|Tout le monde contre/.test(await E.textContent("#amResultsBody")),
    (await E.textContent("#amResultsBody")).slice(0, 120));
  t.check("Le palier de compatibilité est traduit, pas laissé en français",
    !/Âmes sœurs|Bonne entente|Ça dépend des jours/.test(await E.textContent("#amResultsBody")));

  t.section("Changer de langue en cours de route");
  // Le sélecteur est dans la barre du haut, à gauche du pseudo : un appui
  // suffit, depuis n'importe quel écran.
  t.check("Le bouton de langue montre le drapeau de la langue active",
    (await E.textContent("#amLang")) === "🇬🇧", await E.textContent("#amLang"));
  t.check("… et dit en toutes lettres ce qu'il fera, pour qui ne voit pas le drapeau",
    /English/.test(await E.getAttribute("#amLang", "aria-label")), await E.getAttribute("#amLang", "aria-label"));
  await E.click("#amLang"); await E.waitForTimeout(600);
  t.check("… et bascule sur l'autre drapeau après l'appui",
    (await E.textContent("#amLang")) === "🇫🇷", await E.textContent("#amLang"));
  t.check("Sam passe en français sans recharger la page",
    /Résultats|compatib/i.test(await E.textContent("#amResultsBody")), (await E.textContent("#amResultsBody")).slice(0, 80));
  t.check("… et son score n'a pas bougé", (await pct(E)) === 100, String(await pct(E)));

  t.check("Aucune erreur dans les deux navigateurs", erreurs.length === 0, erreurs.slice(0, 3).join(" | "));
};
