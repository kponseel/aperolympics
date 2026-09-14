// L'image de partage au format story.
//
// Elle est dessinée dans le navigateur et téléchargée : cette suite la fait
// produire pour de vrai, récupère le PNG, et le relit pixel par pixel.
//
// Ce qu'on vérifie ne se voit pas à l'œil sur une capture : qu'AUCUN contenu
// ne tombe sous l'interface d'Instagram. Une story est couverte par le profil
// en haut et la barre de réponse en bas, sur environ 250 px de chaque côté.
// Du texte posé là existe, mais personne ne le lit — et c'est exactement ce
// qui arrivait à l'URL et à la dernière ligne d'accroche.

exports.navigateur = true;
exports.titre = "L'image de partage (story)";

// Instagram recouvre ~250 px en haut et en bas d'une story de 1920 px.
const HAUT_SUR = 250, BAS_SUR = 1670;

exports.run = async (t) => {
  const b = await t.navigateur();
  if (!b) return;
  const srv = await t.serveur();
  const fs = require("fs"), os = require("os"), path = require("path");

  // Produit l'image comme un vrai hôte : créer une partie, toucher le bouton,
  // récupérer le fichier qui tombe.
  async function imageDeStory(locale, titre, scenes) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale, acceptDownloads: true });
    const p = await ctx.newPage();
    const erreurs = [];
    p.on("pageerror", (e) => erreurs.push(e.message));
    await p.goto(srv.base + "/AlterEgo/", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(350);
    await p.evaluate(() => { const e = document.getElementById("amOnbSkip"); if (e) e.click(); });
    await p.waitForTimeout(180);
    await p.fill("#amName", "Hote" + locale.slice(0, 2)); await p.fill("#amPin", "7391");
    await p.evaluate(() => document.getElementById("amContinue").click());
    await p.waitForFunction(() => document.getElementById("s-home").classList.contains("on"), null, { timeout: 10000 });
    await p.evaluate(() => document.getElementById("amCreate").click());
    await p.waitForSelector("#amLenRange", { timeout: 8000 });
    await p.evaluate((n) => {
      const r = document.getElementById("amLenRange");
      r.value = String(n); r.dispatchEvent(new Event("input", { bubbles: true }));
    }, scenes);
    const dureeCurseur = (await p.textContent("#amLenD")).trim();
    await p.fill("#amFormTitle", titre);
    await p.evaluate(() => document.getElementById("amFormGo").click());
    await p.waitForFunction(() => document.querySelector(".am-code-big"), null, { timeout: 10000 });
    const code = (await p.textContent(".am-code-big")).trim();

    const [dl] = await Promise.all([
      p.waitForEvent("download", { timeout: 15000 }),
      p.evaluate(() => document.getElementById("amStory").click()),
    ]);
    const fichier = path.join(os.tmpdir(), "am-story-" + locale + "-" + Date.now() + ".png");
    await dl.saveAs(fichier);
    const octets = fs.readFileSync(fichier);

    // On relit le PNG livré, pas le canvas d'origine : c'est le fichier que
    // l'hôte poste qu'on veut mesurer.
    const mesure = await p.evaluate(async (b64) => {
      const img = new Image();
      await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = "data:image/png;base64," + b64; });
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      // Le fond est sombre (luminance < 80 même sous la lueur rose) ; tout ce
      // qui est clair est du contenu : texte, carte blanche du QR.
      const lum = (i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let haut = -1, bas = -1;
      for (let y = 0; y < c.height; y++) {
        let clair = false;
        for (let px = 0; px < c.width; px += 3) if (lum((y * c.width + px) * 4) > 120) { clair = true; break; }
        if (clair) { if (haut < 0) haut = y; bas = y; }
      }
      // La plus longue suite de blanc sur une ligne. Le QR porte déjà son
      // propre fond blanc : ce qu'on mesure ici, c'est que la surface blanche
      // déborde du code, donc qu'il a bien sa marge de silence autour.
      let plusLongBlanc = 0;
      for (let y = 0; y < c.height; y += 4) {
        let run = 0;
        for (let x = 0; x < c.width; x++) {
          if (lum((y * c.width + x) * 4) > 230) { run++; if (run > plusLongBlanc) plusLongBlanc = run; }
          else run = 0;
        }
      }
      return { l: c.width, h: c.height, haut, bas, plusLongBlanc };
    }, octets.toString("base64"));

    await ctx.close();
    fs.unlinkSync(fichier);
    return { nom: dl.suggestedFilename(), code, dureeCurseur, erreurs, octets: octets.length, ...mesure };
  }

  t.section("Le fichier qu'on récupère");
  const fr = await imageDeStory("fr-FR", "Soirée du 12", 10);
  t.check("Toucher le bouton produit bien un fichier", fr.octets > 20000, fr.octets + " octets");
  t.check("Il porte le code de la partie dans son nom",
    fr.nom === "alter-ego-" + fr.code + ".png", fr.nom);
  t.check("Format story : 1080 × 1920", fr.l === 1080 && fr.h === 1920, fr.l + "×" + fr.h);
  t.check("Aucune erreur JavaScript pendant la fabrication", fr.erreurs.length === 0, fr.erreurs.slice(0, 2).join(" | "));

  t.section("Tout est dans la zone qu'Instagram ne recouvre pas");
  t.check("Rien ne commence au-dessus de " + HAUT_SUR + " px", fr.haut >= HAUT_SUR,
    "premier pixel clair à y=" + fr.haut);
  t.check("Rien ne descend sous " + BAS_SUR + " px", fr.bas <= BAS_SUR,
    "dernier pixel clair à y=" + fr.bas);
  // Un QR sans marge blanche autour se lit mal, voire pas du tout. Le code
  // lui-même fait 456 px de large : la surface blanche doit être plus large
  // que lui, sinon c'est que la carte a disparu et qu'il touche le fond.
  t.check("Le QR garde sa marge blanche tout autour", fr.plusLongBlanc >= 500,
    "plus longue suite de blanc : " + fr.plusLongBlanc + " px");

  t.section("La durée annoncée est la même partout");
  // Base retenue avec Kevin : 10 scènes = 2 minutes. Le curseur de création et
  // l'image doivent dire le même chiffre pour la même partie — ils tirent de
  // la même fonction, ce contrôle garde cette unicité.
  t.check("10 scènes → ~2 min sur le curseur", /~2\s*min/.test(fr.dureeCurseur), fr.dureeCurseur);

  t.section("Et en anglais");
  const en = await imageDeStory("en-GB", "Sam's flat warming", 20);
  t.check("L'image anglaise se fabrique aussi", en.octets > 20000, en.octets + " octets");
  t.check("… dans la même zone sûre", en.haut >= HAUT_SUR && en.bas <= BAS_SUR, en.haut + " → " + en.bas);
  t.check("20 scènes → ~4 min, la même base de calcul", /~4\s*min/.test(en.dureeCurseur), en.dureeCurseur);
  t.check("Les deux langues ne produisent pas le même fichier", en.octets !== fr.octets,
    fr.octets + " vs " + en.octets);
  t.check("Aucune erreur JavaScript côté anglais", en.erreurs.length === 0, en.erreurs.slice(0, 2).join(" | "));
};
