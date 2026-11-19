// ============================================================================
// Outils partagés par les tests (ce n'est pas un test : pas de describe/it ici).
// ============================================================================

import { Game, defaultCharacter } from "../../src/engine/engine.ts";
import { mulberry32 } from "../../src/engine/rng.ts";
import type { Campaign, Character } from "../../src/engine/types.ts";

/** Choisit, dans la scène courante, le choix dont le texte contient `label`. */
export function pick(game: Game, label: string) {
  const found = game.availableChoices().find((x) => x.choice.text.includes(label));
  if (!found) throw new Error(`Choix introuvable ou masqué : "${label}" (scène ${game.state.sceneId})`);
  return game.choose(found.index);
}

/** Joue une partie en choisissant au hasard (reproductible grâce à la seed). */
export function playRandom(
  campaign: Campaign,
  seed: number,
  character: Character = defaultCharacter,
  maxSteps = 50,
) {
  const pickRng = mulberry32(seed + 10_000);
  const game = new Game(campaign, character, mulberry32(seed));
  let steps = 0;
  let blocked = false;
  while (!game.isOver && steps < maxSteps) {
    const options = game.availableChoices();
    if (options.length === 0) {
      blocked = true;
      break;
    }
    game.choose(options[Math.floor(pickRng() * options.length)].index);
    steps++;
  }
  return { game, steps, blocked };
}
