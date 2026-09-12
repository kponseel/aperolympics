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
  // Espace insécable en français ; l'anglais garde la même convention pour ne
  // pas casser une ligne au mauvais endroit.
  const mauvais = toutes.filter((q) => LANGUES.some((l) => /« | »/.test(q[l].q + q[l].ctx + q[l].o.join(""))));
  t.check("Les guillemets ont partout une espace insécable", mauvais.length === 0, mauvais.map((q) => q.id).join(" "));

  games._reset();
};
