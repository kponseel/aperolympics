// Are We A Match? — registre des packs. Ajouter un pack = 1 fichier + 1 entrée.
// Chaque question : { id (stable, sert de clé de persistance), q, o: [3 options] }

module.exports = {
  amis:        { id: "amis",        name: "Amis",         emoji: "👯", tagline: "Goûts et modes de vie — avec n'importe qui", bank: require("./amis") },
  date:        { id: "date",        name: "Date",         emoji: "💘", tagline: "Romance et vie à deux — parfait en tête-à-tête", bank: require("./date") },
  piquant:     { id: "piquant",     name: "Piquant",      emoji: "🌶️", tagline: "Plus osé, pour une soirée bien lancée", bank: require("./piquant") },
  pop_culture: { id: "pop_culture", name: "Pop culture",  emoji: "🎬", tagline: "Films, séries, musique, jeux", bank: require("./pop_culture") },
};
