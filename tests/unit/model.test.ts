// ============================================================================
// Tests du « modèle » de l'éditeur (src/editor/model.ts).
//
// Rappel Vitest :
//   describe("...", () => { ... })  regroupe des tests ;
//   it("...", () => { ... })        un test ; il échoue si une assertion échoue ;
//   expect(valeur).toBe(attendu)    une assertion (toBe = égalité stricte, toEqual = égalité profonde).
// `structuredClone(x)` fabrique une copie indépendante : indispensable ici, car les
// fonctions testées MODIFIENT l'objet reçu, et on ne veut pas abîmer l'original.
// ============================================================================

import { describe, it, expect } from "vitest";
import crypte from "../../src/campaigns/crypte.json";
import { illustrationIds } from "../../src/illustrations/index.ts";
import { validateCampaign } from "../../src/engine/validate.ts";
import type { Campaign } from "../../src/engine/types.ts";
import {
  addScene,
  countReferences,
  createEmptyCampaign,
  deleteScene,
  isValidId,
  moveChoice,
  newSceneId,
  renameScene,
  setChoiceKind,
  slugify,
  uniqueId,
} from "../../src/editor/model.ts";
import { playRandom } from "./helpers.ts";

// `as Campaign` : le JSON importé est typé « au plus large » par TypeScript (string, number...) ;
// on affirme qu'il respecte bien notre type Campaign.
const fresh = (): Campaign => structuredClone(crypte as Campaign);

describe("identifiants", () => {
  it("slugify retire accents et ponctuation", () => {
    expect(slugify("La Crypte oubliée !")).toBe("la-crypte-oubliee");
    expect(slugify("  Été   2026 ")).toBe("ete-2026");
  });

  it("slugify ne renvoie jamais un identifiant vide", () => {
    expect(slugify("???")).toBe("sans-titre");
    expect(slugify("")).toBe("sans-titre");
  });

  it("isValidId accepte minuscules/chiffres/-/_ et refuse le reste", () => {
    for (const ok of ["a", "grotte-2", "scene_1", "9lives"]) expect(isValidId(ok), ok).toBe(true);
    for (const bad of ["", "Grotte", "a b", "é", "-a", "a/b"]) expect(isValidId(bad), bad).toBe(false);
  });

  it("uniqueId ajoute un suffixe tant que l'identifiant est pris", () => {
    expect(uniqueId("a", ["b"])).toBe("a");
    expect(uniqueId("a", ["a"])).toBe("a-2");
    expect(uniqueId("a", ["a", "a-2", "a-3"])).toBe("a-4");
  });
});

describe("aventure vierge", () => {
  it("est déjà valide, sans erreur ni avertissement", () => {
    const c = createEmptyCampaign("test", "Test");
    expect(validateCampaign(c, { illustrationIds })).toEqual({ errors: [], warnings: [] });
  });

  it("est jouable : 300 parties aléatoires atteignent toutes une fin", () => {
    const c = createEmptyCampaign("test", "Test");
    for (let seed = 0; seed < 300; seed++) {
      const { game, blocked } = playRandom(c, seed);
      expect(blocked).toBe(false);
      expect(game.isOver).toBe(true);
    }
  });
});

describe("scènes", () => {
  it("newSceneId choisit le premier numéro libre", () => {
    const c = fresh();
    expect(newSceneId(c)).toBe("scene-1");
    c.scenes["scene-1"] = { text: "x", choices: [] };
    c.scenes["scene-3"] = { text: "x", choices: [] };
    expect(newSceneId(c)).toBe("scene-2");
  });

  it("addScene crée une scène vide et renvoie son identifiant", () => {
    const c = fresh();
    const id = addScene(c);
    expect(c.scenes[id]).toBeDefined();
    expect(c.scenes[id].choices).toEqual([]);
  });

  it("renameScene met à jour départ, mort, destinations et jets de dés", () => {
    const c = fresh();
    renameScene(c, "mort", "trepas");
    renameScene(c, "start", "debut");
    expect(c.start).toBe("debut");
    expect(c.deathScene).toBe("trepas");
    expect(c.scenes.garde.choices![0].test!.onFailure).toBe("trepas");
    expect(c.scenes.debut.choices![0].to).toBe("hall");
    // aucune référence cassée : la campagne reste valide
    expect(validateCampaign(c).errors).toEqual([]);
  });

  it("renameScene conserve l'ordre des scènes", () => {
    const c = fresh();
    const before = Object.keys(c.scenes);
    renameScene(c, "hall", "grand-hall");
    expect(Object.keys(c.scenes)).toEqual(before.map((id) => (id === "hall" ? "grand-hall" : id)));
  });

  it("renameScene refuse un identifiant invalide ou déjà pris", () => {
    const c = fresh();
    expect(() => renameScene(c, "hall", "Grand Hall")).toThrow(/invalide/);
    expect(() => renameScene(c, "hall", "couloir")).toThrow(/existe déjà/);
    expect(() => renameScene(c, "inconnue", "autre")).toThrow(/inconnue/);
    expect(c.scenes.hall).toBeDefined(); // rien n'a été modifié
  });

  it("deleteScene refuse de supprimer le départ et la scène de mort", () => {
    const c = fresh();
    expect(() => deleteScene(c, "start")).toThrow(/départ/);
    expect(() => deleteScene(c, "mort")).toThrow(/mort/);
  });

  it("deleteScene retire aussi les choix et les jets qui y menaient", () => {
    const c = fresh();
    expect(countReferences(c, "torche")).toBe(1);
    const removed = deleteScene(c, "torche");
    expect(removed).toBe(1);
    expect(c.scenes.torche).toBeUndefined();
    expect(countReferences(c, "torche")).toBe(0);
    // la scène « hall » n'avait plus que le choix « Avancer dans le noir »
    expect(c.scenes.hall.choices).toHaveLength(1);
  });

  it("deleteScene gère les jets de dés (réussite OU échec pointant vers la scène)", () => {
    const c = fresh();
    expect(countReferences(c, "fuite")).toBe(1); // « Te faufiler » : réussite → fuite
    deleteScene(c, "fuite");
    expect(c.scenes.garde.choices).toHaveLength(1); // « Attaquer » reste
  });
});

describe("choix", () => {
  it("moveChoice échange deux choix et ignore les déplacements impossibles", () => {
    const c = fresh();
    const scene = c.scenes.couloir;
    const [a, b] = [scene.choices![0].text, scene.choices![1].text];
    moveChoice(scene, 0, 1);
    expect([scene.choices![0].text, scene.choices![1].text]).toEqual([b, a]);
    moveChoice(scene, 0, -1); // déjà en haut : sans effet
    expect(scene.choices![0].text).toBe(b);
  });

  it("setChoiceKind bascule entre destination directe et jet de dés sans perdre la destination", () => {
    const choice = { text: "Aller", to: "hall" };
    setChoiceKind(choice, "test");
    expect(choice).toMatchObject({ test: { onSuccess: "hall", onFailure: "" } });
    expect("to" in choice).toBe(false);
    setChoiceKind(choice, "direct");
    expect(choice).toMatchObject({ to: "hall" });
    expect("test" in choice).toBe(false);
  });
});
