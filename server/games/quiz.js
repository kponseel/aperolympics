// Quiz — server-authoritative, ported from esp32-hub/src/games/quiz.cpp.
//
// This file is the reference for porting the other 15 games: copy the shape
// (a `create()` returning the hooks below) and translate the matching .cpp.
//
// Hook contract (mirror of games/game_api.h). Every hook receives the `room`
// (use room.players / room.activePlayers()); never broadcast yourself — the
// core does it after each hook and whenever tick() returns true.
//   phase()                  -> "lobby" | "playing" | "reveal" | "finished"
//   onSelect(room)           -> entered from the hub (reset)
//   onStart(room)            -> explicit start (optional)
//   onAdvance(room)          -> NEXT pressed (host / admin)
//   onReset(room)            -> full reset
//   onEndSession(room)       -> host pressed 🏁 (loop-only games; flip to "finished")
//   onPlayerJoin(room, p)    -> optional
//   onPlayerLeave(room, p)   -> optional
//   onMessage(room, p, msg)  -> game-specific intent (server decides outcomes)
//   serializeRound(room)     -> object put in state.round
//   serializePrivate(room,p) -> per-player whisper, or null (optional)
//   tick(room, nowMs)        -> return true if state changed (timers)
//
// Reserved keys on `state.round` at phase==="finished" — consumed by the
// shared fin-de-partie screen in public/app.js (renderResults):
//   mvp:           { label, name, value, emoji? }   per-game session stat
//   winner_banner: { text, emoji? }                 role/cup games' headline
//
// CLIENT-side (public/games/<id>.js) registration flags consumed by the SPA:
//   scored:     true  -> render a 3-medal podium at "finished" (else "Partie jouée — N")
//   endable:    true  -> show the 🏁 topbar button (host can force "finished")
//   minPlayers: N     -> hub card shows "👥 N+" badge; below this disables Démarrer
//   renderFinishedExtras(area, state, helpers) -> optional hook to layer
//                       game-specific reveal content under the shared screen
//                       (wolves uses it for the role roster).

const QUESTION_TIME_MS = 10000; // max answer time per question (10 s)
const QUESTIONS_PER_MATCH = 10; // 10 random questions drawn from the bank below

// Bank of 150 questions; each round picks QUESTIONS_PER_MATCH at random so two
// games in a row don't feel identical. The first 25 are the original set kept
// in their original order so a deterministic test run (env QUIZ_NO_SHUFFLE=1)
// still hits "Capitale France = Paris" at index 1 as Q1.
const QUESTION_BANK = [
  // --- Original 25 (test-friendly head; do not reorder) ---
  { text: "Quelle est la capitale de la France ?", options: ["Lyon", "Paris", "Marseille", "Nice"], correct: 1 },
  { text: "Combien font 7 × 8 ?", options: ["54", "56", "64", "48"], correct: 1 },
  { text: "Quel gaz les plantes absorbent-elles ?", options: ["Oxygène", "Azote", "CO₂", "Hélium"], correct: 2 },
  { text: "Quel est le plus grand océan ?", options: ["Atlantique", "Indien", "Arctique", "Pacifique"], correct: 3 },
  { text: "Combien de bits dans un octet ?", options: ["4", "8", "16", "32"], correct: 1 },
  { text: "Quelle est la capitale de l'Espagne ?", options: ["Lisbonne", "Madrid", "Athènes", "Rome"], correct: 1 },
  { text: "Quelle est la plus grosse planète du système solaire ?", options: ["Mars", "Saturne", "Jupiter", "Neptune"], correct: 2 },
  { text: "Combien y a-t-il de continents ?", options: ["4", "5", "6", "7"], correct: 3 },
  { text: "Quel animal a le plus long cou ?", options: ["Autruche", "Lama", "Girafe", "Flamant"], correct: 2 },
  { text: "Qui a peint la Joconde ?", options: ["Michel-Ange", "Raphaël", "Léonard de Vinci", "Picasso"], correct: 2 },
  { text: "Comment s'appelle un bébé chien ?", options: ["Chaton", "Chiot", "Faon", "Poulain"], correct: 1 },
  { text: "Quel est le plus grand désert chaud du monde ?", options: ["Gobi", "Kalahari", "Atacama", "Sahara"], correct: 3 },
  { text: "En quelle année est tombé le Mur de Berlin ?", options: ["1985", "1989", "1991", "1993"], correct: 1 },
  { text: "Combien de touches a un piano classique ?", options: ["76", "82", "88", "96"], correct: 2 },
  { text: "Quelle est la monnaie du Japon ?", options: ["Won", "Yuan", "Yen", "Baht"], correct: 2 },
  { text: "Quel est le plus haut sommet du monde ?", options: ["K2", "Mont Blanc", "Everest", "Kilimandjaro"], correct: 2 },
  { text: "Quel sport pratique Roger Federer ?", options: ["Golf", "Tennis", "Ski", "Basket"], correct: 1 },
  { text: "Combien de joueurs dans une équipe de foot ?", options: ["9", "10", "11", "12"], correct: 2 },
  { text: "Quelle est la capitale de l'Australie ?", options: ["Sydney", "Melbourne", "Canberra", "Perth"], correct: 2 },
  { text: "Quel auteur a écrit « Les Misérables » ?", options: ["Zola", "Hugo", "Balzac", "Dumas"], correct: 1 },
  { text: "Combien d'os dans le corps humain adulte ?", options: ["186", "206", "256", "306"], correct: 1 },
  { text: "Quelle planète a des anneaux célèbres ?", options: ["Mars", "Jupiter", "Saturne", "Uranus"], correct: 2 },
  { text: "Quel est le pays le plus peuplé au monde ?", options: ["Chine", "Inde", "USA", "Indonésie"], correct: 1 },
  { text: "Combien de côtés a un hexagone ?", options: ["5", "6", "7", "8"], correct: 1 },
  { text: "Combien de cordes sur une guitare standard ?", options: ["4", "5", "6", "7"], correct: 2 },

  // --- Capitales (30) ---
  { text: "Quelle est la capitale du Portugal ?", options: ["Lisbonne", "Porto", "Madrid", "Séville"], correct: 0 },
  { text: "Quelle est la capitale de l'Italie ?", options: ["Milan", "Naples", "Rome", "Florence"], correct: 2 },
  { text: "Quelle est la capitale de l'Allemagne ?", options: ["Munich", "Berlin", "Hambourg", "Francfort"], correct: 1 },
  { text: "Quelle est la capitale du Royaume-Uni ?", options: ["Édimbourg", "Manchester", "Londres", "Liverpool"], correct: 2 },
  { text: "Quelle est la capitale de la Russie ?", options: ["Saint-Pétersbourg", "Moscou", "Kiev", "Volgograd"], correct: 1 },
  { text: "Quelle est la capitale de la Belgique ?", options: ["Anvers", "Liège", "Bruxelles", "Bruges"], correct: 2 },
  { text: "Quelle est la capitale du Maroc ?", options: ["Casablanca", "Marrakech", "Fès", "Rabat"], correct: 3 },
  { text: "Quelle est la capitale de la Chine ?", options: ["Shanghai", "Pékin", "Hong Kong", "Canton"], correct: 1 },
  { text: "Quelle est la capitale de la Pologne ?", options: ["Cracovie", "Gdansk", "Varsovie", "Lodz"], correct: 2 },
  { text: "Quelle est la capitale de l'Autriche ?", options: ["Salzbourg", "Graz", "Innsbruck", "Vienne"], correct: 3 },
  { text: "Quelle est la capitale de la Suède ?", options: ["Göteborg", "Stockholm", "Malmö", "Uppsala"], correct: 1 },
  { text: "Quelle est la capitale de la Norvège ?", options: ["Bergen", "Oslo", "Trondheim", "Stavanger"], correct: 1 },
  { text: "Quelle est la capitale de la Finlande ?", options: ["Helsinki", "Turku", "Tampere", "Espoo"], correct: 0 },
  { text: "Quelle est la capitale du Danemark ?", options: ["Aarhus", "Odense", "Copenhague", "Aalborg"], correct: 2 },
  { text: "Quelle est la capitale de la Hongrie ?", options: ["Debrecen", "Budapest", "Szeged", "Pécs"], correct: 1 },
  { text: "Quelle est la capitale du Canada ?", options: ["Toronto", "Vancouver", "Ottawa", "Montréal"], correct: 2 },
  { text: "Quelle est la capitale de la Turquie ?", options: ["Istanbul", "Ankara", "Izmir", "Antalya"], correct: 1 },
  { text: "Quelle est la capitale de la Grèce ?", options: ["Thessalonique", "Athènes", "Patras", "Sparte"], correct: 1 },
  { text: "Quelle est la capitale de l'Égypte ?", options: ["Alexandrie", "Le Caire", "Louxor", "Gizeh"], correct: 1 },
  { text: "Quelle est la capitale de l'Argentine ?", options: ["Córdoba", "Rosario", "Buenos Aires", "Mendoza"], correct: 2 },
  { text: "Quelle est la capitale de la Corée du Sud ?", options: ["Busan", "Séoul", "Incheon", "Daegu"], correct: 1 },
  { text: "Quelle est la capitale de l'Inde ?", options: ["Bombay", "Calcutta", "Bangalore", "New Delhi"], correct: 3 },
  { text: "Quelle est la capitale de la Thaïlande ?", options: ["Phuket", "Bangkok", "Chiang Mai", "Pattaya"], correct: 1 },
  { text: "Quelle est la capitale du Brésil ?", options: ["Rio de Janeiro", "São Paulo", "Brasilia", "Salvador"], correct: 2 },
  { text: "Quelle est la capitale du Mexique ?", options: ["Guadalajara", "Mexico", "Monterrey", "Cancún"], correct: 1 },
  { text: "Quelle est la capitale du Chili ?", options: ["Valparaíso", "Concepción", "Santiago", "La Serena"], correct: 2 },
  { text: "Quelle est la capitale de l'Irlande ?", options: ["Cork", "Belfast", "Galway", "Dublin"], correct: 3 },
  { text: "Quelle est la capitale de la Suisse ?", options: ["Zurich", "Genève", "Berne", "Bâle"], correct: 2 },
  { text: "Quelle est la capitale du Vietnam ?", options: ["Hô Chi Minh-Ville", "Hanoï", "Da Nang", "Huế"], correct: 1 },
  { text: "Quelle est la capitale de l'Iran ?", options: ["Ispahan", "Téhéran", "Chiraz", "Tabriz"], correct: 1 },

  // --- Géographie générale (14) ---
  { text: "Quel est le plus grand pays du monde en superficie ?", options: ["Chine", "USA", "Canada", "Russie"], correct: 3 },
  { text: "Quel est le plus petit continent ?", options: ["Europe", "Antarctique", "Océanie", "Amérique du Sud"], correct: 2 },
  { text: "Quel est le plus long fleuve d'Afrique ?", options: ["Congo", "Nil", "Niger", "Zambèze"], correct: 1 },
  { text: "Quel est le plus haut sommet d'Afrique ?", options: ["Mont Kenya", "Atlas", "Kilimandjaro", "Ras Dashen"], correct: 2 },
  { text: "Quelle est la plus grande île du monde ?", options: ["Bornéo", "Madagascar", "Nouvelle-Guinée", "Groenland"], correct: 3 },
  { text: "Quel pays abrite le Machu Picchu ?", options: ["Bolivie", "Pérou", "Équateur", "Chili"], correct: 1 },
  { text: "Sur quel continent se trouve le Sahara ?", options: ["Asie", "Afrique", "Amérique du Sud", "Océanie"], correct: 1 },
  { text: "Quelle est la deuxième plus grande ville de France ?", options: ["Lyon", "Marseille", "Toulouse", "Bordeaux"], correct: 1 },
  { text: "Quel détroit sépare l'Europe de l'Afrique ?", options: ["Bosphore", "Hormuz", "Gibraltar", "Béring"], correct: 2 },
  { text: "Sur quel continent vit naturellement le kangourou ?", options: ["Asie", "Afrique", "Océanie", "Amérique du Sud"], correct: 2 },
  { text: "Quel est le plus grand lac d'Afrique ?", options: ["Lac Tanganyika", "Lac Tchad", "Lac Malawi", "Lac Victoria"], correct: 3 },
  { text: "Dans quel pays se trouve le mont Fuji ?", options: ["Chine", "Corée", "Vietnam", "Japon"], correct: 3 },
  { text: "Quel est le plus haut volcan d'Europe ?", options: ["Vésuve", "Stromboli", "Etna", "Eyjafjallajökull"], correct: 2 },

  // --- Maths / nombres / sport (18) ---
  { text: "Combien de minutes dans une heure ?", options: ["50", "60", "100", "120"], correct: 1 },
  { text: "Combien d'heures dans une journée ?", options: ["12", "24", "48", "60"], correct: 1 },
  { text: "Combien de jours dans une année non-bissextile ?", options: ["360", "364", "365", "366"], correct: 2 },
  { text: "Combien d'années dans un siècle ?", options: ["10", "100", "1000", "10000"], correct: 1 },
  { text: "Combien de mois dans une année ?", options: ["10", "11", "12", "13"], correct: 2 },
  { text: "Combien de jambes a une araignée ?", options: ["6", "8", "10", "12"], correct: 1 },
  { text: "Combien de pattes a une coccinelle ?", options: ["4", "6", "8", "10"], correct: 1 },
  { text: "Combien de doigts a une main humaine ?", options: ["4", "5", "6", "10"], correct: 1 },
  { text: "Combien y a-t-il de signes du zodiaque ?", options: ["10", "11", "12", "13"], correct: 2 },
  { text: "Combien de joueurs dans une équipe de basket sur le terrain ?", options: ["4", "5", "6", "7"], correct: 1 },
  { text: "Combien de joueurs dans une équipe de rugby à XV ?", options: ["13", "14", "15", "16"], correct: 2 },
  { text: "Combien y a-t-il de planètes dans le système solaire ?", options: ["7", "8", "9", "10"], correct: 1 },
  { text: "Combien d'États composent les USA ?", options: ["48", "49", "50", "51"], correct: 2 },
  { text: "Combien de cartes dans un jeu standard (sans jokers) ?", options: ["48", "50", "52", "54"], correct: 2 },
  { text: "Combien y a-t-il de lettres dans l'alphabet français ?", options: ["24", "25", "26", "28"], correct: 2 },
  { text: "Combien de minutes dure un match de foot (hors prolongations) ?", options: ["60", "80", "90", "100"], correct: 2 },
  { text: "Combien de joueurs dans une équipe de handball (en jeu) ?", options: ["6", "7", "8", "11"], correct: 1 },

  // --- Sciences (15) ---
  { text: "Quelle est la formule chimique de l'eau ?", options: ["H2O", "CO2", "O2", "HO2"], correct: 0 },
  { text: "Quel est le symbole chimique du fer ?", options: ["F", "Fe", "Ir", "Ie"], correct: 1 },
  { text: "Quel est le symbole chimique du sodium ?", options: ["So", "Sd", "Na", "S"], correct: 2 },
  { text: "Quel métal est liquide à température ambiante ?", options: ["Argent", "Mercure", "Aluminium", "Plomb"], correct: 1 },
  { text: "Quel est le plus long os du corps humain ?", options: ["Tibia", "Humérus", "Fémur", "Radius"], correct: 2 },
  { text: "Combien de chambres a le cœur humain ?", options: ["2", "3", "4", "5"], correct: 2 },
  { text: "Quel scientifique a énoncé la théorie de la relativité ?", options: ["Newton", "Einstein", "Hawking", "Curie"], correct: 1 },
  { text: "Qui a découvert la pénicilline ?", options: ["Pasteur", "Fleming", "Koch", "Mendel"], correct: 1 },
  { text: "Qui a découvert la loi de la gravitation universelle ?", options: ["Galilée", "Newton", "Kepler", "Einstein"], correct: 1 },
  { text: "Quelle planète est la plus proche du Soleil ?", options: ["Vénus", "Mars", "Mercure", "Terre"], correct: 2 },
  { text: "Comment appelle-t-on la planète rouge ?", options: ["Vénus", "Mars", "Jupiter", "Saturne"], correct: 1 },
  { text: "Qui a été le premier homme à marcher sur la Lune ?", options: ["Buzz Aldrin", "Yuri Gagarine", "Neil Armstrong", "John Glenn"], correct: 2 },

  // --- Histoire (9) ---
  { text: "En quelle année a commencé la Première Guerre mondiale ?", options: ["1912", "1914", "1916", "1918"], correct: 1 },
  { text: "En quelle année s'est terminée la Seconde Guerre mondiale ?", options: ["1943", "1944", "1945", "1946"], correct: 2 },
  { text: "Qui a découvert l'Amérique en 1492 ?", options: ["Magellan", "Vasco de Gama", "Christophe Colomb", "Cortés"], correct: 2 },
  { text: "Qui fut le premier président des États-Unis ?", options: ["John Adams", "Thomas Jefferson", "George Washington", "Abraham Lincoln"], correct: 2 },
  { text: "Qui fut le premier président de la Ve République française ?", options: ["Pompidou", "De Gaulle", "Mitterrand", "Giscard d'Estaing"], correct: 1 },
  { text: "En quelle année a débuté la Révolution française ?", options: ["1689", "1789", "1815", "1848"], correct: 1 },
  { text: "Sur quelle île Napoléon est-il mort ?", options: ["Elbe", "Corse", "Sainte-Hélène", "Madère"], correct: 2 },
  { text: "Qui a conçu la Tour Eiffel ?", options: ["Le Corbusier", "Gustave Eiffel", "Haussmann", "Garnier"], correct: 1 },
  { text: "En quelle année la Tour Eiffel a-t-elle été inaugurée ?", options: ["1879", "1889", "1899", "1909"], correct: 1 },

  // --- Littérature (7) ---
  { text: "Qui a écrit « Le Petit Prince » ?", options: ["Camus", "Saint-Exupéry", "Voltaire", "Hugo"], correct: 1 },
  { text: "Qui a écrit « Roméo et Juliette » ?", options: ["Molière", "Shakespeare", "Goethe", "Wilde"], correct: 1 },
  { text: "Qui a écrit « Les Trois Mousquetaires » ?", options: ["Dumas", "Balzac", "Stendhal", "Flaubert"], correct: 0 },
  { text: "Qui a écrit « 1984 » ?", options: ["Huxley", "Orwell", "Asimov", "Bradbury"], correct: 1 },
  { text: "Qui a écrit « Le Comte de Monte-Cristo » ?", options: ["Hugo", "Dumas", "Maupassant", "Verne"], correct: 1 },
  { text: "Qui a écrit la saga « Harry Potter » ?", options: ["Stephen King", "J.K. Rowling", "J.R.R. Tolkien", "Suzanne Collins"], correct: 1 },

  // --- Arts / musique (7) ---
  { text: "Qui a peint le plafond de la chapelle Sixtine ?", options: ["Raphaël", "Léonard de Vinci", "Michel-Ange", "Caravage"], correct: 2 },
  { text: "Qui a peint « La Nuit étoilée » ?", options: ["Monet", "Van Gogh", "Cézanne", "Renoir"], correct: 1 },
  { text: "Qui a composé « Lettre à Élise » ?", options: ["Mozart", "Bach", "Beethoven", "Chopin"], correct: 2 },
  { text: "Quelle note se trouve entre Fa et La ?", options: ["Mi", "Sol", "Si", "Ré"], correct: 1 },
  { text: "Quel instrument est l'emblème national de l'Écosse ?", options: ["Violon", "Cornemuse", "Harpe", "Accordéon"], correct: 1 },
  { text: "Combien de touches noires sur un piano classique ?", options: ["32", "36", "40", "44"], correct: 1 },

  // --- Sport (10) ---
  { text: "Quel sport pratique Tony Parker ?", options: ["Tennis", "Basketball", "Football", "Rugby"], correct: 1 },
  { text: "Quel sport pratique Cristiano Ronaldo ?", options: ["Football", "Tennis", "Golf", "Rugby"], correct: 0 },
  { text: "Quel sport pratique Usain Bolt ?", options: ["Natation", "Athlétisme", "Cyclisme", "Football"], correct: 1 },
  { text: "Quel sport pratique Tiger Woods ?", options: ["Tennis", "Golf", "Hockey", "Baseball"], correct: 1 },
  { text: "Quel sport pratique Rafael Nadal ?", options: ["Football", "Golf", "Tennis", "Cyclisme"], correct: 2 },
  { text: "Quel est le sport national du Japon ?", options: ["Judo", "Karaté", "Sumo", "Kendo"], correct: 2 },
  { text: "Quel sport est le plus populaire en Inde ?", options: ["Football", "Cricket", "Hockey", "Tennis"], correct: 1 },
  { text: "Dans quel pays le judo a-t-il été inventé ?", options: ["Chine", "Corée", "Japon", "Vietnam"], correct: 2 },
  { text: "Quel sport collectif a été inventé aux États-Unis ?", options: ["Football", "Basketball", "Rugby", "Hockey"], correct: 1 },
  { text: "En quelle année se sont déroulés les premiers JO modernes ?", options: ["1888", "1896", "1900", "1912"], correct: 1 },

  // --- Animaux (5) ---
  { text: "Quel est l'animal terrestre le plus rapide ?", options: ["Lion", "Antilope", "Guépard", "Cheval"], correct: 2 },
  { text: "Quel est le plus grand mammifère terrestre ?", options: ["Rhinocéros blanc", "Hippopotame", "Éléphant d'Afrique", "Girafe"], correct: 2 },
  { text: "Quel animal symbolise la France ?", options: ["Lion", "Aigle", "Coq", "Loup"], correct: 2 },
  { text: "Quel est l'animal national de l'Australie ?", options: ["Koala", "Kangourou", "Wombat", "Dingo"], correct: 1 },
  { text: "Quel oiseau est l'emblème des États-Unis ?", options: ["Aigle royal", "Pygargue à tête blanche", "Faucon pèlerin", "Colibri"], correct: 1 },

  // --- Langues / drapeaux / monnaies (9) ---
  { text: "Quelle est la langue officielle du Brésil ?", options: ["Espagnol", "Portugais", "Anglais", "Français"], correct: 1 },
  { text: "Quelle est la langue principale en Égypte ?", options: ["Arabe", "Berbère", "Anglais", "Copte"], correct: 0 },
  { text: "Quelle est la monnaie du Royaume-Uni ?", options: ["Euro", "Livre sterling", "Dollar", "Couronne"], correct: 1 },
  { text: "Quelle est la monnaie de la Suisse ?", options: ["Euro", "Franc suisse", "Couronne", "Lira"], correct: 1 },
  { text: "De quelles couleurs est le drapeau du Japon ?", options: ["Bleu et blanc", "Rouge et blanc", "Vert et blanc", "Rouge et noir"], correct: 1 },
  { text: "Combien de couleurs sur le drapeau français ?", options: ["2", "3", "4", "5"], correct: 1 },
  { text: "Combien de couleurs sur le drapeau italien ?", options: ["2", "3", "4", "5"], correct: 1 },
  { text: "Quel pays produit le plus de café au monde ?", options: ["Colombie", "Vietnam", "Éthiopie", "Brésil"], correct: 3 },

  // --- Culture pop / divers (12) ---
  { text: "De quelle couleur sont les taxis traditionnels de Londres ?", options: ["Jaune", "Rouge", "Noire", "Blanc"], correct: 2 },
  { text: "De quelle couleur sont les bus à impériale de Londres ?", options: ["Bleu", "Rouge", "Vert", "Noir"], correct: 1 },
  { text: "Quel sport pratiquait Michael Jordan ?", options: ["Baseball", "Football américain", "Basketball", "Tennis"], correct: 2 },
  { text: "Quel instrument est associé au tango argentin ?", options: ["Bandonéon", "Violon", "Saxophone", "Trompette"], correct: 0 },
  { text: "Quelle danse est emblématique du Brésil ?", options: ["Tango", "Samba", "Flamenco", "Salsa"], correct: 1 },
  { text: "De quel pays est originaire le flamenco ?", options: ["Italie", "Portugal", "Espagne", "Mexique"], correct: 2 },
  { text: "Quel est le bâtiment le plus haut du monde ?", options: ["Empire State Building", "Burj Khalifa", "Shanghai Tower", "Taipei 101"], correct: 1 },
  { text: "Combien de couleurs différentes sur un cube Rubik's classique ?", options: ["4", "5", "6", "7"], correct: 2 },
  { text: "Quel sport olympique utilise un sabre, un fleuret ou une épée ?", options: ["Tir à l'arc", "Escrime", "Pentathlon", "Lutte"], correct: 1 },
];

function create() {
  let phase = "lobby";
  let questions = []; // freshly picked from QUESTION_BANK for each match
  let currentQ = -1;
  let questionStart = 0;
  let paused = false; // host pause: timer frozen, question hidden for everyone
  let pausedAt = 0;
  let streakNow = {};   // name -> current consecutive correct count
  let bestStreak = {};  // name -> longest correct streak achieved this session
  let lastGain = {};    // name -> points awarded on the most recent question (for the reveal screen)

  // Pick QUESTIONS_PER_MATCH from QUESTION_BANK. Shuffled (Fisher-Yates) by
  // default; set QUIZ_NO_SHUFFLE=1 in the server env for deterministic tests
  // (head-of-bank kept stable so the existing E2Es still see "Capitale France
  // = Paris" as the first prompt with `correct: 1`).
  function pickRound() {
    const arr = QUESTION_BANK.slice();
    if (process.env.QUIZ_NO_SHUFFLE !== "1") {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
    }
    questions = arr.slice(0, Math.min(QUESTIONS_PER_MATCH, arr.length));
  }

  function startQuestion(room, idx) {
    currentQ = idx;
    phase = "playing";
    questionStart = Date.now();
    paused = false;
    pausedAt = 0;
    room.players.forEach((p) => {
      p.answered = false;
      p.answer = -1;
    });
  }

  function allAnswered(room) {
    const a = room.activePlayers();
    return a.length > 0 && a.every((p) => p.answered);
  }

  function doReveal(room) {
    if (phase !== "playing") return; // idempotent: timeout vs all-answered
    const correct = questions[currentQ].correct;
    lastGain = {};
    room.activePlayers().forEach((p) => {
      if (p.answered && p.answer === correct) {
        let frac = 1 - p.answerMs / QUESTION_TIME_MS;
        if (frac < 0) frac = 0;
        const gain = 500 + Math.round(500 * frac);
        p.score += gain;
        lastGain[p.name] = gain;
        streakNow[p.name] = (streakNow[p.name] || 0) + 1;
        if (streakNow[p.name] > (bestStreak[p.name] || 0)) bestStreak[p.name] = streakNow[p.name];
      } else {
        streakNow[p.name] = 0;
      }
    });
    phase = "reveal";
  }

  function topStreak(room) {
    const present = new Set();
    room.activePlayers().forEach((p) => { if (p.name) present.add(p.name); });
    let best = null;
    for (const name in bestStreak) {
      if (!present.has(name)) continue;
      if (!best || bestStreak[name] > bestStreak[best]) best = name;
    }
    return (best && bestStreak[best] >= 2) ? { name: best, count: bestStreak[best] } : null;
  }

  function resetAll(room) {
    phase = "lobby";
    questions = [];
    currentQ = -1;
    paused = false;
    pausedAt = 0;
    streakNow = {};
    bestStreak = {};
    lastGain = {};
    room.players.forEach((p) => {
      p.score = 0;
      p.answered = false;
      p.answer = -1;
    });
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { pickRound(); if (questions.length) startQuestion(room, 0); },
    onAdvance: (room) => {
      if (phase === "lobby") { pickRound(); if (questions.length) startQuestion(room, 0); }
      else if (phase === "playing") { doReveal(room); }
      else if (phase === "reveal") {
        if (currentQ + 1 < questions.length) startQuestion(room, currentQ + 1);
        else phase = "finished";
      } else { resetAll(room); }
    },
    onReset: resetAll,
    // Host can cut a long quiz short — straight to fin de partie with the
    // current scores. Idempotent (lobby/finished are no-ops).
    onEndSession: () => { if (phase !== "lobby" && phase !== "finished") phase = "finished"; },
    onPlayerLeave: (room, p) => {
      // Don't let dropping mid-question preserve (and silently extend) a streak:
      // a timeout would zero it via doReveal's else-branch, so a disconnect should too.
      if (p && p.name && phase === "playing" && !p.answered) streakNow[p.name] = 0;
      if (phase === "playing" && allAnswered(room)) doReveal(room);
    },
    onMessage: (room, p, msg) => {
      if (!p) return;
      const isHost = room.hostName() === p.name;
      // Host pause/resume: freeze the timer; while paused the question is hidden
      // for everyone (serializeRound) and answers are refused.
      if (msg.t === "pause") {
        if (isHost && phase === "playing" && !paused) { paused = true; pausedAt = Date.now(); }
        return;
      }
      if (msg.t === "resume") {
        if (isHost && phase === "playing" && paused) { questionStart += Date.now() - pausedAt; paused = false; }
        return;
      }
      if (msg.t !== "answer") return;
      if (phase !== "playing" || paused || p.answered) return;
      const choice = msg.choice;
      if (typeof choice !== "number" || choice < 0 || choice > 3) return;
      p.answered = true;
      p.answer = choice;
      p.answerMs = Date.now() - questionStart;
      if (allAnswered(room)) doReveal(room);
    },
    serializeRound: (room) => {
      const r = { total: QUESTIONS_PER_MATCH };
      if (currentQ < 0 || !questions.length) return r;
      const q = questions[currentQ];
      r.idx = currentQ;
      if (phase === "playing" && paused) {
        r.paused = true; // hide everything while the host has paused
        return r;
      }
      if (phase === "playing" || phase === "reveal") {
        r.q = q.text;
        r.options = q.options.slice();
      }
      if (phase === "playing") {
        const elapsed = Date.now() - questionStart;
        const left = elapsed >= QUESTION_TIME_MS ? 0 : QUESTION_TIME_MS - elapsed;
        r.time_left_ms = left;
        r.time_total_ms = QUESTION_TIME_MS;
        r.points_now = 500 + Math.round(500 * (left / QUESTION_TIME_MS)); // points a correct answer earns right now
        r.answered = room.activePlayers().filter((p) => p.answered).length;
      } else if (phase === "reveal") {
        r.correct = q.correct;
        // Per-player score deltas for this question so the reveal screen can
        // show "+X pts" next to each correct answerer.
        r.gains = Object.keys(lastGain).map((n) => ({ name: n, gain: lastGain[n] }));
      }
      if (phase === "finished") {
        const s = topStreak(room);
        if (s) r.mvp = { label: "Meilleure série de bonnes réponses", emoji: "🔥", name: s.name, value: s.count + " d'affilée" };
      }
      return r;
    },
    // Per-player: tell each player at reveal whether they got the question
    // right. `answer` is no longer in the public state (privacy), so the
    // ✅/❌ badge needs this whisper to know.
    serializePrivate: (room, viewer) => {
      if (!viewer || phase !== "reveal" || currentQ < 0 || !questions.length) return {};
      const correct = questions[currentQ].correct;
      return { my_correct: !!(viewer.answered && viewer.answer === correct) };
    },
    tick: (room, now) => {
      if (phase !== "playing" || paused) return false;
      if (now - questionStart >= QUESTION_TIME_MS) { doReveal(room); return true; }
      return true; // refresh the live countdown (points + timer bar) ~2x/s
    },
  };
}

module.exports = {
  id: "quiz",
  name: "Speed Quiz",
  emoji: "🧠",
  desc: "Questions à choix multiples, score au chrono.",
  create,
};
