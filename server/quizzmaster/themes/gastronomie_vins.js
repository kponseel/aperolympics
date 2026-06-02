// QuizzMaster — thème 🍷 Gastronomie & Vins.
// 40 questions : cuisine française, vins, fromages, plats du monde, terroir.

module.exports = [
  // --- Vins français ---
  { text: "Quel cépage rouge fait la quasi-totalité des vins de Bourgogne ?", options: ["Cabernet Sauvignon", "Pinot Noir", "Merlot", "Syrah"], correct: 1 },
  { text: "Quel cépage blanc règne en maître à Chablis ?", options: ["Sauvignon", "Chardonnay", "Riesling", "Viognier"], correct: 1 },
  { text: "Quelle région produit le Sancerre ?", options: ["Bourgogne", "Loire", "Bordeaux", "Alsace"], correct: 1 },
  { text: "Quel département produit le plus de Champagne ?", options: ["Aube", "Marne", "Aisne", "Haute-Marne"], correct: 1 },
  { text: "Quel cépage donne le Beaujolais ?", options: ["Gamay", "Pinot Noir", "Syrah", "Grenache"], correct: 0 },
  { text: "Quel vin doux est produit dans le Sauternais (Gironde) ?", options: ["Banyuls", "Sauternes", "Muscat de Beaumes-de-Venise", "Pineau"], correct: 1 },
  { text: "Quel cépage emblématique du Rhône Nord produit l'Hermitage rouge ?", options: ["Grenache", "Mourvèdre", "Syrah", "Cinsault"], correct: 2 },
  { text: "Que désigne le terme « millésime » ?", options: ["Le degré d'alcool", "L'année de récolte du raisin", "Le sol du vignoble", "Le nombre de bouteilles produites"], correct: 1 },
  { text: "Quelle bouteille standard de vin contient combien de centilitres ?", options: ["50 cl", "70 cl", "75 cl", "100 cl"], correct: 2 },
  { text: "Quel cépage blanc se reconnaît à ses notes de pamplemousse et de buis ?", options: ["Chardonnay", "Sauvignon Blanc", "Riesling", "Viognier"], correct: 1 },

  // --- Fromages ---
  { text: "Quel fromage AOP de Roquefort est affiné dans des grottes ?", options: ["Bleu d'Auvergne", "Roquefort", "Bleu de Bresse", "Fourme d'Ambert"], correct: 1 },
  { text: "Le Comté est un fromage au lait de…", options: ["Brebis", "Chèvre", "Vache", "Bufflonne"], correct: 2 },
  { text: "Quel fromage est à pâte molle et croûte fleurie blanche ?", options: ["Comté", "Camembert", "Roquefort", "Cantal"], correct: 1 },
  { text: "De quel pays vient la mozzarella di bufala ?", options: ["France", "Italie", "Grèce", "Suisse"], correct: 1 },
  { text: "Quel fromage suisse est traditionnellement fondu pour la raclette ?", options: ["Gruyère", "Emmental", "Raclette", "Tomme"], correct: 2 },
  { text: "Le Beaufort est typique de quel massif ?", options: ["Vosges", "Pyrénées", "Alpes", "Massif Central"], correct: 2 },

  // --- Cuisine française ---
  { text: "Quelle est l'origine du « boeuf bourguignon » ?", options: ["Lyon", "Bourgogne", "Provence", "Normandie"], correct: 1 },
  { text: "Quel ingrédient principal entre dans la pâte à choux ?", options: ["Levure", "Beurre + œufs + farine + eau", "Pommes de terre", "Crème"], correct: 1 },
  { text: "Quelle sauce mère est à base de roux blanc et de lait ?", options: ["Béchamel", "Hollandaise", "Espagnole", "Velouté"], correct: 0 },
  { text: "Quel chef étoilé est associé à la « nouvelle cuisine » dans les années 70 ?", options: ["Auguste Escoffier", "Paul Bocuse", "Joël Robuchon", "Alain Ducasse"], correct: 1 },
  { text: "Le Kouign-amann est une spécialité de quelle région ?", options: ["Alsace", "Bretagne", "Provence", "Auvergne"], correct: 1 },
  { text: "Quel poisson entre dans la composition traditionnelle de la quenelle lyonnaise ?", options: ["Sole", "Brochet", "Truite", "Saumon"], correct: 1 },
  { text: "Combien de temps minimum doit-on affiner un Parmigiano Reggiano AOP ?", options: ["6 mois", "12 mois", "24 mois", "36 mois"], correct: 1 },

  // --- Plats du monde ---
  { text: "De quel pays vient le sushi ?", options: ["Chine", "Japon", "Corée", "Thaïlande"], correct: 1 },
  { text: "Quel plat espagnol mélange riz, safran, fruits de mer et viande ?", options: ["Risotto", "Paella", "Couscous", "Tajine"], correct: 1 },
  { text: "De quel pays est originaire le ceviche ?", options: ["Mexique", "Pérou", "Chili", "Brésil"], correct: 1 },
  { text: "Le « pho » est un plat traditionnel de quel pays ?", options: ["Thaïlande", "Cambodge", "Vietnam", "Laos"], correct: 2 },
  { text: "Le ras el-hanout est un mélange d'épices typique de quelle région ?", options: ["Inde", "Maghreb", "Mexique", "Éthiopie"], correct: 1 },
  { text: "Le falafel est traditionnellement à base de…", options: ["Pois chiches ou fèves", "Lentilles", "Quinoa", "Haricots noirs"], correct: 0 },
  { text: "Le « parmigiano » est un fromage de quelle région italienne ?", options: ["Toscane", "Émilie-Romagne", "Sicile", "Piémont"], correct: 1 },

  // --- Boissons & spiritueux ---
  { text: "À partir de quoi est distillé le calvados ?", options: ["Raisin", "Poire", "Pommes (cidre)", "Prune"], correct: 2 },
  { text: "Combien de céréales différentes faut-il pour un whisky « single malt » ?", options: ["1 (orge maltée)", "2", "3", "Toutes"], correct: 0 },
  { text: "Quel cocktail mélange rhum blanc, citron vert et menthe ?", options: ["Daiquiri", "Mojito", "Caipirinha", "Piña Colada"], correct: 1 },
  { text: "L'absinthe est traditionnellement faite à base de quelle plante ?", options: ["Anis", "Grande absinthe (artemisia)", "Genièvre", "Menthe poivrée"], correct: 1 },
  { text: "Le saké est obtenu par fermentation de…", options: ["Raisin", "Orge", "Riz", "Pomme"], correct: 2 },

  // --- Techniques / repères ---
  { text: "« Mise en place » signifie en cuisine…", options: ["Servir l'assiette", "Préparer tous les ingrédients avant cuisson", "Dresser la table", "Goûter le plat"], correct: 1 },
  { text: "Quelle température idéale pour servir un vin rouge tannique de garde ?", options: ["8-10 °C", "12-14 °C", "16-18 °C", "22-24 °C"], correct: 2 },
  { text: "Quel fruit constitue la base du chutney indien traditionnel ?", options: ["Pomme", "Mangue", "Banane", "Tomate"], correct: 1 },
  { text: "Quel ingrédient donne sa couleur jaune au safran ?", options: ["Le pistil de Crocus sativus", "Le curcuma", "L'œuf", "Le miel"], correct: 0 },
  { text: "Quelle pâte est utilisée pour confectionner les baklavas ?", options: ["Brisée", "Sablée", "Phyllo (filo)", "Sucrée"], correct: 2 },
];
