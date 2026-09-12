# Les tests d'Are We A Match ?

```
npm test              tout : les modules, puis le navigateur
npm test -- --fast    seulement les modules (aucun navigateur requis)
npm test -- banque    seulement les suites dont le nom contient « banque »
npm run test:dents    casse le code exprès et vérifie que les tests s'en aperçoivent
```

## Pourquoi ce dossier existe

Ces suites vivaient dans `/tmp`. Le conteneur de développement a été recyclé
pendant une nuit d'inactivité et **791 contrôles ont disparu d'un coup**. Elles
sont maintenant dans le dépôt, et la CI les exécute à chaque poussée.

## Ce que chaque suite garde

| suite | ce qu'elle protège |
|---|---|
| `10-banque` | Un id de scène ne se recycle jamais ; chaque contexte dit le sens du classement ; le tirage reste équilibré par axe |
| `20-version` | Le casse-cache du CDN : les `?v=`, le service worker et VERSION avancent ensemble |
| `30-parties` | Les trois règles qui rendent le différé équitable |
| `40-score` | Le score de compatibilité ne ment pas, et se tait quand il n'a pas assez de matière |
| `50-comptes` | Le code de reprise : durci à la création, jamais à la vérification |
| `60-stockage` | Un fichier illisible est mis de côté, jamais écrasé |
| `70-serveur` | Les routes, le manifeste servi par Node, l'administration fermée |
| `80-ecran` | Ce qui se passe vraiment à l'écran : messages, fenêtres, contraste, cibles tactiles |
| `90-partie-complete` | Une partie jouée de bout en bout, à trois joueurs |

Les deux dernières ont besoin d'un navigateur. Sans Playwright ni Chromium,
elles **s'ignorent proprement** et le reste tourne quand même — `--fast` fait
la même chose volontairement.

## Les trois règles que tout le reste sert

Jouer chacun de son côté ne reste équitable que si :

1. tout le monde voit les **mêmes scènes, dans le même ordre** ;
2. on ne voit les réponses des autres à une scène qu'**après avoir validé la
   sienne** ;
3. une réponse validée **ne change plus** — sauf dans l'unique fenêtre où
   revenir n'apprend rien, c'est-à-dire quand on est seul à avoir répondu.

Si l'une saute, le score de compatibilité ne veut plus rien dire, et personne
ne s'en apercevra en jouant.

## Deux pièges qui ont coûté cher

**Les ids de scènes.** Une réponse mémorisée est un index dans `o`, rangé par
`id`. Réutiliser un id, ou réordonner les options d'une scène existante, rend
fausses toutes les compatibilités passées — **en silence**. Une scène réécrite
reçoit un id neuf ; l'ancien est perdu, c'est voulu.

**Le CDN de l'hébergeur.** Il sert les fichiers du disque sans passer par Node
et ignore `Cache-Control` : aucun en-tête ne peut le faire lâcher un fichier.
Après le déploiement de la 2.1, trois versions d'`app.js` étaient servies en
même temps selon l'edge — dont une dont le client parlait un protocole que le
serveur n'avait plus. Le seul levier est l'URL, d'où les `?v=`.

## Écrire une suite

Un fichier de `suites/`, qui exporte `titre` et `run(t)` :

```js
exports.titre = "Ce que je garde";
exports.navigateur = true;        // seulement si elle a besoin d'un navigateur

exports.run = async (t) => {
  const { games, players, packs } = t.modules();   // stockage neuf et isolé
  t.section("Un groupe de contrôles");
  t.check("Ce qui doit être vrai", condition, "détail affiché si ça casse");
};
```

`t.modules()` donne à chaque suite **son propre `DATA_DIR` et son propre
`HOME`** : `storage.js` pré-remplit un dossier neuf en recopiant
`~/.aperolympics`, et une suite qui laisse traîner des parties les ferait
hériter aux suivantes. Ce piège a déjà coûté une demi-journée.

## Le libellé d'un contrôle

Il est lu par quelqu'un qui vient de casser quelque chose et qui ne sait pas
encore quoi. Il dit ce qui **devrait** être vrai, en français, sans jargon :

- ✅ « Dès que quelqu'un d'autre a répondu, la fenêtre se referme »
- ❌ « test unanswer revealed »

Et quand une règle existe pour une raison, la raison est écrite en commentaire
juste au-dessus. C'est ce qui empêche le prochain de la supprimer en trouvant
qu'elle complique le code.
