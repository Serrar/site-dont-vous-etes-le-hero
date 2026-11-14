export type StatName = "force" | "habilete" | "chance";

export interface Character {
  name: string;
  stats: Record<StatName, number>;
  hp: number;
  inventory: string[];
}

export type Condition =
  | { type: "stat"; stat: StatName; min: number }
  | { type: "item"; item: string };

export type Effect =
  | { type: "hp"; delta: number }
  | { type: "addItem"; item: string }
  | { type: "removeItem"; item: string };

/** Jet de dé : 1d6 + stat >= difficulty */
export interface Test {
  stat: StatName;
  difficulty: number;
  onSuccess: string;
  onFailure: string;
}

export interface Choice {
  text: string;
  to?: string; // destination directe
  test?: Test; // OU un jet de dé (success/failure)
  condition?: Condition;
  effects?: Effect[];
}

export interface Scene {
  text: string;
  choices?: Choice[];
  onEnter?: Effect[];
  ending?: { type: "victory" | "defeat" | "neutral"; title: string };
}

export interface Campaign {
  id: string;
  title: string;
  start: string;
  deathScene: string;
  scenes: Record<string, Scene>;
}

export interface GameState {
  sceneId: string;
  character: Character;
  history: string[];
}
