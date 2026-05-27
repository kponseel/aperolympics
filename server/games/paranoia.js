// "Paranoia" — one player gets a PRIVATE question, points at someone; a coin
// flip decides whether the question is revealed to the room. Ported from
// esp32-hub/src/games/paranoia.cpp. Whisperer/accused identity = player name.

const PROMPTS = [
  "Qui dans le groupe a le pire gout musical ?",
  "Avec qui partirais-tu en road-trip sans hesiter ?",
  "Qui ferait le pire colocataire ?",
  "Qui te raconte les meilleures histoires ?",
  "Avec qui voudrais-tu echanger ta vie pour un jour ?",
  "Qui est secretement le plus competitif ?",
  "Qui peut le moins garder un secret ?",
  "Qui dans le groupe est ton acolyte ideal pour un mauvais coup ?",
  "Qui prendrais-tu en premier dans une equipe de quiz ?",
  "Qui a le plus de chance de devenir riche ?",
  "Avec qui passerais-tu un weekend sur une ile deserte ?",
  "Qui ferait le meilleur DJ de soiree ?",
  "Qui dans le groupe est le plus mauvais perdant ?",
  "Avec qui ferais-tu equipe pour braquer une banque (hypothetique) ?",
  "Qui est le plus susceptible de finir prof de yoga ?",
  "Qui as-tu le plus envie de connaitre mieux ?",
  "Qui ferait le meilleur partenaire d'escape game ?",
  "Qui dirait le plus de betises sous l'effet de la fatigue ?",
  "Qui pleure le plus facilement (en bien ou en mal) ?",
  "Qui as-tu le plus de mal a contredire ?",
  "Qui ferait le meilleur baby-sitter ?",
  "Qui te ferait le moins confiance pour cacher un cadeau de surprise ?",
  "Qui dans le groupe est le plus genereux ?",
  "Qui ferait le pire prof particulier ?",
  "Qui aurait le plus de followers sur TikTok si il/elle s'y mettait serieusement ?",
];

function create() {
  let phase = "lobby";
  let whispererName = null;
  let accusedName = null;
  let currentPrompt = "";
  let revealPrompt = false;
  let turn = 0;

  function pickPrompt() { currentPrompt = PROMPTS.length ? PROMPTS[Math.floor(Math.random() * PROMPTS.length)] : ""; }
  function resetAll() { phase = "lobby"; whispererName = null; accusedName = null; currentPrompt = ""; revealPrompt = false; turn = 0; }
  function startTurn(room) {
    const a = room.activePlayers();
    if (!a.length) return;
    whispererName = a[Math.floor(Math.random() * a.length)].name;
    accusedName = null; revealPrompt = false; pickPrompt(); phase = "playing"; turn = 1;
  }
  function nextTurn(room) {
    const a = room.activePlayers();
    if (!a.length) { phase = "lobby"; return; }
    const idx = a.findIndex((p) => p.name === whispererName);
    whispererName = a[(idx + 1) % a.length].name;
    accusedName = null; revealPrompt = false; pickPrompt(); phase = "playing"; turn++;
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { startTurn(room); },
    onAdvance: (room) => {
      if (phase === "lobby") startTurn(room);
      else if (phase === "playing") { phase = "reveal"; revealPrompt = Math.random() < 0.5; }
      else if (phase === "reveal") nextTurn(room);
      else resetAll();
    },
    onReset: resetAll,
    onPlayerLeave: (room, p) => { if (phase === "playing" && p && p.name === whispererName) nextTurn(room); },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || p.name !== whispererName) return;
      if (msg.t !== "point") return;
      const target = room.players.get(String(msg.target_id || "").toLowerCase());
      if (!target || !target.name) return;
      accusedName = target.name;
      revealPrompt = Math.random() < 0.5; // 50/50 coin
      phase = "reveal";
    },
    serializeRound: () => {
      const r = { turn: turn };
      if (phase === "lobby") return r;
      if (whispererName) { r.whisperer_id = whispererName; r.whisperer_name = whispererName; }
      if (phase === "reveal" && accusedName) {
        r.accused_id = accusedName;
        r.accused_name = accusedName;
        r.coin = revealPrompt ? "open" : "sealed";
        if (revealPrompt) r.prompt = currentPrompt;
      }
      return r;
    },
    serializePrivate: (room, viewer) => {
      if (!viewer || phase !== "playing" || !whispererName) return {};
      if (viewer.name !== whispererName) return {};
      return { prompt: currentPrompt, your_turn: true };
    },
    tick: () => false,
  };
}

module.exports = {
  id: "paranoia",
  name: "Paranoia",
  emoji: "👀",
  desc: "Question secrete a une personne. Le doigt parle... le coin decide.",
  create,
};
