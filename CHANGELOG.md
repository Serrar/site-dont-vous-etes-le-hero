# Journal des modifications

## 0.5.0
- **Atelier du scribe** : éditeur d'aventures accessible depuis le menu principal, dans un bloc visuellement séparé.
- **Arbre de l'histoire** (SVG) : disposition en colonnes, jets de dés / choix conditionnels / retours / scènes inaccessibles / culs-de-sac distingués.
- Création, duplication d'une aventure existante, import et export de fichiers `.json`.
- Sauvegarde dans le navigateur (brouillons), reprise plus tard, avertissement avant de quitter avec des modifications non enregistrées.
- Les brouillons apparaissent dans « Mes aventures » du menu principal ; « Tester » depuis l'éditeur.
- Code **commenté pour débutants en TypeScript** + `GUIDE-TYPESCRIPT.md`.
- Validateur : la scène de mort est atteignable quand des effets retirent des PV, même sans choix qui y mène.
- Structure : `src/main.ts` découpé en `src/ui/game.ts`, `src/ui/dom.ts`, `src/editor/*`.
- Tests : model, graph, local, parse (unitaires) et editor.spec.ts (e2e) ; test e2e redondant supprimé, parties aléatoires ramenées à 15 graines.
- Aucun fichier supprimé par rapport à 0.4.0.

## 0.4.0
- Illustrations refaites en style « vieux grimoire » : encre au trait tremblant, double trait, hachures, lavis ocre/rouge/vert-de-gris, cadre de planche.
- Palette de lavis ajoutée dans `src/style.css` ; test de cohérence de style sur toutes les illustrations.

## 0.3.0
- 18 illustrations SVG originales (`src/illustrations/`), une ambiance par scène, avec lueurs animées discrètes.
- Thème parchemin : boutons, texte de scène et cartes du menu (grain, bords irréguliers, survol et appui).
- Champ `illustration` sur les scènes ; le validateur détecte les identifiants inconnus.
- `gallery.html` : prévisualisation de toutes les illustrations.
- Tests : illustrations.test.ts (SVG autonomes, palette, pas de ressource orpheline) et 5 scénarios e2e (ambiance, parchemin, galerie).
- Le CSS est sorti de `index.html` vers `src/style.css`.

## 0.2.0
- Écran de choix d'aventure (menu) ; accès direct par `?campaign=<id>`.
- Nouvelle aventure : « Le Royaume maudit des Bugs » (conditions d'objet et de caractéristique, `removeItem`).
- Architecture : `CampaignSource` (src/catalog/), champs `schemaVersion` et `description` dans les campagnes.
- `npm run validate` analyse toutes les campagnes ; les tests génériques s'appliquent à chaque campagne trouvée.
- Correction : le bouton « Rejouer » restait visible avant la fin de partie (le CSS `display:block` écrasait l'attribut `hidden`).
- Tests : catalog.test.ts, royaume-bugs.test.ts, menu.spec.ts ; helpers.ts partagé ; play.spec.ts utilise `?campaign=crypte`.

## 0.1.0
- Version initiale : moteur, aventure « La Crypte oubliée », tests unitaires et e2e.
