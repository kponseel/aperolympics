// "Plus ou Moins" (higher_lower) — a stat is shown with its value; the active
// player guesses whether the NEXT item's value is higher or lower. Right →
// streak grows & they continue; wrong → they drink and the hand passes. Score
// = longest streak. Server-authoritative; the next value is hidden until reveal.
//
// To keep comparisons fair & truthful, each "run" stays within ONE themed deck
// (same unit). A wrong guess (or the active player leaving) draws a fresh deck.

const DECKS = [
  { unit: "M hab.", name: "Pays par population", items: [
    { label: "Belgique", value: 12 }, { label: "Suède", value: 10 }, { label: "Portugal", value: 10 },
    { label: "Maroc", value: 37 }, { label: "Canada", value: 39 }, { label: "Espagne", value: 48 },
    { label: "Italie", value: 59 }, { label: "Royaume-Uni", value: 67 }, { label: "France", value: 68 },
    { label: "Allemagne", value: 84 }, { label: "Égypte", value: 110 }, { label: "Japon", value: 125 },
    { label: "Mexique", value: 128 }, { label: "Russie", value: 144 }, { label: "Brésil", value: 215 },
    { label: "Indonésie", value: 277 }, { label: "USA", value: 335 }, { label: "Chine", value: 1410 },
    { label: "Inde", value: 1430 },
  ] },
  { unit: "M km²", name: "Pays par superficie", items: [
    { label: "Belgique", value: 0.03 }, { label: "Italie", value: 0.30 }, { label: "Allemagne", value: 0.36 },
    { label: "Japon", value: 0.38 }, { label: "Espagne", value: 0.51 }, { label: "France", value: 0.55 },
    { label: "Égypte", value: 1.0 }, { label: "Algérie", value: 2.4 }, { label: "Argentine", value: 2.8 },
    { label: "Inde", value: 3.3 }, { label: "Australie", value: 7.7 }, { label: "Brésil", value: 8.5 },
    { label: "Chine", value: 9.6 }, { label: "USA", value: 9.8 }, { label: "Canada", value: 10.0 },
    { label: "Russie", value: 17.1 },
  ] },
  { unit: "km/h", name: "Animaux les plus rapides", items: [
    { label: "Escargot", value: 0.05 }, { label: "Tortue", value: 1 }, { label: "Souris", value: 13 },
    { label: "Humain (Bolt)", value: 37 }, { label: "Éléphant", value: 40 }, { label: "Chat", value: 48 },
    { label: "Kangourou", value: 56 }, { label: "Lévrier", value: 65 }, { label: "Cheval", value: 70 },
    { label: "Lion", value: 80 }, { label: "Antilope", value: 98 }, { label: "Guépard", value: 110 },
    { label: "Faucon pèlerin (piqué)", value: 350 },
  ] },
  { unit: "ans", name: "Longévité animale", items: [
    { label: "Souris", value: 2 }, { label: "Lapin", value: 9 }, { label: "Chien", value: 13 },
    { label: "Chat", value: 15 }, { label: "Cheval", value: 30 }, { label: "Perroquet", value: 60 },
    { label: "Éléphant", value: 70 }, { label: "Humain", value: 80 }, { label: "Tortue géante", value: 150 },
    { label: "Baleine boréale", value: 200 },
  ] },
  { unit: "m", name: "Hauteur de structures & sommets", items: [
    { label: "Arc de Triomphe", value: 50 }, { label: "Tour de Pise", value: 56 }, { label: "Statue de la Liberté", value: 93 },
    { label: "Tour Eiffel", value: 330 }, { label: "Empire State Building", value: 443 }, { label: "Burj Khalifa", value: 828 },
    { label: "Mont Blanc", value: 4809 }, { label: "Kilimandjaro", value: 5895 }, { label: "Everest", value: 8849 },
  ] },
  { unit: "×1000 km Ø", name: "Diamètre des astres", items: [
    { label: "Lune", value: 3.5 }, { label: "Mercure", value: 4.9 }, { label: "Mars", value: 6.8 },
    { label: "Vénus", value: 12.1 }, { label: "Terre", value: 12.7 }, { label: "Neptune", value: 49.2 },
    { label: "Uranus", value: 50.7 }, { label: "Saturne", value: 116.5 }, { label: "Jupiter", value: 139.8 },
  ] },
];

function create() {
  let phase = "lobby";       // lobby | playing | reveal | finished
  let deck = null;           // { unit, name, items: shuffled copy }
  let idx = 0;               // cardA = deck.items[idx], cardB = deck.items[idx+1]
  let activeName = null;
  let lastCorrect = null;    // result of the most recent guess
  let lastGuess = null;      // "higher" | "lower"
  let streak = {};           // name -> current run length
  let best = {};             // name -> longest run this session

  function pickDeck() {
    const src = DECKS[Math.floor(Math.random() * DECKS.length)];
    const items = src.items.slice();
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = items[i]; items[i] = items[j]; items[j] = t; }
    deck = { unit: src.unit, name: src.name, items: items };
    idx = 0;
  }
  function nextActive(room) {
    const a = room.activePlayers();
    if (!a.length) return null;
    if (!activeName) return a[0].name;
    const i = a.findIndex((p) => p.name === activeName);
    return a[(i + 1) % a.length].name;
  }
  function cardA() { return deck && deck.items[idx]; }
  function cardB() { return deck && deck.items[idx + 1]; }

  function startRun(room, advanceHand) {
    const a = room.activePlayers();
    if (!a.length) { phase = "lobby"; return; }
    activeName = advanceHand ? nextActive(room) : (activeName || a[0].name);
    pickDeck();
    lastCorrect = null; lastGuess = null;
    phase = "playing";
  }

  function resetAll() {
    phase = "lobby"; deck = null; idx = 0; activeName = null;
    lastCorrect = null; lastGuess = null; streak = {}; best = {};
  }

  function recordBest(name) {
    if ((streak[name] || 0) > (best[name] || 0)) best[name] = streak[name] || 0;
  }

  // After a reveal, move the run forward (correct) or pass the hand (wrong).
  function advanceRun(room) {
    if (phase !== "reveal") return;
    if (lastCorrect) {
      streak[activeName] = (streak[activeName] || 0) + 1;
      recordBest(activeName);
      idx++;
      if (idx + 1 >= deck.items.length) { pickDeck(); } // ran out: fresh deck, streak kept
      lastCorrect = null; lastGuess = null;
      phase = "playing";
    } else {
      // Wrong: their run ends, hand passes, fresh deck.
      streak[activeName] = 0;
      startRun(room, true);
    }
  }

  function topStreak(room) {
    const present = new Set(); room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let bn = null;
    for (const n in best) { if (!present.has(n)) continue; if (!bn || best[n] > best[bn]) bn = n; }
    return (bn && best[bn] > 0) ? { name: bn, count: best[bn] } : null;
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { resetAll(); startRun(room, false); },
    onAdvance: (room) => {
      if (phase === "lobby") { resetAll(); startRun(room, false); }
      else if (phase === "reveal") { advanceRun(room); }  // host can drive the run too
      else if (phase === "finished") { resetAll(); }
    },
    onReset: resetAll,
    onEndSession: (room) => {
      if (phase === "lobby" || phase === "finished") return;
      if (activeName) recordBest(activeName);
      phase = "finished";
    },
    onPlayerLeave: (room, p) => {
      if (phase === "lobby" || phase === "finished") return;
      if (p && p.name === activeName) { recordBest(activeName); streak[activeName] = 0; startRun(room, true); }
    },
    onMessage: (room, p, msg) => {
      if (!p || p.name !== activeName) return;
      if (msg.t === "guess" && phase === "playing") {
        const dir = msg.dir === "higher" ? "higher" : (msg.dir === "lower" ? "lower" : null);
        const a = cardA(), bC = cardB();
        if (!dir || !a || !bC) return;
        lastGuess = dir;
        // Ties are lenient (either guess counts).
        lastCorrect = (bC.value === a.value) || (dir === "higher" ? bC.value >= a.value : bC.value <= a.value);
        phase = "reveal";
      } else if (msg.t === "cont" && phase === "reveal") {
        advanceRun(room); // the active player drives their own run
      }
    },
    serializeRound: (room) => {
      const r = {};
      if (phase === "lobby") return r;
      r.deck = deck ? deck.name : "";
      r.unit = deck ? deck.unit : "";
      if (activeName) { r.active_id = activeName; r.active_name = activeName; }
      const a = cardA(), bC = cardB();
      if (a) r.cardA = { label: a.label, value: a.value, unit: deck.unit };
      if (bC) r.cardB = (phase === "reveal")
        ? { label: bC.label, value: bC.value, unit: deck.unit }
        : { label: bC.label, value: null, unit: deck.unit };
      r.streak = Object.assign({}, streak);
      if (phase === "reveal") { r.lastCorrect = lastCorrect; r.lastGuess = lastGuess; }
      if (phase === "finished") {
        const t = topStreak(room);
        if (t) r.mvp = { label: "Plus longue série", emoji: "📈", name: t.name, value: t.count + " d'affilée" };
      }
      return r;
    },
    tick: () => false,
  };
}

module.exports = {
  id: "higher_lower",
  name: "Plus ou Moins",
  emoji: "📈",
  desc: "Plus haut ou plus bas ? Devine la stat et enchaîne les bonnes séries.",
  create,
};
