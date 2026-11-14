import { describe, it, expect } from "vitest";
import bugs from "../../src/campaigns/royaume-bugs.json";
import { Game, defaultCharacter } from "../../src/engine/engine.ts";
import type { Campaign } from "../../src/engine/types.ts";
import { pick } from "./helpers.ts";

const c = bugs as Campaign;

function gotoBoss(game: Game) {
  pick(game, "Lire le ticket");
  pick(game, "Partir vers le donjon");
  pick(game, "égouts");
  pick(game, "Remonter");
}

describe("Le Royaume maudit des Bugs", () => {
  it("chemin sans aucun jet de dé : ticket → égouts → logs → cas de test → victoire", () => {
    const g = new Game(c, defaultCharacter);
    gotoBoss(g);
    pick(g, "Analyser les logs");
    pick(g, "Affronter le Bug Fantôme");
    pick(g, "cas de test");
    expect(g.state.sceneId).toBe("victoire");
    expect(g.scene.ending?.type).toBe("victory");
  });

  it("la lecture du ticket débloque l'analyse des logs", () => {
    const sans = new Game(c, defaultCharacter);
    pick(sans, "Foncer");
    pick(sans, "égouts");
    pick(sans, "Remonter");
    expect(sans.availableChoices().map((x) => x.choice.text)).not.toContain("Analyser les logs");

    const avec = new Game(c, defaultCharacter);
    gotoBoss(avec);
    expect(avec.availableChoices().map((x) => x.choice.text)).toContain("Analyser les logs");
  });

  it("le badge des égouts ouvre la salle des serveurs", () => {
    const g = new Game(c, defaultCharacter);
    pick(g, "Foncer");
    pick(g, "égouts");
    expect(g.state.character.inventory).toContain("badge_admin");
    pick(g, "Remonter");
    expect(g.availableChoices().map((x) => x.choice.text)).toContain("Ouvrir la salle des serveurs");
  });

  it("l'indice est consommé quand on rédige le cas de test (removeItem)", () => {
    const g = new Game(c, defaultCharacter);
    gotoBoss(g);
    pick(g, "Analyser les logs");
    expect(g.state.character.inventory).toContain("indice_regression");
    pick(g, "Affronter le Bug Fantôme");
    pick(g, "cas de test");
    expect(g.state.character.inventory).not.toContain("indice_regression");
  });

  it("condition de caractéristique : « faille de logique » exige Habileté ≥ 5", () => {
    const boss = (habilete: number) => {
      const g = new Game(c, { ...defaultCharacter, stats: { ...defaultCharacter.stats, habilete } });
      pick(g, "Foncer");
      pick(g, "égouts");
      pick(g, "Remonter");
      pick(g, "Affronter le Bug Fantôme");
      return g.availableChoices().map((x) => x.choice.text);
    };
    expect(boss(4)).not.toContain("Exploiter une faille de logique");
    expect(boss(5)).toContain("Exploiter une faille de logique");
  });

  it("les égouts coûtent 1 PV", () => {
    const g = new Game(c, defaultCharacter);
    pick(g, "Foncer");
    pick(g, "égouts");
    expect(g.state.character.hp).toBe(9);
  });
});
