# Journal des modifications

## 0.2.0
- Écran de choix d'aventure (menu) ; accès direct par `?campaign=<id>`.
- Nouvelle aventure : « Le Royaume maudit des Bugs » (conditions d'objet et de caractéristique, `removeItem`).
- Architecture : `CampaignSource` (src/catalog/), champs `schemaVersion` et `description` dans les campagnes.
- `npm run validate` analyse toutes les campagnes ; les tests génériques s'appliquent à chaque campagne trouvée.
- Correction : le bouton « Rejouer » restait visible avant la fin de partie (le CSS `display:block` écrasait l'attribut `hidden`).
- Tests : catalog.test.ts, royaume-bugs.test.ts, menu.spec.ts ; helpers.ts partagé ; play.spec.ts utilise `?campaign=crypte`.

## 0.1.0
- Version initiale : moteur, aventure « La Crypte oubliée », tests unitaires et e2e.
