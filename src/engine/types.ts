// ============================================================================
// types.ts : le « vocabulaire » du projet. À quoi ressemblent nos données ?
//
// Pour un développeur JS : TypeScript = JavaScript + des déclarations de types.
// Elles n'existent QUE pendant l'écriture du code : elles sont effacées avant
// l'exécution. Leur rôle : repérer les fautes de frappe et les oublis AVANT de
// lancer le programme (l'éditeur de code souligne l'erreur en rouge).
// Aucune ligne de ce fichier ne « fait » quelque chose : il ne contient que des
// descriptions.
// ============================================================================

/**
 * `type X = "a" | "b"` : une « union de littéraux ». X ne peut valoir que "a"
 * ou "b". Comme une énumération, mais sans code généré. Écrire "forse" par
 * erreur provoquera une erreur de compilation.
 */
export type StatName = "force" | "habilete" | "chance";

/** `interface` : décrit la forme d'un objet (ses propriétés et leurs types). */
export interface Character {
  name: string;
  /**
   * Record<K, V> : un objet dont les clés sont de type K et les valeurs de type V.
   * Ici : { force: number, habilete: number, chance: number }.
   */
  stats: Record<StatName, number>;
  hp: number; // points de vie
  inventory: string[]; // tableau de chaînes (on pourrait écrire Array<string>)
}

/**
 * « Union discriminée » : un objet qui peut avoir plusieurs formes, repérables
 * grâce à une propriété commune (`type`). Quand on teste `c.type === "item"`,
 * TypeScript sait que `c.item` existe (et que `c.stat` n'existe pas) :
 * c'est le « narrowing » (affinage du type).
 */
export type Condition =
  | { type: "stat"; stat: StatName; min: number } // « Force ≥ 12 »
  | { type: "item"; item: string }; // « possède la torche »

/** Un effet appliqué au personnage (même principe d'union discriminée). */
export type Effect =
  | { type: "hp"; delta: number } // delta négatif = dégâts
  | { type: "addItem"; item: string }
  | { type: "removeItem"; item: string };

/** Jet de dé : on lance 1d6, on ajoute la caractéristique, on compare à `difficulty`. */
export interface Test {
  stat: StatName;
  difficulty: number;
  onSuccess: string; // identifiant de la scène suivante en cas de réussite
  onFailure: string; // ... et en cas d'échec
}

export interface Choice {
  text: string;
  /**
   * Le `?` après le nom rend la propriété OPTIONNELLE : `to?: string` signifie
   * « string ou absent » (type réel : string | undefined).
   * Un choix a soit `to` (destination directe), soit `test` (jet de dé).
   */
  to?: string;
  test?: Test;
  condition?: Condition; // le choix n'est visible que si la condition est vraie
  effects?: Effect[];
}

export interface Scene {
  text: string;
  /** Identifiant d'une illustration de la bibliothèque (src/illustrations). */
  illustration?: string;
  choices?: Choice[];
  onEnter?: Effect[]; // effets appliqués en arrivant dans la scène
  /** Si présent, la scène est une fin d'histoire. */
  ending?: { type: "victory" | "defeat" | "neutral"; title: string };
}

export interface Campaign {
  /** Version du format de fichier : permettra de migrer les anciennes campagnes. */
  schemaVersion: 1; // ici « 1 » est lui-même un type : seule la valeur 1 est acceptée
  /** Identifiant unique (doit correspondre au nom du fichier .json). */
  id: string;
  title: string;
  description?: string;
  start: string; // identifiant de la scène de départ
  deathScene: string; // scène où l'on arrive quand les PV tombent à 0
  /** Dictionnaire : identifiant de scène → scène. */
  scenes: Record<string, Scene>;
}

/** L'état d'une partie en cours. */
export interface GameState {
  sceneId: string;
  character: Character;
  history: string[]; // identifiants des scènes visitées, dans l'ordre
}
