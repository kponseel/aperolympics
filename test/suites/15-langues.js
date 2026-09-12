// Les deux langues, et surtout : leur ALIGNEMENT.
//
// Un classement est un tableau d'indices dans `o`. Si l'option 0 désigne « la
// bouffe » en français et « travel » en anglais, deux joueurs d'accord sont
// comptés en désaccord, et le score de compatibilité devient du bruit — sans
// que personne ne s'en aperçoive en jouant. C'est la même classe de défaut que
// recycler un id de scène.
//
// Le garde-fou le plus sûr est l'EMOJI de tête : chaque option porte le même
// dans les deux langues. Il ne prouve pas que la traduction est bonne, mais il
// prouve que les options n'ont pas glissé.

exports.titre = "Français et anglais";

exports.run = async (t) => {
  const { games, packs } = t.modules();
  const toutes = [];
  for (const k of ["amis", "date", "piquant"]) toutes.push(...packs[k].bank);

  const LANGUES = games.LANGS || ["fr", "en"];
  const tete = (s) => { const m = /^(\S+)\s/.exec(s || ""); return m ? m[1] : null; };

  t.section("Chaque scène existe dans les deux langues");
  const incompletes = toutes.filter((q) => LANGUES.some((l) => {
    const b = q[l];
    return !b || !b.q || !b.q.trim() || !b.ctx || !b.ctx.trim() || !Array.isArray(b.o) || b.o.length !== 3 || b.o.some((o) => !String(o).trim());
  }));
  t.check("Les " + toutes.length + " scènes sont complètes en " + LANGUES.join(" et "),
    incompletes.length === 0, incompletes.map((q) => q.id).join(" "));

  t.section("L'alignement des options — le point critique");
  const glissees = [];
  for (const q of toutes) {
    if (!q.fr || !q.en || q.fr.o.length !== 3 || q.en.o.length !== 3) continue;
    for (let i = 0; i < 3; i++) {
      if (tete(q.fr.o[i]) !== tete(q.en.o[i]))
        glissees.push(q.id + "[" + i + "] " + tete(q.fr.o[i]) + " ≠ " + tete(q.en.o[i]));
    }
  }
  t.check("Chaque option porte le même emoji dans les deux langues", glissees.length === 0, glissees.slice(0, 5).join(" | "));

  t.section("L'anglais respecte les mêmes règles que le français");
  const trop = [];
  for (const q of toutes) for (const l of LANGUES) {
    const b = q[l];
    if (b.q.length > 62) trop.push(q.id + " [" + l + "] question " + b.q.length);
    if (b.ctx.length > 150) trop.push(q.id + " [" + l + "] ctx " + b.ctx.length);
    b.o.forEach((o, i) => { if (o.length > 55) trop.push(q.id + " [" + l + "] option " + i + " : " + o.length); });
  }
  t.check("Questions ≤ 62, contextes ≤ 150, options ≤ 55 caractères", trop.length === 0, trop.slice(0, 5).join(" | "));

  const sansEmoji = [];
  for (const q of toutes) for (const l of LANGUES)
    q[l].o.forEach((o, i) => { if (/^[\w\d«"'(\[]/.test(o)) sansEmoji.push(q.id + " [" + l + "] " + i); });
  t.check("Chaque option commence par un emoji, dans les deux langues", sansEmoji.length === 0, sansEmoji.slice(0, 5).join(" | "));

  // Sans le sens du classement, le joueur ne sait pas ce qu'il range — et deux
  // joueurs qui le devinent à l'envers sont comptés en désaccord.
  const sansSensFr = toutes.filter((q) => !/(?:^|[\s.])(du|de|des)\s[^.]*\s(au|aux|à)\s[^.]*\.$/i.test(q.fr.ctx));
  t.check("Chaque contexte français dit le sens du classement", sansSensFr.length === 0, sansSensFr.map((q) => q.id).join(" "));
  const sansSensEn = toutes.filter((q) => !/\bfrom\b[^.]*\bto\b[^.]*\.$/i.test(q.en.ctx));
  t.check("Chaque contexte anglais aussi (« From … to … »)", sansSensEn.length === 0, sansSensEn.map((q) => q.id).join(" "));

  t.section("Pas de français resté dans l'anglais");
  // « café » est un mot anglais : on retire les emprunts légitimes avant de
  // chercher des accents. Les guillemets « » sont voulus, ils citent une
  // réplique.
  const EMPRUNTS = /caf[eé]s?|clich[eé]s?|r[eé]sum[eé]s?|na[iï]ve|fianc[eé]e?|d[eé]j[aà] vu|[eé]clair/gi;
  const restes = [];
  for (const q of toutes) {
    const texte = (q.en.q + " " + q.en.ctx + " " + q.en.o.join(" "))
      .replace(/[«» ]/g, "").replace(EMPRUNTS, "");
    const acc = texte.match(/[éèêëàâçùûôîïÉÈÀÇ]/g);
    if (acc) restes.push(q.id + " : " + acc.join("") + " dans « " + texte.slice(0, 50) + " »");
  }
  t.check("Aucun accent français ne traîne dans l'anglais", restes.length === 0, restes.slice(0, 4).join(" | "));

  t.section("Aucune scène n'est écrite deux fois");
  for (const l of LANGUES) {
    const qs = toutes.map((q) => q[l].q);
    const dup = [...new Set(qs.filter((x, i) => qs.indexOf(x) !== i))];
    t.check("Aucune question en double en " + l, dup.length === 0, dup.join(" | "));
  }

  t.section("La typographie des guillemets");
  // Chaque langue cite avec SES signes. Un anglophone qui lit « ok » voit de la
  // typographie française au milieu de sa phrase : la traduction n'est pas
  // finie tant que les guillemets ne le sont pas. Vingt-cinq chaînes étaient
  // dans ce cas.
  const txt = (q, l) => q[l].q + " " + q[l].ctx + " " + q[l].o.join(" ");
  const frDansEn = toutes.filter((q) => /[«»]/.test(txt(q, "en")));
  t.check("Aucun guillemet français dans l'anglais", frDansEn.length === 0, frDansEn.map((q) => q.id).join(" "));
  const enDansFr = toutes.filter((q) => /[“”]/.test(txt(q, "fr")));
  t.check("… ni de guillemet anglais dans le français", enDansFr.length === 0, enDansFr.map((q) => q.id).join(" "));
  // Espace insécable en français : sans elle la ligne casse entre « et le mot.
  const mauvais = toutes.filter((q) => /« | »/.test(txt(q, "fr")));
  t.check("Les guillemets français ont partout une espace insécable", mauvais.length === 0, mauvais.map((q) => q.id).join(" "));
  // Et ils vont par paires : un ouvrant orphelin passe inaperçu à la lecture.
  const depareilles = [];
  for (const q of toutes) {
    const f = txt(q, "fr"), e = txt(q, "en");
    if ((f.match(/«/g) || []).length !== (f.match(/»/g) || []).length) depareilles.push(q.id + " [fr]");
    if ((e.match(/“/g) || []).length !== (e.match(/”/g) || []).length) depareilles.push(q.id + " [en]");
  }
  t.check("Chaque guillemet ouvrant a son fermant", depareilles.length === 0, depareilles.join(" "));

  // ---- Le dictionnaire de l'interface ----
  //
  // T() retombe sur le français quand la clé manque. C'est le bon repli en
  // production — mais ça veut dire qu'une chaîne oubliée ne casse RIEN : elle
  // s'affiche en français à un anglophone, et personne ne le voit passer.
  // D'où ce contrôle statique.
  const fs = require("fs"), path = require("path");
  const racine = path.join(__dirname, "..", "..", "public", "AreWeAMatch");
  const lire = (f) => fs.readFileSync(path.join(racine, f), "utf8");
  const fenetre = {};
  new Function("window", lire("i18n.js"))(fenetre);
  const dico = fenetre.AM_I18N.en;
  // Les commentaires sont retirés AVANT toute analyse : celui qui documente
  // T() contient « T("…") » en exemple, et serait lu comme un vrai appel.
  const sansCommentaires = (src) => src.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const appjs = sansCommentaires(lire("app.js"));
  const html = lire("index.html");

  // Le littéral est récupéré BRUT puis évalué : sinon « \' » et « \\ » sont
  // relus de travers et la clé cherchée n'est pas celle du code.
  const litteral = /(?<![A-Za-z0-9_$])T\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  const dures = new Set();
  let m2;
  while ((m2 = litteral.exec(appjs))) dures.add(new Function("return " + m2[1])());
  // Les paliers passent par T(PALIERS[…]) : leur texte n'est pas un littéral
  // de T(), il faut aller le chercher dans l'objet.
  const mp = /var PALIERS = \{([\s\S]*?)\};/.exec(appjs);
  const paliers = mp ? (mp[1].match(/"((?:[^"\\]|\\.)*)"/g) || []).map((s) => JSON.parse(s)) : [];
  for (const p of paliers) dures.add(p);

  t.section("Le dictionnaire de l'interface");
  t.check("Des chaînes traduisibles ont bien été trouvées dans app.js", dures.size > 100, String(dures.size));
  const manquantes = [...dures].filter((s) => s && s !== "—" && dico[s] == null);
  t.check("Chaque T(\"…\") d'app.js a sa traduction anglaise", manquantes.length === 0,
    manquantes.slice(0, 4).map((s) => JSON.stringify(s.slice(0, 45))).join(" | "));
  t.check("Les paliers de compatibilité sont traduits", paliers.filter((p) => p !== "—" && dico[p] == null).length === 0);

  // Une clé que plus personne n'utilise est le symptôme d'une phrase reformulée
  // d'un seul côté : le français a bougé, l'anglais est resté sur l'ancienne
  // version, et le joueur anglophone lit du français.
  const plat = (s) => s.replace(/\s+/g, " ").trim();
  const htmlPlat = plat(html);
  const orphelines = Object.keys(dico).filter((k) => !dures.has(k) && htmlPlat.indexOf(plat(k)) < 0);
  t.check("Aucune clé ne traîne sans personne pour l'utiliser", orphelines.length === 0,
    orphelines.slice(0, 4).map((s) => JSON.stringify(s.slice(0, 45))).join(" | "));

  // Un trou perdu à la traduction fait disparaître une variable de la phrase :
  // « Join 's game » au lieu de « Join Marie's game ».
  const trous = (s) => (s.match(/%\d/g) || []).sort().join("");
  const casses = Object.keys(dico).filter((k) => trous(k) !== trous(dico[k]));
  t.check("Les trous (%1, %2…) sont les mêmes des deux côtés", casses.length === 0,
    casses.slice(0, 3).map((k) => JSON.stringify(k.slice(0, 40)) + " : " + trous(k) + " ≠ " + trous(dico[k])).join(" | "));

  // Même règle que pour les scènes : une phrase anglaise ne cite pas à la
  // française.
  const guilUi = Object.entries(dico).filter(([, v]) => /[«»]/.test(v));
  t.check("Aucun guillemet français dans l'interface anglaise", guilUi.length === 0,
    guilUi.slice(0, 3).map(([, v]) => JSON.stringify(v.slice(0, 45))).join(" | "));

  // Le piège le plus vicieux : une phrase française que PERSONNE n'a pensé à
  // envelopper dans T(). Le dictionnaire est complet, tous les contrôles
  // ci-dessus passent, et l'anglophone lit quand même « 3 autres joueurs » au
  // milieu de sa phrase. Rien ne la signale, sauf ceci.
  //
  // Une regexp ne suffit pas ici : les apostrophes des commentaires et les
  // littéraux régexp (/[&<>"']/g) ouvrent de fausses chaînes et noient le
  // résultat. On relit donc le fichier caractère par caractère.
  const chaines = lireChaines(fs.readFileSync(path.join(racine, "app.js"), "utf8"));
  const FRANCAIS = /[éèêàçôûîï]|\b(les?|la|une?|des|du|de|et|tu|on|dans|pour|avec|sans|que|qui|est|sont|pas|ne|se|sa|son|ses|ce|cette|autres?|joueurs?|parties?|réponses?|dont|déjà|tout|tous|rien|très|encore|aussi|mais|donc|alors|quand|comme|ton|ta|tes)\b/i;
  // Ce qui n'est pas de la prose : sélecteurs, classes, attributs, urls.
  const TECHNIQUE = /^[#.\/?&=_a-zA-Z0-9:@%+\- ]*$|am-|^data-|^https?:/;
  // Les noms de mois et de langues restent dans leur langue, par définition.
  const mm = /var MOIS = \{([\s\S]*?)\};/.exec(appjs);
  const permis = new Set(["Français", "English"]);
  for (const s of (mm ? mm[1].match(/"((?:[^"\\]|\\.)*)"/g) || [] : [])) permis.add(JSON.parse(s));

  const nues = [];
  for (const c of chaines) {
    if (dures.has(c.val) || permis.has(c.val) || c.val.length < 4) continue;
    if (TECHNIQUE.test(c.val)) continue;
    // Le texte visible d'un bloc HTML compte, ses balises non.
    const visible = c.val.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (visible.length < 4 || !FRANCAIS.test(visible)) continue;
    nues.push("l." + c.ligne + " " + JSON.stringify(c.val.slice(0, 40)));
  }
  t.check("Aucune phrase française n'échappe à T()", nues.length === 0,
    nues.length + " restante(s) : " + nues.slice(0, 5).join(" | "));

  // Une clé tronquée ne se voit pas : elle reste une sous-chaîne valide du
  // fichier source, donc elle n'a l'air ni orpheline ni manquante — mais elle
  // ne correspond plus à ce que le navigateur calcule, et la phrase s'affiche
  // en français. C'est arrivé à « 🔒 Ton code de reprise <span…>(4 chiffres) »,
  // amputée de son </span> : le libellé du code de reprise n'a jamais été
  // traduit. Les balises d'une clé doivent donc être équilibrées.
  const desequilibre = (s) => {
    const ouvrants = (s.match(/<([a-z]+)(?: [^>]*)?>/g) || []).map((x) => /<([a-z]+)/.exec(x)[1]).filter((n) => n !== "br");
    const fermants = (s.match(/<\/([a-z]+)>/g) || []).map((x) => /<\/([a-z]+)/.exec(x)[1]);
    return ouvrants.sort().join(",") !== fermants.sort().join(",");
  };
  //
  // Ne concerne QUE les clés venues d'index.html (les data-t) : là, la clé est
  // comparée à ce que le navigateur calcule pour innerHTML, donc elle doit
  // être un bloc complet. Les clés d'app.js, elles, sont légitimement des
  // morceaux de phrase — le littéral du code EST la clé, l'égalité est exacte.
  // (Ces morceaux restent fragiles pour d'autres raisons ; c'est un autre
  // chantier, pas une régression.)
  const tronquees = [];
  for (const [k, v] of Object.entries(dico)) {
    if (dures.has(k)) continue;                       // clé d'app.js : fragment autorisé
    if (htmlPlat.indexOf(plat(k)) < 0) continue;      // ni app.js ni index.html : déjà signalée
    if (desequilibre(k)) tronquees.push("clé : " + k.slice(0, 60));
    else if (desequilibre(v)) tronquees.push("traduction de : " + k.slice(0, 60));
  }
  t.check("Les blocs d'index.html ne sont pas tronqués dans le dictionnaire", tronquees.length === 0,
    tronquees.slice(0, 3).join(" | "));

  // Les blocs HTML traduits gardent leurs id : c'est le code qui s'y accroche.
  const idsCasses = [];
  for (const [k, v] of Object.entries(dico)) {
    const ids = (s) => (s.match(/id="[^"]+"/g) || []).sort().join(" ");
    if (ids(k) !== ids(v)) idsCasses.push(k.slice(0, 40));
  }
  t.check("Les id des blocs HTML survivent à la traduction", idsCasses.length === 0, idsCasses.slice(0, 3).join(" | "));

  games._reset();
};

// Toutes les chaînes littérales d'un fichier JavaScript, avec leur ligne.
// Assez d'analyse pour ne pas se faire piéger : commentaires de ligne et de
// bloc, littéraux régexp (celui de esc() contient des guillemets), gabarits.
function lireChaines(src) {
  const out = [];
  const avantRegexp = /[(,=:[!&|?{};+\-*/%~^<>]/;
  let i = 0, ligne = 1, precedent = "";
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { ligne++; i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") ligne++; i++; }
      i += 2; continue;
    }
    // Une barre oblique après un opérateur ouvre une régexp, pas une division.
    if (c === "/" && avantRegexp.test(precedent)) {
      i++;
      while (i < src.length && src[i] !== "/") { if (src[i] === "\\") i++; i++; }
      i++;
      while (/[gimsuy]/.test(src[i] || "")) i++;
      precedent = "/"; continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c, l0 = ligne;
      let val = ""; i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\\") {
          // \uXXXX doit être rendu : sinon « quelqu’un » ne ressemble plus
          // à la chaîne que T() reçoit, et la clé paraît absente du code.
          const suite = src[i + 1];
          if (suite === "u") { val += String.fromCharCode(parseInt(src.substr(i + 2, 4), 16)); i += 6; continue; }
          if (suite === "x") { val += String.fromCharCode(parseInt(src.substr(i + 2, 2), 16)); i += 4; continue; }
          val += { n: "\n", t: "\t", r: "\r" }[suite] || suite;
          i += 2; continue;
        }
        if (src[i] === "\n") ligne++;
        val += src[i]; i++;
      }
      i++;
      out.push({ val, ligne: l0 });
      precedent = q; continue;
    }
    if (!/\s/.test(c)) precedent = c;
    i++;
  }
  return out;
}
