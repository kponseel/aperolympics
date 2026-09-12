// « Si on choisit l'anglais, TOUTE l'interface est en anglais. »
//
// 15-langues prouve que chaque chaîne a une traduction. Ça ne prouve pas
// qu'aucun français n'arrive à l'écran : il suffit d'une phrase construite
// ailleurs, d'un texte écrit en dur dans un coin rarement visité, ou d'un
// écran qu'on n'a jamais regardé en anglais. Cette suite ouvre les écrans
// un par un, en anglais, et lit ce qui s'affiche vraiment.
//
// Le détecteur n'est pas une liste de mots français devinée : ce sont les
// CLÉS du dictionnaire, c'est-à-dire exactement les phrases françaises que
// l'app connaît. Si l'une d'elles apparaît à l'écran alors que sa traduction
// existe et diffère, c'est que T() n'a pas été appliqué à cet endroit-là.

exports.navigateur = true;
exports.titre = "Tout est en anglais quand on choisit l'anglais";

// Tourne DANS la page : renvoie les phrases françaises visibles à l'écran.
const FRANCAIS_VISIBLE = () => {
  const d = (window.AM_I18N && window.AM_I18N.en) || {};
  const nu = (h) => String(h).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const vu = document.body.innerText.replace(/\s+/g, " ");
  const out = [];
  for (const fr of Object.keys(d)) {
    const f = nu(fr), e = nu(d[fr]);
    // Les phrases courtes donnent de faux positifs par simple inclusion, et
    // celles qui ne changent pas d'une langue à l'autre ne prouvent rien.
    if (f.length < 14 || f === e) continue;
    if (vu.indexOf(f) >= 0) out.push(f.slice(0, 70));
  }
  return out;
};

// Deuxième filet : un accent français à l'écran. Il attrape ce qui n'est
// jamais passé par le dictionnaire — un mois écrit en dur, une phrase neuve.
// Les emprunts que l'anglais utilise vraiment sont retirés d'abord.
const ACCENTS_VISIBLES = () => {
  const EMPRUNTS = /caf[eé]s?|clich[eé]s?|r[eé]sum[eé]s?|na[iï]ve|fianc[eé]e?|d[eé]j[aà] vu|[eé]clairs?/gi;
  // « Français » dans le sélecteur de langue est écrit en français exprès :
  // une langue se nomme dans sa propre langue, sinon on ne la reconnaît pas.
  const LANGUES = /Français/g;
  const vu = document.body.innerText.replace(EMPRUNTS, "").replace(LANGUES, "").replace(/\s+/g, " ");
  const out = [];
  const re = /[éèêàçôûîïÉÈÀÇ]/g;
  let m;
  while ((m = re.exec(vu))) out.push(vu.slice(Math.max(0, m.index - 30), m.index + 30));
  return out.slice(0, 5);
};

exports.run = async (t) => {
  const b = await t.navigateur();
  if (!b) return;
  const srv = await t.serveur();
  const restes = [];

  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "en-GB" });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push(e.message));
  p.on("dialog", (d) => d.accept());

  // Chaque écran est regardé au moment où il est à l'écran : innerText ne
  // rend que le visible, c'est justement ce qu'on veut vérifier.
  async function lire(ecran) {
    await p.waitForTimeout(150);
    for (const s of await p.evaluate(FRANCAIS_VISIBLE)) restes.push(ecran + " → « " + s + " »");
    for (const s of await p.evaluate(ACCENTS_VISIBLES)) restes.push(ecran + " → accent : …" + s + "…");
  }
  const clic = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (e) e.click(); }, sel);
  const sur = (id) => p.waitForFunction((i) => document.getElementById(i).classList.contains("on"), id, { timeout: 10000 });

  await p.goto(srv.base + "/AreWeAMatch/", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(400);

  t.section("L'accueil et l'explication d'entrée");
  t.check("La page démarre en anglais", (await p.evaluate(() => document.documentElement.lang)) === "en");
  // L'onboarding, diapo par diapo : c'est le premier écran d'un nouveau
  // joueur, et le seul qu'on ne revoit jamais si on le passe.
  if (await p.evaluate(() => getComputedStyle(document.getElementById("amOnb")).display !== "none")) {
    for (let i = 0; i < 6; i++) {
      await lire("onboarding " + (i + 1));
      if (!(await p.evaluate(() => getComputedStyle(document.getElementById("amOnb")).display !== "none"))) break;
      await clic("#amOnbNext");
      await p.waitForTimeout(180);
    }
    if (await p.evaluate(() => getComputedStyle(document.getElementById("amOnb")).display !== "none")) await clic("#amOnbSkip");
    await p.waitForTimeout(250);
  }
  await lire("pseudo");

  t.section("Créer une partie");
  await p.fill("#amName", "Sam"); await p.fill("#amPin", "7391");
  await clic("#amContinue"); await sur("s-home");
  await lire("accueil (vide)");

  await clic("#amCreate"); await p.waitForSelector("#amLenRange", { timeout: 8000 });
  await lire("feuille de création (20 scènes)");
  // Chaque palier du curseur a son nom et sa note : on les regarde tous.
  for (const n of [5, 10, 15, 25, 40, 50]) {
    await p.evaluate((v) => {
      const r = document.getElementById("amLenRange");
      r.value = String(v); r.dispatchEvent(new Event("input", { bubbles: true }));
    }, n);
    await lire("curseur sur " + n);
  }
  await p.evaluate(() => {
    const r = document.getElementById("amLenRange");
    r.value = "5"; r.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await p.fill("#amFormTitle", "Sam's night");
  await clic("#amFormGo");
  await p.waitForFunction(() => document.querySelector(".am-code-big"), null, { timeout: 10000 });
  const code = (await p.textContent(".am-code-big")).trim();
  await lire("partie (invitation)");

  t.section("Jouer, révéler, finir");
  await clic("#amPlay"); await sur("s-play");
  await lire("scène 1, rien de classé");
  // Un classement partiel : c'est le texte « encore N à classer ».
  await p.evaluate(() => document.querySelectorAll("#amOpts button")[0].click());
  await p.waitForTimeout(120);
  await lire("scène 1, classement en cours");

  // Toucher une option déjà classée l'ENLÈVE : on part donc de la première
  // non classée à chaque fois, plutôt que de cliquer 0, 1, 2 en aveugle.
  async function classerEtValider() {
    await p.waitForFunction(() => document.querySelectorAll("#amOpts button").length === 3, null, { timeout: 10000 });
    for (let j = 0; j < 3; j++) {
      const reste = await p.evaluate(() => {
        const bs = [...document.querySelectorAll("#amOpts button")].filter((x) => !/^\s*[123]\b/.test(x.textContent));
        if (!bs.length) return 0;
        bs[0].click();
        return bs.length;
      });
      if (!reste) break;
      await p.waitForTimeout(60);
    }
    await clic("#amValid");
    await p.waitForTimeout(500);
  }
  for (let i = 0; i < 5; i++) {
    await classerEtValider();
    if (i === 0) await lire("révélation (seul sur la scène)");
    if (await p.$("#amNext")) { await clic("#amNext"); await p.waitForTimeout(250); }
    if (await p.evaluate(() => document.getElementById("s-results").classList.contains("on"))) break;
  }
  await sur("s-results");
  await p.waitForTimeout(900);
  await lire("résultats (seul, en attente)");

  t.section("Les feuilles qu'on ouvre rarement");
  await clic("#amHelp"); await p.waitForTimeout(400);
  await lire("aide");
  await clic("#amSheetClose"); await p.waitForTimeout(250);

  await clic("#amWho"); await p.waitForTimeout(400);
  await lire("profil");
  await clic("#amSheetClose"); await p.waitForTimeout(250);

  // Retour sur la partie pour atteindre la feuille de suppression, qui porte
  // les phrases les plus recomposées de l'app.
  await p.goto(srv.base + "/AreWeAMatch/g/" + code, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(900);
  await lire("partie (hôte)");
  const supprime = await p.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /🗑️|Delete|Supprimer/.test(x.textContent));
    if (b) { b.click(); return true; }
    return false;
  });
  if (supprime) { await p.waitForTimeout(500); await lire("feuille de suppression"); }
  t.check("La feuille de suppression a bien été ouverte", supprime);

  t.section("Le verdict");
  t.check("Aucune phrase française ne s'affiche en anglais", restes.length === 0,
    restes.length + " reste(s) : " + restes.slice(0, 6).join("  |  "));
  t.check("Aucune erreur JavaScript pendant le parcours", erreurs.length === 0, erreurs.slice(0, 2).join(" | "));

  await ctx.close();
};
