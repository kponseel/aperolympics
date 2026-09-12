// Le stockage : où vivent les comptes et les parties, et comment on évite de
// les perdre.
//
// Deux incidents ont façonné ce fichier :
//   - les données vivaient à côté du code, donc chaque déploiement les
//     effaçait. D'où DATA_DIR, puis ~/.aperolympics, et jamais le dossier de
//     l'application ;
//   - un fichier illisible (disque plein, écriture coupée) était écrasé par la
//     sauvegarde suivante et la panne devenait définitive. Un rename() ne
//     demande le droit d'écrire QUE sur le dossier, jamais sur le fichier
//     remplacé : c'est ce mécanisme qui détruisait, il est maintenant détourné
//     pour METTRE DE CÔTÉ le fichier au lieu de le perdre.

const fs = require("fs");
const path = require("path");
const { RACINE } = require("../lib/harness");

exports.titre = "Le stockage des données";

exports.run = async (t) => {
  const { storage, data } = t.modules();
  const ailleurs = path.join(t.dossierDonnees(), "jamais-ici.json");   // l'ancien emplacement

  t.section("Où les données atterrissent");
  const boite = storage.open("essai", ailleurs);
  t.check("open() rend une boîte avec read, write et describe",
    boite && typeof boite.read === "function" && typeof boite.write === "function" && typeof boite.describe === "function");
  t.check("Elle écrit dans DATA_DIR, pas à côté du code",
    boite.describe().file.startsWith(data), boite.describe().file);
  t.check("… et le dit dans describe()", boite.describe().source === "DATA_DIR", boite.describe().source);
  t.check("Rien n'a été créé à l'ancien emplacement", !fs.existsSync(ailleurs));

  t.section("Écrire et relire");
  t.check("Une écriture réussit", boite.write({ version: 1, items: { a: 1 } }) === true);
  t.check("… et se relit à l'identique", JSON.parse(JSON.stringify(boite.read())).items.a === 1);
  // L'écriture passe par un fichier temporaire puis un rename : un crash au
  // mauvais moment ne doit jamais laisser un fichier à moitié écrit.
  t.check("Aucun fichier temporaire ne traîne après l'écriture",
    !fs.readdirSync(data).some((f) => f.endsWith(".tmp")), fs.readdirSync(data).join(" "));

  t.section("Un fichier illisible est mis de côté, jamais détruit");
  const b2 = storage.open("casse", path.join(t.dossierDonnees(), "vieux.json"));
  const fichier = b2.describe().file;
  const contenu = '{ ceci n\'est pas du JSON';
  fs.writeFileSync(fichier, contenu);
  let leve = false, lu;
  try { lu = b2.read(); } catch (e) { leve = true; }
  t.check("Lire un fichier corrompu ne fait pas planter le serveur", !leve);
  t.check("… et rend null plutôt que du n'importe quoi", lu === null, JSON.stringify(lu));
  const quarantaine = fs.readdirSync(data).filter((f) => f.startsWith("casse") && f.includes(".corrupt-"));
  t.check("Le fichier abîmé est mis en quarantaine", quarantaine.length === 1, fs.readdirSync(data).join(" "));
  t.check("… avec son contenu d'origine, intact",
    quarantaine.length === 1 && fs.readFileSync(path.join(data, quarantaine[0]), "utf8") === contenu);
  t.check("… et il n'est plus à sa place, donc la prochaine écriture ne l'écrase pas",
    !fs.existsSync(fichier));
  t.check("L'incident est rapporté par describe(), pour l'écran d'admin",
    b2.describe().readError && b2.describe().readError.code === "EINVALID_JSON", JSON.stringify(b2.describe().readError));
  t.check("Et on peut écrire de nouveau ensuite", b2.write({ version: 1, items: {} }) === true);

  t.section("Les parties survivent à un redémarrage du serveur");
  const g1 = require(path.join(RACINE, "server/match/games.js"));
  const partie = g1.createGame({ hostName: "Kevin" }).game;
  g1.answer(partie.code, "Kevin", partie.sceneIds[0], [0, 1, 2]);
  if (g1.flush) g1.flush();

  // Recharger les modules en pointant sur le MÊME dossier : c'est exactement
  // ce que fait un redémarrage.
  const dossier = process.env.DATA_DIR;
  const prefixe = path.join(RACINE, "server") + path.sep;
  for (const k of Object.keys(require.cache)) if (k.startsWith(prefixe)) delete require.cache[k];
  process.env.DATA_DIR = dossier;
  const g2 = require(path.join(RACINE, "server/match/games.js"));

  const relue = g2.getGame(partie.code);
  t.check("La partie est retrouvée", !!relue, partie.code);
  t.check("… avec ses scènes dans le même ordre", relue && relue.sceneIds.join() === partie.sceneIds.join());
  t.check("… et la réponse déjà donnée",
    relue && relue.players.kevin && relue.players.kevin.answers[partie.sceneIds[0]].join() === "0,1,2");
  g2._reset();
};
