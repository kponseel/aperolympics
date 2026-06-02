// QuizzMaster — thème 🇫🇷 France.
// 50 questions de culture française : géo, histoire, marques, présidents,
// expressions, cuisine régionale. Niveau "honnête connaisseur".

module.exports = [
  // --- Géographie ---
  { text: "Quel est le plus long fleuve de France ?", options: ["La Seine", "La Loire", "Le Rhône", "La Garonne"], correct: 1 },
  { text: "Combien y a-t-il de régions en France métropolitaine depuis 2016 ?", options: ["12", "13", "14", "22"], correct: 1 },
  { text: "Quelle est la plus haute montagne de France ?", options: ["Mont Aiguille", "Aiguille du Midi", "Mont Blanc", "Mont Ventoux"], correct: 2 },
  { text: "Dans quel département se trouve Strasbourg ?", options: ["Moselle", "Bas-Rhin", "Haut-Rhin", "Vosges"], correct: 1 },
  { text: "Quelle ville est surnommée « la Cité des Papes » ?", options: ["Arles", "Avignon", "Nîmes", "Aix-en-Provence"], correct: 1 },
  { text: "La Camargue se situe principalement dans le delta de quel fleuve ?", options: ["Rhône", "Hérault", "Var", "Aude"], correct: 0 },
  { text: "Quelle île est la plus grande de France métropolitaine ?", options: ["Belle-Île", "Ré", "Corse", "Oléron"], correct: 2 },
  { text: "Quel océan borde la façade ouest de la France ?", options: ["Pacifique", "Indien", "Atlantique", "Méditerranée"], correct: 2 },
  { text: "Combien de départements compte la France (avec l'outre-mer, 2024) ?", options: ["96", "100", "101", "104"], correct: 2 },
  { text: "Quelle ville héberge le Parlement européen côté France ?", options: ["Lyon", "Strasbourg", "Bruxelles", "Bordeaux"], correct: 1 },

  // --- Histoire ---
  { text: "En quelle année a été prise la Bastille ?", options: ["1789", "1792", "1799", "1804"], correct: 0 },
  { text: "Qui a été le premier président de la Ve République ?", options: ["Vincent Auriol", "Charles de Gaulle", "Georges Pompidou", "René Coty"], correct: 1 },
  { text: "En quelle année la France a-t-elle adopté l'euro pour les pièces et billets ?", options: ["1999", "2000", "2002", "2004"], correct: 2 },
  { text: "Quel roi de France était surnommé « le Roi-Soleil » ?", options: ["Louis XIII", "Louis XIV", "Louis XV", "Louis XVI"], correct: 1 },
  { text: "En quelle année a eu lieu la Révolution française ?", options: ["1789", "1815", "1848", "1871"], correct: 0 },
  { text: "Qui a peint « La Liberté guidant le peuple » ?", options: ["David", "Delacroix", "Géricault", "Monet"], correct: 1 },
  { text: "Quel président a été élu en 2017 et réélu en 2022 ?", options: ["François Hollande", "Nicolas Sarkozy", "Emmanuel Macron", "Édouard Philippe"], correct: 2 },
  { text: "Sous quel président la peine de mort a-t-elle été abolie en France (1981) ?", options: ["Giscard d'Estaing", "Mitterrand", "Chirac", "Pompidou"], correct: 1 },
  { text: "Quel traité signé en 1957 a fondé la Communauté économique européenne ?", options: ["Maastricht", "Rome", "Lisbonne", "Paris"], correct: 1 },
  { text: "Jeanne d'Arc a libéré quelle ville lors d'un siège célèbre ?", options: ["Reims", "Rouen", "Orléans", "Domrémy"], correct: 2 },

  // --- Présidents & politique ---
  { text: "Combien de temps dure un mandat présidentiel en France depuis 2002 ?", options: ["4 ans", "5 ans", "6 ans", "7 ans"], correct: 1 },
  { text: "À quel parti politique appartient historiquement Jacques Chirac ?", options: ["PS", "RPR/UMP", "FN", "UDF"], correct: 1 },
  { text: "Quel président a été surnommé « Tonton » ?", options: ["Mitterrand", "Chirac", "Pompidou", "Giscard"], correct: 0 },
  { text: "Qui était Premier ministre lors de la cohabitation de 1986-1988 ?", options: ["Lionel Jospin", "Jacques Chirac", "Alain Juppé", "Édouard Balladur"], correct: 1 },
  { text: "Combien de sénateurs siègent au Sénat français ?", options: ["348", "400", "577", "925"], correct: 0 },
  { text: "Combien y a-t-il de députés à l'Assemblée nationale ?", options: ["348", "400", "577", "925"], correct: 2 },

  // --- Marques & culture pop ---
  { text: "Quelle marque française a inventé le yaourt à boire « Yop » ?", options: ["Danone", "Yoplait", "Candia", "Lactel"], correct: 1 },
  { text: "Quelle marque automobile française produit la « Twingo » ?", options: ["Peugeot", "Renault", "Citroën", "Simca"], correct: 1 },
  { text: "Quelle entreprise française est leader mondial du luxe ?", options: ["Kering", "LVMH", "Hermès", "Chanel"], correct: 1 },
  { text: "Quelle marque française vend des biscuits « Petit Écolier » ?", options: ["LU", "BN", "Belin", "Brossard"], correct: 0 },
  { text: "Quel opérateur français existe depuis 1991 et était au départ « France Télécom » ?", options: ["SFR", "Bouygues", "Orange", "Free"], correct: 2 },
  { text: "« Le Petit Nicolas » a été créé par quel duo d'auteurs ?", options: ["Goscinny & Uderzo", "Goscinny & Sempé", "Tabary & Goscinny", "Hergé & Franquin"], correct: 1 },

  // --- Expressions & langue ---
  { text: "Que signifie l'expression « Avoir le cafard » ?", options: ["Être chanceux", "Être triste / déprimé", "Être en colère", "Avoir faim"], correct: 1 },
  { text: "« Poser un lapin » à quelqu'un, c'est…", options: ["Lui faire un cadeau", "Ne pas venir au rendez-vous", "Lui mentir", "Le surprendre"], correct: 1 },
  { text: "Combien y a-t-il de lettres dans l'alphabet français ?", options: ["24", "25", "26", "27"], correct: 2 },
  { text: "Quel mot français est utilisé dans le monde entier pour dire « croissant de pâte feuilletée » ?", options: ["Baguette", "Croissant", "Brioche", "Éclair"], correct: 1 },

  // --- Cuisine & terroir ---
  { text: "De quelle région provient le cassoulet ?", options: ["Bretagne", "Occitanie / Sud-Ouest", "Alsace", "Provence"], correct: 1 },
  { text: "Quel fromage est typique de la Normandie ?", options: ["Camembert", "Reblochon", "Roquefort", "Brie"], correct: 0 },
  { text: "Quel vin pétillant français est associé aux célébrations ?", options: ["Bordeaux", "Champagne", "Beaujolais", "Sancerre"], correct: 1 },
  { text: "La fondue savoyarde se prépare avec quels fromages principalement ?", options: ["Brie + Camembert", "Beaufort + Comté + Gruyère", "Roquefort + Bleu", "Chèvre + Reblochon"], correct: 1 },
  { text: "Quel est le plat emblématique de Marseille ?", options: ["Cassoulet", "Bouillabaisse", "Choucroute", "Galette"], correct: 1 },

  // --- Sport ---
  { text: "Quelle équipe a gagné la Coupe du Monde de football 2018 ?", options: ["Croatie", "France", "Allemagne", "Brésil"], correct: 1 },
  { text: "Combien de Tours de France a remporté Bernard Hinault ?", options: ["4", "5", "6", "7"], correct: 1 },
  { text: "Quel club français a remporté la Ligue des Champions en 1993 ?", options: ["PSG", "OM", "ASSE", "Monaco"], correct: 1 },
  { text: "Quelle joueuse française a remporté Roland-Garros en 2000 ?", options: ["Amélie Mauresmo", "Mary Pierce", "Marion Bartoli", "Caroline Garcia"], correct: 1 },

  // --- Cinéma & médias ---
  { text: "Quel acteur a joué « Astérix » dans le film « Astérix & Obélix : Mission Cléopâtre » ?", options: ["Gérard Depardieu", "Christian Clavier", "Jean Reno", "Édouard Baer"], correct: 1 },
  { text: "Quel festival de cinéma se tient chaque année à Cannes ?", options: ["Festival de la Croisette", "Festival International du Film", "Festival d'Avignon", "Berlinale"], correct: 1 },
  { text: "Qui a réalisé « Les Intouchables » (2011) ?", options: ["Luc Besson", "Olivier Nakache & Éric Toledano", "Cédric Klapisch", "Jean-Pierre Jeunet"], correct: 1 },
  { text: "Quel film français a eu plus de 19 millions de spectateurs en 2014 ?", options: ["Intouchables", "Qu'est-ce qu'on a fait au Bon Dieu ?", "Bienvenue chez les Ch'tis", "La Famille Bélier"], correct: 2 },

  // --- Divers ---
  { text: "Quel est le nom de la fête nationale française ?", options: ["8 mai", "11 novembre", "14 juillet", "1er mai"], correct: 2 },
  { text: "Quelle est la devise de la France ?", options: ["Liberté, Fraternité, Solidarité", "Liberté, Égalité, Fraternité", "Liberté, Justice, Égalité", "Liberté, Paix, Travail"], correct: 1 },
  { text: "Quel monument parisien a été inauguré pour l'Exposition Universelle de 1889 ?", options: ["Arc de Triomphe", "Tour Eiffel", "Sacré-Cœur", "Palais Garnier"], correct: 1 },
  { text: "Quel hymne national la France a-t-elle adopté ?", options: ["La Marseillaise", "Le Chant du Départ", "La Marche d'Henri IV", "L'Internationale"], correct: 0 },
];
