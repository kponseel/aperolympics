// QuizzMaster — thème 🎩 Bonnes manières (savoir-vivre, code gentleman,
// Code Rothschild). 90 questions.
// Mêle : maximes du Code Rothschild légendaire (banque allemande de
// Francfort), arts de la table à la française, civilités classiques
// (présentations, baisemain, vouvoiement), dress code (smoking, jaquette,
// white tie), correspondance, hôte/invité, fleurs et cadeaux.

module.exports = [
  // ---------- Code Rothschild (1-12) ----------
  { text: "Selon le « Code Rothschild » légendaire, on ne déjeune jamais deux fois de suite avec…", options: ["la même personne","le même restaurateur","les mêmes plats","en silence"], correct: 0 },
  { text: "Un précepte central : on tient TOUJOURS…", options: ["sa langue","sa parole","ses comptes","ses distances"], correct: 1 },
  { text: "Que dit le code à propos d'un document qu'on vous présente ?", options: ["ne jamais le signer sans l'avoir lu","toujours le signer rapidement","ne jamais le lire","le déléguer à un secrétaire"], correct: 0 },
  { text: "« Être à l'heure » selon le code, c'est plutôt…", options: ["5 minutes en avance","tolérer 30 min de retard","arriver pile à la minute","peu importe"], correct: 0 },
  { text: "Le code privilégie quoi sur quoi en affaires ?", options: ["le long terme sur le court terme","le court terme sur tout","l'apparence sur le fond","l'oral sur tout"], correct: 0 },
  { text: "Et les dettes ?", options: ["on les paie toujours, même petites","on les oublie","on les renégocie","on les transfère"], correct: 0 },
  { text: "Vis-à-vis d'un service rendu, on doit…", options: ["ne jamais l'oublier","l'oublier vite","le facturer","le revendre"], correct: 0 },
  { text: "De quelle ville européenne la dynastie Rothschild est-elle originaire ?", options: ["Vienne","Francfort","Londres","Paris"], correct: 1 },
  { text: "Mayer Amschel Rothschild fonde la banque familiale au XVIIIᵉ siècle dans quel pays ?", options: ["Allemagne","Suisse","Royaume-Uni","Italie"], correct: 0 },
  { text: "Le code conseille de préférer quoi à l'écrit pour les détails personnels ?", options: ["la mémoire","la dictée","le sténo","la photo"], correct: 0 },
  { text: "Face aux apparences, le code prône…", options: ["le mépris du paraître","l'ostentation","le luxe permanent","l'indifférence"], correct: 0 },
  { text: "À table, le code recommande de…", options: ["ne pas parler affaires","parler affaires d'abord","éviter de manger","tout filmer"], correct: 0 },

  // ---------- Arts de la table : couverts, verres, position (13-37) ----------
  { text: "Quand plusieurs couverts sont dressés, on commence par…", options: ["le plus extérieur","le plus proche de l'assiette","celui de droite","au hasard"], correct: 0 },
  { text: "En France (style continental), la fourchette se tient dans…", options: ["la main gauche","la main droite","les deux","selon l'humeur"], correct: 0 },
  { text: "Et le couteau ?", options: ["la main droite","la main gauche","aucune","on alterne"], correct: 0 },
  { text: "L'assiette à pain se place…", options: ["à gauche de l'assiette","à droite","dans l'assiette","sur les genoux"], correct: 0 },
  { text: "La serviette se met…", options: ["sur les genoux","autour du cou","sur l'épaule","sous l'assiette"], correct: 0 },
  { text: "Pour signaler qu'on a fini son plat, on pose les couverts…", options: ["en parallèle, vers 4h30 sur l'assiette","en croix","à plat sur la nappe","sous l'assiette"], correct: 0 },
  { text: "Pour signaler une simple pause (sans avoir fini), on les pose…", options: ["en V inversé sur l'assiette (on ne CROISE JAMAIS les couverts)","en parallèle","sur la nappe","dans le verre"], correct: 0 },
  { text: "Servir le vin : par quel côté du convive ?", options: ["par la droite","par la gauche","par-devant","par-derrière"], correct: 0 },
  { text: "Débarrasser une assiette (étiquette française classique) : par quel côté ?", options: ["par la gauche","par la droite","par-devant","au choix"], correct: 1 },
  { text: "Quel verre est le PLUS grand sur une table dressée à la française ?", options: ["le verre à eau","le verre à vin rouge","le verre à vin blanc","la flûte à champagne"], correct: 0 },
  { text: "Saler son plat AVANT de l'avoir goûté est…", options: ["une faute majeure","apprécié","obligatoire","une marque d'élégance"], correct: 0 },
  { text: "Saucer son assiette avec du pain en société formelle ?", options: ["à éviter","obligatoire","apprécié","la marque du connaisseur"], correct: 0 },
  { text: "Une salade un peu grande se mange en France traditionnellement…", options: ["pliée à la fourchette","coupée au couteau","à la cuillère","à la main"], correct: 0 },
  { text: "Le couteau à poisson se reconnaît à…", options: ["sa lame plate et large","sa double pointe","sa lame dentelée","sa couleur rouge"], correct: 0 },
  { text: "Boire à table doit se faire…", options: ["la bouche vide d'abord","avec la bouche pleine","jamais","entre 2 paroles"], correct: 0 },
  { text: "Les coudes sur la table sont…", options: ["à proscrire pendant qu'on mange","obligatoires","encouragés","traditionnels"], correct: 0 },
  { text: "La cuillère à soupe se manie vers…", options: ["l'extérieur (devant soi)","soi","la nappe","la cuillère du voisin"], correct: 0 },
  { text: "On rompt son pain…", options: ["à la main, en petits morceaux","au couteau","d'un seul coup","avec les dents"], correct: 0 },
  { text: "Qui goûte le vin servi pour la 1ʳᵉ fois à un dîner ?", options: ["le maître de maison","le sommelier","l'invité d'honneur","personne"], correct: 0 },
  { text: "Si le vin a un défaut, le maître de maison…", options: ["fait discrètement remplacer la bouteille","le boit quand même sans rien dire","s'excuse devant tout le monde","réprimande le serveur"], correct: 0 },
  { text: "Téléphone portable à table ?", options: ["jamais","en mode vibreur OK","si urgent","si silencieux"], correct: 0 },
  { text: "Quand commencer à manger lors d'un dîner ?", options: ["quand tous sont servis et que la maîtresse a commencé","dès qu'on est servi","quand on a faim","quand le chef apparaît"], correct: 0 },
  { text: "Le maître de maison se sert généralement…", options: ["en dernier","en premier","au milieu du tour","jamais"], correct: 0 },
  { text: "L'ordre classique des verres (du plus grand au plus petit) ?", options: ["eau, vin rouge, vin blanc, champagne","champagne, blanc, rouge, eau","tous identiques","blanc, rouge, eau, champagne"], correct: 0 },
  { text: "Se moucher à table : ?", options: ["se retirer discrètement si possible","bruyamment OK","dans la serviette","dans la nappe"], correct: 0 },
  { text: "Cure-dents à table en public ?", options: ["à éviter","obligatoire","élégant","fortement encouragé"], correct: 0 },
  { text: "Une serviette tachée se replie…", options: ["pliée sans étaler les taches","mise en boule","jetée à terre","laissée ouverte"], correct: 0 },
  { text: "La nappe doit pendre de chaque côté de la table…", options: ["d'environ 30 cm","de 5 cm seulement","jusqu'au sol","selon les hôtes"], correct: 0 },

  // ---------- Civilités, présentations, vouvoiement (38-52) ----------
  { text: "Lors d'une présentation, on présente toujours…", options: ["le plus jeune au plus âgé","le plus âgé au plus jeune","au hasard","les hommes en premier"], correct: 0 },
  { text: "Présentation entre un homme et une femme : on présente…", options: ["l'homme à la femme","la femme à l'homme","peu importe","les deux en même temps"], correct: 0 },
  { text: "Entre un subordonné et un supérieur, on présente…", options: ["le subordonné au supérieur","le supérieur au subordonné","les deux en simultané","aucun"], correct: 0 },
  { text: "Le baisemain : la main de la dame est…", options: ["soulevée par l'homme jusqu'à mi-hauteur","laissée pendante","secouée","retournée"], correct: 0 },
  { text: "Le baisemain : les lèvres…", options: ["effleurent au-dessus de la main, sans toucher","embrassent franchement la main","embrassent le poignet","touchent à peine la peau"], correct: 0 },
  { text: "Le baisemain se pratique…", options: ["en intérieur uniquement","en extérieur uniquement","partout","jamais"], correct: 0 },
  { text: "Le baisemain à une jeune fille non mariée est traditionnellement…", options: ["déconseillé","obligatoire","apprécié","fortement encouragé"], correct: 0 },
  { text: "Le vouvoiement en société classique est…", options: ["de rigueur jusqu'à invitation explicite à se tutoyer","jamais utilisé","réservé aux personnes âgées","réservé aux supérieurs"], correct: 0 },
  { text: "En entrant dans une pièce, on doit…", options: ["saluer","se taire","attendre qu'on parle","s'asseoir tout de suite"], correct: 0 },
  { text: "Un homme se lève quand…", options: ["une dame entre ou se lève","jamais","seulement si elle est âgée","s'il est invité"], correct: 0 },
  { text: "Tenir la porte à une dame : ?", options: ["oui et la laisser passer en premier","non c'est désuet","selon les cas","jamais"], correct: 0 },
  { text: "En marchant avec une dame dans la rue, l'homme se tient…", options: ["côté chaussée (côté danger)","côté trottoir","derrière elle","devant elle"], correct: 0 },
  { text: "Saluer en serrant la main : qui tend la main en premier ?", options: ["la femme (ou l'aîné, ou le supérieur)","l'homme systématiquement","le plus jeune","peu importe"], correct: 0 },
  { text: "Une poignée de main dure idéalement…", options: ["2-3 secondes","10 secondes","jusqu'à ce qu'on parle","le plus longtemps possible"], correct: 0 },
  { text: "On vouvoie classiquement même…", options: ["ses beaux-parents (initialement)","ses propres parents","ses enfants","son chat"], correct: 0 },

  // ---------- Dress code (53-64) ----------
  { text: "« Cravate noire » (black tie) correspond à…", options: ["smoking","habit / queue-de-pie","costume sombre","jaquette"], correct: 0 },
  { text: "« Cravate blanche » (white tie) correspond à…", options: ["habit / queue-de-pie","smoking","costume sombre","jaquette"], correct: 0 },
  { text: "Avec un smoking, la cravate est…", options: ["un nœud papillon noir","une cravate noire classique","une cravate blanche","aucune cravate"], correct: 0 },
  { text: "La jaquette se porte…", options: ["en journée (mariage, événement diurne)","le soir uniquement","au sport","la nuit"], correct: 0 },
  { text: "Traditionnellement, le smoking se porte à partir de quelle heure ?", options: ["18h00","midi","6h","21h"], correct: 0 },
  { text: "Les revers d'un smoking sont…", options: ["en soie (satin ou grosgrain)","en lin","en velours systématique","en coton brut"], correct: 0 },
  { text: "Avec un habit (white tie), le gilet est typiquement…", options: ["blanc, en piqué","noir","de couleur","absent"], correct: 0 },
  { text: "Chaussures avec smoking : ?", options: ["escarpins vernis","mocassins de ville","baskets","santiags"], correct: 0 },
  { text: "Pourquoi des chaussettes hautes pour un homme ?", options: ["ne pas montrer la peau en croisant les jambes","tenir chaud","la mode actuelle","pour cacher des tatouages"], correct: 0 },
  { text: "Règle anglaise « no brown after six » : on évite…", options: ["le marron en ville après 18h","le bleu marine","le gris","le velours"], correct: 0 },
  { text: "Couleur classique d'un costume de ville en journée ?", options: ["gris ou bleu marine","noir","blanc","marron"], correct: 0 },
  { text: "Boutonnage d'un veston 3 boutons : on boutonne…", options: ["souvent le central, jamais le bas","tous","aucun","seulement le bas"], correct: 0 },

  // ---------- Correspondance & RSVP (65-72) ----------
  { text: "Formule de politesse classique d'un homme à une dame à la fin d'une lettre :", options: ["« l'expression de mes respectueux hommages »","« bisous »","« cordialement »","« amitiés sincères »"], correct: 0 },
  { text: "Formule entre hommes (formel) en fin de lettre :", options: ["« l'expression de mes sentiments distingués »","« salut »","« à plus »","« bien à toi »"], correct: 0 },
  { text: "« Cordialement » en signature est…", options: ["semi-formel, pas pour le très protocolaire","la formule la plus solennelle","familier","réservé aux dames"], correct: 0 },
  { text: "Pour écrire à un évêque, on s'adresse à lui par…", options: ["« Monseigneur »","« Monsieur »","« Maître »","« Bonjour »"], correct: 0 },
  { text: "RSVP signifie…", options: ["« Répondez s'il vous plaît »","« Rendez-vous Sur Votre Place »","« Reçu Sans Vin Pris »","« Réception Sur Voie Postale »"], correct: 0 },
  { text: "Délai idéal pour répondre à une invitation formelle ?", options: ["24 à 48 heures","sous une semaine","le jour même","la veille"], correct: 0 },
  { text: "Un faire-part de mariage se reçoit traditionnellement…", options: ["par voie postale, idéalement gravé","par SMS","par DM Instagram","par appel"], correct: 0 },
  { text: "Après un dîner privé, on remercie idéalement…", options: ["par un mot manuscrit le lendemain","par SMS dans la semaine","rien à faire","email dans le mois"], correct: 0 },

  // ---------- Hôte / invité, cadeaux, fleurs (73-87) ----------
  { text: "Le « quart d'heure de courtoisie » à Paris : on arrive…", options: ["15 minutes après l'heure indiquée","30 minutes après","1 heure après","5 minutes en avance"], correct: 0 },
  { text: "Pour offrir des fleurs lors d'un dîner, on les fait livrer…", options: ["le matin même, avant le dîner","pendant le dîner","après le dîner","le lendemain"], correct: 0 },
  { text: "Nombre traditionnel de fleurs dans un bouquet :", options: ["impair (sauf 13)","pair","exactement 12","exactement 7"], correct: 0 },
  { text: "Quel nombre de fleurs faut-il toujours éviter en France ?", options: ["13","7","10","21"], correct: 0 },
  { text: "Quelle fleur évoque le deuil et la Toussaint en France ?", options: ["chrysanthème","tulipe","rose","pivoine"], correct: 0 },
  { text: "Une bouteille de vin offerte à l'hôte est…", options: ["à sa discrétion : il décide de la servir ou pas","obligatoire à servir tout de suite","à boire à deux à l'écart","à refuser poliment"], correct: 0 },
  { text: "La maîtresse de maison s'assoit à table…", options: ["en première, signal pour les invités","en dernière","au milieu du repas","jamais"], correct: 0 },
  { text: "La place d'honneur masculine se trouve…", options: ["à la droite de la maîtresse de maison","à sa gauche","en face d'elle","côté cuisine"], correct: 0 },
  { text: "Lors d'un dîner formel, les conjoints sont placés…", options: ["séparés (sauf jeunes mariés)","côte à côte","face à face","au choix"], correct: 0 },
  { text: "Un homme arrive avec un cadeau d'hôtesse autre que vin/fleurs : exemple correct ?", options: ["bougie, chocolats fins, livre","espèces dans une enveloppe","T-shirt humoristique","outil de cuisine"], correct: 0 },
  { text: "Inviter en retour des hôtes : idéalement sous…", options: ["1 à 2 mois","5 ans","jamais","1 semaine"], correct: 0 },
  { text: "Quand quitter une réception après le repas ?", options: ["1 à 2 heures après la fin du dîner","aussitôt qu'on a fini","au petit matin","quand l'hôte l'ordonne"], correct: 0 },
  { text: "Un cadeau d'hôtesse en argent liquide est…", options: ["à proscrire","apprécié","obligatoire","traditionnel"], correct: 0 },
  { text: "Refuser un plat servi par un hôte est…", options: ["délicat — mieux vaut en prendre peu et goûter","de bon ton","obligatoire si on n'aime pas","silencieusement accepté"], correct: 0 },
  { text: "Repos de la fourchette pendant qu'on coupe : où ?", options: ["sur le bord de l'assiette, dents vers le bas","sur la nappe","dans le verre","sur le genou"], correct: 0 },

  // ---------- Bonus culture (88-90) ----------
  { text: "« L'Almanach de Gotha » est…", options: ["un annuaire des familles royales et nobles d'Europe","un journal politique","un guide gastronomique","un calendrier liturgique"], correct: 0 },
  { text: "Le mot « courtoisie » vient de…", options: ["« cour » (du roi), donc les bonnes manières de la cour","« court » comme trajet","de l'anglais","du latin « court »"], correct: 0 },
  { text: "À la cour, il était interdit de tourner le dos…", options: ["au monarque","aux autres invités","aux serviteurs","au repas"], correct: 0 },

  // ---------- Verres, champagne, spiritueux (91-98) ----------
  { text: "Un verre à vin (servi) se tient par…", options: ["le pied","le calice","le ventre du verre","à deux mains"], correct: 0 },
  { text: "Une flûte à champagne se tient idéalement par…", options: ["le pied (pour ne pas réchauffer la coupe)","la coupe à pleine main","la base seulement","à deux mains"], correct: 0 },
  { text: "Selon l'étiquette CLASSIQUE, doit-on entrechoquer les flûtes de champagne ?", options: ["non — on les lève simplement","oui, systématiquement","seulement entre hommes","seulement en s'embrassant"], correct: 0 },
  { text: "En trinquant, on regarde…", options: ["les yeux de la personne","le bord de son verre","en l'air","la table"], correct: 0 },
  { text: "Pour ouvrir une bouteille de champagne proprement, on tient…", options: ["le bouchon et on tourne la bouteille","la bouteille et on tourne le bouchon","les deux","on cogne pour faire sauter"], correct: 0 },
  { text: "Le cognac (verre tulipe) se réchauffe…", options: ["dans le creux de la main","au micro-ondes","au bain-marie","jamais"], correct: 0 },
  { text: "Un grand single malt whisky se déguste traditionnellement…", options: ["sec ou très peu d'eau","avec beaucoup de glaçons et de cola","avec du sirop de menthe","avec du lait"], correct: 0 },
  { text: "Pour porter un toast, l'invité d'honneur…", options: ["se lève (les autres restent assis ou se lèvent ensuite)","reste assis","grimpe sur sa chaise","fait le tour de la table"], correct: 0 },

  // ---------- Voiture, taxi, transports (99-101) ----------
  { text: "Dans une voiture avec chauffeur, la place D'HONNEUR est…", options: ["arrière droite","avant à côté du chauffeur","arrière gauche","milieu arrière"], correct: 0 },
  { text: "Tenir la portière à une dame, c'est…", options: ["la lui ouvrir et la laisser monter en premier","obsolète, c'est désuet","réservé aux jeunes filles","valable uniquement la portière passager"], correct: 0 },
  { text: "En taxi, l'homme et la dame qui voyagent ensemble…", options: ["la dame monte en premier, l'homme ferme la portière","l'homme entre en premier","peu importe","l'un devant l'autre derrière"], correct: 0 },

  // ---------- Théâtre / opéra / spectacle (102-105) ----------
  { text: "Pour passer devant des spectateurs déjà assis dans une rangée, on se place…", options: ["face à eux (de face)","de dos","de profil","en s'excusant juste verbalement"], correct: 0 },
  { text: "Soirée de gala à l'opéra : tenue traditionnelle ?", options: ["smoking pour homme, robe longue pour dame","jean","costume clair de jour","tenue de sport"], correct: 0 },
  { text: "Téléphone portable au théâtre :", options: ["éteint AVANT le lever de rideau","mode vibreur suffit","silencieux suffit","seulement pour les SMS"], correct: 0 },
  { text: "Au cinéma classique, l'homme retire…", options: ["son chapeau","ses chaussures","son veston","ses lunettes"], correct: 0 },

  // ---------- Cartes de visite (106-108) ----------
  { text: "Sur une carte de visite, un coin corné en haut à gauche indique…", options: ["une visite déposée en personne","des condoléances","un mariage","un anniversaire"], correct: 0 },
  { text: "L'abréviation « p.f. » sur une carte de visite signifie…", options: ["pour féliciter","pour finir","pour fâcher","payer franchement"], correct: 0 },
  { text: "Et « p.p.c. » ?", options: ["pour prendre congé (avant un long voyage)","pour partir court","personne préférée client","pour parler clair"], correct: 0 },

  // ---------- Bal, danse, salons (109-111) ----------
  { text: "Inviter une dame à danser se fait…", options: ["par une légère inclinaison du buste + formule polie","en la prenant par le bras","en claquant des doigts","par SMS"], correct: 0 },
  { text: "Après une danse, on reconduit la dame…", options: ["à sa place","au bar","on la laisse partir seule","sur la piste pour la suivante"], correct: 0 },
  { text: "Au XIXᵉ, le « carnet de bal » servait à…", options: ["noter par avance ses partenaires de danse","compter les pas","noter ses dépenses","collectionner les fleurs"], correct: 0 },

  // ---------- Royauté & protocole (112-114) ----------
  { text: "On s'adresse à un roi ou une reine par…", options: ["« Votre Majesté »","« Cher Monsieur »","« Roi/Reine »","« Sire » en toute occasion"], correct: 0 },
  { text: "Devant un membre de la famille royale britannique, une femme fait classiquement…", options: ["une révérence (curtsy)","une génuflexion","une accolade","un salut militaire"], correct: 0 },
  { text: "On parle à un souverain…", options: ["seulement quand il/elle nous adresse la parole","en premier pour briser la glace","quand on a une question","jamais"], correct: 0 },

  // ---------- Conversation, sujets tabous (115-119) ----------
  { text: "Sujets à éviter à table en société classique :", options: ["politique, religion, argent","voyages, cuisine, art","sport, météo, vacances","cinéma, musique"], correct: 0 },
  { text: "Couper la parole, c'est…", options: ["un vrai manque de politesse","efficace en société","la marque d'un esprit vif","obligatoire en débat"], correct: 0 },
  { text: "Finir les phrases des autres, c'est…", options: ["à éviter","une marque d'écoute","un signe d'esprit","obligatoire"], correct: 0 },
  { text: "L'usage classique préfère, comme pronom 1ʳᵉ pers. pluriel formel…", options: ["« nous » plutôt que « on »","« on » plutôt que « nous »","alterner sans règle","« je » triple"], correct: 0 },
  { text: "Parler trop de soi en société est…", options: ["déconseillé (frise la vantardise)","obligatoire","élégant","encouragé"], correct: 0 },

  // ---------- Mariage, cérémonies religieuses (120-123) ----------
  { text: "Dans une église catholique en France, la famille de la mariée s'installe…", options: ["à gauche en regardant l'autel","à droite","au fond","à côté du clergé"], correct: 0 },
  { text: "Un homme dans une église catholique :", options: ["enlève son chapeau","garde son chapeau","ôte sa veste","met ses lunettes de soleil"], correct: 0 },
  { text: "Tenue convenable pour un enterrement :", options: ["noir ou très sobre","blanc immaculé","couleurs vives","jean décontracté"], correct: 0 },
  { text: "Applaudir dans une église pendant la cérémonie est…", options: ["à proscrire (sauf consigne contraire)","obligatoire pour féliciter","réservé à la sortie","encouragé"], correct: 0 },

  // ---------- Service à table avancé + escalier (124-127) ----------
  { text: "Le maître d'hôtel sert les plats par…", options: ["la gauche du convive","la droite","par-dessus l'épaule","sans approcher"], correct: 0 },
  { text: "Le service « à la française » signifie…", options: ["plats posés au centre, chacun se sert","portions individuelles préparées en cuisine","service debout","sans nappe"], correct: 0 },
  { text: "Dans un escalier, selon l'étiquette française classique, l'homme…", options: ["précède la dame à la montée comme à la descente (pour la guider et la retenir)","reste toujours en dessous","marche en parallèle","reste 3 marches derrière"], correct: 0 },
  { text: "Reculer une chaise pour qu'une dame s'asseye, c'est…", options: ["un geste classique du gentleman","du paternalisme dépassé","réservé à la cérémonie","réservé aux serveurs"], correct: 0 },

  // ===========================================================================
  // EXTENSION exhaustive d'après le référentiel d'étiquette française classique
  // (Baronne Staffe, Nadine de Rothschild, Bottin Mondain, sources mondaines).
  // ===========================================================================

  // ---------- Placement & art du couvert (à la française) (128-145) ----------
  { text: "Espacement idéal entre deux convives à table ?", options: ["20 à 30 cm","60 à 70 cm","1 mètre","2 mètres"], correct: 1 },
  { text: "À partir de combien de convives pose-t-on un marque-place ?", options: ["4","6","8","16"], correct: 2 },
  { text: "Au-delà de combien de personnes prévoit-on plusieurs petites tables ?", options: ["10","14-16","25","50"], correct: 1 },
  { text: "Lors d'un dîner, on sépare les conjoints SAUF…", options: ["les fiancés et jeunes mariés (<1 an)","les chefs d'État","les médecins","jamais"], correct: 0 },
  { text: "Un ecclésiastique reçoit traditionnellement…", options: ["la place d'honneur (sauf si autorité supérieure)","la dernière place","peu importe","une chaise basse"], correct: 0 },
  { text: "Où la maîtresse de maison non servie s'installe-t-elle ?", options: ["près de la porte de la cuisine (pour s'éclipser)","au bout opposé","au centre","derrière un paravent"], correct: 0 },
  { text: "Combien de couverts MAXIMUM dispose-t-on de chaque côté de l'assiette ?", options: ["1","2","3","5"], correct: 2 },
  { text: "L'assiette à pain se place…", options: ["en haut à gauche, au-dessus des fourchettes","en haut à droite","à droite du verre","au centre"], correct: 0 },
  { text: "En France, la fourchette est posée avec les dents tournées…", options: ["vers la nappe (pour exposer les armoiries au dos)","vers le haut (à l'anglaise)","vers la droite","de profil"], correct: 0 },
  { text: "La cuillère se place partie bombée vers…", options: ["le haut (le ciel)","le bas","de côté","peu importe"], correct: 0 },
  { text: "Les verres à liqueur, cognac ou whisky se dressent-ils sur la table ?", options: ["jamais","oui systématiquement","seulement les liqueurs","selon l'hôte"], correct: 0 },
  { text: "Un pain entier non coupé peut-il être posé sur la nappe ?", options: ["jamais","oui","seulement en famille","si fariné"], correct: 0 },
  { text: "Les fromages se présentent traditionnellement en nombre…", options: ["impair","pair","exactement 12","aléatoire"], correct: 0 },
  { text: "Un porte-couteau en repas formel est-il convenable ?", options: ["non (sous-entend qu'on réutilise le couteau, donc qu'on salit la nappe)","oui obligatoire","seulement au déjeuner","seulement en province"], correct: 0 },
  { text: "Pour un DÎNER formel, la serviette se pose…", options: ["à gauche de l'assiette","sur l'assiette","à droite","sous l'assiette"], correct: 0 },
  { text: "Pour un DÉJEUNER, la serviette se pose…", options: ["sur l'assiette","à gauche","à droite","sous le verre"], correct: 0 },
  { text: "Tables rondes et ovales sont préférées car…", options: ["elles évitent les questions de préséance (pas de bouts)","elles tiennent moins de place","elles sont plus modernes","elles sont moins chères"], correct: 0 },
  { text: "On réserve les places les plus confortables aux…", options: ["femmes","supérieurs hiérarchiques","plus jeunes","invités de loin"], correct: 0 },

  // ---------- Position « terminé » (146-147) ----------
  { text: "À la position « terminé », la lame du couteau est tournée…", options: ["vers l'intérieur de l'assiette","vers l'extérieur","vers soi","vers le voisin"], correct: 0 },
  { text: "À la position « terminé », les dents de la fourchette sont…", options: ["vers le haut","vers la nappe","vers le voisin","peu importe"], correct: 0 },

  // ---------- Service & ordre (148-150) ----------
  { text: "L'ordre de service à un dîner ?", options: ["d'abord les dames, puis les messieurs, l'hôte en DERNIER","les hommes d'abord","de gauche à droite","par âge"], correct: 0 },
  { text: "Le service « à la russe » (un plat après l'autre) s'est imposé au…", options: ["XVIIᵉ siècle","XIXᵉ siècle","XXᵉ siècle","XVᵉ siècle"], correct: 1 },
  { text: "Avant le service à la russe, on servait à la française : tout était…", options: ["présenté simultanément sur la table","servi par étages","mangé debout","apporté en cuisine"], correct: 0 },

  // ---------- Vin & verre à pied (Louis XIV, affaire des poisons) (151-154) ----------
  { text: "Pourquoi le verre se tient-il par le pied ? Origine historique en France ?", options: ["Louis XIV l'a imposé à sa cour (méfiance après l'affaire des poisons)","ergonomie suédoise","tradition gallo-romaine","norme européenne 1850"], correct: 0 },
  { text: "L'« affaire des poisons » qui a marqué la cour française se situe entre…", options: ["1679 et 1682","1714 et 1722","1788 et 1791","1860 et 1865"], correct: 0 },
  { text: "Combien de personnes furent inculpées dans l'affaire des poisons ?", options: ["~42","~442","~4 200","~12 000"], correct: 1 },
  { text: "Le verre de vin se remplit idéalement aux…", options: ["deux tiers","ras bord","trois quarts","une moitié strictement"], correct: 0 },

  // ---------- Trinquer & toast (155-159) ----------
  { text: "Croiser les verres en trinquant est traditionnellement…", options: ["proscrit (signe de croix involontaire porteur de malheur)","encouragé","élégant","obligatoire"], correct: 0 },
  { text: "Trinquer avec de l'EAU ?", options: ["à éviter (superstition espagnole)","obligatoire","sans importance","élégant"], correct: 0 },
  { text: "Dans un dîner officiel français, le toast se porte…", options: ["uniquement à la fin du repas","au début","à chaque plat","jamais"], correct: 0 },
  { text: "Traditionnellement, qui porte un toast ?", options: ["les hommes","les femmes seulement","les enfants","l'aîné quel que soit le sexe"], correct: 0 },
  { text: "L'expression « porter un toast » vient de l'ancien français « toste » : c'était…", options: ["une tranche de pain grillée trempée dans le vin pour honorer une dame","une coupe en or","un manteau de cour","un instrument de musique"], correct: 0 },

  // ---------- Aliments délicats (160-167) ----------
  { text: "L'artichaut se mange…", options: ["feuille à feuille à la main, foin retiré à la fourchette","entier au couteau","à la cuillère","en purée"], correct: 0 },
  { text: "Les asperges (en dîner formel) se mangent…", options: ["à la fourchette","à la main systématiquement","à la cuillère","au couteau"], correct: 0 },
  { text: "Le foie gras se…", options: ["découpe à la fourchette puis se dépose sur le toast","tartine comme un pâté","mange à la cuillère","mélange à la salade"], correct: 0 },
  { text: "Les huîtres se prennent avec…", options: ["la fourchette à huîtres","les doigts","la cuillère à soupe","le couteau à poisson"], correct: 0 },
  { text: "Les escargots se prennent avec…", options: ["pince et fourchette à escargots","les doigts","la cuillère","le couteau"], correct: 0 },
  { text: "Les spaghettis se mangent…", options: ["enroulés à la fourchette, SANS cuillère","à la cuillère","au couteau","à la main"], correct: 0 },
  { text: "Une pomme ou poire en société classique se…", options: ["coupe en quatre puis se pèle à la main au-dessus de l'assiette","mange à pleines dents","pèle à la cuillère","jette intacte"], correct: 0 },
  { text: "Ronger les os d'une viande ?", options: ["à proscrire (on détache la chair au couteau)","obligatoire","apprécié","élégant"], correct: 0 },

  // ---------- Fromage & dessert + Brillat-Savarin (168-173) ----------
  { text: "En France, l'ordre classique est…", options: ["fromage AVANT le dessert","fromage APRÈS le dessert (anglais)","fromage en apéritif (américain)","pas de fromage"], correct: 0 },
  { text: "Cette place du fromage est…", options: ["unique au monde — française","partagée avec l'Italie","reprise des Anglais","copiée des États-Unis"], correct: 0 },
  { text: "L'adage médiéval « caseus claudit ventrem » signifie…", options: ["« le fromage ferme le ventre »","« le fromage est de Caen »","« le repas se signe »","« le fromage est complet »"], correct: 0 },
  { text: "Brillat-Savarin écrit « Un … sans fromage est une belle à qui il manque un œil » : le mot d'origine est…", options: ["dessert","repas","apéritif","mariage"], correct: 0 },
  { text: "Brillat-Savarin (auteur de la Physiologie du goût, 1825) était de profession…", options: ["magistrat (et gastronome)","cuisinier","évêque","ambassadeur"], correct: 0 },
  { text: "Le plateau de fromage à un dîner formel…", options: ["ne circule qu'UNE fois (on ne se ressert pas)","circule à volonté","ne se présente jamais","reste à l'entrée"], correct: 0 },

  // ---------- Comportement à table (suite Nadine) (174-180) ----------
  { text: "Selon Nadine de Rothschild, dire « Bon appétit » est…", options: ["déconseillé (renvoie aux fonctions digestives)","obligatoire","réservé à l'hôte","la marque d'une bonne éducation"], correct: 0 },
  { text: "Si on vous dit « Bon appétit », on répond…", options: ["par un sourire ou « merci »","« bon appétit » en retour","« santé »","rien — on l'ignore"], correct: 0 },
  { text: "La salière se passe…", options: ["posée sur la table (on ne la passe jamais main en main)","main à main","par-dessus l'épaule","sous l'assiette"], correct: 0 },
  { text: "Empiler les assiettes pour aider à débarrasser est…", options: ["un « réflexe de cantine » à éviter","apprécié","obligatoire en privé","élégant"], correct: 0 },
  { text: "Se remaquiller ou se recoiffer à table…", options: ["à proscrire","élégant","obligatoire pour les femmes","au dessert seulement"], correct: 0 },
  { text: "On touche au pain à partir de…", options: ["la fin du potage / l'arrivée de l'entrée","l'arrivée à la table","le verre de bienvenue","au dessert"], correct: 0 },
  { text: "La FAUTE LA PLUS GRAVE en mondanités est…", options: ["ne pas honorer une invitation préalablement confirmée","manger trop","parler fort","arriver à l'heure"], correct: 0 },

  // ---------- Présentations & tutoiement (suite) (181-186) ----------
  { text: "Les présentations doivent se faire…", options: ["debout","assis","par téléphone","par écrit uniquement"], correct: 0 },
  { text: "En présentant quelqu'un, il est conseillé d'ajouter…", options: ["sa fonction ou sa profession","son âge","son adresse","son salaire"], correct: 0 },
  { text: "Le « vous » de politesse s'est imposé en France…", options: ["au XVIIᵉ siècle (sous la cour)","au XXᵉ siècle","au Moyen Âge","au XIXᵉ siècle"], correct: 0 },
  { text: "Pendant la Révolution, qu'a-t-on tenté d'imposer brièvement ?", options: ["le tutoiement général (an II)","le baisemain obligatoire","le silence","le pseudonyme"], correct: 0 },
  { text: "C'est… qui propose le tutoiement.", options: ["l'aîné / le supérieur / l'hôte","le plus jeune","le moins gradé","tout le monde en même temps"], correct: 0 },
  { text: "En contexte protocolaire officiel, on conseille d'attendre… avant de tutoyer.", options: ["la quatrième rencontre","la première rencontre","jamais","la dixième année"], correct: 0 },

  // ---------- Baisemain (suite) (187-190) ----------
  { text: "Lors du baisemain, c'est…", options: ["la femme qui prend l'initiative et tend la main","l'homme qui prend la main","peu importe","les deux en même temps"], correct: 0 },
  { text: "Lors d'un baisemain, l'homme…", options: ["se dégante la main droite (la femme peut garder son gant en soirée)","garde les deux gants","embrasse à pleine bouche","s'agenouille"], correct: 0 },
  { text: "Combien de mots prononce-t-on PENDANT un baisemain ?", options: ["aucun","une formule de politesse","trois mots","un compliment court"], correct: 0 },
  { text: "Faire un baisemain à la mariée à la sortie de l'église ?", options: ["non — théoriquement jeune fille jusqu'au lendemain","oui obligatoire","selon les régions","seulement à la sortie de la mairie"], correct: 0 },

  // ---------- Titres de noblesse (191-200) ----------
  { text: "Hiérarchie des titres en France, dans l'ordre décroissant ?", options: ["duc > marquis > comte > vicomte > baron","baron > vicomte > comte > marquis > duc","comte > duc > vicomte > marquis > baron","égalité absolue"], correct: 0 },
  { text: "En France, qui prime entre un duc et un prince (hors famille royale) ?", options: ["le duc","le prince","égalité","selon le département"], correct: 0 },
  { text: "À l'oral, comment s'adresse-t-on à un duc, marquis ou comte ?", options: ["« Monsieur » / « Madame »","« Monsieur le Duc »","« Votre Grâce »","« Cher Comte »"], correct: 0 },
  { text: "À un cardinal, on s'adresse par…", options: ["« Éminence »","« Votre Majesté »","« Monseigneur »","« Père »"], correct: 0 },
  { text: "Au Pape, on écrit en s'adressant à lui par…", options: ["« Très Saint-Père »","« Votre Majesté »","« Monsieur le Pape »","« Maître »"], correct: 0 },
  { text: "Le fils aîné d'un duc porte traditionnellement…", options: ["un titre subsidiaire du père (ex. marquis)","aucun titre","le même titre que son père","« prince »"], correct: 0 },
  { text: "La particule « de » fait-elle la noblesse à elle seule ?", options: ["non — elle marquait la terre, pas le rang","oui obligatoire","oui depuis 1789","seulement avec un « van »"], correct: 0 },
  { text: "En 1789, combien de titres réguliers d'Ancien Régime subsistaient en France ?", options: ["~172","~1 720","~17 000","~5"], correct: 0 },
  { text: "Selon Régis Valette (Robert Laffont, 2007), combien de familles nobles subsistantes en France ?", options: ["~3 092","~30 092","~92","~300 000"], correct: 0 },
  { text: "Selon Pierre-Marie Dioudonnat (Sedopols, 2012), combien de familles PORTENT une particule SANS être nobles ?", options: ["5 000 à 6 000","50 à 60","environ 100","aucune"], correct: 0 },

  // ---------- Cartes de visite — sigles classiques (201-207) ----------
  { text: "Une carte de visite mondaine s'écrit traditionnellement…", options: ["à la troisième personne","à la première personne","en italique","en chiffres"], correct: 0 },
  { text: "Une carte de visite mondaine se signe-t-elle ?", options: ["JAMAIS","toujours","seulement les hommes","au crayon"], correct: 0 },
  { text: "Sur une carte de visite : « p.c. » signifie…", options: ["pour condoléances","prier le client","poste centrale","peu correct"], correct: 0 },
  { text: "« p.r. » sur une carte de visite signifie…", options: ["pour remercier","pour rire","par recommandation","prêt à recevoir"], correct: 0 },
  { text: "« p.p. » sur une carte de visite signifie…", options: ["pour présenter (recommander quelqu'un)","poste préférée","prix particulier","pour parler"], correct: 0 },
  { text: "« p.f.c. » sur une carte de visite signifie…", options: ["pour faire connaissance","pour féliciter le couple","prix fixe communiqué","pour fortifier la confiance"], correct: 0 },
  { text: "« p.p.n. » sur une carte de visite signifie…", options: ["pour prendre des nouvelles","pour partir n'importe quand","pour préparer le notaire","pas plus nécessaire"], correct: 0 },

  // ---------- Formules épistolaires graduées (208-214) ----------
  { text: "La formule de clôture d'une lettre formelle doit…", options: ["reprendre exactement la formule d'APPEL","être plus longue","ne pas citer le destinataire","être en italique"], correct: 0 },
  { text: "Une femme adresse-t-elle des « sentiments » à un homme (hors époux) ?", options: ["non, elle préfère « salutations » ou « considération »","oui systématiquement","oui sauf à un prêtre","seulement entre 18 et 25 ans"], correct: 0 },
  { text: "Pour une relation neutre / commerciale, on emploie…", options: ["« mes salutations distinguées »","« ma haute considération »","« mes sentiments amoureux »","« bisous »"], correct: 0 },
  { text: "Pour marquer la déférence à un supérieur, on dit plutôt…", options: ["« l'expression de ma considération distinguée »","« mes salutations distinguées »","« cordialement »","« ciao »"], correct: 0 },
  { text: "Pour une très haute personnalité, on écrit…", options: ["« l'expression de ma (très) haute considération »","« mes sentiments »","« amicalement »","« bien à vous »"], correct: 0 },
  { text: "On s'adresse à un avocat, notaire ou huissier par…", options: ["« Maître »","« Monsieur »","« Madame »","« Cher Confrère »"], correct: 0 },
  { text: "Un avocat se présente-t-il LUI-MÊME comme « Maître » ?", options: ["non — c'est aux autres de lui donner ce titre","oui systématiquement","seulement à l'audience","seulement à l'écrit"], correct: 0 },

  // ---------- Lettre de château & invitations (215-218) ----------
  { text: "Une « lettre de château » s'envoie…", options: ["à la maîtresse de maison après un séjour","au régisseur","au notaire","au cuisinier"], correct: 0 },
  { text: "Délai pour envoyer une lettre de château ?", options: ["3 jours à 3 semaines après le séjour","le jour même","sous 24 h","6 mois après"], correct: 0 },
  { text: "Une lettre soignée NE COMMENCE JAMAIS par…", options: ["« Je »","« Cher »","« Monsieur »","« Veuillez »"], correct: 0 },
  { text: "Une invitation formelle se lance au minimum… avant l'événement.", options: ["3 semaines","la veille","2 jours","6 mois"], correct: 0 },

  // ---------- Dressing & smoking — origine et détails (219-228) ----------
  { text: "« Tenue de ville » sur un carton d'invitation = ?", options: ["costume sombre pour homme, robe courte habillée pour femme","short et T-shirt","smoking","habit"], correct: 0 },
  { text: "Le smoking est né vers 1860 grâce au tailleur…", options: ["Henry Poole","Cifonelli","Brioni","Hermès"], correct: 0 },
  { text: "Pour qui ce tailleur a-t-il créé la veste de smoking ?", options: ["le prince de Galles (futur Édouard VII)","Napoléon III","Charlemagne","Louis XIV"], correct: 0 },
  { text: "Les revers en soie du smoking servaient à l'origine à…", options: ["faire glisser les cendres de cigare","afficher le rang","absorber la sueur","tenir au chaud"], correct: 0 },
  { text: "Le pantalon de smoking porte traditionnellement…", options: ["un galon de soie sur la couture","une boucle dorée","des rivets","un revers retroussé"], correct: 0 },
  { text: "Un pantalon de smoking ne se tient JAMAIS par…", options: ["une ceinture en cuir classique (préférer cummerbund ou bretelles)","des bretelles","un cummerbund","un gilet"], correct: 0 },
  { text: "La chemise de smoking porte…", options: ["un plastron piqué (Marcella) + poignets mousquetaires","une cravate kraft","un col Mao","une poche poitrine"], correct: 0 },
  { text: "Chaussettes d'un gentleman : couleur assortie à…", options: ["la couleur des CHAUSSURES (pas du pantalon)","la couleur de la cravate","la couleur du veston","aucune règle"], correct: 0 },
  { text: "Le poignet de chemise doit dépasser de la manche de veste de…", options: ["2 à 3 cm","10 cm","aucun (manchette cachée)","exactement 5 cm"], correct: 0 },
  { text: "La pochette d'un veston doit-elle être assortie à la cravate ?", options: ["non — c'est la seule fantaisie autorisée, on ose","oui strictement","seulement les soirs","par couleur exacte"], correct: 0 },

  // ---------- Accessoires interdits / vulgarités (229-232) ----------
  { text: "Pour un gentleman, quels bijoux sont tolérés ?", options: ["la chevalière (pas de gourmette, chaîne, ni bague à l'index)","tous selon le goût","les gourmettes en or","aucun bijou jamais"], correct: 0 },
  { text: "Une chemise à manches courtes sous une veste est…", options: ["proscrite","la norme estivale","élégante","obligatoire en bureau"], correct: 0 },
  { text: "Les logos visibles d'une marque de luxe sur un costume sont…", options: ["considérés vulgaires (même de luxe)","la marque du raffinement","obligatoires","réservés aux soirées"], correct: 0 },
  { text: "Les armoiries familiales se brodent traditionnellement…", options: ["uniquement sur le linge de maison","sur la cravate","sur la pochette","sur les chaussettes"], correct: 0 },

  // ---------- Conversation, compliments, Baronne Staffe (233-237) ----------
  { text: "Quel sujet est LE tabou absolu de la haute société française ?", options: ["l'argent","la cuisine","les voyages","le sport"], correct: 0 },
  { text: "Selon la Baronne Staffe, en société…", options: ["« il faut faire intervenir son moi le moins possible »","« il faut tout dire de soi »","« il faut briller en se mettant en avant »","« il faut couper la parole pour qu'on vous écoute »"], correct: 0 },
  { text: "Le « name-dropping » (citer des noms importants pour se valoriser) est…", options: ["mal vu — discrétion et understatement","élégant","apprécié","obligatoire"], correct: 0 },
  { text: "Selon Nadine de Rothschild, un compliment réussi…", options: ["contient le prénom et porte sur la PERSONNE, pas sur un objet","commence toujours par « ta robe… »","est neutre et général","est ironique"], correct: 0 },
  { text: "Exemple de compliment « bien fait » à la Rothschild ?", options: ["« Charlotte, tu es magnifique »","« Belle robe »","« Joli chapeau »","« Sympa la coiffure »"], correct: 0 },

  // ---------- Fleurs, apéritif, cadeaux mariage (238-243) ----------
  { text: "Quelle fleur évoque traditionnellement le malheur en France ?", options: ["l'œillet","la pivoine","le lys","l'iris"], correct: 0 },
  { text: "Pourquoi éviter les roses rouges à une jeune fille ?", options: ["c'est la fleur de la passion (équivoque)","elles tachent","elles coûtent cher","elles sont trop banales"], correct: 0 },
  { text: "Quel nombre de roses rouges fait exception à la règle du « nombre impair » ?", options: ["12 roses rouges","100 roses","6 roses","aucune exception"], correct: 0 },
  { text: "À l'apéritif, on sert les boissons dès…", options: ["l'arrivée du premier invité","l'arrivée du dernier invité","le départ vers la table","minuit"], correct: 0 },
  { text: "À l'apéritif, les amuse-bouches arrivent…", options: ["à l'arrivée du DERNIER convive","tout de suite","au dessert","jamais"], correct: 0 },
  { text: "Les cadeaux de mariage se…", options: ["font livrer ou poster AVANT la cérémonie","apportent le jour du mariage","envoient 1 an après","laissent dans la voiture"], correct: 0 },

  // ---------- Rallye / vie mondaine bourgeoise (244-248) ----------
  { text: "Un « rallye » dans la haute bourgeoisie française est…", options: ["une série de soirées dansantes organisées pour les jeunes","une course automobile","une réunion politique","une fête religieuse"], correct: 0 },
  { text: "Les « rallyes-goûters » s'adressent aux jeunes de…", options: ["12-13 ans","16-17 ans","20-22 ans","30+ ans"], correct: 0 },
  { text: "Vers 15 ans, on passe aux…", options: ["rallyes-bridges","rallyes-goûters","rallyes-vins","rallyes-foot"], correct: 0 },
  { text: "Vers 16 ans, on accède aux…", options: ["rallyes mondains (dansants)","rallyes-cocktails","rallyes du dimanche","rallyes scientifiques"], correct: 0 },
  { text: "Quels sociologues ont étudié les rallyes comme dispositif d'entre-soi (CNRS) ?", options: ["Michel et Monique Pinçon-Charlot","Pierre Bourdieu seul","Frédéric Lordon","aucun"], correct: 0 },

  // ---------- Galanterie & restaurant (249-253) ----------
  { text: "Au restaurant, qui entre traditionnellement en premier ?", options: ["l'homme (pour s'assurer du lieu)","la femme","peu importe","le maître d'hôtel"], correct: 0 },
  { text: "Qui commande en premier au restaurant en société classique ?", options: ["la femme","l'homme","le plus âgé","l'hôte"], correct: 0 },
  { text: "Dans les grands restaurants, la carte de la femme…", options: ["ne porte pas les prix","est plus petite","est en italique","n'existe pas"], correct: 0 },
  { text: "Pour appeler un serveur, on dit…", options: ["« Monsieur, s'il vous plaît »","« Garçon ! »","« Hé ! »","« Patron »"], correct: 0 },
  { text: "Au restaurant, qui goûte le vin commandé pour la table ?", options: ["l'homme qui invite","la femme","le plus âgé","le plus jeune"], correct: 0 },

  // ---------- Pourboires en France (254-259) ----------
  { text: "En France, le service est…", options: ["compris dans l'addition","ajouté à 15 % obligatoire","exclu et chacun le calcule","interdit"], correct: 0 },
  { text: "Le pourboire en France est…", options: ["facultatif","obligatoire à 10 %","obligatoire à 20 %","interdit"], correct: 0 },
  { text: "Pourboire usuel restaurant si on est très satisfait ?", options: ["5 à 10 %","30 %","aucun","20 % minimum"], correct: 0 },
  { text: "Pourboire usuel pour une ouvreuse de théâtre ?", options: ["1 à 2 €","20 €","50 €","aucun"], correct: 0 },
  { text: "Pourboire usuel pour une femme de chambre d'hôtel ?", options: ["2 à 5 € par nuit","20 € par nuit","aucun","50 € à l'arrivée"], correct: 0 },
  { text: "Pourboire usuel pour un voiturier ou bagagiste ?", options: ["1 à 2 €","aucun","10 €","20 €"], correct: 0 },

  // ---------- Nadine de Rothschild — biographie & doctrine (260-266) ----------
  { text: "Nadine de Rothschild orthographie « savoir vivre »…", options: ["sans trait d'union (pour alléger la charge protocolaire)","avec trait d'union obligatoire","en deux mots majuscules","en italique"], correct: 0 },
  { text: "Le nom de naissance de Nadine de Rothschild est…", options: ["Nadine Lhopitalier","Nadine Dupont","Nadine de Rothschild","Nadine Soyer"], correct: 0 },
  { text: "Nadine de Rothschild est née en quelle année ?", options: ["1932","1925","1945","1955"], correct: 0 },
  { text: "Dans quelle ville française est-elle née ?", options: ["Saint-Quentin (Aisne)","Paris","Strasbourg","Lyon"], correct: 0 },
  { text: "Avant son mariage, Nadine a exercé quelles professions ?", options: ["ouvrière à 14 ans puis actrice","journaliste","institutrice","médecin"], correct: 0 },
  { text: "Elle a épousé le baron Edmond de Rothschild en…", options: ["1963","1953","1973","1983"], correct: 0 },
  { text: "Selon Nadine, les 4 règles du « savoir-vivre financier » sont :", options: ["discrétion, discernement, sens du patrimoine, sens du mécénat","économie, austérité, jeûne, transmission","luxe, ostentation, voyage, démonstration","tout dépenser, ne rien garder, prêter, oublier"], correct: 0 },

  // ---------- Baronne Staffe & Bottin Mondain (267-271) ----------
  { text: "Le pseudonyme « Baronne Staffe » désigne…", options: ["Blanche-Augustine-Angèle Soyer","Geneviève d'Angenstein","la Comtesse de Gencé","une véritable baronne"], correct: 0 },
  { text: "Date de publication de son célèbre « Usages du monde » ?", options: ["1889","1789","1925","1965"], correct: 0 },
  { text: "Le sous-titre exact de l'ouvrage est…", options: ["« Règles du savoir-vivre dans la société moderne »","« Le bon goût français »","« Les codes du gentleman »","« Manuel de la haute société »"], correct: 0 },
  { text: "Le « Bottin Mondain » est…", options: ["un annuaire & guide de la vie mondaine française","un magazine mensuel","une chaîne de télé","un restaurant parisien"], correct: 0 },
  { text: "La Baronne Staffe a vécu de…", options: ["1843 à 1911","1900 à 1970","1789 à 1855","1750 à 1820"], correct: 0 },
];
