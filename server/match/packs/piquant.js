// Are We A Match? — les scènes sur LES PETITS VICES, L'ARGENT et CE QUI AGACE.
//
// Le fichier s'appelle encore piquant.js et son pack garde l'id « piquant » :
// cet id est la clé sous laquelle les réponses sont rangées dans les profils,
// il ne bouge pas. Le contenu, lui, a changé de nature.
//
// « Piquant » ne veut plus dire osé. Un vice, ici, ce n'est pas du sexe : c'est
// la procrastination, les achats compulsifs, juger quelqu'un sur ses
// chaussures, garder une rancune sept ans, annuler à la dernière minute. Et
// c'est braqué sur TOI, jamais sur les défauts des autres — c'est drôle
// justement parce que l'autre voit ta réponse. Tout ce qui relevait de la
// drague ou de la confidence intime (« Flirter, pour toi c'est », « Un crush
// sur un ami du groupe », « Les applis de rencontre ») est parti : ces scènes
// ne passaient pas le test des trois relations, puisqu'une partie se joue
// aussi bien avec sa mère qu'avec son meilleur pote.
//
// Format et règle de stabilité : voir amis.js. Une scène réécrite reçoit un
// NOUVEL id (le préfixe dit l'axe : vi- / ar- / ag- / au-), les anciennes
// réponses sont ignorées proprement plutôt que réinterprétées.

module.exports = [
  // ------------------------------------------------------------ petits vices
  { id: "vi-tentation", axis: "vices", q: "À quoi tu cèdes le plus facilement ?",
    ctx: "Fin de journée, tu es fatigué, personne ne regarde. Du plus fréquent chez toi au plus rare.",
    o: ["🍫 Le placard à sucre", "🛒 Un achat dont tu n'as aucun besoin", "📱 Une heure de scroll qui devait durer cinq minutes"] },
  { id: "vi-jugement", axis: "vices", q: "Sur quoi tu juges quelqu'un en dix secondes ?",
    ctx: "Tu ne l'assumes pas forcément, mais ça se fait tout seul. Du plus vrai pour toi au moins vrai.",
    o: ["👟 Ce qu'il porte", "🎵 Ce qu'il écoute", "🍽️ Sa façon de se tenir à table"] },
  { id: "vi-ragot", axis: "vices", q: "Tu apprends un ragot croustillant sur quelqu'un",
    ctx: "Rien de grave, mais c'est juteux, et personne ne t'a demandé le secret. Du réflexe le plus honnête à ton sujet au moins honnête.",
    o: ["📢 Je le raconte dans l'heure", "🤐 Je le garde, mais j'y pense", "🙄 Ça ne m'intéresse pas vraiment"] },
  { id: "vi-rancune", axis: "vices", q: "Quelqu'un t'a vexé il y a deux ans. Aujourd'hui ?",
    ctx: "Vous vous recroisez, il ne s'est jamais excusé, il a sans doute oublié. Du plus proche de toi au plus éloigné.",
    o: ["🧊 Poli et distant, à vie", "🤷 J'ai oublié depuis longtemps", "🗣️ Je remets le sujet sur la table"] },
  { id: "vi-mensonge", axis: "vices", q: "Quel petit mensonge tu fais le plus souvent ?",
    ctx: "Pas un gros : celui qui sort tout seul, sans y penser. Du plus fréquent chez toi au plus rare.",
    o: ["😴 « J'arrive dans cinq minutes »", "📖 « Oui, j'ai lu le contrat »", "😀 « Non non, ça va très bien »"] },
  { id: "vi-annuler", axis: "vices", q: "Annuler un plan à la dernière minute, tu le vis comment ?",
    ctx: "Tu avais dit oui, tu n'as plus envie, et tu n'as aucune excuse valable. Du plus vrai pour toi au moins vrai.",
    o: ["📵 Je le fais sans culpabiliser", "😅 Je culpabilise, mais je le fais", "🚫 Je ne le fais jamais, j'y vais"] },
  { id: "vi-vengeance", axis: "vices", q: "Ta vengeance préférée, c'est laquelle ?",
    ctx: "Quelqu'un t'a fait un coup bas. Tu ne vas rien faire de grave. De ce qui te ressemble le plus au moins.",
    o: ["🧊 L'indifférence totale", "🎭 Une blague bien placée", "🔥 La confrontation directe"] },
  { id: "vi-drama", axis: "vices", q: "Un drama éclate dans le groupe. Tu es qui ?",
    ctx: "Deux personnes que tu aimes bien se prennent la tête devant tout le monde. Du rôle que tu tiens le plus souvent à celui que tu tiens le moins.",
    o: ["🍿 Le spectateur qui adore ça", "🕊️ Le médiateur qui calme", "🔥 Celui qui met de l'huile"] },
  { id: "vi-rire", axis: "vices", q: "Quelqu'un se casse la figure devant toi",
    ctx: "Une vraie gamelle, sans gravité. Du réflexe le plus honnête à ton sujet au moins honnête.",
    o: ["😂 Je ris immédiatement, désolé", "🫣 Je vérifie que ça va, puis je ris", "😟 Je m'inquiète direct"] },
  { id: "vi-attention", axis: "vices", q: "Être le centre de l'attention, ça te fait quoi ?",
    ctx: "Tout le monde se tourne vers toi, on attend que tu parles. Du plus vrai pour toi au moins vrai.",
    o: ["✨ J'adore, totalement", "🎭 Par moments seulement", "🙈 L'horreur absolue"] },
  { id: "vi-portable", axis: "vices", q: "On te demande de laisser fouiller ton téléphone",
    ctx: "Quelqu'un de proche, cinq minutes, sans surveillance. Du plus vrai pour toi au moins vrai.",
    o: ["📱 Aucun problème", "😬 Ça me met mal à l'aise", "🔒 Hors de question"] },
  { id: "vi-photo", axis: "vices", q: "Une photo gênante de toi circule",
    ctx: "Dans le groupe, tout le monde l'a vue, tu viens de la découvrir. De ta vraie réaction à celle que tu n'aurais jamais.",
    o: ["😂 J'en ris et je la repartage", "😐 Je demande qu'on la supprime", "😡 Ça m'énerve vraiment"] },
  { id: "vi-alcool", axis: "vices", q: "Après deux verres, tu deviens quoi ?",
    ctx: "Une bonne soirée, des gens que tu aimes bien. Du plus vrai pour toi au moins vrai.",
    o: ["🕺 Très fêtard", "🫂 Très affectueux", "🗣️ Très bavard et philosophe"] },
  { id: "vi-soiree-role", axis: "vices", q: "En soirée, tu finis toujours où ?",
    ctx: "Trois heures après ton arrivée, sans l'avoir décidé. De l'endroit où tu atterris le plus souvent au plus rare.",
    o: ["🎧 À gérer la musique", "🍳 Dans la cuisine à discuter", "💃 Au milieu de la piste"] },
  { id: "vi-gagner", axis: "vices", q: "Tu viens de battre un proche à plate couture",
    ctx: "Un jeu sans enjeu, mais tu as gagné largement, et il le prend mal. Du plus vrai pour toi au moins vrai.",
    o: ["🏆 Je savoure et je le rappelle longtemps", "😊 Content, mais discret", "🤫 Il m'arrive de laisser gagner"] },
  { id: "vi-defaut", axis: "vices", q: "Ton pire défaut, tu l'assumes lequel ?",
    ctx: "Celui que tes proches citeraient en premier, et que tu connais très bien. Du plus vrai pour toi au moins vrai.",
    o: ["😤 Têtu", "🐌 Toujours en retard", "🙃 Sarcastique un peu trop"] },
  { id: "vi-honte", axis: "vices", q: "Quel souvenir gênant te revient encore la nuit ?",
    ctx: "Dix ans après, sans prévenir, pour rien. Du plus souvent au plus rarement.",
    o: ["💃 Une danse en soirée", "📧 Un message envoyé au mauvais destinataire", "🎤 Un karaoké assumé trop fort"] },
  { id: "vi-avouer", axis: "vices", q: "Qu'est-ce qui te serait le plus dur à avouer ?",
    ctx: "À quelqu'un de proche, ce soir, sans y être obligé. Du plus dur pour toi au plus facile.",
    o: ["😬 Une grosse honte publique", "💔 Un sentiment non partagé", "🤥 Un mensonge qui a duré des années"] },
  { id: "vi-reveal", axis: "vices", q: "Tu dois révéler une chose que personne ne sait",
    ctx: "Un jeu de soirée, tu ne peux pas y couper, mais tu choisis quoi. Du plus facile à lâcher au plus difficile.",
    o: ["🎯 Un échec professionnel", "🙈 Une bêtise jamais avouée", "🤐 Une manie un peu honteuse"] },
  { id: "vi-jalousie", axis: "vices", q: "La jalousie, tu la connais comment ?",
    ctx: "Pas seulement en amour : un ami qui en préfère un autre, ça compte aussi. Du plus honnête à ton sujet au moins honnête.",
    o: ["😌 Aucune, confiance totale", "🌡️ Un peu, c'est humain", "🔥 Pas mal, et je l'assume"] },
  { id: "vi-reseaux", axis: "vices", q: "Ta vie privée sur les réseaux, ça donne quoi ?",
    ctx: "Tes proches, tes soirées, tes vacances. Du plus proche de ce que tu fais vraiment au plus éloigné.",
    o: ["📸 J'assume, je poste", "🫥 Quelques photos, discret", "🤐 Zéro publication"] },
  { id: "au-ex-ami", axis: "autres", q: "Rester ami avec un ex, c'est possible ?",
    ctx: "La question de principe, pas ton cas personnel. Du plus proche de ce que tu penses au plus éloigné.",
    o: ["👍 Complètement possible", "😬 Compliqué mais faisable", "🚫 Jamais de la vie"] },

  // ------------------------------------------------------------ argent
  { id: "ar-preter", axis: "argent", q: "Un proche te demande de lui prêter de l'argent",
    ctx: "Une somme qui compte pour toi, sans date de remboursement annoncée. Du plus proche de toi au plus éloigné.",
    o: ["🤝 Je prête sans hésiter", "📝 Oui, mais avec une date", "🙅 Je ne prête jamais"] },
  { id: "ar-gain", axis: "argent", q: "Tu gagnes beaucoup d'argent d'un coup",
    ctx: "Une somme qui change des choses, personne n'est au courant. Du réflexe le plus vrai pour toi au moins vrai.",
    o: ["🤫 Je ne le dis à personne", "🎁 J'en fais profiter mes proches", "📢 Tout le monde le sait très vite"] },
  { id: "ar-addition", axis: "argent", q: "L'addition arrive, vous êtes six",
    ctx: "Certains ont pris une entrée et du vin, d'autres un plat et de l'eau. Du réflexe le plus fréquent chez toi au plus rare.",
    o: ["➗ On divise en parts égales, c'est plus simple", "🧮 Chacun ce qu'il a pris, au centime", "🙋 Je paie tout, on verra la prochaine fois"] },
  { id: "ar-depense", axis: "argent", q: "Sur quoi tu ne regardes jamais le prix ?",
    ctx: "Le poste où ton budget part sans que tu discutes. Du plus vrai pour toi au moins vrai.",
    o: ["🍽️ La bouffe et les restos", "✈️ Les voyages", "🏠 Le confort de chez toi"] },
  { id: "ar-salaire", axis: "argent", q: "Un ami te demande combien tu gagnes",
    ctx: "Sincèrement curieux, sans arrière-pensée, un soir où vous parlez de tout. Du plus proche de toi au plus éloigné.",
    o: ["💬 Je réponds franchement", "🤏 Je donne un ordre d'idée", "🚫 Je change de sujet"] },
  { id: "ar-role", axis: "argent", q: "Dans ton groupe, tu es lequel des trois ?",
    ctx: "Sois honnête, ils sont là pour vérifier. Du plus vrai pour toi au moins vrai.",
    o: ["💸 Celui qui offre les tournées", "🧾 Celui qui compte au centime", "😶 Celui qui laisse les autres gérer"] },
  { id: "ar-achat", axis: "argent", q: "Un objet cher te fait envie. Tu fais quoi ?",
    ctx: "Tu peux te le payer, mais ce n'est pas raisonnable ce mois-ci. Du plus fréquent chez toi au plus rare.",
    o: ["🛒 Je l'achète tout de suite", "⏳ J'attends deux semaines pour voir", "📊 Je compare pendant un mois"] },

  // ------------------------------------------------------------ ce qui agace
  { id: "ag-quotidien", axis: "agace", q: "Qu'est-ce qui t'agace le plus dans une journée ?",
    ctx: "Des micro-trucs, tous les jours, qui finissent par user. Du plus insupportable pour toi au moins insupportable.",
    o: ["🔊 Les gens qui parlent fort au téléphone", "🐌 Ceux qui marchent lentement devant toi", "📢 La musique dans les magasins"] },
  { id: "ag-groupe", axis: "agace", q: "Dans une bande, qu'est-ce qui te fatigue le plus ?",
    ctx: "Un groupe que tu aimes bien, malgré tout, et que tu continues de voir. Du plus fatigant pour toi au moins fatigant.",
    o: ["🎙️ Celui qui monopolise la parole", "📅 Celui qui annule toujours", "🤐 Celui qui ne donne jamais son avis"] },
  { id: "ag-table", axis: "agace", q: "À table, qu'est-ce que tu ne supportes pas ?",
    ctx: "Un dîner normal, avec des gens que tu aimes bien. Tu ne diras rien. Du plus insupportable au moins insupportable.",
    o: ["😋 Qu'on mâche bruyamment", "📱 Qu'on sorte son téléphone", "🍽️ Qu'on commence avant tout le monde"] },
  { id: "ag-maison", axis: "agace", q: "Chez quelqu'un, qu'est-ce qui te fait tiquer ?",
    ctx: "Tu es invité, tu ne diras rien, mais tu l'as vu tout de suite. Du plus dérangeant pour toi au moins dérangeant.",
    o: ["🧦 Les chaussures dans le salon", "🧼 L'évier plein de vaisselle", "🌡️ Le chauffage à 25 degrés"] },
  { id: "ag-conversation", axis: "agace", q: "Quelle conversation te donne envie de fuir ?",
    ctx: "Vingt minutes debout, impossible de partir poliment. Du plus pénible pour toi au moins pénible.",
    o: ["🏥 Les problèmes de santé en détail", "💼 Le travail de quelqu'un que tu ne connais pas", "🚗 Les histoires de bouchons et de trajets"] },
  { id: "ag-attente", axis: "agace", q: "On te fait attendre. Tu craques au bout de combien ?",
    ctx: "Quelqu'un que tu aimes bien, qui n'a pas prévenu, et qui ne répond pas. Du plus proche de toi au plus éloigné.",
    o: ["⏱️ Dix minutes et j'écris déjà", "🕐 Une demi-heure, ça passe", "🧘 Je m'en fiche, j'attends"] },
];
