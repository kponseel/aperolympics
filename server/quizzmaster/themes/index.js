// QuizzMaster — theme registry. Adding a theme = 1 file + 1 entry here +
// 1 entry in rooms.js THEMES.

module.exports = {
  france:            { id: "france",            name: "France",                emoji: "🇫🇷", bank: require("./france") },
  chine:             { id: "chine",             name: "Chine",                 emoji: "🇨🇳", bank: require("./chine") },
  gastronomie_vins:  { id: "gastronomie_vins",  name: "Gastronomie & Vins",    emoji: "🍷", bank: require("./gastronomie_vins") },
  culture_generale:  { id: "culture_generale",  name: "Culture générale",      emoji: "🧠", bank: require("./culture_generale") },
  histoire:          { id: "histoire",          name: "Histoire",              emoji: "📜", bank: require("./histoire") },
  geographie:        { id: "geographie",        name: "Géographie",            emoji: "🌍", bank: require("./geographie") },
  sport:             { id: "sport",             name: "Sport",                 emoji: "⚽", bank: require("./sport") },
  cinema:            { id: "cinema",            name: "Cinéma & Séries",       emoji: "🎬", bank: require("./cinema") },
  musique:           { id: "musique",           name: "Musique",               emoji: "🎵", bank: require("./musique") },
  sciences:          { id: "sciences",          name: "Sciences & Tech",       emoji: "🔬", bank: require("./sciences") },
};
