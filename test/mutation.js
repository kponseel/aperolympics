#!/usr/bin/env node
// Est-ce que les tests ont des dents ?
//
// Une suite verte ne prouve rien tant qu'on n'a pas vu ROUGE. Ce script casse
// le code volontairement, une fois par mutation, et vérifie que la suite
// concernée s'en aperçoit. Il restaure tout à la fin, quoi qu'il arrive.
//
//   npm run test:dents
//
// Si une mutation passe inaperçue, c'est le test qu'il faut renforcer, pas la
// mutation qu'il faut retirer.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const RACINE = path.resolve(__dirname, "..");

// [ fichier, texte à remplacer, remplacement, suite censée crier, ce qu'on casse ]
const MUTATIONS = [
  ["server/match/games.js",
    'if (p.answers[qid]) return { ok: false, reason: "already_answered" };',
    "",
    "30-parties",
    "on peut réécrire une réponse déjà validée"],

  ["server/match/games.js",
    "if (!me || !me.answers[qid]) return null;",
    "if (!me) return null;",
    "30-parties",
    "on voit les réponses des autres avant d'avoir répondu"],

  ["server/match/games.js",
    'if (!soleAnswerer(g, p, qid)) return { ok: false, reason: "revealed" };',
    "",
    "30-parties",
    "on peut revenir sur sa réponse après avoir vu celle des autres"],

  ["server/match/games.js",
    'if (g.closedAt) return { ok: false, reason: "closed" };',
    "",
    "30-parties",
    "fermer les inscriptions ne ferme plus rien"],

  ["server/match/players.js",
    "if (weakPin(pin)) return false;",
    "",
    "50-comptes",
    "les codes de reprise trop devinables repassent"],

  ["server/match/packs/piquant.js",
    '{ id: "vi-tentation"',
    '{ id: "am-weekend"',
    "10-banque",
    "un id de scène est recyclé (les réponses archivées deviennent fausses)"],

  ["public/AreWeAMatch/index.html",
    'style.css?v=',
    'style.css?vv=',
    "20-version",
    "une marque de version saute (le CDN resservira l'ancien fichier)"],

  ["public/AreWeAMatch/style.css",
    "--soft: #c3b9e0;",
    "--soft: #8b80ad;",
    "80-ecran",
    "le texte secondaire redevient trop pâle"],

  ["public/AreWeAMatch/style.css",
    "position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;",
    "position: static;",
    "80-ecran",
    "les notices retournent dans le flux et décalent la page"],

  ["public/AreWeAMatch/app.js",
    'navigator.share({ title: "Are We A Match ?", text: text })',
    'navigator.share({ title: "Are We A Match ?", text: text, url: text.split(" ").pop() })',
    "80-ecran",
    "le lien revient en double dans le partage"],

  ["public/AreWeAMatch/style.css",
    ".am-help { width: 44px; height: 44px;",
    ".am-help { width: 30px; height: 30px;",
    "80-ecran",
    "un bouton redevient trop petit pour un doigt"],

  ["server/match/index.js",
    "Number.isInteger(brut) && brut >= games.SCENE_MIN && brut <= games.SCENE_MAX ? brut : undefined",
    "brut",
    "35-longueur",
    "le serveur accepte n'importe quelle longueur envoyée par le client"],

  ["server/match/games.js",
    "? Math.max(SCENE_MIN, Math.min(SCENE_MAX, Math.floor(demande)))",
    "? Math.max(1, Math.min(SCENE_MAX, Math.floor(demande)))",
    "35-longueur",
    "une partie peut retomber à une seule scène (le score ne repose plus sur rien)"],

  ["server/match/games.js",
    "const SCENE_MAX = Math.min(50, BANK.length);",
    "const SCENE_MAX = BANK.length;",
    "35-longueur",
    "le plafond de 50 saute et une partie peut demander toute la banque"],

  // ---- les deux langues ----

  ["server/match/packs/piquant.js",
    "\u201cok\u201d to your long message",
    "\u00ab\u00a0ok\u00a0\u00bb to your long message",
    "15-langues",
    "une scène anglaise se remet à citer avec des guillemets français"],

  ["server/match/packs/amis.js",
    "\ud83e\udd50 Brunch, then a museum",
    "\ud83c\udfd4\ufe0f Brunch, then a museum",
    "15-langues",
    "une option anglaise glisse d\'un cran (les deux joueurs d\'accord sont compt\u00e9s en d\u00e9saccord)"],

  ["public/AreWeAMatch/app.js",
    'T("\ud83c\udfc1 Voir les r\u00e9sultats")',
    '"\ud83c\udfc1 Voir les r\u00e9sultats"',
    "15-langues",
    "une phrase fran\u00e7aise ressort sans T() (l\'anglophone la lit en fran\u00e7ais)"],

  ["public/AreWeAMatch/i18n.js",
    '"Annuler": "Cancel",',
    "",
    "15-langues",
    "une traduction dispara\u00eet du dictionnaire"],

  // Une cl\u00e9 venue d'index.html ampute\u00e9e de sa balise fermante : elle reste
  // une sous-cha\u00eene valide du fichier, donc ni orpheline ni manquante — mais
  // elle ne correspond plus \u00e0 ce que le navigateur calcule, et la phrase
  // s'affiche en fran\u00e7ais. C'est exactement ce qui \u00e9tait arriv\u00e9 au libell\u00e9
  // du code de reprise.
  ["public/AreWeAMatch/i18n.js",
    '(4 chiffres)</span>": "\ud83d\udd12 Your recovery code <span class=\\"am-soft\\">(4 digits)</span>',
    '(4 chiffres)": "\ud83d\udd12 Your recovery code <span class=\\"am-soft\\">(4 digits)',
    "15-langues",
    "une cl\u00e9 d'index.html est tronqu\u00e9e et la phrase reste en fran\u00e7ais"],

  // La langue du t\u00e9l\u00e9phone n'est plus lue au d\u00e9marrage : tout d\u00e9marre en
  // fran\u00e7ais, quel que soit le r\u00e9glage.
  ["public/AreWeAMatch/app.js",
    "    lang = langInitiale();",
    '    lang = "fr";',
    "96-tout-en-anglais",
    "la langue du t\u00e9l\u00e9phone est ignor\u00e9e au d\u00e9marrage"],
];

const lire = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");
const ecrire = (f, s) => fs.writeFileSync(path.join(RACINE, f), s);

function suiteEchoue(filtre) {
  try {
    execFileSync("node", [path.join(__dirname, "run.js"), filtre],
      { cwd: RACINE, stdio: ["ignore", "pipe", "pipe"], timeout: 180000 });
    return false;                                  // sortie 0 → la suite n'a rien vu
  } catch (e) {
    return true;                                   // sortie ≠ 0 → elle a crié
  }
}

const originaux = new Map();
let rates = 0;

process.on("exit", restaurer);
process.on("SIGINT", () => { restaurer(); process.exit(130); });
function restaurer() {
  for (const [f, s] of originaux) { try { ecrire(f, s); } catch (e) {} }
  originaux.clear();
}

console.log("On casse le code exprès, une fois par ligne, pour voir si les tests s'en aperçoivent.\n");

for (const [fichier, avant, apres, suite, quoi] of MUTATIONS) {
  const src = lire(fichier);
  if (!src.includes(avant)) {
    console.log("  \x1b[33m?\x1b[0m  " + quoi + "\n       → mutation impossible : le texte visé n'existe plus dans " + fichier +
                "\n         (« " + avant.slice(0, 60) + " ») — mutation à mettre à jour");
    rates++;
    continue;
  }
  if (!originaux.has(fichier)) originaux.set(fichier, src);
  ecrire(fichier, src.replace(avant, apres));
  const vu = suiteEchoue(suite);
  ecrire(fichier, originaux.get(fichier));
  if (vu) console.log("  \x1b[32m✓\x1b[0m  " + suite + " crie quand " + quoi);
  else { rates++; console.log("  \x1b[31m✗  " + suite + " NE VOIT PAS que " + quoi + "\x1b[0m\n       → " + fichier); }
}

restaurer();
console.log("\n" + "─".repeat(60));
if (rates) { console.log(`\x1b[31m${rates} mutation(s) passée(s) inaperçue(s)\x1b[0m — ces tests sont à renforcer.`); process.exit(1); }
console.log(`\x1b[32mLes ${MUTATIONS.length} mutations sont toutes détectées ✓\x1b[0m`);
