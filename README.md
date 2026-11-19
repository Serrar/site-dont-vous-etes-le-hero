# Gamebook QA

Un « livre dont vous êtes le héros » jouable dans le navigateur, avec **plusieurs aventures**, une **feuille de personnage**,
des **jets de dés**, des **fins multiples** et un **éditeur d'aventures** avec visualisation de l'arbre des choix.

C'est avant tout mon **terrain d'entraînement pour le test automatisé et l'IA dans le processus de test**.

## Pourquoi ce projet

Je suis testeur logiciel fonctionnel, avec un bagage de développeur. Je voulais monter en compétence
sur l'automatisation des tests et sur la place de l'IA dans le travail de test, avec un projet qui me plaise plutôt qu'un
exercice abstrait.

Un livre-jeu est un bon sujet : c'est un **graphe d'états** (scènes, choix, conditions, fins) plus un personnage qui évolue.
Cela rassemble des questions d'un testeur : tous les parcours mènent-ils à une fin ? Une scène est-elle inaccessible ?
Un état du personnage peut-il devenir incohérent ? Le hasard (les dés) pose en plus un vrai problème d'automatisation :
comment rendre un test reproductible ?

## Comment il a été réalisé (et la place de l'IA)

Ce dépôt a été construit **en dialogue avec un LLM (Claude, d'Anthropic)**. Le LLM a rédigé le code, les tests et la
documentation à partir de mes demandes successives. Je ne le présente donc pas comme du code écrit de ma main.

Ce que j'ai décidé et piloté : le sujet et son découpage en étapes, le choix de TypeScript (je connaissais déjà JavaScript,
et l'écosystème Playwright ), l'orientation « test d'abord » plutôt que « développement », puis
chaque évolution.

Ce que ce mode de travail m'apprend (et que je documente ici) :

- un LLM produit vite des tests qui passent ; **le travail du testeur reste de se demander s'ils testent la bonne chose** ;
- **limite connue** : le code et les tests ont été écrits avec le même LLM, donc avec des angles morts communs possibles ;
- l'IA est surtout utile quand on lui impose un cadre vérifiable (types stricts, tests, validation automatique du graphe).

## Ce que le projet met en œuvre côté test

| Niveau | Outil | Ce qui est vérifié | Où |
|---|---|---|---|
| Unitaire | Vitest | Règles du jeu : conditions, effets, jets de dés, mort à 0 PV, valeurs limites | `tests/unit/engine.test.ts` |
| Hasard maîtrisé | générateur à graine | Mêmes dés = même partie ; `() => 0.99` force un 6 ; `?seed=N` dans l'URL pour le navigateur | `src/engine/rng.ts` |
| Analyse statique | validateur de graphe | Scènes inaccessibles, culs-de-sac, destinations inconnues, objets requis mais introuvables | `src/engine/validate.ts` |
| À base de propriétés (fuzzing) | parties aléatoires reproductibles | Sur **chaque** aventure : 1000 parties jouées au hasard finissent toutes, toutes les fins sont atteintes, les PV ne passent jamais sous 0 | `tests/unit/campaign.test.ts` |
| Tests de mutation « artisanaux » | campagnes volontairement cassées | Le validateur détecte bien chaque défaut injecté (tester le testeur) | `tests/unit/campaign.test.ts` |
| Données externes | contrôle de structure | Un fichier importé ou un stockage abîmé ne fait pas planter l'appli | `tests/unit/parse.test.ts`, `local.test.ts` |
| Calcul pur | tests de disposition | Pas de chevauchement, flèches cohérentes, cycles, scènes orphelines | `tests/unit/graph.test.ts` |
| Bout en bout | Playwright | Menu, parties complètes, éditeur, sauvegarde et reprise après rechargement, import/export, parties aléatoires | `tests/e2e/` |

Quelques défauts réels attrapés ou signalés au fil du projet (voir `CHANGELOG.md`) :

- le bouton « Rejouer » restait visible en cours de partie, parce qu'une règle CSS écrasait l'attribut `hidden` ;
- un test de disposition de l'arbre a révélé qu'un simple lien transversal entre deux scènes était dessiné comme un retour
  en arrière : le classement des scènes a été revu (chemin le plus long, vrais cycles détectés) ;
- une aventure vierge créée dans l'éditeur devait être valide dès sa création, ce qui a conduit à corriger la règle
  d'accessibilité de la scène de mort.

Toute nouvelle aventure déposée dans `src/campaigns/` est **testée automatiquement**, sans écrire un seul test.

## Démarrage

Prérequis : Node.js 22 ou plus récent.

```bash
npm install
npx playwright install chromium
npm run dev        # le jeu sur http://localhost:5173  (?seed=42 pour des dés déterministes)
npm test           # tests unitaires (Vitest)
npm run validate   # analyse statique de TOUTES les campagnes
npm run e2e        # tests de bout en bout (Playwright)
```

## Fonctionnalités

**Jeu** : choix d'une aventure, texte et illustration par scène, fiche de personnage (PV, Force, Habileté, Chance, inventaire),
choix conditionnels (objet possédé, caractéristique suffisante), jets de dés (1d6 + caractéristique), plusieurs fins.
Deux aventures sont fournies : « La Crypte oubliée » (courte, classique) et « Le Royaume maudit des Bugs » (un testeur
traque un bug fantôme).

**L'atelier du scribe** (éditeur d'aventures), accessible depuis le menu principal dans un bloc visuellement séparé :

- création d'une aventure (déjà jouable) ou duplication d'une aventure existante ;
- **arbre de l'histoire** : chaque scène est une boîte, chaque choix une flèche (tirets = jet de dés, pointillés = choix
  conditionnel, rouge pointillé = scène inaccessible, ⚠ = cul-de-sac) ; un clic sur une boîte ouvre la scène ;
- formulaires pour le texte, l'illustration, les effets, les choix (destination directe ou jet de dés, conditions) ;
  « ➕ Créer une nouvelle scène » depuis une liste de destinations fait grandir l'arbre ;
- **vérifications en direct**, cliquables, qui mènent à la scène concernée ;
- **enregistrement dans le navigateur** (localStorage) et reprise plus tard ; avertissement si l'on quitte avec des modifications
  non enregistrées ;
- **test de l'aventure en cours** depuis l'éditeur ; **export / import** de fichiers `.json`.

> Les brouillons dépendent du navigateur et de l'adresse (localhost:5173) : vider les données du navigateur les efface.
> L'export permet de les conserver ; déposé dans `src/campaigns/`, le fichier devient une aventure permanente du projet.

## Où est quoi

| Dossier / fichier | Rôle |
|---|---|
| `src/campaigns/*.json` | Le contenu : une aventure = un fichier (découvert automatiquement) |
| `src/engine/` | Les règles du jeu (`engine.ts`), le hasard (`rng.ts`), le validateur de graphe (`validate.ts`), les types (`types.ts`) |
| `src/editor/` | L'atelier : `model.ts` (opérations), `graph.ts` (disposition de l'arbre), `editor.ts` (écran) |
| `src/catalog/` | D'où viennent les campagnes (`CampaignSource`) : fichiers embarqués, brouillons du navigateur, import |
| `src/ui/` | Écran de jeu et utilitaires DOM |
| `src/illustrations/`, `src/style.css` | Illustrations SVG et thème parchemin (palette partagée) |
| `gallery.html` | Prévisualisation de toutes les illustrations (`/gallery.html` en mode dev) |
| `tests/unit/`, `tests/e2e/` | Tests unitaires (Vitest) et de bout en bout (Playwright) |
| `GUIDE-TYPESCRIPT.md` | Mémo TypeScript pour qui vient de JavaScript (le code source est commenté dans le même esprit) |

## Ajouter une aventure

1. Créer `src/campaigns/mon-aventure.json` (en copiant `crypte.json`) ; le champ `id` doit être identique au nom du fichier.
2. `npm run validate` : le graphe est-il cohérent ?
3. `npm test` : l'aventure est automatiquement validée et jouée 1000 fois au hasard.
4. `npm run dev` : elle apparaît dans le menu.

## Choix d'architecture

- **Une campagne = des données pures** (JSON, versionné par `schemaVersion`) : le moteur est testé une fois, les contenus
  sont testés par analyse de graphe.
- **`validateCampaign` est une fonction pure**, sans dépendance au navigateur : le même code sert aux tests, à la ligne de
  commande et aux vérifications en direct de l'éditeur.
- **`CampaignSource`** isole l'origine des campagnes (fichiers, brouillons du navigateur, et un jour un serveur) sans toucher
  au moteur ni aux écrans.
- **Le moteur ne dépend pas de l'interface** : il se teste seul.
- **Le hasard est injecté** : sans cela, un test de jeu de dés serait instable.

## Illustrations

Illustrations en SVG originaux, dessinés spécialement pour le projet, en planches à l'encre façon vieux grimoire (trait
légèrement tremblant, double trait, hachures, lavis). Aucune image externe ni reprise d'une œuvre ou d'un illustrateur
existant. Les couleurs viennent de la palette CSS commune ; les animations se désactivent si le système demande de
réduire les mouvements.

## Limites actuelles et pistes d'évolution

Limites assumées :

- pas encore d'intégration continue (GitHub Actions) ni de mesure de couverture de code ;
- tests écrits avec le même LLM que le code (voir plus haut) ;
- brouillons stockés uniquement dans le navigateur, pas d'annulation (Ctrl+Z) dans l'éditeur ;
- arbre calculé automatiquement : les boîtes ne se déplacent pas à la main.

Pistes :

- workflow GitHub Actions (`npm test`, `npm run validate`, `npm run e2e`) et rapport de couverture ;
- **IA comme outil de test** : faire générer des cas de test ou explorer l'arbre par un LLM, puis trier les propositions
  (relire, garder, rejeter) ; comparer avec les tests existants pour mesurer ce qu'ils apportent réellement ;
- feuille de personnage conservée d'une aventure à l'autre, avec test de la migration entre deux versions de sauvegarde ;
- Page Object et traces Playwright pour les tests de bout en bout.
