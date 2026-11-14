import campaign from "./campaigns/crypte.json";
import { Game, defaultCharacter } from "./engine/engine.ts";
import { mulberry32 } from "./engine/rng.ts";
import type { Campaign } from "./engine/types.ts";

const $ = (id: string) => document.getElementById(id)!;
const seed = new URLSearchParams(location.search).get("seed");
let game: Game;

function start() {
  const rng = seed !== null ? mulberry32(Number(seed)) : Math.random;
  game = new Game(campaign as Campaign, defaultCharacter, rng);
  $("roll").textContent = "";
  render();
}

function render() {
  const { character } = game.state;
  $("title").textContent = (campaign as Campaign).title;
  $("sheet").textContent =
    `${character.name} — PV ${character.hp} | Force ${character.stats.force} | ` +
    `Habileté ${character.stats.habilete} | Chance ${character.stats.chance} | ` +
    `Inventaire : ${character.inventory.join(", ") || "vide"}`;
  $("scene-text").textContent = game.scene.text;

  const choicesEl = $("choices");
  choicesEl.replaceChildren();
  for (const { index, choice } of game.availableChoices()) {
    const b = document.createElement("button");
    b.textContent = choice.text;
    b.dataset.testid = `choice-${index}`;
    b.onclick = () => {
      const r = game.choose(index);
      $("roll").textContent = r.roll !== undefined ? `Dé : ${r.roll} — ${r.success ? "réussite" : "échec"}` : "";
      render();
    };
    choicesEl.append(b);
  }

  const ending = game.scene.ending;
  $("ending").hidden = !ending;
  $("ending").textContent = ending?.title ?? "";
  $("ending").dataset.type = ending?.type ?? "";
  $("restart").hidden = !ending;
}

$("restart").onclick = start;
start();
