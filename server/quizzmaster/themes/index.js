// QuizzMaster — theme registry. Adding a theme = 1 file + 1 entry here.

module.exports = {
  france:            { id: "france",            name: "France",                emoji: "🇫🇷", bank: require("./france") },
  chine:             { id: "chine",             name: "Chine",                 emoji: "🇨🇳", bank: require("./chine") },
  gastronomie_vins:  { id: "gastronomie_vins",  name: "Gastronomie & Vins",    emoji: "🍷", bank: require("./gastronomie_vins") },
  culture_generale:  { id: "culture_generale",  name: "Culture générale",      emoji: "🧠", bank: require("./culture_generale") },
  histoire:          { id: "histoire",          name: "Histoire",              emoji: "📜", bank: require("./histoire") },
  geographie:        { id: "geographie",        name: "Géographie",            emoji: "🌍", bank: require("./geographie") },
  sciences:          { id: "sciences",          name: "Sciences & Tech",       emoji: "🔬", bank: require("./sciences") },
  docusign:          { id: "docusign",          name: "Docusign",              emoji: "✍️", bank: require("./docusign") },
  olivier_agneray:   { id: "olivier_agneray",   name: "Olivier Agneray",       emoji: "🏃", bank: require("./olivier_agneray") },
  bonnes_manieres:   { id: "bonnes_manieres",   name: "L'étiquette Française", emoji: "🎩", bank: require("./bonnes_manieres") },
};
