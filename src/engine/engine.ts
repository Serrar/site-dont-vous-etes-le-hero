// ============================================================================
// engine.ts : les règles du jeu. Aucune interface ici : le moteur ne connaît ni
// le navigateur ni la page web. C'est ce qui permet de le tester seul, et de
// le réutiliser (éditeur, serveur...).
// ============================================================================

// `import type` : on importe uniquement des TYPES (effacés à l'exécution).
// Les `.ts` dans les chemins sont volontaires dans ce projet.
import type { Campaign, Character, Choice, Condition, Effect, GameState, Scene } from "./types.ts";
import { rollD6 } from "./rng.ts"; // import « normal » : une vraie fonction
import type { Rng } from "./rng.ts";

/** Vérifie si le personnage remplit une condition de choix. */
export function checkCondition(c: Condition, ch: Character): boolean {
  // `switch` sur la propriété discriminante : dans chaque `case`, TypeScript
  // connaît la forme exacte de `c` (c.min dans « stat », c.item dans « item »).
  switch (c.type) {
    case "stat":
      return ch.stats[c.stat] >= c.min;
    case "item":
      return ch.inventory.includes(c.item);
  }
  // Pas de `default` : TypeScript vérifie que tous les cas sont couverts.
  // Si on ajoute un 3e type de condition, il signalera l'oubli ici.
}

/** Ce que renvoie `choose` : le résultat du dé, s'il y a eu un jet. */
export interface ChoiceResult {
  roll?: number;
  success?: boolean;
}

export class Game {
  // `readonly` : la propriété ne peut pas être réassignée (mais son contenu peut changer).
  readonly state: GameState;
  // `private` : invisible depuis l'extérieur de la classe (vérifié à la compilation seulement).
  private campaign: Campaign;
  private rng: Rng;

  // `rng: Rng = Math.random` : paramètre avec valeur par défaut, comme en JS.
  constructor(campaign: Campaign, character: Character, rng: Rng = Math.random) {
    this.campaign = campaign;
    this.rng = rng;
    // structuredClone : copie profonde. Sans elle, jouer modifierait le personnage d'origine.
    this.state = { sceneId: campaign.start, character: structuredClone(character), history: [] };
    this.enter(campaign.start);
  }

  /** `get` : une propriété calculée (on écrit game.scene, sans parenthèses). */
  get scene(): Scene {
    const s = this.campaign.scenes[this.state.sceneId];
    if (!s) throw new Error(`Scène inconnue : ${this.state.sceneId}`);
    return s;
  }

  get isOver(): boolean {
    return this.scene.ending !== undefined;
  }

  /**
   * Choix visibles (conditions remplies), avec leur index d'origine.
   * `{ index: number; choice: Choice }[]` = tableau d'objets de cette forme.
   */
  availableChoices(): { index: number; choice: Choice }[] {
    return (this.scene.choices ?? []) // `??` : « si absent (null/undefined), utilise ceci »
      .map((choice, index) => ({ index, choice }))
      .filter(({ choice }) => !choice.condition || checkCondition(choice.condition, this.state.character));
  }

  /** Applique le choix numéro `index` et renvoie le résultat du dé éventuel. */
  choose(index: number): ChoiceResult {
    const picked = this.availableChoices().find((c) => c.index === index);
    if (!picked) throw new Error(`Choix indisponible : ${index}`);
    const { choice } = picked;

    this.applyEffects(choice.effects ?? []);
    if (this.state.character.hp <= 0) {
      this.enter(this.campaign.deathScene);
      return {};
    }

    if (choice.test) {
      const roll = rollD6(this.rng);
      const success = roll + this.state.character.stats[choice.test.stat] >= choice.test.difficulty;
      this.enter(success ? choice.test.onSuccess : choice.test.onFailure);
      return { roll, success };
    }
    if (!choice.to) throw new Error("Choix sans destination ni test");
    this.enter(choice.to);
    return {};
  }

  /** Entre dans une scène : mémorise, applique ses effets, vérifie la mort. */
  private enter(sceneId: string): void {
    this.state.sceneId = sceneId;
    this.state.history.push(sceneId);
    this.applyEffects(this.scene.onEnter ?? []);
    if (this.state.character.hp <= 0 && sceneId !== this.campaign.deathScene) {
      this.state.sceneId = this.campaign.deathScene;
      this.state.history.push(this.campaign.deathScene);
    }
  }

  private applyEffects(effects: Effect[]): void {
    const ch = this.state.character;
    for (const e of effects) {
      // Même principe que le `switch` : le test sur `e.type` « affine » le type de `e`.
      if (e.type === "hp") ch.hp = Math.max(0, ch.hp + e.delta);
      if (e.type === "addItem" && !ch.inventory.includes(e.item)) ch.inventory.push(e.item);
      if (e.type === "removeItem") ch.inventory = ch.inventory.filter((i) => i !== e.item);
    }
  }
}

/** Personnage utilisé par défaut au début de chaque aventure. */
export const defaultCharacter: Character = {
  name: "Aventurier",
  stats: { force: 3, habilete: 3, chance: 2 },
  hp: 10,
  inventory: [],
};
