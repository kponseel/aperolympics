// "Gages" — random dare for a random player; the picked player taps Done to
// reroll. Ported from esp32-hub/src/games/dares.cpp. Picked identity = name.

const DARES = [
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
];

function create() {
  let phase = "lobby";
  let pickedName = null;
  let dareIdx = -1;
  let roundN = 0;

  function startRound(room) {
    const a = room.activePlayers();
    if (!a.length) return;
    pickedName = a[Math.floor(Math.random() * a.length)].name;
    dareIdx = DARES.length ? Math.floor(Math.random() * DARES.length) : -1;
    phase = "playing";
    roundN++;
  }
  function resetAll() { phase = "lobby"; pickedName = null; dareIdx = -1; roundN = 0; }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { startRound(room); },
    onAdvance: (room) => { startRound(room); }, // always reroll a new victim + dare
    onReset: resetAll,
    onPlayerLeave: (room, p) => { if (phase === "playing" && p && p.name === pickedName) startRound(room); },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || p.name !== pickedName) return;
      if (msg.t === "done") startRound(room);
    },
    serializeRound: () => {
      const r = { round_n: roundN };
      if (phase !== "playing" || !pickedName) return r;
      r.picked_id = pickedName;
      r.picked_name = pickedName;
      if (dareIdx >= 0) r.dare = DARES[dareIdx];
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "dares",
  name: "Gages",
  emoji: "🎲",
  desc: "Gage aleatoire pour un joueur aleatoire.",
  create,
};
