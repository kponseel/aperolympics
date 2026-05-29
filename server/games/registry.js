// Server-side game registry. The ids here MUST match the client renderers'
// ids (window.Apero.register(id, ...)). To add a game: create its module here
// (copy quiz.js), add it to GAMES, and ship a matching client renderer in
// public/games/<id>.js included from index.html.

const quiz = require("./quiz");
const most_likely = require("./most_likely");
const superlatives = require("./superlatives");
const would_rather = require("./would_rather");
const never = require("./never");
const bluff = require("./bluff");
const quips = require("./quips");
const picolo = require("./picolo");
const dares = require("./dares");
const kings = require("./kings");
const bomb = require("./bomb");
const paranoia = require("./paranoia");
const spyfall = require("./spyfall");
const undercover = require("./undercover");
const wolves = require("./wolves");
const reaction = require("./reaction");
const roulette = require("./roulette");
const simon = require("./simon");
const quiz_solo = require("./quiz_solo");

const GAMES = [
  quiz,
  most_likely,
  superlatives,
  would_rather,
  never,
  bluff,
  quips,
  picolo,
  dares,
  kings,
  bomb,
  paranoia,
  spyfall,
  undercover,
  wolves,
  // Solo skill / party games (1 joueur)
  reaction,
  roulette,
  simon,
  quiz_solo,
];

module.exports = {
  list: () => GAMES.map((g) => ({ id: g.id, name: g.name, emoji: g.emoji, desc: g.desc })),
  get: (id) => GAMES.find((g) => g.id === id),
};
