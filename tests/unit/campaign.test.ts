// ============================================================================
// Tests des campagnes : validation statique, parties aléatoires, « tests de mutation ».
//  - describe.each(tableau)(...) : le même groupe de tests pour CHAQUE campagne trouvée.
//  - « fuzzing » : on joue des milliers de parties au hasard (reproductibles grâce à la seed)
//    pour trouver des blocages que personne n'aurait pensé à tester à la main.
//  - « mutation » : on casse volontairement une campagne pour vérifier que le validateur le voit.
//  - `!` après une valeur (ex. choices![0]) : « je sais que ce n'est pas undefined ».
// ============================================================================

import { describe, it, expect } from "vitest";
import crypte from "../../src/campaigns/crypte.json";
import { bundledCampaigns } from "../../src/catalog/bundled.ts";
import { validateCampaign } from "../../src/engine/validate.ts";
import { illustrationIds } from "../../src/illustrations/index.ts";
import type { Campaign } from "../../src/engine/types.ts";
import { playRandom } from "./helpers.ts";

// Ces tests s'appliquent AUTOMATIQUEMENT à chaque campagne présente dans src/campaigns/.
// Ajouter une aventure = elle est testée sans écrire une ligne de test.
describe.each(Object.entries(bundledCampaigns))("campagne %s", (_path, campaign) => {
  it("est valide (analyse statique du graphe)", () => {
    expect(validateCampaign(campaign, { illustrationIds }).errors).toEqual([]);
  });

  it("1000 parties aléatoires atteignent toutes une fin (ni blocage ni boucle)", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const { game, steps, blocked } = playRandom(campaign, seed);
      expect(blocked, `seed ${seed} bloquée`).toBe(false);
      expect(game.isOver, `seed ${seed} non terminée après ${steps} pas`).toBe(true);
    }
  });

  it("toutes les fins sont atteintes au moins une fois", () => {
    const reached = new Set<string>();
    for (let seed = 0; seed < 1000; seed++) reached.add(playRandom(campaign, seed).game.state.sceneId);
    const endings = Object.keys(campaign.scenes).filter((id) => campaign.scenes[id].ending);
    expect([...reached].sort()).toEqual(endings.sort());
  });

  it("les PV ne descendent jamais sous 0", () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(playRandom(campaign, seed).game.state.character.hp).toBeGreaterThanOrEqual(0);
    }
  });
});

// "Tester le testeur" : on casse volontairement une campagne et on vérifie que le validateur réagit.
describe("validateur (tests de mutation)", () => {
  const clone = (): Campaign => structuredClone(crypte as Campaign);

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

  it("détecte une illustration inconnue", () => {
    const bad = clone();
    bad.scenes.start.illustration = "dragon-inexistant";
    expect(validateCampaign(bad, { illustrationIds }).errors.join()).toMatch(/illustration inconnue/);
  });

  it("la scène de mort est atteignable par les dégâts, même sans choix qui y mène", () => {
    const c = clone();
    // On retire tous les liens vers « mort », mais on garde des effets qui retirent des PV
    for (const scene of Object.values(c.scenes)) {
      for (const ch of scene.choices ?? []) {
        if (ch.test?.onFailure === "mort") ch.test.onFailure = "hall";
      }
    }
    expect(validateCampaign(c).errors.join()).not.toMatch(/mort : scène inaccessible/);
  });

  it("…mais devient inaccessible si plus aucun effet ne retire de PV", () => {
    const c = clone();
    for (const scene of Object.values(c.scenes)) {
      for (const ch of scene.choices ?? []) {
        if (ch.test?.onFailure === "mort") ch.test.onFailure = "hall";
        ch.effects = ch.effects?.filter((e) => !(e.type === "hp" && e.delta < 0));
      }
    }
    expect(validateCampaign(c).errors.join()).toMatch(/mort : scène inaccessible/);
  });

  it("détecte une version de schéma non supportée", () => {
    const bad = { ...clone(), schemaVersion: 2 } as unknown as Campaign;
    expect(validateCampaign(bad).errors.join()).toMatch(/schemaVersion/);
  });
});
