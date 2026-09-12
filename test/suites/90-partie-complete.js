// Une partie jouée en entier, comme un vrai joueur : créer, inviter, répondre
// à toutes les scènes, voir les révélations, atteindre l'écran final pendant
// qu'un troisième joueur est encore en route.
//
// C'est la suite qui attrape ce qu'aucun test unitaire ne voit : un écran qui
// déborde, un texte coupé, une erreur JavaScript en cours de route, un bouton
// qui n'apparaît pas au bon moment.

exports.navigateur = true;
exports.titre = "Une partie de bout en bout";

exports.run = async (t) => {
  const b = await t.navigateur();
  if (!b) return;
  // On joue une partie de 5 scènes : même chemin qu'une partie de 20, en plus
  // court — et ça fait passer le choix de longueur par le vrai parcours.
  const N = 5;
  const srv = await t.serveur();
  const soucis = [];

  const ouvrir = async (nom, url) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => soucis.push(nom + " — erreur JS : " + e.message));
    p.on("console", (m) => { if (m.type() === "error") soucis.push(nom + " — console : " + m.text()); });
    p.on("dialog", (d) => d.accept());
    await p.goto(url || srv.base + "/AreWeAMatch/", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(250);
    if (await p.evaluate(() => getComputedStyle(document.getElementById("amOnb")).display !== "none")) {
      await p.click("#amOnbSkip"); await p.waitForTimeout(200);
    }
    p.nom = nom;
    return p;
  };
  const entrer = async (p, nom, pin) => { await p.fill("#amName", nom); await p.fill("#amPin", pin); await p.click("#amContinue"); };
  const sur = (p, id) => p.waitForFunction((i) => document.getElementById(i).classList.contains("on"), id, { timeout: 10000 });
  // openResults() affiche l'écran AVEC « Calcul… » puis demande les résultats
  // au serveur : interroger la page dès que l'écran est là, c'est lire le
  // message d'attente. Sur une machine rapide, le test échouait pour ça.
  const resultatsPrets = (p) => p.waitForFunction(() => {
    const b = document.getElementById("amResultsBody");
    return !!b && b.textContent.trim().length > 20 && !/Calcul…/.test(b.textContent);
  }, null, { timeout: 15000 });
  const scene = (p) => p.evaluate(() => { const m = /Scène (\d+) \//.exec(document.body.textContent || ""); return m ? parseInt(m[1], 10) : -1; });

  async function repondre(p, choix) {
    await p.waitForFunction(() => document.querySelectorAll("#amOpts button").length === 3, null, { timeout: 10000 });
    for (const i of choix) { await p.evaluate((j) => document.querySelectorAll("#amOpts button")[j].click(), i); await p.waitForTimeout(30); }
    await p.click("#amValid");
    await p.waitForFunction(() => document.getElementById("amNext") ||
      document.querySelectorAll("#amOpts button").length === 3 ||
      document.getElementById("s-results").classList.contains("on"), null, { timeout: 10000 });
    if (await p.$("#amNext")) await p.click("#amNext");
  }
  // Ce que l'œil rate sur une capture.
  async function balayer(p, ecran) {
    for (const s of await p.evaluate(BALAYAGE)) soucis.push(ecran + " — " + s);
  }

  t.section("Kevin découvre le jeu et crée une partie");
  const K = await ouvrir("Kevin");
  await balayer(K, "pseudo");
  await entrer(K, "Kevin", "4827");
  await sur(K, "s-home");
  await balayer(K, "accueil");
  await K.click("#amCreate"); await K.waitForSelector("#amLenRange", { timeout: 8000 });
  const bornes = await K.evaluate(() => {
    const r = document.getElementById("amLenRange");
    return { min: r.min, max: r.max, step: r.step, val: r.value };
  });
  t.check("Le curseur va de 5 à 50 scènes", bornes.min === "5" && bornes.max === "50",
    bornes.min + " → " + bornes.max);
  t.check("Il avance par crans de 5", bornes.step === "5", bornes.step);
  t.check("Il démarre sur la longueur par défaut", bornes.val === "20", bornes.val);
  // On pose la valeur puis on déclenche « input » : c'est l'événement que le
  // code écoute, et le glissement du pouce ne se simule pas autrement.
  await K.evaluate((n) => {
    const r = document.getElementById("amLenRange");
    r.value = String(n);
    r.dispatchEvent(new Event("input", { bubbles: true }));
  }, N);
  await K.waitForTimeout(200);
  t.check("Le chiffre choisi s'affiche", (await K.textContent("#amLenN")) === String(N), await K.textContent("#amLenN"));
  t.check("… avec une durée estimée", /min/.test(await K.textContent("#amLenD")), await K.textContent("#amLenD"));
  t.check("Choisir une longueur explique ce qu'elle vaut",
    /impression, pas un verdict/.test(await K.textContent("#amLengthNote")), await K.textContent("#amLengthNote"));
  await K.click("#amFormGo");
  await K.waitForFunction(() => document.querySelector(".am-code-big"), null, { timeout: 10000 });
  const code = (await K.textContent(".am-code-big")).trim();
  t.check("La partie est créée et affiche son code", /^[A-Z0-9]+$/.test(code), code);
  t.check("… et elle fait bien " + N + " scènes",
    (await K.evaluate(() => window.__amGame.sceneCount)) === N,
    String(await K.evaluate(() => window.__amGame.sceneCount)));
  await balayer(K, "partie (seul)");
  t.check("Seul, on lui propose d'abord d'inviter", !!(await K.$("#amQR")));

  t.section("Il répond à la première scène, seul");
  await K.click("#amPlay"); await sur(K, "s-play");
  await balayer(K, "scène 1");
  await repondre(K, [1, 0, 2]);
  t.check("Seul sur la scène, l'app enchaîne sur la suivante", (await scene(K)) === 2);
  await K.waitForSelector(".am-tip.am-first", { timeout: 8000 });
  t.check("… en expliquant pourquoi il n'a rien vu, dans la scène",
    /Tu es le premier sur la scène 1/.test(await K.textContent(".am-tip.am-first")));
  t.check("… juste au-dessus du bouton qui y ramène",
    await K.evaluate(() => { const x = document.querySelector(".am-tip.am-first"); return x && x.nextElementSibling && x.nextElementSibling.id === "amUndo"; }));
  await balayer(K, "scène 2 (premier)");

  t.section("Marie arrive par le lien d'invitation");
  const M = await ouvrir("Marie", srv.base + "/AreWeAMatch/g/" + code);
  await balayer(M, "invitation");
  await entrer(M, "Marie", "3947");
  await M.waitForSelector("#amJoinGame", { timeout: 10000 });
  t.check("Le lien mène droit à la partie, avec un bouton pour la rejoindre", true);
  await M.click("#amJoinGame");
  await M.waitForSelector("#amPlay", { timeout: 8000 });
  await balayer(M, "partie rejointe");
  await M.click("#amPlay"); await sur(M, "s-play");
  await repondre(M, [0, 2, 1]);
  await balayer(M, "révélation");

  t.section("La fenêtre de retour de Kevin se referme toute seule");
  await K.waitForFunction(() => !document.querySelector(".am-tip.am-first"), null, { timeout: 10000 });
  t.check("Marie a répondu : le message et le bouton disparaissent de l'écran de Kevin",
    !(await K.$(".am-tip.am-first")) && !(await K.$("#amUndo")));

  t.section("Ils finissent tous les deux");
  for (let s = await scene(K); s > 0 && s <= N; s = await scene(K)) {
    if (await K.evaluate(() => document.getElementById("s-results").classList.contains("on"))) break;
    await repondre(K, [s % 3, (s + 1) % 3, (s + 2) % 3]);
  }
  await sur(K, "s-results");
  await resultatsPrets(K);
  await balayer(K, "résultats (seul fini)");
  t.check("Kevin atteint l'écran final", !!(await K.$("#amResultsBody")));
  t.check("… qui dit clairement qu'il attend les autres",
    /pas encore fini|Où en sont|attend/i.test(await K.textContent("#amResultsBody")));

  for (let s = await scene(M); s > 0 && s <= N; s = await scene(M)) {
    if (await M.evaluate(() => document.getElementById("s-results").classList.contains("on"))) break;
    await repondre(M, [(s + 1) % 3, s % 3, (s + 2) % 3]);
  }
  await sur(M, "s-results");
  await resultatsPrets(M);
  await balayer(M, "résultats complets");
  t.check("Marie voit un score de compatibilité", /%/.test(await M.textContent("#amResultsBody")));

  t.section("Tom rejoint tard et s'arrête au milieu");
  const T = await ouvrir("Tom", srv.base + "/AreWeAMatch/g/" + code);
  await entrer(T, "Tom", "5261");
  await T.waitForSelector("#amJoinGame", { timeout: 10000 }); await T.click("#amJoinGame");
  await T.waitForSelector("#amPlay", { timeout: 8000 }); await T.click("#amPlay"); await sur(T, "s-play");
  for (let i = 0; i < 3; i++) await repondre(T, [2, 1, 0]);
  await balayer(T, "Tom en cours");

  await K.reload();
  await sur(K, "s-results");
  await resultatsPrets(K);
  await balayer(K, "résultats avec Tom en cours");
  const final = await K.textContent("#amResultsBody");
  t.check("L'écran final montre l'avancée de celui qui n'a pas fini", /Tom/.test(final), final.slice(0, 200));
  t.check("… et propose un lien pour revenir voir la progression", !!(await K.$("#amShareRes")));

  t.section("Le partage de l'écran final");
  await K.evaluate(() => { window.__partage = null; navigator.share = (d) => { window.__partage = d; return Promise.resolve(); }; });
  await K.click("#amShareRes"); await K.waitForTimeout(300);
  const sh = await K.evaluate(() => window.__partage);
  t.check("Il produit un texte avec le lien des résultats", sh && /\?r=1/.test(sh.text), sh && sh.text);
  t.check("… une seule fois", sh && (sh.text.match(/https?:\/\//g) || []).length === 1, sh && sh.text);

  t.section("Ce que le balayage a relevé sur tous ces écrans");
  t.check("Aucune erreur, aucun débordement, aucun texte coupé, aucune cible trop petite",
    soucis.length === 0, soucis.slice(0, 6).join("\n      → "));
};

// Débordement horizontal, texte coupé, cibles trop petites.
const BALAYAGE = () => {
  const out = [];
  const L = innerWidth;
  if (document.documentElement.scrollWidth > L + 1)
    out.push("la page déborde à droite (" + document.documentElement.scrollWidth + " > " + L + ")");
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const tag = el.tagName.toLowerCase();
    const nom = tag + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/)[0] : "");
    if (r.left < -1 || r.right > L + 1) out.push(nom + " sort de l'écran (" + Math.round(r.left) + "…" + Math.round(r.right) + ")");
    // Texte coupé — seulement si l'élément PEUT couper : avec overflow visible
    // rien n'est perdu, et un ::after décalé suffirait à gonfler scrollWidth.
    let propre = ""; for (const n of el.childNodes) if (n.nodeType === 3) propre += n.nodeValue;
    const coupeX = cs.overflowX === "hidden" || cs.overflowX === "clip";
    if (propre.trim() && coupeX && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== "ellipsis")
      out.push(nom + " a du texte coupé « " + propre.trim().slice(0, 30) + " »");
    if ((tag === "button" || tag === "a" || tag === "input") && !el.disabled) {
      const a = getComputedStyle(el, "::after");
      const marge = a.content !== "none" && a.position === "absolute" ? Math.abs(parseFloat(a.top) || 0) : 0;
      if (r.height + 2 * marge < 44 || r.width + 2 * marge < 44)
        out.push(nom + " est une cible trop petite (" + Math.round(r.width) + "×" + Math.round(r.height) + ")");
    }
  }
  return [...new Set(out)];
};
