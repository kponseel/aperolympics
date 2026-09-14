// Le nom et la marque du jeu.
//
// Le jeu s'appelait « Are We A Match ? », son icône était un cœur percé d'une
// flèche de Cupidon, et son adresse disait /AreWeAMatch. Partagé en story ou
// envoyé à un ami, il passait pour une appli de rencontre — alors qu'on y joue
// à dix. Tout a changé d'un coup : nom, icône, chemin.
//
// Un changement de nom se défait tout seul. Il suffit d'une chaîne recopiée
// depuis un ancien bout de code, d'un emoji remis « parce qu'il allait bien »,
// et l'ancienne identité repousse par endroits — sans que rien ne casse, donc
// sans que personne ne le voie. Ces contrôles sont là pour ça.
//
// Ils ne regardent QUE ce qui part chez le joueur. Les commentaires qui
// racontent l'histoire du renommage sont non seulement tolérés, ils sont
// utiles : c'est eux qui expliquent pourquoi l'ancien chemin est encore servi.

const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..", "..");
const FRONT = path.join(RACINE, "public", "AlterEgo");
const lire = (f) => fs.readFileSync(path.join(FRONT, f), "utf8");

exports.titre = "Le nom et la marque";

exports.run = async (t) => {
  const app = lire("app.js");
  const dico = lire("i18n.js");
  const html = lire("index.html");
  const css = lire("style.css");

  t.section("Plus rien ne dit « rencontre »");
  // 💘 (cœur percé d'une flèche) et 💞 (cœurs qui tournent) : les deux emojis
  // qui portaient le malentendu. Un seul qui revient dans un libellé de
  // résultat, et la capture d'écran qu'on partage le redit.
  for (const [nom, contenu] of [["app.js", app], ["i18n.js", dico], ["index.html", html], ["style.css", css]]) {
    const trouves = (contenu.match(/[\u{1F498}\u{1F49E}\u{1F49D}\u{1F496}\u{1F49F}\u{2764}]/gu) || []);
    t.check("Aucun emoji « amoureux » dans " + nom, trouves.length === 0, trouves.join(" "));
  }
  const svg = fs.readFileSync(path.join(RACINE, "public", "icons", "am-icon.svg"), "utf8");
  t.check("L'icône n'est plus un cœur", !/cœur/i.test(svg.replace(/<!--[\s\S]*?-->/g, "")) && !/M50,88/.test(svg),
    "le tracé du cœur est encore dans public/icons/am-icon.svg");

  t.section("L'ancien nom ne s'affiche plus");
  // Dans le front, « Are We A Match » ne doit plus exister DU TOUT : même en
  // commentaire, il finirait recopié dans une chaîne un jour ou l'autre.
  // Sauf là où on raconte l'histoire — une seule ligne, en tête d'app.js.
  const sansHistoire = app.split("\n").filter((l) => !/ex « Are We A Match/.test(l)).join("\n");
  t.check("app.js ne porte plus l'ancien nom", !/Are We A Match/.test(sansHistoire),
    (sansHistoire.match(/.{0,40}Are We A Match.{0,20}/) || [])[0]);
  for (const [nom, contenu] of [["i18n.js", dico], ["index.html", html], ["style.css", css]]) {
    t.check(nom + " non plus", !/Are We A Match/.test(contenu),
      (contenu.match(/.{0,40}Are We A Match.{0,20}/) || [])[0]);
  }

  t.section("Le nom est écrit pareil dans les deux langues");
  // C'est la raison d'être de ce nom-là : une seule marque, qui n'a pas à être
  // traduite. Si une entrée du dictionnaire se mettait à dire autre chose en
  // anglais, la marque se dédoublerait sans prévenir.
  const D = (() => {
    const m = /var\s+DICO\s*=\s*\{([\s\S]*?)\n\s*\};/.exec(dico) || /=\s*\{([\s\S]*)\}/.exec(dico);
    const paires = {};
    const re = /"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let x;
    while ((x = re.exec(m ? m[1] : dico))) paires[x[1]] = x[2];
    return paires;
  })();
  const avecMarque = Object.keys(D).filter((k) => /Alter Ego/.test(k));
  t.check("Des entrées du dictionnaire portent la marque", avecMarque.length >= 3, String(avecMarque.length));
  const traduitLaMarque = avecMarque.filter((k) => !/Alter Ego/.test(D[k]));
  t.check("… et aucune ne la traduit", traduitLaMarque.length === 0,
    traduitLaMarque.map((k) => k.slice(0, 40) + " → " + D[k].slice(0, 40)).join(" | "));

  t.section("La page s'annonce sous le bon nom");
  t.check("Le titre de l'onglet", /<title>Alter Ego<\/title>/.test(html));
  t.check("Le nom de l'app installée", /apple-mobile-web-app-title" content="Alter Ego"/.test(html));
  t.check("Le manifeste pointe le nouveau chemin", /href="\/AlterEgo\/app\.webmanifest"/.test(html));
  const man = JSON.parse(lire("manifest.webmanifest"));
  t.check("Le manifeste porte le nom, pas une phrase", man.name === "Alter Ego" && man.short_name === "Alter Ego",
    man.name + " / " + man.short_name);
  t.check("… et sa portée est le nouveau chemin", man.scope === "/AlterEgo/" && man.start_url === "/AlterEgo/",
    man.scope + " / " + man.start_url);

  t.section("Ce que l'app fabrique porte le nouveau chemin");
  // Les liens partagés, le QR, l'image de story : tous construits à partir de
  // gameUrl(). S'il repassait sur l'ancien chemin, tout continuerait de
  // marcher — et chaque partage rediffuserait l'ancien nom pendant des mois.
  t.check("gameUrl() part de la constante BASE", /function gameUrl\(code\)\s*\{\s*return location\.origin \+ BASE/.test(app));
  t.check("BASE est le nouveau chemin", /var BASE = "\/AlterEgo";/.test(app));
  t.check("Le fichier de la story porte le nouveau nom", /var nom = "alter-ego-" \+ g\.code/.test(app));
  // L'ancien chemin reste LU — sinon un vieux QR ouvrirait l'accueil au lieu
  // de la partie. C'est le seul endroit du client qui a le droit de le citer.
  t.check("… mais l'ancien chemin est encore reconnu à la lecture",
    /AlterEgo\|AreWeAMatch/.test(app), "codeFromUrl() doit accepter les deux");
};
