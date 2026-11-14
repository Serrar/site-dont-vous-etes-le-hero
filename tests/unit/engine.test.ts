import { describe, it, expect } from "vitest";
import campaign from "../../src/campaigns/crypte.json";
import { Game, defaultCharacter } from "../../src/engine/engine.ts";
import type { Campaign } from "../../src/engine/types.ts";

const c = campaign as Campaign;
const always6 = () => 0.99; // d6 = 6
const always1 = () => 0; // d6 = 1

/** Aide : choisit le choix dont le texte contient `label`. */
function pick(game: Game, label: string) {
  const found = game.availableChoices().find((x) => x.choice.text.includes(label));
  if (!found) throw new Error(`Choix introuvable : ${label}`);
  return game.choose(found.index);
}

describe("moteur", () => {
  it("démarre sur la scène de départ", () => {
    const g = new Game(c, defaultCharacter);
    expect(g.state.sceneId).toBe("start");
    expect(g.isOver).toBe(false);
  });

  it("ne modifie pas le personnage d'origine (pas d'effet de bord)", () => {
    const g = new Game(c, defaultCharacter);
    pick(g, "porte principale");
    pick(g, "torche");
    expect(defaultCharacter.inventory).toEqual([]);
  });

  it("masque un choix dont la condition n'est pas remplie", () => {
    const g = new Game(c, defaultCharacter);
    pick(g, "porte principale");
    pick(g, "noir");
    const texts = g.availableChoices().map((x) => x.choice.text);
    expect(texts.some((t) => t.includes("escalier"))).toBe(false);
  });

  it("affiche le choix conditionnel une fois l'objet obtenu", () => {
    const g = new Game(c, defaultCharacter);
    pick(g, "porte principale");
    pick(g, "Ramasser la torche");
    pick(g, "Poursuivre");
    const texts = g.availableChoices().map((x) => x.choice.text);
    expect(texts.some((t) => t.includes("escalier"))).toBe(true);
  });

  it("applique la perte de PV d'un choix", () => {
    const g = new Game(c, defaultCharacter);
    pick(g, "porte principale");
    pick(g, "noir");
    expect(g.state.character.hp).toBe(8);
  });

  it("envoie à la scène de mort quand les PV tombent à 0", () => {
    const fragile = { ...defaultCharacter, hp: 2 };
    const g = new Game(c, fragile);
    pick(g, "porte principale");
    pick(g, "noir");
    expect(g.state.sceneId).toBe("mort");
    expect(g.scene.ending?.type).toBe("defeat");
  });

  it("jet réussi (dé=6, force 3 → 9 ≥ 8) mène au trésor", () => {
    const g = new Game(c, defaultCharacter, always6);
    pick(g, "porte principale");
    pick(g, "noir");
    pick(g, "gardien");
    const r = pick(g, "Attaquer");
    expect(r).toEqual({ roll: 6, success: true });
    expect(g.state.sceneId).toBe("tresor");
  });

  it("jet raté (dé=1, force 3 → 4 < 8) mène à la mort", () => {
    const g = new Game(c, defaultCharacter, always1);
    pick(g, "porte principale");
    pick(g, "noir");
    pick(g, "gardien");
    const r = pick(g, "Attaquer");
    expect(r.success).toBe(false);
    expect(g.state.sceneId).toBe("mort");
  });

  it("valeur limite : le jet réussit pile à la difficulté", () => {
    // chance 2 + dé 4 = 6 = difficulté 6 → réussite (>=)
    const g = new Game(c, defaultCharacter, () => 0.5); // d6 = 4
    const r = pick(g, "passage secret");
    expect(r.success).toBe(true);
    expect(g.state.character.inventory).toContain("cle_ancienne");
  });

  it("refuse un choix indisponible", () => {
    const g = new Game(c, defaultCharacter);
    expect(() => g.choose(99)).toThrow();
  });
});
