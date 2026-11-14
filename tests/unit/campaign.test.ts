import { describe, it, expect } from "vitest";
import campaign from "../../src/campaigns/crypte.json";
import { Game, defaultCharacter } from "../../src/engine/engine.ts";
import { mulberry32 } from "../../src/engine/rng.ts";
import { validateCampaign } from "../../src/engine/validate.ts";
import type { Campaign } from "../../src/engine/types.ts";

const c = campaign as Campaign;
const clone = (): Campaign => structuredClone(c);

describe("validation statique de la campagne", () => {
  it("ne contient aucune erreur", () => {
    expect(validateCampaign(c).errors).toEqual([]);
  });

  // "Tester le testeur" : on casse volontairement la campagne
  it("détecte une destination inexistante", () => {
    const bad = clone();
    bad.scenes.start.choices![0].to = "nulle_part";
    expect(validateCampaign(bad).errors.join()).toMatch(/destination inconnue/);
  });

  it("détecte une scène inaccessible", () => {
    const bad = clone();
    bad.scenes.orpheline = { text: "Personne ne vient ici.", ending: { type: "neutral", title: "?" } };
    expect(validateCampaign(bad).errors.join()).toMatch(/orpheline : scène inaccessible/);
  });

  it("détecte un cul-de-sac", () => {
    const bad = clone();
    delete bad.scenes.escalier.choices;
    expect(validateCampaign(bad).errors.join()).toMatch(/escalier : cul-de-sac/);
  });

  it("détecte un objet requis mais jamais obtenable", () => {
    const bad = clone();
    delete bad.scenes.torche.onEnter;
    expect(validateCampaign(bad).errors.join()).toMatch(/objet "torche"/);
  });
});

describe("parcours aléatoires (fuzzing avec seed)", () => {
  function playRandom(seed: number) {
    const pickRng = mulberry32(seed + 10_000);
    const g = new Game(c, defaultCharacter, mulberry32(seed));
    let steps = 0;
    while (!g.isOver && steps < 50) {
      const options = g.availableChoices();
      expect(options.length).toBeGreaterThan(0); // jamais bloqué
      g.choose(options[Math.floor(pickRng() * options.length)].index);
      steps++;
    }
    return { g, steps };
  }

  it("1000 parties aléatoires atteignent toutes une fin (pas de boucle infinie)", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const { g, steps } = playRandom(seed);
      expect(g.isOver, `seed ${seed} bloquée après ${steps} pas`).toBe(true);
    }
  });

  it("toutes les fins sont atteintes au moins une fois (couverture)", () => {
    const reached = new Set<string>();
    for (let seed = 0; seed < 1000; seed++) reached.add(playRandom(seed).g.state.sceneId);
    const endings = Object.keys(c.scenes).filter((id) => c.scenes[id].ending);
    expect([...reached].sort()).toEqual(endings.sort());
  });

  it("le personnage ne descend jamais sous 0 PV", () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(playRandom(seed).g.state.character.hp).toBeGreaterThanOrEqual(0);
    }
  });
});
