# 🍹 Aperolympics

Les **jeux olympiques de l'apéro** : plateforme de jeux de soirée multijoueur,
**en ligne**, jouable depuis **n'importe quel navigateur** — téléphone **ou
ordinateur** (idéal aussi en *office game* au bureau) — et installable en **PWA**
(Android + iPhone). Version hébergée de [GamesHub](https://github.com/kponseel/PickMate)
(sans Flipper Zero ni ESP32).

- **Serveur** Node.js + **Socket.IO** (état faisant autorité, en mémoire ; bascule
  automatiquement en **long-polling** si les WebSockets entrantes sont bloquées).
- **Rooms** : chaque groupe joue dans une partie isolée (code à 4 lettres / lien `…/r/CODE`).
- **Front** : SPA vanilla JS réutilisée de GamesHub + PWA (manifest + service worker).

`npm start` sert à la fois la SPA **et** le temps réel sur `process.env.PORT` (fallback `3000`).

---

## 🚀 Essayer depuis GitHub (sans rien installer)

Deux façons d'obtenir une **URL publique HTTPS** testable au téléphone, directement
depuis ce repo — avant tout déploiement prod.

### Option A — GitHub Codespaces (le plus rapide, ~1 min)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/kponseel/aperolympics)

1. Bouton **Code → Codespaces → Create codespace** (ou le badge ci-dessus).
2. À l'ouverture, `npm install` tourne tout seul (`postCreateCommand`).
3. Dans le terminal du Codespace : **`npm start`**.
4. Le port **3000** est forwardé en **public** : onglet *Ports* → ouvre / copie l'URL
   `…app.github.dev` et lance-la sur ton **téléphone ou ton ordinateur** (et partage-la
   à tes collègues). 🎉

> Réglé par `.devcontainer/devcontainer.json` : image **Node 20**, `npm install` au
> `postCreate`, et visibilité **publique** du port 3000.

### Option B — Render (URL HTTPS permanente, gratuite, **WebSockets OK**)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kponseel/aperolympics)

1. Clique le bouton (ou Render → **New → Blueprint** et pointe ce repo).
2. Render lit **`render.yaml`** : service *web*, build `npm install`, start `npm start`, plan **free**.
3. ~1 min plus tard tu as une URL `https://aperolympics-….onrender.com` partageable.

> Render free supporte les **vraies WebSockets** (pas besoin du fallback). Le service
> free se met en veille après inactivité : le 1ᵉʳ accès peut prendre ~30 s à réveiller.

#### Équivalent Railway

Aucun fichier dédié nécessaire (Railway auto-détecte Node via `package.json`) :

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** → choisis `aperolympics`.
2. Build = `npm install`, Start = `npm start` (déduits du `package.json` ; sinon règle-les dans *Settings → Deploy*).
3. **Settings → Networking → Generate Domain** pour l'URL HTTPS publique. Railway supporte aussi les WebSockets.

*(Fly.io marche aussi pour du WS « pur » mais demande un `fly.toml` + la CLI — non couvert ici.)*

---

## 💻 Démarrer en local

```bash
npm install
npm start            # http://localhost:3000
```

Ouvre `http://localhost:3000`, **crée une partie**, puis rejoins-la avec le **code**
à 4 lettres affiché — ou via le lien `…/r/CODE`. L'hôte 👑 choisit une épreuve et fait
*Démarrer* / *Question suivante*.

L'interface marche aussi bien **sur ordinateur que sur téléphone** (mise en page
centrée, boutons cliquables, **Entrée** pour valider). Pour tester en solo sur desktop,
ouvre simplement **plusieurs onglets / fenêtres** (chacun = un joueur) ; pour un *office
game*, chaque collègue ouvre l'URL sur sa machine.

## 🏗️ Arborescence

```
aperolympics/                # racine du dépôt
├── package.json
├── render.yaml              # blueprint déploiement Render (1-clic)
├── .devcontainer/
│   └── devcontainer.json    # config GitHub Codespaces (Node 20 + port public)
├── .env.example
├── server/
│   ├── index.js          # HTTP (sert public/) + Socket.IO + orchestration
│   ├── rooms.js          # registre + modèle de room (reconnexion par pseudo)
│   └── games/
│       ├── registry.js   # liste des jeux (ids = ceux des renderers client)
│       └── quiz.js       # logique Quiz (portée de esp32-hub/src/games/quiz.cpp)
└── public/               # PWA servie telle quelle
    ├── index.html
    ├── app.js            # cœur SPA (Socket.IO, rooms, routage, helpers)
    ├── style.css
    ├── games/quiz.js     # renderer Quiz (contrat identique à GamesHub)
    ├── manifest.webmanifest
    ├── sw.js             # service worker (cache du shell)
    └── icons/icon.svg
```

## 🔌 Protocole (conservé depuis GamesHub)

- **client → serveur** (`socket.emit("msg", …)`) : `{t:"create",name}` · `{t:"join",name,room}` ·
  `{t:"select_game",id}` · `{t:"next"|"start"}` · `{t:"reset"}` · messages du jeu.
- **serveur → client** : `socket.on("state", …)` `{phase,game,hostId,room,players[],round{}}`
  et `socket.on("private", …)` (chuchotements par joueur : rôle/mot/question).
- Phases : `lobby` · `playing` · `reveal` · `finished`.

## ➕ Porter une épreuve (les 15 autres)

Pour chaque jeu de `esp32-hub/src/games/<jeu>.cpp` :
1. **Serveur** : crée `server/games/<jeu>.js` en copiant la forme de `quiz.js`
   (un `create()` qui renvoie les hooks `phase/onSelect/onAdvance/onMessage/
   serializeRound/tick/…`), et traduis la logique du `.cpp`.
2. Ajoute-le à `server/games/registry.js`.
3. **Client** : copie `public/games/<jeu>.js` depuis `esp32-hub/data/js/games/<jeu>.js`
   (helpers identiques ; un alias `window.GamesHub = window.Apero` est en place,
   donc le `register(...)` marche tel quel).
4. Ajoute `<script src="/games/<jeu>.js"></script>` dans `index.html`.

L'id doit être **identique** côté serveur et client.

## 🌐 Prod (Hostinger — App Node.js depuis GitHub)

Pour héberger en prod sur ton domaine Hostinger (plan **Business / Cloud** avec **Node.js**) :

1. **Pousse ce repo sur GitHub** (déjà fait si tu lis ceci sur GitHub).
2. hPanel → **Avancé → Node.js** (ou **Website → Node.js**) → *Create application*.
3. Connecte **GitHub** et choisis le dépôt `aperolympics` + la branche (`main`).
   - **Application root** : la **racine du dépôt** (`/`) — le `package.json` est à la racine.
   - **Application URL** : ton domaine / sous-domaine.
   - **Application startup file** : `server/index.js` (ou laisse Hostinger lancer `npm start`).
   - **Node version** : **18+**.
4. **Build command** : `npm install` — **Start command** : `npm start`.
5. *Deploy*. Hostinger installe les deps, lance le process et fournit le **HTTPS** sur ton domaine.
6. **Mises à jour** : à chaque `git push` sur la branche, redéploie depuis hPanel
   (bouton *Deploy* / *Restart*) — ou active l'auto-deploy si ton plan le propose.

Le serveur écoute sur `process.env.PORT` (fallback 3000) — **Hostinger l'injecte**, ne
le code pas en dur. Aucune autre variable n'est requise (voir `.env.example`).

> ⚠️ **WebSockets entrantes** souvent **bloquées** sur l'hébergement mutualisé
> Hostinger : pas de souci, Socket.IO **bascule automatiquement en long-polling HTTP**,
> la partie fonctionne (latence un peu plus élevée, OK pour un jeu de soirée). Pour du
> WebSocket « pur », prends un **VPS** Hostinger — ou utilise **Render / Railway**
> (ci-dessus), qui supportent les WS nativement.

## 📱 PWA / icônes

`manifest.webmanifest` + `sw.js` rendent l'app installable (« Ajouter à l'écran
d'accueil »). L'icône fournie est un **SVG** ; pour une compat maximale (surtout
iOS), ajoute des PNG `192×192` et `512×512` dans `public/icons/` et référence-les
dans le manifest et l'`apple-touch-icon`.

## ⚠️ Limites connues (starter)

- **Une seule épreuve portée** (Quiz). Les 15 autres sont à porter (voir plus haut).
- État **en mémoire** : un redémarrage du process vide les parties en cours.
- Pas d'auth admin ici (le contrôle passe par le rôle *host*, élu = 1ᵉʳ connecté).
