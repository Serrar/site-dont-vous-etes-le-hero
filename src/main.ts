import { createBundledSource } from "./catalog/bundled.ts";
import { Game, defaultCharacter } from "./engine/engine.ts";
import { mulberry32 } from "./engine/rng.ts";
import type { Campaign } from "./engine/types.ts";

const $ = (id: string) => document.getElementById(id)!;

// Seule ligne à changer pour brancher une autre origine de campagnes (éditeur, API...).
const source = createBundledSource();

const params = new URLSearchParams(location.search);
const seed = params.get("seed"); // ?seed=N : dés déterministes
let campaign: Campaign;
let game: Game;

async function showMenu() {
  $("game").hidden = true;
  $("menu").hidden = false;
  const list = $("campaign-list");
  list.replaceChildren();
  for (const meta of await source.list()) {
    const b = document.createElement("button");
    b.dataset.testid = `campaign-card-${meta.id}`;
    const title = document.createElement("strong");
    title.textContent = meta.title;
    const desc = document.createElement("span");
    desc.textContent = meta.description ?? "";
    b.append(title, document.createElement("br"), desc);
    b.onclick = () => void startCampaign(meta.id);
    list.append(b);
  }
}

async function startCampaign(id: string) {
  const found = await source.get(id);
  if (!found) return showMenu(); // identifiant inconnu : retour au menu
  campaign = found;
  restart();
  $("menu").hidden = true;
  $("game").hidden = false;
}

function restart() {
  const rng = seed !== null ? mulberry32(Number(seed)) : Math.random;
  // Point d'extension : ici on pourra passer un personnage conservé d'une campagne à l'autre.
  game = new Game(campaign, defaultCharacter, rng);
  $("roll").textContent = "";
  render();
}

function render() {
  const { character } = game.state;
  $("title").textContent = campaign.title;
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

$("restart").onclick = restart;
$("back").onclick = () => void showMenu();

// ?campaign=<id> : accès direct à une aventure (pratique pour les tests e2e)
const direct = params.get("campaign");
void (direct ? startCampaign(direct) : showMenu());
