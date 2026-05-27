// "Action ou Verite" — turn rotation; the spotlighted player picks truth/dare,
// a random prompt is drawn, then they tap Done to pass. Ported from
// esp32-hub/src/games/truth_dare.cpp. Spotlight identity = player name.

const TRUTHS = [
  "Quel est ton plus gros mensonge a un parent ?",
  "Quel est ton crush le plus inavoue dans le groupe ?",
  "Quelle est la pire chose que tu aies faite a un ex ?",
  "Quel est ton plus grand secret musical (artiste honteux) ?",
  "Quel est ton souvenir le plus genant en soiree ?",
  "Quel est ton score le plus bas a un examen ?",
  "As-tu deja menti pour eviter quelqu'un dans cette piece ?",
  "Quel est le dernier mensonge que tu as dit ?",
  "Quel est ton fantasme de vacances ?",
  "A quel age as-tu cru au pere Noel jusqu'a... ?",
  "Quelle est la chose la plus chere que tu as cassee ?",
  "Quel est le dernier reve dont tu te souviens ?",
  "Quel est ton plus gros regret de la derniere annee ?",
  "Si tu pouvais changer ton prenom, ce serait lequel ?",
  "Quel est ton plat 'plaisir coupable' ?",
  "Quel personnage de fiction trouves-tu super attirant ?",
  "Quelle est la chose la plus bizarre que tu as deja googlee ?",
  "Quel est ton plus vieux souvenir d'enfance ?",
  "Combien de temps peux-tu rester sans ton tel ?",
  "Quelle est ton pire achat compulsif ?",
];

const DARES = [
  "Imite la personne a ta gauche pendant 30 secondes",
  "Envoie un emoji random a la 3eme personne de ta liste",
  "Fais 10 pompes maintenant",
  "Parle en chuchotant les 2 prochains tours",
  "Danse 15 secondes sans musique",
  "Mets ton t-shirt a l'envers pour le reste du jeu",
  "Appelle un proche et chante 'Joyeux Anniversaire'",
  "Mange/bois un truc en utilisant uniquement ta main faible",
  "Fais un compliment honnete a chaque joueur",
  "Raconte une histoire embarrassante de moins de 30 secondes",
  "Fais un selfie en grimace et envoie-le a un contact au hasard",
  "Imite un animal pendant 20 secondes, les autres devinent",
  "Parle uniquement en chantant pendant 2 tours",
  "Recite l'alphabet a l'envers le plus vite possible",
  "Mets-toi en equilibre sur un pied pendant 30 sec",
  "Joue le role d'un journal televise en breaking news pendant 30 sec",
  "Fais ta meilleure imitation de quelqu'un dans la piece",
  "Mange une bouchee avec les yeux fermes (un autre choisit)",
  "Raconte ta journee en utilisant 3 mots tires au hasard du groupe",
  "Tiens-toi sur la pointe des pieds jusqu'a ton prochain tour",
];

function create() {
  let phase = "lobby";
  let currentName = null;
  let choice = -1; // -1 not yet, 0 truth, 1 dare
  let currentPrompt = "";
  let turnCount = 0;

  function pickRandomPrompt(dare) {
    const bank = dare ? DARES : TRUTHS;
    currentPrompt = bank.length ? bank[Math.floor(Math.random() * bank.length)] : "";
  }
  function resetAll() { phase = "lobby"; currentName = null; choice = -1; currentPrompt = ""; turnCount = 0; }
  function startTurn(room) {
    const a = room.activePlayers();
    if (!a.length) return;
    currentName = a[Math.floor(Math.random() * a.length)].name;
    choice = -1; currentPrompt = ""; phase = "playing"; turnCount = 1;
  }
  function advanceTurn(room) {
    const a = room.activePlayers();
    if (!a.length) { phase = "lobby"; return; }
    const idx = a.findIndex((p) => p.name === currentName);
    currentName = a[(idx + 1) % a.length].name; // idx -1 -> first
    choice = -1; currentPrompt = ""; turnCount++;
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { startTurn(room); },
    onAdvance: (room) => {
      if (phase === "lobby") startTurn(room);
      else if (phase === "playing") advanceTurn(room);
      else resetAll();
    },
    onReset: resetAll,
    onPlayerLeave: (room, p) => { if (phase === "playing" && p && p.name === currentName) advanceTurn(room); },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || p.name !== currentName) return;
      if (msg.t === "choose" && choice < 0) {
        if (msg.value === "truth") { choice = 0; pickRandomPrompt(false); }
        else if (msg.value === "dare") { choice = 1; pickRandomPrompt(true); }
      } else if (msg.t === "done") {
        advanceTurn(room);
      }
    },
    serializeRound: () => {
      const r = { turn: turnCount };
      if (phase !== "playing" || !currentName) return r;
      r.current_id = currentName;
      r.current_name = currentName;
      if (choice >= 0) { r.choice = choice === 0 ? "truth" : "dare"; r.prompt = currentPrompt; }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "truth_dare",
  name: "Action ou Verite",
  emoji: "🎭",
  desc: "Tour par tour : verite ou gage, prompts pioches au hasard.",
  create,
};
