// QuizzMaster — thème 🏃 Olivier Agneray (DocuSign FR + ultra-trail). 50 q.
// Construit à partir du dossier bio (LinkedIn, UTMB World, ITRA, TheOrg,
// RocketReach, DocuSign events). Évite les données privées et les faits où les
// sources divergent (date exacte d'entrée chez DocuSign : 2019 vs 2021).

module.exports = [
  // ---------- DocuSign & carrière (1-15) ----------
  { text: "Quel est le poste actuel d'Olivier Agneray chez DocuSign ?", options: ["Account Executive","Manager, Solutions Consulting","CFO France","Sales Engineer junior"], correct: 1 },
  { text: "Quelle équipe régionale dirige-t-il ?", options: ["EMEA North","EMEA Enterprise South","NORAM Mid-Market","APAC Strategic"], correct: 1 },
  { text: "Depuis quelle année est-il Manager Solutions Consulting ?", options: ["2022","2023","2024","2025"], correct: 3 },
  { text: "Quel poste occupait-il juste avant d'être Manager ?", options: ["Senior Solutions Consultant","Principal Solutions Consultant","Account Executive","Customer Success Lead"], correct: 1 },
  { text: "Quel a été son premier poste chez DocuSign ?", options: ["Stage produit","Senior Solutions Consultant","Sales Manager","Directeur France"], correct: 1 },
  { text: "Quelle est sa ville de base professionnelle ?", options: ["Lyon","Paris","Dublin","Lille"], correct: 1 },
  { text: "Quelle société française l'employait juste avant DocuSign ?", options: ["Yousign","TechViz","PandaDoc","Universign"], correct: 1 },
  { text: "Quel poste avait-il chez TechViz (2018-19) ?", options: ["Stagiaire commercial","International Pre-Sales Engineer","Lead Developer","Product Manager"], correct: 1 },
  { text: "Dans quel cabinet a-t-il fait son stage d'audit en 2016-17 ?", options: ["KPMG","Mazars","Deloitte","EY"], correct: 1 },
  { text: "Combien d'années (approx) compte-t-il chez DocuSign à mi-2026 ?", options: ["1-2 ans","3-4 ans","5-7 ans","10+ ans"], correct: 2 },
  { text: "Quel ex-CEO de DocuSign dirige Ironclad — la société dont des collègues d'Olivier le rejoignent ?", options: ["Tom Gonser","Keith Krach","Dan Springer","Allan Thygesen"], correct: 2 },
  { text: "La rumeur « Olivier a rejoint Ironclad » qui circule sur LinkedIn est…", options: ["confirmée","un post d'une de ses relations apparu dans son fil","une blague d'avril","datée d'avant 2020"], correct: 1 },
  { text: "Quel sigle DocuSign correspond à la gestion du cycle de vie des contrats qu'il vend ?", options: ["CRM","CLM","ERP","SCM"], correct: 1 },
  { text: "À quel événement annuel DocuSign a-t-il été speaker en 2025 ?", options: ["Dreamforce","Momentum25","Web Summit","VivaTech"], correct: 1 },
  { text: "Quel lieu parisien a accueilli un de ses roadshows DocuSign ?", options: ["La Galerie Bourbon","Le Grand Palais","La Bourse","La Conciergerie"], correct: 0 },

  // ---------- Études & formation (16-23) ----------
  { text: "Quelle école d'ingénieurs l'a diplômé ?", options: ["École Polytechnique","École Centrale de Nantes","INSA Lyon","Mines ParisTech"], correct: 1 },
  { text: "Dans quel lycée a-t-il fait ses classes préparatoires ?", options: ["Lycée Henri-IV (Paris)","Lycée Faidherbe (Lille)","Lycée du Parc (Lyon)","Lycée Pierre-de-Fermat (Toulouse)"], correct: 1 },
  { text: "Dans quelle université étrangère a-t-il fait un master de management ?", options: ["MIT","University of Melbourne","ETH Zürich","HEC Montréal"], correct: 1 },
  { text: "Dans quel pays cette université se trouve-t-elle ?", options: ["Canada","Suisse","Australie","Royaume-Uni"], correct: 2 },
  { text: "Quelles années a-t-il passées à l'École Centrale de Nantes ?", options: ["2010-13","2012-15","2014-17","2016-19"], correct: 2 },
  { text: "Quel stage 3D a-t-il fait en 2016 ?", options: ["Dassault Systèmes","WIPON","Ubisoft","Capgemini"], correct: 1 },
  { text: "Quelle discipline domine sa formation initiale ?", options: ["Médecine","Ingénierie","Droit","Sciences politiques"], correct: 1 },
  { text: "Le master de Melbourne porte sur…", options: ["la finance pure","le management / l'ingénierie","la biologie marine","le droit international"], correct: 1 },

  // ---------- Ultra-trail (24-43) ----------
  { text: "Quelle est sa discipline sportive de prédilection ?", options: ["Triathlon","Cyclisme sur route","Ultra-trail","Natation eau libre"], correct: 2 },
  { text: "Quel est son UTMB Index (global) ?", options: ["516","616","716","816"], correct: 1 },
  { text: "Quel est son ITRA Performance Index ?", options: ["548","648","748","848"], correct: 1 },
  { text: "Dans quelle catégorie d'âge UTMB court-il ?", options: ["M 16-19","M 20-34","M 35-39","M 40-49"], correct: 1 },
  { text: "Combien de courses indexées UTMB a-t-il finies ?", options: ["12","22","32","52"], correct: 2 },
  { text: "Quelle est l'épreuve la plus longue qu'il ait terminée ?", options: ["SwissPeaks 100","SwissPeaks 170","SwissPeaks 360","SwissPeaks 380"], correct: 3 },
  { text: "Quelle distance (km) fait le SwissPeaks 380 ?", options: ["280 km","338 km","388 km","420 km"], correct: 2 },
  { text: "Combien de dénivelé positif (m+) avalent les 388 km du SwissPeaks 380 ?", options: ["~12 600","~18 600","~26 600","~34 600"], correct: 2 },
  { text: "En quelle année a-t-il fini le SwissPeaks 380 ?", options: ["2022","2023","2024","2025"], correct: 3 },
  { text: "Quel temps a-t-il mis pour boucler le SwissPeaks 380 (388 km) ?", options: ["environ 80 h","environ 100 h","environ 124 h","environ 160 h"], correct: 2 },
  { text: "À quelle place a-t-il fini ce SwissPeaks 380 ?", options: ["3ᵉ / 247","57ᵉ / 247","124ᵉ / 247","220ᵉ / 247"], correct: 1 },
  { text: "Quel ultra grenoblois (4 Massifs) en mode Xtrem a-t-il fini en 2025 ?", options: ["UT4M 90","UT4M 130","UT4M 180 Xtrem","UT4M 100 Express"], correct: 2 },
  { text: "Quel ultra mythique nocturne lyonnais figure dans son palmarès ?", options: ["La Diagonale","La SaintéLyon","La Transju'","Les Templiers"], correct: 1 },
  { text: "Quelle course parisienne 120 km a-t-il finie en mars 2026 ?", options: ["Marathon de Paris","EcoTrail Paris Printemps","Paris-Versailles","20 km de Paris"], correct: 1 },
  { text: "À quelle place a-t-il fini cet EcoTrail Paris Printemps 120 km 2026 ?", options: ["12ᵉ / 1 540","99ᵉ / 1 540","456ᵉ / 1 540","1 100ᵉ / 1 540"], correct: 1 },
  { text: "Dans quel pays a-t-il couru le Glendalough Tucker Trail (80 km) en 2022 ?", options: ["France","Suisse","Irlande","Écosse"], correct: 2 },
  { text: "Quel est le total de km cumulés sur ses courses ITRA enregistrées ?", options: ["~558 km","~1 558 km","~2 558 km","~5 558 km"], correct: 1 },
  { text: "Quel est le total de dénivelé positif cumulé sur ces mêmes courses ?", options: ["~24 000 m","~44 000 m","~74 000 m","~114 000 m"], correct: 2 },
  { text: "Quel est son classement mondial ITRA (top X %) ?", options: ["top 0,5 %","top 2,55 %","top 10 %","top 25 %"], correct: 1 },
  { text: "Le blog « Olivier Ultra Trail » (Tor des Géants 2018, etc.) appartient à…", options: ["Olivier Agneray","Olivier Bourdais — un autre coureur","un journaliste","un sponsor"], correct: 1 },

  // ---------- Persona / culture périphérique (44-50) ----------
  { text: "Sur quel réseau pro est-il le plus actif ?", options: ["X (Twitter)","Instagram","LinkedIn","Mastodon"], correct: 2 },
  { text: "Quel est son handle LinkedIn ?", options: ["oagneray","olivieragneray","docusign-olivier","trailagneray"], correct: 0 },
  { text: "Sur quel autre réseau a-t-il un profil (non public) ?", options: ["TikTok","Facebook","Snapchat","Reddit"], correct: 1 },
  { text: "Sur quelle plateforme de course (course officielle indexée) suit-on ses résultats ?", options: ["Strava","UTMB World","Garmin Connect","Komoot"], correct: 1 },
  { text: "À quelle autre association d'ultras est-il référencé pour le scoring international ?", options: ["WMRA","ITRA","FFA","ISMF"], correct: 1 },
  { text: "Comment l'ITRA décrit-elle un coureur avec un Performance Index ~ 648 ?", options: ["Débutant","Intermédiaire","Advanced 3","Top Elite (900+)"], correct: 2 },
  { text: "Quel téléphone professionnel (préfixe pays) trouve-t-on dans certaines bases agrégateur ?", options: ["+1 (USA)","+33 (France) et +353 (Irlande)","+86 (Chine)","+49 (Allemagne)"], correct: 1 },

  // ---------- DocuSign — management & équipe (51-62) ----------
  { text: "Combien de niveaux Olivier a-t-il gravis chez DocuSign en ~6 ans ?", options: ["2","3","4","5"], correct: 2 },
  { text: "Quel était son tout premier titre chez DocuSign (avant Senior) ?", options: ["Stagiaire Pre-Sales","Associate Solutions Consultant","Consultant Junior","Architect Trainee"], correct: 1 },
  { text: "Qui semble être sa supérieure hiérarchique ?", options: ["Sarah Walker","Lorna Dowd","Mathilde Hott","Isabel Guerrero"], correct: 1 },
  { text: "L'un des SC de son équipe a remporté un trophée prestigieux chez DocuSign : lequel ?", options: ["Rookie of the Year","President's Club SC EMEA FY26","Innovation Trophy","CEO Award"], correct: 1 },
  { text: "Le President's Club SC EMEA FY26 récompense quel pourcentage des meilleurs commerciaux ?", options: ["top 1 %","top 7 %","top 15 %","top 25 %"], correct: 1 },
  { text: "Combien de SC espagnols (au moins) sont mentionnés dans son équipe ?", options: ["1","2","3","4"], correct: 3 },
  { text: "Lequel est un SC de son équipe, basé en Espagne ?", options: ["Daniel García-Viso Albardía","Cormac Murphy","Sarah Walker","Andreas Müller"], correct: 0 },
  { text: "Quelle certification de cybersécurité cloud Olivier a-t-il annoncée sur LinkedIn ?", options: ["AWS Certified Architect","CCSK (Cloud Security Knowledge)","CISSP","Azure Fundamentals"], correct: 1 },
  { text: "Quel organisme délivre la certification CCSK ?", options: ["AWS","ISC²","Cloud Security Alliance","ENISA"], correct: 2 },
  { text: "À quel grand salon européen DocuSign Olivier a-t-il tenu le stand DocuSign ?", options: ["VivaTech Paris","Workday Rising Stockholm","Web Summit Lisbonne","SaaStr Barcelone"], correct: 1 },
  { text: "L'intégration mise en avant à Workday Rising portait sur :", options: ["la facturation électronique","le recrutement / onboarding","la cybersécurité","les voyages d'affaires"], correct: 1 },
  { text: "Hors signature, quel produit DocuSign promeut-il particulièrement ?", options: ["DocuSign Postal","Intelligent Agreement Management (IAM)","DocuSign POS","DocuSign Cloud Office"], correct: 1 },

  // ---------- DORA & webinaires (63-67) ----------
  { text: "Quel webinaire DocuSign a-t-il animé en décembre 2024 ?", options: ["RGPD 2024","DORA — comment l'IA peut vous aider","Cybersecurity for Dummies","Climate Tech Live"], correct: 1 },
  { text: "Quelle est la date du webinaire DocuSign DORA qu'il a co-animé ?", options: ["1ᵉʳ janvier 2024","5 décembre 2024","17 janvier 2025","31 mars 2025"], correct: 1 },
  { text: "Quelle était la durée annoncée du webinaire DORA ?", options: ["15 min","30 min","1 h","2 h"], correct: 1 },
  { text: "À quelle date le règlement DORA est-il entré en vigueur ?", options: ["1ᵉʳ janvier 2024","5 décembre 2024","17 janvier 2025","1ᵉʳ juillet 2025"], correct: 2 },
  { text: "DORA concerne principalement…", options: ["la signature électronique","la résilience opérationnelle numérique du secteur financier","la TVA digitale","les batteries lithium"], correct: 1 },

  // ---------- Compétences techniques (68-73) ----------
  { text: "Quel langage de programmation Olivier a-t-il déclaré savoir ?", options: ["Rust","C++","COBOL","Haskell"], correct: 1 },
  { text: "Quel moteur 3D / temps réel figure dans ses compétences ?", options: ["Unreal Engine","Unity","Godot","Cryengine"], correct: 1 },
  { text: "Quel langage de bases de données déclare-t-il maîtriser ?", options: ["SQL","GraphQL","SPARQL","XQuery"], correct: 0 },
  { text: "Lequel ne figure PAS dans ses compétences techniques déclarées ?", options: ["C++","Unity","SQL","Kubernetes"], correct: 3 },
  { text: "Quelle suite bureautique Microsoft figure dans ses compétences ?", options: ["Access","Excel","Visio","Power BI"], correct: 1 },
  { text: "Quel domaine de TechViz expliquait son bagage technique en C++/Unity ?", options: ["la 3D / VR industrielle","l'e-commerce","la finance quant","le gaming mobile"], correct: 0 },

  // ---------- UTMB / ITRA — indices détaillés (74-80) ----------
  { text: "Quel est son UTMB Index sur le 50K ?", options: ["418","518","618","718"], correct: 1 },
  { text: "Quel est son UTMB Index sur le 100K ?", options: ["517","617","717","817"], correct: 1 },
  { text: "Quel est son UTMB Index sur le 100M (≈161 km) ?", options: ["374","474","574","674"], correct: 1 },
  { text: "Quel est son meilleur score UTMB (toutes catégories) ?", options: ["536","636","736","836"], correct: 1 },
  { text: "Combien de top 10 a-t-il décrochés sur ses 32 courses indexées UTMB ?", options: ["0","1","2","5"], correct: 2 },
  { text: "Combien de ses courses ITRA ont décroché le niveau d'endurance maximal (6/6) ?", options: ["0","1","3","5"], correct: 2 },
  { text: "Selon sa catégorie d'âge UTMB (M 20-34), il est probablement né entre…", options: ["1980-1985","1986-1990","1991-1994","1995-1999"], correct: 2 },

  // ---------- SwissPeaks 380 — la grande course en détail (81-92) ----------
  { text: "Quelle région suisse le SwissPeaks 380 traverse-t-il intégralement ?", options: ["Le Tessin","Le Valais","Les Grisons","Le Jura"], correct: 1 },
  { text: "Où démarre le SwissPeaks 380 ?", options: ["Zermatt","Obergesteln / Oberwald (Haut-Valais)","Sion","Lausanne"], correct: 1 },
  { text: "Où se trouve l'arrivée du SwissPeaks 380 ?", options: ["Bouveret (Lac Léman)","Montreux","Sierre","Brigue"], correct: 0 },
  { text: "À quelle altitude max monte-t-on sur le SwissPeaks 380 ?", options: ["~2 414 m","~2 914 m","~3 414 m","~3 914 m"], correct: 1 },
  { text: "Quel est le dénivelé négatif (descente) cumulé sur le 380 ?", options: ["≈−14 000 m","≈−21 000 m","≈−27 900 m","≈−34 000 m"], correct: 2 },
  { text: "Quelle est la barrière horaire totale du SwissPeaks 380 ?", options: ["120 h","159 h","180 h","240 h"], correct: 1 },
  { text: "Combien de ravitaillements jalonnent les ≈388 km ?", options: ["12","24","32","48"], correct: 2 },
  { text: "Quel jour et heure de départ pour son édition 2025 ?", options: ["30 août, 22h00","31 août, 06h00","31 août, 10h00","1ᵉʳ septembre, 08h00"], correct: 2 },
  { text: "Combien de finishers ont franchi la ligne en 2025 (sur 247 partants) ?", options: ["≈87","≈146","≈210","≈247"], correct: 1 },
  { text: "Quel taux d'abandon approximatif cela représente-t-il ?", options: ["≈10 %","≈25 %","≈41 %","≈60 %"], correct: 2 },
  { text: "Au sein de sa catégorie d'âge, à quelle place a-t-il fini le SwissPeaks 380 ?", options: ["3ᵉ","8ᵉ","14ᵉ","22ᵉ"], correct: 2 },
  { text: "Quel est le format le plus long de la galaxie SwissPeaks ?", options: ["≈488-500 km","≈588-600 km","≈688-700 km","≈800 km"], correct: 2 },

  // ---------- Palmarès — détails fins (93-99) ----------
  { text: "Sur le SwissPeaks 170 en 2022, à quelle place a-t-il fini ?", options: ["10ᵉ / 90","65ᵉ / 90","82ᵉ / 90","88ᵉ / 90"], correct: 1 },
  { text: "Quel a été son temps sur le SwissPeaks 100K en 2023 ?", options: ["≈14 h","≈21 h 54","≈30 h","≈40 h"], correct: 1 },
  { text: "À quelle place a-t-il fini la SaintéLyon 2021 (sa première édition documentée) ?", options: ["~50ᵉ","~250ᵉ","~1 082ᵉ","~3 000ᵉ"], correct: 2 },
  { text: "Sur quel UT4M (Ultra Tour des 4 Massifs) Olivier figure-t-il NE PAS y avoir couru le format extrême ?", options: ["UT4M 180 Xtrem","UT4M 130","UT4M 90","Aucun — il a couru le 180 Xtrem"], correct: 3 },
  { text: "Quelle était sa place sur La 6000D en 2025 ?", options: ["~50ᵉ","~150ᵉ","~392ᵉ","~600ᵉ"], correct: 2 },
  { text: "Sur la SaintéLyon 2025, son temps est de…", options: ["07:50","09:20","11:10","13:45"], correct: 1 },
  { text: "Sur la SaintéLyon 2024, son temps est de…", options: ["09:20","10:25","11:09","12:30"], correct: 2 },

  // ---------- Profil sportif global (100) ----------
  { text: "À quelle famille de courses du circuit UTMB du Mont-Blanc n'a-t-il PAS participé (d'après les données indexées) ?", options: ["UTMB / CCC / TDS / OCC","SwissPeaks","SaintéLyon","EcoTrail Paris"], correct: 0 },

  // ---------- Équipe & relations (101-105) ----------
  { text: "Quel SC de son équipe espagnole se prénomme Jaime ?", options: ["Jaime Pérez","Jaime Caldés Sánchez","Jaime Rodríguez","Jaime Martín"], correct: 1 },
  { text: "Quel SC de son équipe espagnole se prénomme Nicolás ?", options: ["Nicolás Angaramo","Nicolás García","Nicolás Lopez","Nicolás Romero"], correct: 0 },
  { text: "Quelle SC de son équipe espagnole se prénomme Isabel ?", options: ["Isabel Fernández","Isabel Sánchez","Isabel Guerrero López","Isabel Martín"], correct: 2 },
  { text: "Quel collègue DocuSign (prénom Cormac) le cite comme co-présentateur de roadshow ?", options: ["O'Connor","Murphy","Walsh","McNamara"], correct: 1 },
  { text: "Quelle collègue (prénom Mathilde) le cite également en co-présentation ?", options: ["Hott","Dubois","Leclerc","Roux"], correct: 0 },

  // ---------- DORA & roadshow La Galerie Bourbon (106-110) ----------
  { text: "Selon le pitch du webinaire DORA, le référentiel d'accords est piloté par…", options: ["l'IA","un consultant interne","un script bash","Excel"], correct: 0 },
  { text: "Quelle solution DocuSign a-t-il présentée au roadshow de La Galerie Bourbon (Paris) ?", options: ["Intelligent Repository","DocuSign Print","DocuSign POS","DocuSign Notary"], correct: 0 },
  { text: "Quelle autre solution figurait à l'ordre du jour de ce même roadshow ?", options: ["IDV Premier","Postal Hub","Print Service","Bulk Shipping"], correct: 0 },
  { text: "Quel sujet stratégique complétait ce roadshow Paris ?", options: ["la roadmap IA","la réglementation TVA","la facturation papier","la migration mainframe"], correct: 0 },
  { text: "L'intégration DocuSign × Workday présentée à Stockholm couvre principalement quelle phase RH ?", options: ["la paie","le départ en retraite","recruter / embaucher / onboarder","les évaluations annuelles"], correct: 2 },

  // ---------- Sportives — IDs publics, géographie, contexte (111-122) ----------
  { text: "Quel est son identifiant coureur sur UTMB World ?", options: ["1234567","4351816","9876543","7000000"], correct: 1 },
  { text: "Quel est son ID ITRA RunnerSpace ?", options: ["4344914","4351816","4123456","4444444"], correct: 0 },
  { text: "Dans quel comté irlandais se trouve Glendalough, où il a couru en 2022 ?", options: ["Cork","Galway","Wicklow","Donegal"], correct: 2 },
  { text: "Glendalough est avant tout connu pour être…", options: ["une marque de whisky","un parc national d'Irlande","une plage atlantique","un studio de cinéma"], correct: 1 },
  { text: "Entre quelles 2 villes se court la SaintéLyon (qu'il a faite 3 fois) ?", options: ["Lyon et Grenoble","Saint-Étienne et Lyon","Lyon et Annecy","Saint-Étienne et Clermont"], correct: 1 },
  { text: "Quelle particularité fondamentale de la SaintéLyon ?", options: ["100 % en montée","course nocturne","strictement féminine","réservée aux Stéphanois"], correct: 1 },
  { text: "Dans quelle station alpine se court La 6000D « Trail de Légende » qu'il a faite en 2025 ?", options: ["Chamonix","Les Arcs","Val Thorens","Tignes"], correct: 1 },
  { text: "Quelle marque sponsorise l'EcoTrail Paris (présent dans le nom officiel) ?", options: ["Salomon","Hoka","On Running","Adidas"], correct: 0 },
  { text: "Quelle est l'altitude MINIMALE atteinte sur le SwissPeaks 380 ?", options: ["72 m","372 m","772 m","1 372 m"], correct: 1 },
  { text: "Combien de jours environ dure le SwissPeaks 380 pour un finisher comme lui ?", options: ["≈2 jours","≈5 jours","≈10 jours","≈14 jours"], correct: 1 },
  { text: "À partir de quel ITRA Performance Index considère-t-on un homme « Top Elite » ?", options: ["600+","700+","800+","900+"], correct: 3 },
  { text: "Que signifie l'acronyme UT4M de la course grenobloise ?", options: ["Ultra Tour des 4 Massifs","Ultra Trail du 4ᵉ Massif","Ultra Tour des Maquis","Ultra Trail 4M"], correct: 0 },

  // ---------- Bonus : carrière + fact-check (123-125) ----------
  { text: "En combien d'années (approx) Olivier a-t-il gravi les 4 niveaux SC chez DocuSign ?", options: ["≈3 ans","≈6 ans","≈10 ans","≈15 ans"], correct: 1 },
  { text: "Olivier a obtenu son master à Melbourne en quelle année ?", options: ["2015","2016","2017","2018"], correct: 2 },
  { text: "Le blog « Olivier Ultra Trail » mentionne un finish au Tor des Géants en quelle année (par Olivier Bourdais, pas Agneray) ?", options: ["2016","2018","2020","2022"], correct: 1 },
];
