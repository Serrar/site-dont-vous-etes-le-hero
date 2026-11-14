import type { Campaign, Character, Choice, Condition, Effect, GameState, Scene } from "./types.ts";
import { rollD6 } from "./rng.ts";
import type { Rng } from "./rng.ts";

export function checkCondition(c: Condition, ch: Character): boolean {
  switch (c.type) {
    case "stat":
      return ch.stats[c.stat] >= c.min;
    case "item":
      return ch.inventory.includes(c.item);
  }
}

export interface ChoiceResult {
  roll?: number;
  success?: boolean;
}

export class Game {
  readonly state: GameState;
  private campaign: Campaign;
  private rng: Rng;

  constructor(campaign: Campaign, character: Character, rng: Rng = Math.random) {
    this.campaign = campaign;
    this.rng = rng;
    this.state = { sceneId: campaign.start, character: structuredClone(character), history: [] };
    this.enter(campaign.start);
  }

  get scene(): Scene {
    const s = this.campaign.scenes[this.state.sceneId];
    if (!s) throw new Error(`Scène inconnue : ${this.state.sceneId}`);
    return s;
  }

  get isOver(): boolean {
    return this.scene.ending !== undefined;
  }

  /** Choix visibles (conditions remplies), avec leur index d'origine. */
  availableChoices(): { index: number; choice: Choice }[] {
    return (this.scene.choices ?? [])
      .map((choice, index) => ({ index, choice }))
      .filter(({ choice }) => !choice.condition || checkCondition(choice.condition, this.state.character));
  }

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
      if (e.type === "hp") ch.hp = Math.max(0, ch.hp + e.delta);
      if (e.type === "addItem" && !ch.inventory.includes(e.item)) ch.inventory.push(e.item);
      if (e.type === "removeItem") ch.inventory = ch.inventory.filter((i) => i !== e.item);
    }
  }
}

export const defaultCharacter: Character = {
  name: "Aventurier",
  stats: { force: 3, habilete: 3, chance: 2 },
  hp: 10,
  inventory: [],
};
