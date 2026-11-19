# Gamebook QA

Un « livre dont vous êtes le héros » en TypeScript, conçu pour **apprendre le test et l'automatisation**.
Le moteur est fourni ; ton travail, c'est de le tester, le casser et l'étendre.

## Démarrage

```bash
npm install
npx playwright install chromium
npm run dev        # le jeu sur http://localhost:5173  (?seed=42 pour des dés déterministes)
npm test           # tests unitaires (Vitest)
npm run validate   # analyse statique de TOUTES les campagnes
npm run e2e        # tests de bout en bout (Playwright)
```

## Où est quoi

| Dossier / fichier | Rôle |
|---|---|
| `src/campaigns/*.json` | Le contenu : une aventure = un fichier (découvert automatiquement) |
| `src/illustrations/` | Illustrations SVG (une par ambiance), référencées par `"illustration": "<id>"` dans les scènes |
| `src/style.css` | Thème parchemin et palette (partagée avec les illustrations) |
| `gallery.html` | Page de prévisualisation de toutes les illustrations (`npm run dev` puis `/gallery.html`) |
| `src/editor/` | L'atelier : `model.ts` (opérations), `graph.ts` (disposition de l'arbre), `editor.ts` (écran) |
| `src/ui/` | Écran de jeu et utilitaires DOM |
| `GUIDE-TYPESCRIPT.md` | Mémo TypeScript pour qui vient de JavaScript |
| `src/catalog/` | D'où viennent les campagnes (`CampaignSource`) : fichiers embarqués aujourd'hui, éditeur demain |
| `src/engine/engine.ts` | Les règles du jeu |
| `src/engine/validate.ts` | Analyse du graphe (scènes orphelines, culs-de-sac…) |
| `tests/unit/` | Tests unitaires + fuzzing par seed |
| `tests/e2e/` | Parcours navigateur avec Playwright |

## Parcours d'apprentissage (dans l'ordre)

1. **Lire** les tests existants, les lancer, les casser un par un (change une difficulté, retire un objet) et observer lequel échoue.
2. **Chasse aux bugs** : le moteur n'est pas parfait. Cherche des cas limites (objet ajouté en double ? PV négatifs ? choix sans `to` ni `test` ?) et écris un test qui échoue, puis corrige.
3. **Ajouter une scène** à `crypte.json` avec un nouveau cas (ex. condition de statistique `{ "type": "stat", ... }`), et la tester sans toucher au moteur.
4. **Couverture** : `npx vitest run --coverage` (installer `@vitest/coverage-v8`). Quelles lignes du moteur ne sont jamais exécutées ?
5. **Playwright avancé** : Page Object, traces (`npx playwright show-trace`), mode UI (`npm run e2e:ui`), test mobile.
6. **CI** : écrire un workflow GitHub Actions qui lance `npm test`, `npm run validate` et `npm run e2e`.
7. **IA et test** : faire générer des cas de test par un LLM, puis les relire, les trier et les rejeter si besoin (le vrai travail du testeur).
8. **Feuille de personnage persistante** : ajouter la sauvegarde, puis *tester* la migration entre deux versions.

## L'atelier du scribe (éditeur d'aventures)

Depuis le menu principal, le bloc **L'atelier du scribe** (visuellement séparé des aventures) ouvre l'éditeur.

- **Créer** une aventure (déjà jouable : départ, deux choix dont un jet de dés, victoire, défaite) ou **dupliquer** une aventure
  existante pour la modifier (les aventures livrées avec le jeu restent en lecture seule).
- **L'arbre de l'histoire** : chaque scène est une boîte, chaque choix une flèche (tirets = jet de dés, pointillés = choix
  conditionnel, rouge pointillé = scène inaccessible, ⚠ = cul-de-sac). Un clic sur une boîte ouvre la scène à droite.
- **Formulaires** : texte, illustration (aperçu), type de scène (choix ou fin), effets, choix (destination directe ou jet de
  dés, conditions de visibilité, effets). Depuis une liste de destinations, « ➕ Créer une nouvelle scène » fait grandir l'arbre.
- **Vérifications en direct** : les erreurs et avertissements sont cliquables et mènent à la scène concernée.
- **Enregistrer / reprendre plus tard** : « 💾 Enregistrer » (ou Ctrl+S) conserve l'aventure dans **ce navigateur**
  (localStorage). Elle réapparaît dans « Mes brouillons » et dans « Mes aventures » du menu principal. Un avertissement
  s'affiche si tu quittes avec des modifications non enregistrées.
- **Tester** : « ▶ Tester » lance l'aventure en cours (même non enregistrée) et ramène à l'éditeur ensuite.
- **Exporter / importer** : « ⇩ Exporter » télécharge un fichier `.json`. Pour en faire une aventure **permanente** du projet,
  dépose-le dans `src/campaigns/` (nom de fichier = identifiant) : elle sera alors testée automatiquement.

> Les brouillons dépendent du navigateur et de l'adresse (localhost:5173). Vider les données du navigateur les efface :
> pense à **exporter** les aventures importantes.

## Ajouter une aventure

1. Crée `src/campaigns/mon-aventure.json` (copie `crypte.json` comme modèle). Le champ `id` doit être identique au nom du fichier.
2. `npm run validate` : le graphe est-il cohérent ?
3. `npm test` : l'aventure est **automatiquement** validée et jouée 1000 fois au hasard.
4. Relance `npm run dev` : elle apparaît dans le menu.

## Illustrations et ambiance

- Toutes les illustrations sont des **SVG originaux écrits à la main** pour ce projet, en planches à l'encre façon vieux grimoire : trait légèrement tremblant (filtre SVG), double trait, hachures d'ombre et lavis de couleur, dans un cadre à double filet. Aucune image externe, aucun tracé repris d'une œuvre, d'un artiste ou d'un univers existant.
- Les couleurs viennent d'une palette CSS commune (`src/style.css`) : changer les variables change toute l'ambiance.
- Pour associer une image à une scène : `"illustration": "torch"` dans le JSON. Le validateur refuse un identifiant inconnu.
- Si tu ajoutes tes propres visuels, crée-les toi-même ou utilise des ressources sous licence libre (CC0) en notant leur origine dans un fichier `CREDITS.md`. Évite tout visuel « dans le style de » un illustrateur précis.
- Les animations (lueur des torches, fondu) sont désactivées automatiquement si le système demande de réduire les animations.

## Architecture prévue pour un futur éditeur d'aventures

- **Une campagne = des données pures** (JSON, versionné par `schemaVersion`) : un éditeur n'aura qu'à produire ce format.
- **`validateCampaign` est une fonction pure** sans dépendance au navigateur : l'éditeur pourra l'appeler en direct pour signaler les erreurs pendant la création.
- **`CampaignSource`** (`src/catalog/source.ts`) isole l'origine des campagnes. L'éditeur en est la première application : `createLocalSource` (brouillons du navigateur) est fusionnée avec les aventures livrées par `createCompositeSource`. Un jour, une source « serveur » pourra s'ajouter sans toucher au moteur ni aux écrans.
- **Le moteur n'a aucune dépendance à l'interface** : il se teste seul et pourra tourner côté serveur.

## Notes de conception

- Les dés passent par un `Rng` injectable : en test, on contrôle le hasard (`() => 0.99` = toujours 6).
- `?seed=N` dans l'URL donne la même propriété au navigateur : tests e2e non flaky.
- Les fins, scènes et objets sont des données : on teste le moteur une fois, puis les campagnes par analyse de graphe.
