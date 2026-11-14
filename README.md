# Gamebook QA

Un « livre dont vous êtes le héros » en TypeScript, conçu pour **apprendre le test et l'automatisation**.
Le moteur est fourni ; ton travail, c'est de le tester, le casser et l'étendre.

## Démarrage

```bash
npm install
npx playwright install chromium
npm run dev        # le jeu sur http://localhost:5173  (?seed=42 pour des dés déterministes)
npm test           # tests unitaires (Vitest)
npm run validate   # analyse statique du graphe de la campagne
npm run e2e        # tests de bout en bout (Playwright)
```

## Où est quoi

| Dossier / fichier | Rôle |
|---|---|
| `src/campaigns/crypte.json` | Le contenu : scènes, choix, conditions, jets, fins |
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

## Notes de conception

- Les dés passent par un `Rng` injectable : en test, on contrôle le hasard (`() => 0.99` = toujours 6).
- `?seed=N` dans l'URL donne la même propriété au navigateur : tests e2e non flaky.
- Les fins, scènes et objets sont des données : on teste le moteur une fois, puis les campagnes par analyse de graphe.
