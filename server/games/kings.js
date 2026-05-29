// "Roi des Bieres" (Kings) — shared 52-card deck, each rank has a rule, the 4th
// King ends the round (Royal Cup). Ported from esp32-hub/src/games/kings.cpp.
// Turn identity = player name; deck is a shuffled array of 0..51.

const RULES = [
  { name: "As", rule: "Cascade — chacun bois 1s en regardant le suivant" },
  { name: "2", rule: "Tu — choisis qui bois" },
  { name: "3", rule: "Moi — bois toi-meme" },
  { name: "4", rule: "Filles — toutes les filles boivent" },
  { name: "5", rule: "Pouce — pose discretement le pouce sur la table ; dernier·e a le faire bois" },
  { name: "6", rule: "Gars — tous les gars boivent" },
  { name: "7", rule: "Ciel — dernier·e a lever la main bois" },
  { name: "8", rule: "Partenaire — choisis un·e partenaire de gorgee jusqu'au prochain 8" },
  { name: "9", rule: "Rime — donne un mot, chacun rime ; premier·e qui rate bois" },
  { name: "10", rule: "Categorie — donne un theme, chacun cite ; premier·e qui rate bois" },
  { name: "Valet", rule: "Regle — impose une nouvelle regle pour la partie" },
  { name: "Reine", rule: "Question — pose des questions ; premier·e a y repondre bois" },
  { name: "Roi", rule: "Verse un peu de ta boisson dans la Coupe Royale" },
];
const SUITS = ["♥", "♦", "♣", "♠"];

function create() {
  let phase = "lobby";
  let deck = [];
  let deckPos = 0;
  let currentName = null;
  let lastCard = -1; // 0..51 or -1 = not drawn yet
  let kingsDrawn = 0;
  let roundN = 0;

  function shuffleDeck() {
    deck = [];
    for (let i = 0; i < 52; i++) deck.push(i);
    for (let i = 51; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    deckPos = 0; lastCard = -1; kingsDrawn = 0;
  }
  function resetAll() { phase = "lobby"; currentName = null; deckPos = 0; lastCard = -1; kingsDrawn = 0; roundN = 0; deck = []; }
  function startRound(room) {
    shuffleDeck();
    const a = room.activePlayers();
    if (!a.length) return;
    currentName = a[0].name;
    phase = "playing";
    roundN++;
  }
  function drawCard() {
    if (deckPos >= 52) { phase = "finished"; return; }
    lastCard = deck[deckPos++];
    if (lastCard % 13 === 12) { kingsDrawn++; if (kingsDrawn >= 4) phase = "finished"; }
  }
  function rotateTurn(room) {
    const a = room.activePlayers();
    if (!a.length) { phase = "lobby"; return; }
    const idx = a.findIndex((p) => p.name === currentName);
    currentName = a[(idx + 1) % a.length].name;
    lastCard = -1;
  }
  function advance(room) {
    if (phase === "lobby") startRound(room);
    else if (phase === "playing") { if (lastCard < 0) drawCard(); else rotateTurn(room); }
    else resetAll();
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { startRound(room); },
    onAdvance: advance,
    onReset: resetAll,
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onPlayerLeave: (room, p) => { if (phase === "playing" && p && p.name === currentName) rotateTurn(room); },
    onMessage: (room, p, msg) => {
      if (!p || phase !== "playing" || p.name !== currentName) return;
      if (msg.t === "draw" && lastCard < 0) advance(room);
      else if (msg.t === "end_turn" && lastCard >= 0) advance(room);
    },
    serializeRound: () => {
      const r = { round_n: roundN, deck_left: 52 - deckPos, kings_drawn: kingsDrawn };
      if (phase === "lobby") return r;
      if (currentName) { r.current_id = currentName; r.current_name = currentName; }
      if (lastCard >= 0) {
        const rank = lastCard % 13;
        const suit = Math.floor(lastCard / 13);
        r.card = RULES[rank].name;
        r.card_full = RULES[rank].name;
        r.suit = SUITS[suit] || "?";
        r.rule = RULES[rank].rule;
        r.is_king = rank === 12;
      }
      if (phase === "finished") {
        // Only crown a "Coupe Royale" if the 4th king was actually drawn; a
        // 52-card-exhausted finish should NOT misattribute the cup to whoever's
        // turn it happened to be when the deck ran dry.
        if (kingsDrawn >= 4 && lastCard >= 0 && currentName) {
          r.winner_banner = { emoji: "👑", text: "Coupe Royale pour " + currentName + " !" };
        } else if (deckPos >= 52) {
          r.winner_banner = { emoji: "🃏", text: "Deck épuisé — fin de manche" };
        }
      }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "kings",
  name: "Roi des Bieres",
  emoji: "👑",
  desc: "Tire une carte, applique la regle, passe au suivant.",
  create,
};
