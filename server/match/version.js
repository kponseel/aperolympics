// Are We A Match? — version et date de la dernière mise à jour, affichées en
// petit dans le hall. C'est aussi le témoin fiable qu'un déploiement a bien
// pris : /admin.html est servi par le serveur frontal de l'hébergeur sans
// passer par Node, alors que ceci sort du process Node lui-même.
//
// À CHAQUE changement du jeu (server/match/* ou public/AreWeAMatch/*) :
//   - VERSION : incrémenter (1.0 → 1.1 pour une retouche, 2.0 pour une
//     refonte). C'est le repère humain, il ne se calcule pas.
//   - DATE    : mettre la date du jour. Elle sert de repli : quand le dépôt
//     git est disponible au démarrage, la date affichée est celle du dernier
//     commit qui touche le jeu (jamais périmée, même si on oublie ce fichier).
const VERSION = "1.1";
const DATE = "2026-09-03";

const { execFileSync } = require("child_process");
const path = require("path");

const GAME_PATHS = ["server/match", "public/AreWeAMatch"];

// Date (AAAA-MM-JJ) et sha court du dernier commit touchant le jeu, ou null si
// git ou le dépôt manquent (archive déployée sans .git, binaire absent…).
function fromGit() {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs %h", "--", ...GAME_PATHS], {
      cwd: path.join(__dirname, "..", ".."),
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
    const m = /^(\d{4}-\d{2}-\d{2}) ([0-9a-f]{7,})$/.exec(out);
    return m ? { date: m[1], sha: m[2] } : null;
  } catch (e) {
    return null;
  }
}

const git = fromGit();

module.exports = Object.freeze({
  version: VERSION,
  date: (git && git.date) || DATE,
  sha: (git && git.sha) || null,
  source: git ? "git" : "file",
});
