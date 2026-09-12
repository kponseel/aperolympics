// La banque de scènes : ce qui doit rester vrai quoi qu'on y ajoute.
//
// Deux règles valent plus cher que les autres :
//   - un id de scène ne se recycle JAMAIS. Une réponse mémorisée est un index
//     dans `o` rangé par `id` : réutiliser un id, ou réordonner les options
//     d'une scène existante, rend fausses toutes les compatibilités passées,
//     en silence ;
//   - chaque `ctx` doit dire DANS QUEL SENS classer. Sans ça deux joueurs
//     d'accord peuvent être comptés en désaccord.

const { lire } = require("../lib/harness");

exports.titre = "La banque de scènes";

exports.run = async (t) => {
  const { games, packs } = t.modules();

  const toutes = [];
  for (const k of ["amis", "date", "piquant"]) toutes.push(...packs[k].bank);

  t.section("Intégrité");
  t.check("La banque n'est pas vide et games.js la voit entière",
    toutes.length > 100 && games.BANK_SIZE === toutes.length, games.BANK_SIZE + " vs " + toutes.length);

  const ids = toutes.map((q) => q.id);
  const doublons = ids.filter((x, i) => ids.indexOf(x) !== i);
  t.check("Tous les ids sont uniques à travers les packs", doublons.length === 0, doublons.join(" "));

  // pop_culture est désactivé, mais des réponses y sont archivées dans les
  // comptes : ses ids restent réservés.
  let popIds = [];
  try { popIds = require(require("path").join(require("../lib/harness").RACINE, "server/match/packs/pop_culture.js")).map((q) => q.id); } catch (e) {}
  const collisions = ids.filter((i) => popIds.includes(i));
  t.check("Aucun id ne rentre en collision avec le pack désactivé pop_culture",
    collisions.length === 0, collisions.join(" "));

  // La forme de chaque langue (options, longueurs, emojis, sens du classement,
  // typographie) est contrôlée par la suite 15-langues, POUR CHAQUE LANGUE.
  t.section("Forme");
  const AXES = ["gouts", "rythme", "argent", "autres", "vices", "agace"];
  const mauvaisAxe = toutes.filter((q) => !AXES.includes(q.axis));
  t.check("Chaque scène porte un axe connu", mauvaisAxe.length === 0, mauvaisAxe.map((q) => q.id + "=" + q.axis).join(" "));

  const PREFIXE = { gouts: "go", rythme: "ry", argent: "ar", autres: "au", vices: "vi", agace: "ag" };
  // amis.js est antérieur à la convention : ses 45 scènes gardent le préfixe am-.
  const mauvaisPrefixe = toutes.filter((q) => !q.id.startsWith("am-") && q.id.split("-")[0] !== PREFIXE[q.axis]);
  t.check("Le préfixe de l'id dit l'axe (sauf les 45 historiques en am-)",
    mauvaisPrefixe.length === 0, mauvaisPrefixe.map((q) => q.id + " / " + q.axis).join(" "));

  t.section("Ce qu'une scène n'a pas le droit de présupposer");
  // Une partie se joue aussi bien avec sa mère qu'avec son meilleur pote :
  // rien ne doit supposer que les deux joueurs forment un couple.
  // On vise le vocabulaire qui désigne L'AUTRE JOUEUR comme partenaire. Pas
  // « au lit » ni « en couple » dans l'absolu : un café apporté au lit peut
  // venir d'un parent, et une scène PEUT parler de la vie amoureuse du joueur
  // (« Rester ami avec un ex ») tant qu'elle ne suppose rien sur la paire.
  const COUPLE = /(ton copain|ta copine|ton conjoint|ta conjointe|ton\/ta partenaire|votre couple|vous deux, en couple|your partner|your boyfriend|your girlfriend|the two of you, as a couple)/i;
  const enCouple = toutes.filter((q) => ["fr", "en"].some((l) =>
    COUPLE.test(q[l].q + " " + q[l].ctx + " " + q[l].o.join(" "))));
  t.check("Aucune scène ne présuppose que vous êtes en couple tous les deux, dans aucune des deux langues",
    enCouple.length === 0, enCouple.map((q) => q.id).join(" "));

  t.section("Le tirage");
  const parAxe = {};
  for (const q of toutes) parAxe[q.axis] = (parAxe[q.axis] || 0) + 1;
  t.check("Les six axes existent", Object.keys(parAxe).length === 6, JSON.stringify(parAxe));

  // Le tirage prend 3 ou 4 scènes PAR AXE à chaque partie, quelle que soit la
  // taille de l'axe : un axe deux fois moins fourni ressert deux fois plus
  // souvent les mêmes scènes.
  const mini = Math.min(...Object.values(parAxe)), maxi = Math.max(...Object.values(parAxe));
  t.check("Aucun axe n'est deux fois moins fourni qu'un autre", maxi <= mini * 2, JSON.stringify(parAxe));

  const N = games.SCENES_PER_GAME;
  const vues = new Map();
  let axeManquant = 0, doublonInterne = 0, voisinsMemeAxe = 0;
  for (let i = 0; i < 60; i++) {
    const g = games.createGame({ hostName: "T" + i }).game;
    const scenes = g.sceneIds.map((id) => toutes.find((q) => q.id === id));
    if (new Set(g.sceneIds).size !== N) doublonInterne++;
    if (new Set(scenes.map((s) => s.axis)).size !== 6) axeManquant++;
    for (let j = 1; j < scenes.length; j++) if (scenes[j].axis === scenes[j - 1].axis) voisinsMemeAxe++;
    for (const id of g.sceneIds) vues.set(id, (vues.get(id) || 0) + 1);
  }
  t.check("Chaque partie tire bien " + N + " scènes distinctes", doublonInterne === 0, String(doublonInterne));
  t.check("Les 6 axes sont présents dans CHAQUE partie", axeManquant === 0, axeManquant + " partie(s) incomplète(s)");
  t.check("Jamais deux scènes du même axe l'une après l'autre", voisinsMemeAxe === 0, String(voisinsMemeAxe));
  t.check("Sur 60 parties, la banque est largement parcourue",
    vues.size > toutes.length * 0.8, vues.size + " scènes vues sur " + toutes.length);

  t.section("Ce qui sort vers le client");
  const g = games.createGame({ hostName: "Kevin" }).game;
  const envoyees = games.state(g.code, "Kevin").scenes;
  t.check("Une scène envoyée porte la question, le contexte et 3 options",
    envoyees.every((s) => s.q && s.ctx && Array.isArray(s.o) && s.o.length === 3));
  t.check("… mais pas son axe (il révélerait le plan de la partie)", envoyees.every((s) => s.axis === undefined));
  // `heat` note à quel point une scène demande un aveu : l'envoyer dirait au
  // joueur que la scène est gênante AVANT qu'il réponde.
  t.check("… ni son niveau de piment", envoyees.every((s) => s.heat === undefined));
  const avecHeat = toutes.filter((q) => q.heat != null);
  t.check("Quand une scène porte un piment, il vaut 1, 2 ou 3",
    avecHeat.every((q) => [1, 2, 3].includes(q.heat)), [...new Set(avecHeat.map((q) => q.heat))].join(","));

  t.section("Le fichier reste relisible par un humain");
  for (const f of ["amis", "date", "piquant"]) {
    const src = lire("server/match/packs/" + f + ".js");
    t.check(f + ".js s'ouvre sur un commentaire qui explique le fichier", /^\/\/ Are We A Match/.test(src));
  }

  games._reset();
};
