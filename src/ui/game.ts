// ============================================================================
// game.ts : l'écran de jeu (texte de la scène, illustration, choix, fiche du
// personnage). Il pilote le moteur (Game) mais ne contient aucune règle.
// ============================================================================

import { Game, defaultCharacter } from "../engine/engine.ts";
import { mulberry32 } from "../engine/rng.ts";
import type { Campaign } from "../engine/types.ts";
import { illustrations } from "../illustrations/index.ts";
import { byId, clear, el } from "./dom.ts";

export interface StartOptions {
  /** Texte du bouton de retour (« ← Changer d'aventure » par défaut). */
  backLabel?: string;
  /** Appelé quand le joueur clique sur le bouton de retour. */
  onBack: () => void;
}

export interface GameScreen {
  start(campaign: Campaign, options: StartOptions): void;
}

/**
 * @param seed  graine du hasard (?seed=42 dans l'URL) ; null = vrai hasard.
 *              Avec une graine, les jets de dés sont toujours identiques :
 *              indispensable pour des tests automatisés stables.
 */
export function createGameScreen(seed: string | null): GameScreen {
  // Les éléments de la page, récupérés une fois pour toutes.
  const title = byId("title");
  const sheet = byId("sheet");
  const sceneText = byId("scene-text");
  const roll = byId("roll");
  const choicesBox = byId("choices");
  const ending = byId("ending");
  const restartBtn = byId("restart");
  const backBtn = byId("back");
  const figure = byId("illustration");

  // `let` + type explicite : ces variables sont remplies au démarrage d'une partie.
  let campaign: Campaign;
  let game: Game;

  function restart(): void {
    const rng = seed !== null ? mulberry32(Number(seed)) : Math.random;
    // Point d'extension : ici on pourra passer un personnage conservé d'une aventure à l'autre.
    game = new Game(campaign, defaultCharacter, rng);
    roll.textContent = "";
    render();
  }

  /** Ne remplace l'image que si elle change (évite de rejouer le fondu à chaque choix). */
  function renderIllustration(id: string | undefined): void {
    const art = id ? illustrations[id] : undefined;
    figure.hidden = !art;
    if (!art || figure.dataset.id === id) return;
    figure.innerHTML = art; // SVG statiques écrits dans ce dépôt : contenu de confiance
    figure.dataset.id = id;
    figure.style.animation = "none";
    void figure.offsetWidth; // force le recalcul pour relancer le fondu
    figure.style.animation = "";
  }

  function render(): void {
    const { character } = game.state;
    title.textContent = campaign.title;
    sheet.textContent =
      `${character.name} — PV ${character.hp} | Force ${character.stats.force} | ` +
      `Habileté ${character.stats.habilete} | Chance ${character.stats.chance} | ` +
      `Inventaire : ${character.inventory.join(", ") || "vide"}`;
    sceneText.textContent = game.scene.text;
    renderIllustration(game.scene.illustration);

    clear(choicesBox);
    for (const { index, choice } of game.availableChoices()) {
      choicesBox.append(
        el(
          "button",
          {
            "data-testid": `choice-${index}`,
            onclick: () => {
              const r = game.choose(index);
              roll.textContent = r.roll !== undefined ? `Dé : ${r.roll} — ${r.success ? "réussite" : "échec"}` : "";
              render();
            },
          },
          choice.text,
        ),
      );
    }

    const end = game.scene.ending;
    ending.hidden = !end;
    ending.textContent = end?.title ?? "";
    ending.dataset.type = end?.type ?? "";
    restartBtn.hidden = !end;
  }

  restartBtn.onclick = restart;

  return {
    start(c, options) {
      campaign = c;
      backBtn.textContent = options.backLabel ?? "← Changer d'aventure";
      backBtn.onclick = options.onBack;
      figure.dataset.id = ""; // force l'affichage de la première image
      restart();
    },
  };
}
