// Ce qui arrive quand quelqu'un ne joue pas le jeu.
//
// Jusqu'ici les suites vérifient que l'app marche quand on s'en sert
// normalement. Celle-ci fait le contraire : elle parle au serveur comme le
// ferait quelqu'un qui veut tricher, fouiller ou casser. Avant une diffusion
// publique, c'est la seule partie du travail qui compte vraiment — les joueurs
// de bonne foi, eux, sont déjà couverts.
//
// Elle n'utilise PAS le client de l'app : elle ouvre un socket brut sur
// /match et envoie ce qu'elle veut. C'est exactement la position de
// l'attaquant — il lui suffit d'ouvrir la console du navigateur — et c'est la
// seule façon de tester les vérifications du serveur, puisque l'app, elle,
// n'enverra jamais ces messages.

exports.navigateur = true;
exports.titre = "Quand quelqu'un ne joue pas le jeu";

exports.run = async (t) => {
  const b = await t.navigateur();
  if (!b) return;
  const srv = await t.serveur({ MATCH_SCENES: "5" });
  const ctx = await b.newContext();

  // Un socket brut, sans l'app autour.
  async function socket(cid) {
    const p = await ctx.newPage();
    await p.goto(srv.base + "/AlterEgo/", { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof window.io === "function", null, { timeout: 10000 });
    await p.evaluate((c) => {
      window.__cid = c;
      window.__s = window.io("/match", { transports: ["websocket"] });
      window.__vu = [];
      window.__s.onAny((ev, d) => window.__vu.push({ ev, d }));
      window.__at = (ev, ms) => new Promise((res) => {
        const dejaVu = window.__vu.find((x) => x.ev === ev);
        if (dejaVu) return res(dejaVu.d);
        const fin = setTimeout(() => res(null), ms || 3000);
        window.__s.once(ev, (d) => { clearTimeout(fin); res(d); });
      });
      window.__go = (ev, d) => { window.__vu = []; window.__s.emit(ev, d); };
    }, cid);
    await p.waitForFunction(() => window.__s && window.__s.connected, null, { timeout: 10000 });
    p.go = (ev, d) => p.evaluate(([e, x]) => window.__go(e, x), [ev, d === undefined ? null : d]);
    p.at = (ev, ms) => p.evaluate(([e, x]) => window.__at(e, x), [ev, ms || 3000]);
    p.envoyer = async (ev, d, attendu, ms) => { await p.go(ev, d); return p.at(attendu, ms); };
    return p;
  }
  const identifier = async (p, nom, cid, pin) => {
    await p.go("set_identity", { cid, name: nom, pin });
    return p.at("identity_ok", 5000);
  };

  // --- le terrain : une partie avec deux joueurs -----------------------------
  const marie = await socket("cid-marie");
  await identifier(marie, "Marie", "cid-marie", "4827");
  await marie.go("create_game", { title: "Soirée" });
  const cree = await marie.at("game_created", 5000);
  const code = cree && cree.code;

  const tom = await socket("cid-tom");
  await identifier(tom, "Tom", "cid-tom", "7391");
  await tom.go("join_game", { code });
  await tom.at("game_state", 5000);

  const etat = await marie.envoyer("open_game", { code }, "game_state", 5000);
  const scenes = (etat && etat.scenes) || [];

  t.section("Se faire passer pour quelqu'un d'autre");
  const voleur = await socket("cid-voleur");
  const sansPin = await voleur.envoyer("set_identity", { cid: "cid-voleur", name: "Marie" }, "pin_required", 4000);
  t.check("Reprendre un pseudo protégé sans le code est refusé", !!sansPin, JSON.stringify(sansPin));
  const mauvais = await voleur.envoyer("set_identity", { cid: "cid-voleur", name: "Marie", pin: "1111" }, "pin_wrong", 4000);
  t.check("… et avec un mauvais code aussi", !!mauvais, JSON.stringify(mauvais));
  t.check("… en annonçant le nombre d'essais restants", mauvais && mauvais.attempts_left >= 0, JSON.stringify(mauvais));
  // Le voleur reste anonyme : aucune action ne doit lui être ouverte.
  const sansId = await voleur.envoyer("create_game", { title: "x" }, "error_msg", 3000);
  t.check("Sans identité, on ne peut rien faire", sansId && sansId.msg === "no_identity", JSON.stringify(sansId));

  t.section("Agir dans une partie où l'on n'est pas");
  const intrus = await socket("cid-intrus");
  await identifier(intrus, "Intrus", "cid-intrus", "5261");
  const rep = await intrus.envoyer("answer", { code, qid: scenes[0] && scenes[0].id, ranking: [0, 1, 2] }, "answer_ack", 4000);
  t.check("Répondre sans avoir rejoint est refusé", rep && rep.ok === false && rep.reason === "not_in_game", JSON.stringify(rep));
  const rev = await intrus.envoyer("get_reveal", { code, qid: scenes[0] && scenes[0].id }, "scene_reveal", 4000);
  t.check("Voir les réponses des autres sans avoir répondu ne donne rien",
    rev && rev.reveal === null, JSON.stringify(rev && rev.reveal).slice(0, 120));
  const ferme = await intrus.envoyer("close_game", { code }, "game_closed", 4000);
  t.check("Fermer la partie de quelqu'un d'autre est refusé",
    ferme && ferme.ok === false && ferme.reason === "not_host", JSON.stringify(ferme));
  const vire = await intrus.envoyer("remove_player", { code, name: "Tom" }, "player_removed", 4000);
  t.check("Retirer un joueur sans être l'hôte est refusé",
    vire && vire.ok === false && vire.reason === "not_host", JSON.stringify(vire));
  // Le refus doit se lire dans les FAITS, pas seulement dans la réponse : un
  // serveur qui répond « non » tout en agissant quand même passerait les deux
  // contrôles ci-dessus.
  const apresRefus = await marie.envoyer("open_game", { code }, "game_state", 4000);
  t.check("… et dans les faits : la partie est toujours ouverte",
    apresRefus && !apresRefus.closedAt, JSON.stringify(apresRefus && apresRefus.closedAt));
  t.check("… et Tom est toujours dans la partie",
    apresRefus && (apresRefus.players || []).some((p) => p.name === "Tom"),
    JSON.stringify((apresRefus && apresRefus.players || []).map((p) => p.name)));
  const suppr = await intrus.envoyer("delete_game", { code, confirm: code }, "game_deleted", 4000);
  t.check("Supprimer la partie de quelqu'un d'autre est refusé",
    suppr && suppr.ok === false && suppr.reason === "not_host", JSON.stringify(suppr));
  t.check("… et la partie existe toujours",
    !!(await intrus.envoyer("open_game", { code }, "game_state", 4000)));

  t.section("Toucher au compte de quelqu'un d'autre");
  // rename_me et delete_me partent du pseudo de la SESSION. Envoyer le nom
  // d'un autre ne doit donc rien lui faire — au pire on se renomme soi-même.
  await intrus.go("rename_me", { name: "Marie" });
  const ack = await intrus.at("rename_ack", 4000);
  t.check("Se renommer avec un pseudo pris est refusé", ack && ack.ok === false, JSON.stringify(ack));
  const profilVole = await intrus.envoyer("get_profile", { name: "Marie" }, "profile", 4000);
  t.check("Lire le profil d'un autre est refusé",
    profilVole && profilVole.ok === false && profilVole.reason === "not_yours", JSON.stringify(profilVole));
  // Le PIN de quelqu'un d'autre ne supprime que soi-même, jamais lui.
  await intrus.go("delete_me", { pin: "4827" });
  await intrus.at("delete_me_ack", 4000);
  const marieVaBien = await marie.envoyer("open_game", { code }, "game_state", 4000);
  t.check("Le compte visé est intact", !!marieVaBien && !!marieVaBien.me, JSON.stringify(!!marieVaBien));

  t.section("Des réponses qui n'en sont pas");
  const qid = scenes[0] && scenes[0].id;
  for (const [quoi, ranking] of [
    ["un classement vide", []],
    ["le même choix trois fois", [0, 0, 0]],
    ["un indice hors bornes", [0, 1, 7]],
    ["un indice négatif", [0, 1, -1]],
    ["trop d'éléments", [0, 1, 2, 3]],
    ["un tableau géant", Array.from({ length: 5000 }, (_, i) => i % 3)],
    ["du texte", ["a", "b", "c"]],
    ["null", null],
  ]) {
    const r = await tom.envoyer("answer", { code, qid, ranking }, "answer_ack", 4000);
    t.check("Refusé : " + quoi, r && r.ok === false, JSON.stringify(r));
  }
  // Et après tout ça, une vraie réponse passe encore : les refus n'ont rien
  // abîmé au passage.
  const bonne = await tom.envoyer("answer", { code, qid, ranking: [2, 0, 1] }, "answer_ack", 4000);
  t.check("Une réponse valide passe toujours", bonne && bonne.ok === true, JSON.stringify(bonne && bonne.reason));
  const rejoue = await tom.envoyer("answer", { code, qid, ranking: [0, 1, 2] }, "answer_ack", 4000);
  t.check("Mais pas deux fois sur la même scène", rejoue && rejoue.ok === false, JSON.stringify(rejoue));

  t.section("Des champs démesurés");
  const geant = "X".repeat(100000);
  await marie.go("create_game", { title: geant });
  const cree2 = await marie.at("game_created", 5000);
  t.check("Un titre de 100 000 caractères ne fait pas tomber le serveur", !!cree2, JSON.stringify(cree2));
  const etat2 = await marie.envoyer("open_game", { code: cree2 && cree2.code }, "game_state", 4000);
  t.check("… et il est coupé, pas stocké tel quel",
    etat2 && etat2.title && etat2.title.length <= 64, String(etat2 && etat2.title && etat2.title.length));
  const long = await socket("cid-long");
  const idLong = await identifier(long, "P".repeat(500), "cid-long", "3947");
  t.check("Un pseudo de 500 caractères est coupé à la création",
    idLong && idLong.name && idLong.name.length <= 16, String(idLong && idLong.name && idLong.name.length));

  t.section("Du HTML dans un pseudo, du HTML dans un titre");
  // Les pseudos et les titres viennent d'inconnus et s'affichent chez les
  // autres. S'ils n'étaient pas échappés, un joueur exécuterait le code d'un
  // autre — dans sa liste de joueurs, ses résultats, sa page d'invitation.
  const mechant = await socket("cid-mechant");
  await identifier(mechant, "<svg onload=1>", "cid-mechant", "8264");
  await mechant.go("join_game", { code });
  await mechant.at("game_state", 4000);
  await mechant.go("create_game", { title: '<img src=x onerror="window.__xss=1">' });
  const creeX = await mechant.at("game_created", 5000);

  // Vu depuis la VRAIE app, chez un autre joueur.
  const victime = await ctx.newPage();
  const bruit = [];
  victime.on("pageerror", (e) => bruit.push(e.message));
  await victime.goto(srv.base + "/AlterEgo/g/" + code, { waitUntil: "domcontentloaded" });
  await victime.waitForTimeout(300);
  await victime.evaluate(() => { const e = document.getElementById("amOnbSkip"); if (e) e.click(); });
  await victime.fill("#amName", "Victime"); await victime.fill("#amPin", "6183");
  await victime.click("#amContinue");
  await victime.waitForSelector("#amJoinGame", { timeout: 10000 });
  await victime.click("#amJoinGame");
  await victime.waitForTimeout(600);
  await victime.evaluate(() => { const e = document.getElementById("amBack"); if (e) e.click(); });
  await victime.waitForTimeout(600);

  const html = await victime.evaluate(() => document.body.innerHTML);
  t.check("Le pseudo piégé s'affiche en toutes lettres", /&lt;svg onload/.test(html) || /&lt;svg/.test(html), html.slice(0, 0));
  t.check("… et n'a créé aucun élément", (await victime.$("svg[onload], body > svg")) === null);
  t.check("… ni exécuté quoi que ce soit",
    (await victime.evaluate(() => window.__xss)) === undefined);
  t.check("Aucune erreur JavaScript chez la victime", bruit.length === 0, bruit.slice(0, 2).join(" | "));

  // La page d'invitation est fabriquée par NODE, pas par le client : c'est un
  // chemin d'échappement complètement séparé, et il sert l'aperçu de lien
  // (WhatsApp, iMessage) à des gens qui n'ont pas encore ouvert l'app.
  const invit = await victime.evaluate(async (u) => (await fetch(u)).text(), srv.base + "/AlterEgo/g/" + (creeX && creeX.code));
  t.check("La page d'invitation n'exécute rien de ce qu'on lui a donné",
    !/<img src=x/.test(invit) && !/onerror="window/.test(invit) && !/<svg onload/.test(invit),
    (invit.match(/.{0,60}(onerror|onload).{0,40}/) || [""])[0]);
  // L'aperçu porte le pseudo de l'hôte — ici le pseudo piégé. Il doit y être,
  // en toutes lettres : absent, on ne saurait pas si c'est l'échappement qui
  // marche ou le champ qui a disparu, et le contrôle ne prouverait rien.
  t.check("… et le pseudo piégé y est bien, échappé",
    /&lt;svg onload=1&gt;/.test(invit),
    (invit.match(/og:title[^>]*/) || [""])[0].slice(0, 120));
  t.check("… y compris dans le titre de l'onglet",
    /<title>&lt;svg onload=1&gt;/.test(invit),
    (invit.match(/<title>[^<]*/) || [""])[0].slice(0, 100));

  t.section("Créer des parties en boucle");
  // Créer une partie est gratuit et n'exige qu'un compte, qu'on ouvre avec un
  // pseudo et quatre chiffres. Sans frein, un seul client remplit le disque :
  // chaque partie pèse ~3,5 Ko une fois jouée, et le fichier entier est
  // réécrit à chaque sauvegarde — donc plus il y a de parties, plus CHAQUE
  // réponse de CHAQUE joueur coûte cher. Ce n'est pas un vol de données,
  // c'est l'arrêt du service pour tout le monde.
  const flood = await socket("cid-flood");
  await identifier(flood, "Flood", "cid-flood", "9427");
  let creees = 0, freine = null;
  for (let i = 0; i < 40; i++) {
    await flood.go("create_game", { title: "spam " + i });
    const r = await flood.evaluate(() => window.__at("game_created", 1500).then((ok) => ok ? { ok } : window.__at("error_msg", 200)));
    if (r && r.ok) creees++;
    else if (r && r.msg) { freine = r.msg; break; }
  }
  t.check("Le serveur finit par refuser", !!freine, "parties créées d'affilée : " + creees);
  t.check("… en le disant, plutôt qu'en coupant la connexion", freine === "slow_down", String(freine));
  t.check("… après un nombre de parties qu'un vrai hôte n'atteint pas",
    creees > 0 && creees <= 30, String(creees));
  // Le frein ne doit pas punir les autres : un joueur qui arrive doit pouvoir
  // créer sa partie pendant que le premier est bloqué.
  const honnete = await socket("cid-honnete");
  await identifier(honnete, "Honnete", "cid-honnete", "6183");
  const saPartie = await honnete.envoyer("create_game", { title: "Ma soirée" }, "game_created", 4000);
  t.check("Un autre joueur peut toujours créer la sienne", !!(saPartie && saPartie.code), JSON.stringify(saPartie));

  t.section("Balayer les codes de partie ne paie pas");
  // Un code fait 5 caractères sur 31 : ce n'est pas énumérable, mais le
  // serveur doit quand même ralentir celui qui essaie.
  const balayeur = await socket("cid-balayeur");
  await identifier(balayeur, "Balayeur", "cid-balayeur", "7264");
  let ralenti = false;
  for (let i = 0; i < 25 && !ralenti; i++) {
    const r = await balayeur.envoyer("open_game", { code: "ZZZ" + String(i).padStart(2, "0") }, "error_msg", 3000);
    if (r && r.msg === "slow_down") ralenti = true;
  }
  t.check("Après une vingtaine de codes inconnus, le serveur ralentit", ralenti);
};
