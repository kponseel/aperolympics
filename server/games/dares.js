// "Gages" — random dare for a random player; the picked player taps Done to
// reroll. Ported from esp32-hub/src/games/dares.cpp. Picked identity = name.

const DARES = [
  // Original 25 head (kept stable for deterministic tests).
  "Imite ton acteur prefere pendant 20 secondes",
  "Chante 5 secondes de ta chanson preferee",
  "Fais 10 pompes (vraiment)",
  "Parle uniquement avec des questions pendant 3 tours",
  "Mime un animal, les autres devinent en 30 sec",
  "Appelle un proche et dis lui une phrase au hasard du groupe",
  "Mets ton t-shirt a l'envers pour les 10 prochaines minutes",
  "Compose un petit poeme avec 3 mots tires des autres",
  "Raconte une histoire embarrassante en 30 secondes",
  "Fais le meme bruit qu'un animal jusqu'au prochain tour",
  "Danse 15 secondes sans musique",
  "Envoie un emoji aleatoire a la 5eme personne de tes contacts",
  "Fais un compliment honnete a chaque joueur",
  "Bois ton verre avec ta main faible jusqu'au prochain tour",
  "Imite quelqu'un dans le groupe, les autres devinent",
  "Recite l'alphabet a l'envers le plus vite possible",
  "Fais 5 burpees devant tout le monde",
  "Parle en yaourt anglais pendant 1 minute",
  "Fais une publicite pour un objet aleatoire dans la piece",
  "Pose une question genante a la personne a ta droite",
  "Raconte une blague vraiment nulle",
  "Fais comme si tu etais un journaliste en plein direct",
  "Bouge comme un robot pendant les 2 prochains tours",
  "Mets-toi a quatre pattes et fais un tour de la piece",
  "Parle uniquement en chuchotant pendant les 3 prochains tours",
  // +55 nouveaux gages
  "Imite l'accent d'un pays au choix pendant 1 minute",
  "Fais un slow tout seul avec une chaise",
  "Trouve un objet rouge en moins de 10 secondes",
  "Bois ton prochain verre avec une paille (et seulement une paille)",
  "Trouve un autre joueur, faites un check chorégraphié de 5 mouvements",
  "Fais ta meilleure imitation d'un présentateur météo en délire",
  "Donne un surnom ridicule au joueur à ta gauche, valable toute la soirée",
  "Raconte ta dernière dispute en 20 sec, version théâtre antique",
  "Fais une story Insta vocale pour le groupe (sans publier)",
  "Mime un sport extrême sans dire lequel, on devine",
  "Échange un vêtement avec un autre joueur jusqu'au prochain tour",
  "Tire au sort un emoji et raconte ton week-end avec",
  "Récite la table de 9 le plus vite possible — sinon bois",
  "Fais un compliment poétique à un objet (la lampe, le tapis, etc.)",
  "Lis le dernier message reçu à voix haute (caviarder les noms si besoin)",
  "Crée un nouveau pas de danse et apprends-le aux autres",
  "Improvise un journal télévisé de 30 sec sur la pièce",
  "Mets une chanson au hasard et danse la première seconde comme un fou",
  "Fais 3 jumping jacks tout en chantant ta chanson préférée",
  "Téléphone à un proche et dis-lui un secret du groupe (à inventer)",
  "Marche jusqu'à la cuisine sur la pointe des pieds, bras en croix",
  "Choisis un joueur et fais-lui une déclaration en yaourt italien",
  "Récite la première strophe d'un poème de Verlaine — sinon bois 2 fois",
  "Mime la naissance d'une étoile (oui, à toi de voir)",
  "Trouve le mot le plus long que tu connaisses et utilise-le 3x au prochain tour",
  "Crée un nouveau cri de guerre pour le groupe",
  "Va dans le couloir et ferme la porte 10 secondes — silence total",
  "Tu es un coach motivateur : motive le groupe en 20 sec",
  "Demande poliment à quelqu'un dans la rue par la fenêtre une heure (si possible)",
  "Pendant 5 min, tu finis chaque phrase par « ... bien sûr, bien sûr »",
  "Choisis un joueur — explique-lui pourquoi il/elle gagnerait Koh-Lanta",
  "Mets ton tel en mode selfie et fais ta plus belle grimace, 5 secondes",
  "Trouve une coïncidence absurde entre toi et le joueur à ta droite",
  "Fais un toast très solennel pour la baguette française",
  "Joue à pierre-feuille-ciseaux avec ton voisin de gauche — perdant bois",
  "Fais semblant d'être un robot qui découvre l'amour, 15 sec",
  "Cite 5 marques de céréales en 10 sec — sinon bois 2 fois",
  "Crée un slogan pour ce groupe d'amis",
  "Lis 3 mots au hasard d'un livre/menu et fais une phrase avec",
  "Trouve la chanson la plus honteuse de ta playlist et fais-en 10 sec",
  "Pose ton tel sur la table, écran visible, pour 1 min — promesse de ne pas regarder",
  "Tu es présentateur d'un télé-achat : vends un objet de la pièce en 30 sec",
  "Imagine ton propre podcast, donne le nom et le pitch (15 sec)",
  "Choisis un joueur et raconte un faux souvenir gênant ensemble",
  "Crée une nouvelle mode (gestuelle, expression) et impose-la pour 5 min",
  "Mange/bois quelque chose de la table en faisant semblant que c'est exquis",
  "Tu es un narrateur de doc nature — décris le groupe pendant 30 sec",
  "Fais un toast au plat le plus moche que tu aies cuisiné",
  "Vante les mérites d'un défaut du joueur à ta droite (au moins 3 phrases)",
  "Trouve un mot interdit pour la soirée — celui qui le dit bois",
  "Improvise une chanson sur le thème « le wifi de mes parents »",
  "Mets-toi en mode statue 15 secondes — bouger = bois",
  "Inventes une langue secrète : 3 mots, leur traduction",
  "Demande aux autres une question à laquelle tu ne sais pas répondre",
  "Pendant 2 tours, tu parles comme un personnage de Game of Thrones",
];

function create() {
  let phase = "lobby";
  let pickedName = null;
  let dareIdx = -1;
  let lastDareIdx = -1; // avoid immediate repeats
  let roundN = 0;
  let victimCount = {}; // name -> times picked this session

  function startRound(room) {
    const a = room.activePlayers();
    if (!a.length) return;
    pickedName = a[Math.floor(Math.random() * a.length)].name;
    victimCount[pickedName] = (victimCount[pickedName] || 0) + 1;
    if (DARES.length) {
      let i;
      do { i = Math.floor(Math.random() * DARES.length); } while (DARES.length > 1 && i === lastDareIdx);
      dareIdx = i; lastDareIdx = i;
    } else { dareIdx = -1; }
    phase = "playing";
    roundN++;
  }
  function resetAll() { phase = "lobby"; pickedName = null; dareIdx = -1; lastDareIdx = -1; roundN = 0; victimCount = {}; }
  function topVictim(room) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const n in victimCount) {
      if (!present.has(n)) continue;
      if (!best || victimCount[n] > victimCount[best]) best = n;
    }
    return best ? { name: best, count: victimCount[best] } : null;
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { startRound(room); },
    onAdvance: (room) => {
      // No silent restart after the host ended the session via 🏁.
      if (phase === "finished") return;
      startRound(room);
    },
    onReset: resetAll,
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onPlayerLeave: (room, p) => { if (phase === "playing" && p && p.name === pickedName) startRound(room); },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || p.name !== pickedName) return;
      if (msg.t === "done") startRound(room);
    },
    serializeRound: (room) => {
      const r = { round_n: roundN };
      if (phase === "playing" && pickedName) {
        r.picked_id = pickedName;
        r.picked_name = pickedName;
        if (dareIdx >= 0) r.dare = DARES[dareIdx];
      }
      if (phase === "finished") {
        const t = topVictim(room);
        if (t) r.mvp = { label: "Le plus mis au défi", emoji: "🎯", name: t.name, value: t.count + " fois" };
      }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "dares",
  name: "Gages",
  emoji: "🎲",
  desc: "Gage aléatoire pour un joueur aléatoire — banque de 80 gages.",
  create,
};
