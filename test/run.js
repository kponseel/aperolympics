#!/usr/bin/env node
// Lanceur des tests d'Are We A Match ?
//
// Les suites vivaient dans /tmp : le conteneur a été recyclé pendant une nuit
// d'inactivité et 791 contrôles ont disparu d'un coup. Elles sont désormais
// dans le dépôt, et c'est `npm test` qui les enchaîne.
//
//   npm test              tout : les modules, puis le navigateur
//   npm test -- --fast    seulement les modules (aucun navigateur requis)
//   npm test -- banque    seulement les suites dont le nom contient « banque »
//
// Une suite est un fichier de test/suites/. Elle exporte une fonction async
// qui reçoit un objet `t` (voir lib/harness.js) et lève une exception ou
// appelle t.check(). Le lanceur compte, résume, et sort en 1 si quoi que ce
// soit a échoué — c'est ce qui fait échouer la CI.

const fs = require("fs");
const path = require("path");
const { Suite } = require("./lib/harness");

const args = process.argv.slice(2);
const fast = args.includes("--fast");
const filtres = args.filter((a) => !a.startsWith("--"));

const DIR = path.join(__dirname, "suites");
const fichiers = fs.readdirSync(DIR).filter((f) => f.endsWith(".js")).sort();

(async () => {
  const t0 = Date.now();
  let total = 0, echecs = 0, lancees = 0, ignorees = 0;
  const rouges = [];

  for (const f of fichiers) {
    if (filtres.length && !filtres.some((q) => f.includes(q))) continue;
    const mod = require(path.join(DIR, f));
    if (fast && mod.navigateur) { ignorees++; console.log(`\n\x1b[90m— ${f} (navigateur, ignorée en --fast)\x1b[0m`); continue; }

    const s = new Suite(f, mod.titre || f);
    console.log(`\n\x1b[1m${s.titre}\x1b[0m  \x1b[90m${f}\x1b[0m`);
    lancees++;
    try {
      await mod.run(s);
    } catch (e) {
      s.fail("La suite s'est interrompue", e && e.stack ? e.stack.split("\n").slice(0, 4).join(" | ") : String(e));
    } finally {
      await s.cleanup();
    }
    total += s.total; echecs += s.echecs;
    if (s.echecs) rouges.push(f + " (" + s.echecs + ")");
    if (s.ignoree) { ignorees++; lancees--; }
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n" + "─".repeat(60));
  console.log(`${lancees} suite(s) · ${total} contrôle(s) · ${sec}s` + (ignorees ? ` · ${ignorees} ignorée(s)` : ""));
  if (echecs) {
    console.log(`\x1b[31m${echecs} ÉCHEC(S)\x1b[0m — ${rouges.join(", ")}`);
    process.exit(1);
  }
  console.log("\x1b[32mTOUT EST VERT ✓\x1b[0m");
  process.exit(0);
})().catch((e) => { console.error("\nLe lanceur a planté :\n", e); process.exit(1); });
