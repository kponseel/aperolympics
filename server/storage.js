// Stockage des données de jeu qui doivent survivre à un déploiement.
//
// POURQUOI CE MODULE EXISTE
// Les comptes (pseudo, PIN, stats, réponses) étaient écrits à côté du code,
// dans server/<app>/players.json, et ces fichiers sont gitignorés — ils ne
// sont donc jamais dans le dépôt. Deux façons de tout perdre :
//   1. l'hébergeur redéploie en remplaçant le dossier de l'app → les comptes
//      partent avec, à chaque mise en ligne ;
//   2. le dossier de l'app est en lecture seule → chaque sauvegarde échoue,
//      et comme l'erreur était juste loguée, la perte passait inaperçue
//      jusqu'au redémarrage suivant.
//
// Les données vivent maintenant HORS du dossier déployé, et toute erreur
// d'écriture est mémorisée pour être affichée dans /admin — un stockage muet
// qui perd les données est pire qu'un stockage cassé qui le dit.
//
// Emplacement retenu, dans l'ordre :
//   1. $DATA_DIR                      (explicite : à privilégier en prod)
//   2. ~/.aperolympics                (hors du dossier déployé, donc conservé)
//   3. le dossier du code             (dernier recours : dev et CI)
// Le choix est logué au démarrage, et le premier lancement recopie
// automatiquement un ancien fichier trouvé à côté du code.

const fs = require("fs");
const os = require("os");
const path = require("path");

let resolved = null;  // { dir, source } — calculé une seule fois
const stores = [];    // tous les fichiers ouverts, pour le diagnostic /admin

// Un dossier n'est utilisable que s'il est réellement inscriptible : on le
// prouve en y écrivant, plutôt qu'en interrogeant des permissions.
function usable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, ".write-probe");
    fs.writeFileSync(probe, String(Date.now()));
    fs.unlinkSync(probe);
    return true;
  } catch (e) {
    return false;
  }
}

function resolveDir(fallbackDir) {
  if (resolved) return resolved;
  const candidates = [];
  if (process.env.DATA_DIR) candidates.push({ dir: path.resolve(process.env.DATA_DIR), source: "DATA_DIR" });
  const home = os.homedir();
  if (home) candidates.push({ dir: path.join(home, ".aperolympics"), source: "home" });
  for (const c of candidates) {
    if (usable(c.dir)) { resolved = c; break; }
  }
  // Dernier recours : à côté du code, comme avant. On ne bloque jamais le
  // démarrage du serveur pour un problème de stockage — la partie doit
  // pouvoir se jouer même si rien ne peut être sauvegardé.
  if (!resolved) resolved = { dir: fallbackDir, source: "legacy", degraded: true };
  return resolved;
}

// Ouvre un fichier JSON persistant.
//   name       : identifiant court, sert de nom de fichier (« quizzmaster »)
//   legacyPath : ancien emplacement, à côté du code — migré s'il existe
function open(name, legacyPath) {
  const { dir, source, degraded } = resolveDir(path.dirname(legacyPath));
  const file = source === "legacy" ? legacyPath : path.join(dir, name + "-players.json");

  let lastError = null;     // dernière erreur d'ÉCRITURE
  let lastReadError = null; // dernière erreur de LECTURE (fichier illisible ou corrompu)
  let lastWriteAt = 0;
  let migratedFrom = null;

  // Premier lancement au nouvel emplacement : on récupère un ancien fichier
  // s'il est encore là, pour ne perdre aucun compte au passage. Deux
  // emplacements possibles ont pu servir par le passé (legacy, puis
  // ~/.aperolympics avant qu'on définisse DATA_DIR) : on cherche dans les deux,
  // pas seulement le tout premier — sinon la migration ne joue qu'une fois.
  if (!fs.existsSync(file)) {
    const home = os.homedir();
    const candidates = [legacyPath];
    if (home) candidates.push(path.join(home, ".aperolympics", name + "-players.json"));
    for (const src of candidates) {
      if (src === file) continue;
      try {
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, file);
          migratedFrom = src;
          console.log(`[storage] ${name}: ancien fichier récupéré depuis ${src}`);
          break;
        }
      } catch (e) {
        console.error(`[storage] ${name}: migration impossible depuis ${src}: ${e.message}`);
      }
    }
  }

  // Écarte un fichier illisible ou corrompu plutôt que de le laisser en place :
  // sans ça, la prochaine écriture l'écraserait silencieusement (rename() ne
  // demande le droit d'écrire QUE sur le dossier, jamais sur le fichier
  // remplacé — c'est ce mécanisme qui causait la perte, on le détourne ici
  // pour sauver le fichier au lieu de le détruire).
  function quarantine() {
    try {
      const dest = file + ".corrupt-" + Date.now();
      fs.renameSync(file, dest);
      console.error(`[storage] ${name}: fichier mis en quarantaine → ${dest}`);
    } catch (e) { /* rien de plus à faire si même la mise en quarantaine échoue */ }
  }

  function read() {
    let raw;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch (e) {
      if (e.code === "ENOENT") { lastReadError = null; return null; } // pas encore de données : normal
      lastReadError = { msg: e.message, code: e.code || null, at: Date.now() };
      console.error(`[storage] ${name}: lecture impossible (${file}): ${e.message}`);
      quarantine();
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      lastReadError = null;
      return parsed;
    } catch (e) {
      lastReadError = { msg: "JSON invalide : " + e.message, code: "EINVALID_JSON", at: Date.now() };
      console.error(`[storage] ${name}: JSON corrompu (${file}): ${e.message}`);
      quarantine();
      return null;
    }
  }

  // Écriture atomique : on écrit à côté puis on renomme, pour qu'un crash au
  // mauvais moment ne laisse jamais un fichier à moitié écrit.
  function write(data) {
    try {
      const tmp = file + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(data));
      fs.renameSync(tmp, file);
      lastError = null;
      lastWriteAt = Date.now();
      return true;
    } catch (e) {
      lastError = { msg: e.message, at: Date.now() };
      console.error(`[storage] ${name}: écriture échouée (${file}): ${e.message}`);
      return false;
    }
  }

  function describe() {
    let exists = false, bytes = 0, mtime = 0;
    try {
      const st = fs.statSync(file);
      exists = true; bytes = st.size; mtime = st.mtimeMs;
    } catch (e) {}
    return {
      name, file, source,
      degraded: !!degraded,
      exists, bytes, mtime,
      writable: usable(path.dirname(file)),
      lastWriteAt,
      lastError,
      readError: lastReadError,
      migratedFrom,
      // Le dossier du code disparaît à chaque déploiement : le signaler
      // explicitement, c'est ce qui a coûté les comptes la première fois.
      warning: degraded
        ? "Stockage à côté du code : les comptes seront perdus au prochain déploiement. Définis DATA_DIR sur un dossier hors de l'app."
        : (lastReadError
          ? "Le dernier fichier lu était illisible ou corrompu et a été mis en quarantaine (voir readError) — les comptes précédents ont pu être perdus."
          : null),
    };
  }

  stores.push({ describe });
  return { read, write, describe, file };
}

function describeAll() {
  return {
    dir: resolved ? resolved.dir : null,
    source: resolved ? resolved.source : null,
    stores: stores.map((s) => s.describe()),
  };
}

module.exports = { open, describeAll };
