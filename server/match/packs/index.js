// Are We A Match? — registre des packs.
//
// Depuis la v2 il n'y a plus qu'UNE banque : une partie tire ses 20 scènes
// dans l'ensemble fusionné, et le joueur ne voit jamais de « pack ». Ces trois
// entrées ne sont plus que des FICHIERS de rangement, et leur `id` la clé sous
// laquelle les réponses sont archivées dans les profils — c'est pour ça qu'on
// ne le renomme pas, même si le nom affiché, lui, a suivi le contenu.
//
// Ce qui organise vraiment la banque, c'est l'`axis` de chaque scène (goûts,
// rythme, argent, autres, vices, agace) : c'est lui qui équilibre le tirage
// (voir drawScenes dans games.js).
//
// Chaque scène : { id (stable), axis, q (vraie question), ctx (la scène + LE
// SENS du classement), o: [3 options clivantes] }. Voir l'en-tête de amis.js
// pour la règle de stabilité des ids.

module.exports = {
  amis:    { id: "amis",    name: "Goûts & mode de vie", emoji: "👯", tagline: "Ce que tu aimes, et comment tu vis", bank: require("./amis") },
  date:    { id: "date",    name: "Les autres et toi",   emoji: "🫂", tagline: "Ce que tu attends des gens qui comptent", bank: require("./date") },
  piquant: { id: "piquant", name: "Vices et agacements", emoji: "🌶️", tagline: "Petits vices assumés, argent, ce qui t'énerve", bank: require("./piquant") },

  // Pop culture est mis de côté pour l'instant (on se concentre sur les trois
  // packs ci-dessus). La banque reste dans packs/pop_culture.js : réactiver le
  // pack = décommenter la ligne, rien d'autre. Les réponses déjà mémorisées
  // pour ce pack sont conservées dans les comptes et le resteront.
  // pop_culture: { id: "pop_culture", name: "Pop culture", emoji: "🎬", tagline: "Films, séries, musique, jeux", bank: require("./pop_culture") },
};

// Le jeu FUSIONNÉ : toutes les scènes de tous les packs, chacune sachant d'où
// elle vient (`pack`). C'est là-dedans qu'une partie tire ses 20 scènes.
// Non énumérable : l'admin et le profil parcourent Object.values(packs) en
// s'attendant à ne trouver que des packs.
Object.defineProperty(module.exports, "all", {
  enumerable: false,
  value: function all() {
    return Object.values(module.exports)
      .filter((p) => p && Array.isArray(p.bank))
      .flatMap((p) => p.bank.map((q) => Object.assign({}, q, { pack: p.id })));
  },
});
