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
];
