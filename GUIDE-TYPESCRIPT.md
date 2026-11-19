# TypeScript pour qui connaît JavaScript

TypeScript = **JavaScript + des types**. Les types n'existent que pendant l'écriture du code : ils sont effacés avant
l'exécution. Ils servent à signaler les erreurs **avant** de lancer le programme (soulignées en rouge dans l'éditeur).
Tout code JS valide est du TS valide ; on ajoute les types petit à petit.

Les exemples ci-dessous sont tirés de ce projet : cherche-les dans le code pour les voir en contexte.

## 1. Les types de base

| Syntaxe | Signification | Exemple dans le projet |
|---|---|---|
| `x: string` | la variable `x` est du texte | `function slugify(text: string)` |
| `: number`, `: boolean` | nombre, booléen | `hp: number` |
| `string[]` | tableau de textes | `inventory: string[]` |
| `x?: string` | propriété **optionnelle** (peut être absente) | `to?: string` dans `Choice` |
| `"a" \| "b"` | « union » : seulement l'une de ces valeurs | `StatName = "force" \| "habilete" \| "chance"` |
| `Record<K, V>` | objet dont les clés sont de type K et les valeurs de type V | `scenes: Record<string, Scene>` |
| `(x: number) => string` | type d'une fonction | `type Rng = () => number` |
| `Promise<T>` | résultat qui arrive plus tard (`await`) | `list(): Promise<CampaignMeta[]>` |
| `unknown` | « je ne sais pas ce que c'est » : il faut tester avant d'utiliser | `parseCampaign(value: unknown)` |

## 2. Décrire une forme d'objet

```ts
interface Character {        // « interface » : la forme d'un objet
  name: string;
  hp: number;
  inventory: string[];
}
type Rng = () => number;      // « type » : un alias, pour tout (objet, union, fonction...)
```

Règle pratique : `interface` pour les objets, `type` pour le reste. Les deux marchent le plus souvent.

## 3. Unions discriminées (très utilisées ici)

```ts
type Effect =
  | { type: "hp"; delta: number }
  | { type: "addItem"; item: string };

if (e.type === "hp") {
  e.delta;   // ✅ TypeScript sait que e est le premier cas
  e.item;    // ❌ erreur : « item » n'existe pas dans ce cas
}
```

Le test sur `type` « affine » (*narrowing*) le type de `e`. Voir `applyEffects` dans `engine.ts`.

## 4. Les petits signes qui déroutent

| Signe | Ce que ça veut dire | Où le voir |
|---|---|---|
| `import type { X } from "..."` | on importe uniquement des **types** (effacé à l'exécution) | partout |
| `valeur!` | « je t'assure que ce n'est ni `null` ni `undefined` » (à utiliser quand on en est sûr) | `queue.shift()!` |
| `valeur as Type` | « fais-moi confiance, c'est de ce type » (assertion : **aucune vérification réelle**) | `e.target as HTMLInputElement` |
| `a ?? b` | `a`, sauf s'il est `null`/`undefined`, alors `b` | `scene.choices ?? []` |
| `a?.b` | `a.b` si `a` existe, sinon `undefined` (pas d'erreur) | `scene.ending?.title` |
| `a ??= b` | « si `a` est absent, mets-y `b` » | `scene.choices ??= []` |
| `readonly x` | ne peut pas être réassigné | `readonly state` dans `Game` |
| `private x` | utilisable seulement dans la classe | `private rng` dans `Game` |
| `x is Type` (dans une signature) | « garde de type » : si la fonction renvoie `true`, `x` est de ce type | `isRecord` dans `parse.ts` |
| `<K extends ...>` | un **générique** : le type renvoyé dépend du type passé | `el("input")` renvoie un `HTMLInputElement` |
| `...children: Child[]` | « le reste des arguments », en tableau | `el(tag, props, ...children)` |

## 5. Comment les erreurs apparaissent

- Dans l'éditeur de code (VS Code) : soulignement rouge, avec le message au survol.
- En ligne de commande : `npx tsc --noEmit` vérifie tous les types sans rien produire.
- Les tests (Vitest) et le serveur (Vite) **ne vérifient pas** les types : ils les effacent simplement.
  Un type faux n'empêche donc pas le code de tourner, d'où l'intérêt de lancer `tsc`.

## 6. Ce que TypeScript ne vérifie PAS

Les données qui arrivent pendant l'exécution (fichier importé, contenu du navigateur, réponse d'un serveur) ne sont
jamais garanties par les types. C'est pourquoi `src/catalog/parse.ts` contrôle à la main la structure d'un fichier
importé avant de le traiter comme une `Campaign`.

## 7. Pour aller plus loin

- Le *handbook* officiel : typescriptlang.org/docs/handbook
- Un bon réflexe : écris d'abord le **type** de tes données (`types.ts`), le reste du code en découle.
