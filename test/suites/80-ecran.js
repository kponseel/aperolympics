// Ce qui se passe à l'écran : les messages, les fenêtres, la lisibilité et
// les cibles tactiles. Tout est MESURÉ dans un vrai navigateur, sur un écran
// de téléphone — jamais déduit du code.
//
// Chaque contrôle ici vient d'un défaut que Kevin a vu et rapporté :
//   - un message qui s'effaçait pendant qu'on le lisait, et qui poussait tout
//     l'écran vers le bas puis le ramenait ;
//   - « les textes ne sont pas assez lisibles, c'est trop ton sur ton » ;
//   - la page qui défilait derrière une fenêtre modale, et le bouton
//     « retour » du téléphone qui quittait le jeu au lieu de la fermer.

exports.navigateur = true;
exports.titre = "L'écran : messages, fenêtres, lisibilité";

exports.run = async (t) => {
  const b = await t.navigateur();
  if (!b) return;
  const srv = await t.serveur({ MATCH_SCENES: "6" });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push("JS : " + e.message));
  p.on("console", (m) => { if (m.type() === "error") erreurs.push("console : " + m.text()); });
  p.on("dialog", (d) => d.accept());
  await p.goto(srv.base + "/AreWeAMatch/", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(400);

  const visible = (id) => p.evaluate((i) => { const e = document.getElementById(i); return !!e && getComputedStyle(e).display !== "none"; }, id);
  const fige = () => p.evaluate(() => document.documentElement.classList.contains("am-modal"));
  const defile = () => p.evaluate(() => { const y = scrollY; scrollTo(0, 1200); const r = scrollY; scrollTo(0, y); return r; });
  const hautContenu = () => p.evaluate(() => Math.round(document.querySelector(".am-main").getBoundingClientRect().top));

  t.section("Une fenêtre modale fige la page derrière elle");
  t.check("L'onboarding s'ouvre à la première visite", await visible("amOnb"));
  t.check("La page est figée", await fige());
  // « overflow: hidden » ne suffit pas, la page reste défilable : on fige le
  // corps en position absolue et on le rend là où on l'avait laissé.
  t.check("Elle ne défile plus derrière", (await defile()) === 0, String(await defile()));

  t.section("Le bouton « retour » du téléphone ferme la fenêtre");
  await p.goBack(); await p.waitForTimeout(400);
  t.check("Le retour ferme l'onboarding", !(await visible("amOnb")));
  t.check("… sans quitter le jeu", /\/AreWeAMatch\//.test(p.url()), p.url());
  t.check("… et rend le défilement", !(await fige()));

  await p.fill("#amName", "Kevin"); await p.fill("#amPin", "4827"); await p.click("#amContinue");
  await p.waitForFunction(() => document.getElementById("s-home").classList.contains("on"), null, { timeout: 8000 });

  t.section("Une notice ne décale jamais la page");
  const avant = await hautContenu();
  // Le pire cas : un message de plusieurs lignes. C'est celui-là qui poussait
  // l'écran vers le bas, puis le ramenait trois secondes plus tard.
  await p.evaluate(() => {
    document.getElementById("amNotice").innerHTML =
      '<div class="am-toast"><span class="t">' + "un message vraiment très long ".repeat(8) + '</span><span class="x">✕</span></div>';
  });
  await p.waitForTimeout(150);
  const h = await p.evaluate(() => Math.round(document.querySelector("#amNotice .am-toast").getBoundingClientRect().height));
  t.check("Le message fait bien plusieurs lignes (le cas qui posait problème)", h > 60, h + "px");
  t.check("La page n'a pas bougé d'un pixel", (await hautContenu()) === avant, avant + " → " + (await hautContenu()));
  t.check("La notice est posée en bas, pas sur le titre de l'écran",
    await p.evaluate(() => {
      const r = document.querySelector("#amNotice .am-toast").getBoundingClientRect();
      return r.top > innerHeight / 2 && Math.round(r.bottom) <= innerHeight + 1;
    }));
  t.check("La barre du haut reste cliquable",
    await p.evaluate(() => {
      const r = document.getElementById("amHelp").getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).id === "amHelp";
    }));
  await p.evaluate(() => { document.getElementById("amNotice").innerHTML = ""; });
  await p.waitForTimeout(100);
  t.check("Et pas davantage en disparaissant", (await hautContenu()) === avant);

  t.section("Un problème reste affiché, une confirmation s'efface");
  // « Si tu l'affiches, laisse-le affiché. » Un message qu'on perd en le
  // lisant est pire que pas de message.
  await p.click("#amJoinBtn"); await p.waitForSelector("#amFormCode", { timeout: 6000 });
  await p.fill("#amFormCode", "ZZZZZ"); await p.click("#amFormGo");
  await p.waitForFunction(() => /Aucune partie/.test(document.getElementById("amNotice").textContent || ""), null, { timeout: 8000 });
  t.check("Un problème s'affiche", /Aucune partie/.test(await p.textContent("#amNotice")));
  t.check("… peint en erreur", !!(await p.$("#amNotice .am-toast.bad")));
  await p.waitForTimeout(6000);
  t.check("Six secondes plus tard, il est TOUJOURS là",
    /Aucune partie/.test(await p.textContent("#amNotice")), await p.textContent("#amNotice"));
  await p.click("#amNotice .am-toast"); await p.waitForTimeout(200);
  t.check("Une touche suffit à le chasser", (await p.textContent("#amNotice")).trim() === "");
  // Et le code inconnu ne laisse pas bloqué sur « Chargement… ».
  await p.waitForFunction(() => document.getElementById("s-home").classList.contains("on"), null, { timeout: 6000 });
  t.check("Un code inconnu ramène à l'accueil au lieu de bloquer sur « Chargement… »", true);

  t.section("La barre d'état n'appartient qu'à la connexion");
  await p.evaluate(() => { document.getElementById("amStatus").textContent = "Connexion perdue — reconnexion…"; });
  await p.click("#amJoinBtn"); await p.waitForSelector("#amFormCode", { timeout: 6000 });
  await p.fill("#amFormCode", "YYYYY"); await p.click("#amFormGo");
  await p.waitForFunction(() => /Aucune partie/.test(document.getElementById("amNotice").textContent || ""), null, { timeout: 8000 });
  t.check("Une notice n'écrase pas l'état de la connexion",
    /Connexion perdue/.test(await p.textContent("#amStatus")), await p.textContent("#amStatus"));
  await p.evaluate(() => { document.getElementById("amStatus").textContent = ""; document.getElementById("amNotice").innerHTML = ""; });
  await p.waitForFunction(() => document.getElementById("s-home").classList.contains("on"), null, { timeout: 6000 });

  t.section("Les cibles tactiles");
  // Le jeu se joue debout, un verre à la main. 44 px, c'est la règle d'Apple.
  await p.click("#amCreate"); await p.waitForSelector("#amFormGo"); await p.click("#amFormGo");
  await p.waitForFunction(() => document.querySelector(".am-code-big"), null, { timeout: 8000 });
  await p.waitForTimeout(400);
  const petits = await p.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll("button, a[href], input, select")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || el.disabled) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      // La zone touchable peut être élargie par un ::after en position absolue
      // à inset négatif : ça garde la mise en page et grossit la cible.
      const a = getComputedStyle(el, "::after");
      const marge = a.content !== "none" && a.position === "absolute" ? Math.abs(parseFloat(a.top) || 0) : 0;
      const H = r.height + 2 * marge, W = r.width + 2 * marge;
      if (H < 44 || W < 44) bad.push((el.id ? "#" + el.id : el.className) + " " + Math.round(W) + "×" + Math.round(H));
    }
    return [...new Set(bad)];
  });
  t.check("Tout ce qui se touche fait au moins 44×44", petits.length === 0, petits.join(" | "));

  t.section("Le contraste, mesuré et pas supposé");
  const faibles = await mesurerContraste(p);
  t.check("Aucun texte sous le seuil WCAG AA sur la page d'une partie",
    faibles.length === 0, faibles.slice(0, 4).map((f) => f.sel + " " + f.r + ":1").join(" | "));

  t.section("Le partage ne met le lien qu'une fois");
  // Les messageries collent le champ « url » à la suite du texte : un texte
  // qui finit déjà par le lien + un champ url = le lien écrit deux fois.
  await p.evaluate(() => { window.__partage = null; navigator.share = (d) => { window.__partage = d; return Promise.resolve(); }; });
  await p.click("#amShare"); await p.waitForTimeout(300);
  const sh = await p.evaluate(() => window.__partage);
  t.check("Le partage produit un texte", !!(sh && sh.text), JSON.stringify(sh));
  t.check("… qui contient le lien", sh && /\/AreWeAMatch\/g\/[A-Z0-9]+/.test(sh.text), sh && sh.text);
  t.check("… une seule fois", sh && (sh.text.match(/https?:\/\//g) || []).length === 1, sh && sh.text);
  t.check("… et sans champ url à recoller derrière", sh && sh.url == null, JSON.stringify(sh));

  t.check("Aucune erreur dans la console", erreurs.length === 0, erreurs.join(" | "));
};

// Contraste réel : couleur calculée de chaque texte contre le premier fond
// opaque au-dessus de lui. Les dégradés sont laissés de côté (jugés à l'œil).
async function mesurerContraste(p) {
  return p.evaluate(() => {
    const px = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const v = m[1].split(",").map(parseFloat); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
    const sur = (f, d) => ({ r: f.r * f.a + d.r * (1 - f.a), g: f.g * f.a + d.g * (1 - f.a), b: f.b * f.a + d.b * (1 - f.a), a: 1 });
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); const [h, l] = x > y ? [x, y] : [y, x]; return (h + 0.05) / (l + 0.05); };
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      let propre = ""; for (const n of el.childNodes) if (n.nodeType === 3) propre += n.nodeValue;
      if (!propre.trim()) continue;
      const fg = px(cs.color); if (!fg) continue;
      let noeud = el, degrade = false; const pile = [];
      while (noeud) {
        const s = getComputedStyle(noeud);
        if (s.backgroundImage && s.backgroundImage !== "none") { degrade = true; break; }
        const c = px(s.backgroundColor);
        if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; }
        noeud = noeud.parentElement;
      }
      if (degrade) continue;
      const bg = pile.reverse().reduce((acc, c) => sur(c, acc), { r: 18, g: 15, b: 30, a: 1 });
      const taille = parseFloat(cs.fontSize), poids = parseInt(cs.fontWeight, 10) || 400;
      const seuil = (taille >= 24 || (taille >= 18.66 && poids >= 700)) ? 3 : 4.5;
      const v = ratio(fg, bg);
      if (v < seuil) out.push({ sel: (el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]), r: Math.round(v * 100) / 100, seuil });
    }
    const vu = {}, uniq = [];
    for (const o of out) { if (!vu[o.sel]) { vu[o.sel] = 1; uniq.push(o); } }
    return uniq;
  });
}
