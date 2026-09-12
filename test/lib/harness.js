// Le harnais partagé par les suites : comptage, dossier de données jetable,
// serveur éphémère, et ouverture du navigateur quand il y en a un.
//
// Chaque suite tourne avec son PROPRE dossier DATA_DIR et son propre HOME :
// storage.js pré-remplit un dossier neuf en recopiant ~/.aperolympics, et une
// suite qui laisse traîner des parties les fait hériter aux suivantes. C'est
// un piège qui a déjà coûté une demi-journée : ne pas le retirer.

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

// test/lib/ → la racine du dépôt.
const RACINE = path.resolve(__dirname, "..", "..");

class Suite {
  constructor(fichier, titre) {
    this.fichier = fichier;
    this.titre = titre;
    this.total = 0;
    this.echecs = 0;
    this.ignoree = false;
    this._aNettoyer = [];
    this._serveurs = [];
    this._navigateurs = [];
  }

  // ---- comptage -----------------------------------------------------------
  check(libelle, condition, detail) {
    this.total++;
    if (condition) { console.log("  \x1b[32m✓\x1b[0m " + libelle); return true; }
    this.echecs++;
    console.log("  \x1b[31m✗ " + libelle + "\x1b[0m" + (detail ? "\n      → " + detail : ""));
    return false;
  }
  fail(libelle, detail) { this.total++; this.echecs++; console.log("  \x1b[31m✗ " + libelle + "\x1b[0m" + (detail ? "\n      → " + detail : "")); }
  section(titre) { console.log("  \x1b[90m" + titre + "\x1b[0m"); }
  ignorer(pourquoi) { this.ignoree = true; console.log("  \x1b[90m↷ ignorée : " + pourquoi + "\x1b[0m"); }

  // ---- données jetables ---------------------------------------------------
  // Charge un module du serveur avec un DATA_DIR neuf. À utiliser AVANT tout
  // require du module visé : storage.js lit l'environnement au chargement.
  dossierDonnees() {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "am-test-"));
    this._aNettoyer.push(d);
    return d;
  }
  // Recharge games.js (et ses dépendances) avec un stockage vierge.
  modules(env) {
    const data = this.dossierDonnees();
    const home = this.dossierDonnees();
    Object.assign(process.env, { DATA_DIR: data, HOME: home, MATCH_SAVE_DELAY_MS: "0" }, env || {});
    // storage.js lit l'environnement AU CHARGEMENT : il faut vider le cache
    // des modules du serveur pour que le nouveau DATA_DIR soit pris en compte.
    const serveur = path.join(RACINE, "server") + path.sep;
    for (const k of Object.keys(require.cache)) if (k.startsWith(serveur)) delete require.cache[k];
    const mod = (rel) => require(path.join(RACINE, rel));
    return {
      data,
      games: mod("server/match/games.js"),
      players: mod("server/match/players.js"),
      packs: mod("server/match/packs/index.js"),
      version: mod("server/match/version.js"),
      storage: mod("server/storage.js"),
    };
  }

  // ---- serveur éphémère ---------------------------------------------------
  async serveur(env) {
    const port = 3200 + Math.floor(Math.random() * 700);
    const data = this.dossierDonnees();
    const home = this.dossierDonnees();
    const p = spawn("node", ["server/index.js"], {
      cwd: RACINE,
      stdio: "ignore",
      env: { ...process.env, PORT: String(port), DATA_DIR: data, HOME: home, MATCH_SAVE_DELAY_MS: "0", ...(env || {}) },
    });
    this._serveurs.push(p);
    const base = "http://127.0.0.1:" + port;
    for (let i = 0; i < 120; i++) {
      if (await ping(base)) return { base, port, data, proc: p };
      await pause(150);
    }
    throw new Error("le serveur n'a pas démarré sur " + base);
  }

  // ---- navigateur ---------------------------------------------------------
  // Retourne null quand Playwright ou un Chromium ne sont pas disponibles :
  // la suite s'ignore proprement au lieu d'échouer (la CI n'a pas de
  // navigateur, une machine de dev en a souvent un).
  async navigateur() {
    let chromium;
    try { ({ chromium } = require("playwright")); }
    catch (e) { this.ignorer("playwright n'est pas installé (npm i -D playwright)"); return null; }
    const exe = trouverChromium();
    try {
      const b = await chromium.launch({
        ...(exe ? { executablePath: exe } : {}),
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      });
      this._navigateurs.push(b);
      return b;
    } catch (e) {
      this.ignorer("aucun Chromium lançable (" + String(e.message).split("\n")[0] + ")");
      return null;
    }
  }

  async cleanup() {
    for (const b of this._navigateurs) { try { await b.close(); } catch (e) {} }
    for (const p of this._serveurs) { try { p.kill(); } catch (e) {} }
    for (const d of this._aNettoyer) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }
  }
}

function trouverChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    const d = fs.readdirSync(base).filter((x) => x.startsWith("chromium")).sort().reverse();
    for (const c of d) {
      const p = path.join(base, c, "chrome-linux", "chrome");
      if (fs.existsSync(p)) return p;
    }
  } catch (e) {}
  return null;                                  // Playwright cherchera tout seul
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const ping = (base) => new Promise((r) => {
  const q = http.get(base + "/", (res) => { res.resume(); r(true); });
  q.on("error", () => r(false));
  q.setTimeout(1500, () => { q.destroy(); r(false); });
});

// GET simple, pour les suites qui n'ont pas besoin d'un navigateur.
function get(url, opts) {
  const o = opts || {};
  return new Promise((resolve) => {
    const req = http.get(url, { headers: o.headers || {} }, (res) => {
      let d = ""; res.on("data", (c) => (d += c));
      res.on("end", () => { let j = null; try { j = JSON.parse(d); } catch (e) {} resolve({ status: res.statusCode, headers: res.headers, text: d, json: j }); });
    });
    req.on("error", () => resolve({ status: 0, headers: {}, text: "", json: null }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 0, headers: {}, text: "", json: null }); });
  });
}

// Lit un fichier du jeu, tel qu'il est sur le disque.
function lire(rel) { return fs.readFileSync(path.join(RACINE, rel), "utf8"); }

module.exports = { Suite, pause, get, lire, RACINE };
