// ============================================================================
// main.ts : point d'entrée. Il assemble les pièces et gère quel écran est affiché :
//   - le menu principal (choix d'une aventure, accès à l'atelier),
//   - l'écran de jeu,
//   - l'atelier du scribe (éditeur).
// ============================================================================

import "./style.css"; // Vite injecte la feuille de style dans la page
import { createBundledSource } from "./catalog/bundled.ts";
import { createLocalSource, createMemoryStorage } from "./catalog/local.ts";
import type { StorageLike } from "./catalog/local.ts";
import { createCompositeSource } from "./catalog/source.ts";
import type { CampaignMeta } from "./catalog/source.ts";
import type { Campaign } from "./engine/types.ts";
import { createEditor } from "./editor/editor.ts";
import { byId, clear, el, put } from "./ui/dom.ts";
import { createGameScreen } from "./ui/game.ts";

type Screen = "menu" | "game" | "editor";

const params = new URLSearchParams(location.search);

// Certains navigateurs (mode privé, cookies bloqués) interdisent localStorage :
// dans ce cas on se rabat sur une mémoire temporaire (les brouillons seront perdus à la fermeture).
function pickStorage(): StorageLike {
  try {
    return window.localStorage;
  } catch {
    return createMemoryStorage();
  }
}

// Les sources de campagnes : celles livrées avec le projet + les brouillons de l'utilisateur.
const bundled = createBundledSource();
const local = createLocalSource(pickStorage());
const all = createCompositeSource([bundled, local]);

const game = createGameScreen(params.get("seed")); // ?seed=N : dés déterministes (tests)

const editor = createEditor({
  root: byId("editor"),
  bundled,
  local,
  onExit: () => void showMenu(),
  // Tester depuis l'éditeur : on lance la partie, et « retour » ramène dans l'éditeur.
  onPlay: (campaign) => {
    show("game");
    game.start(campaign, {
      backLabel: "← Retour à l'éditeur",
      onBack: () => {
        show("editor");
        editor.resume();
      },
    });
  },
});

/** Affiche un écran et masque les autres. */
function show(screen: Screen): void {
  for (const name of ["menu", "game", "editor"] as Screen[]) byId(name).hidden = name !== screen;
  // L'éditeur a besoin de plus de largeur que le jeu.
  document.querySelector("main")!.classList.toggle("wide", screen === "editor");
}

/** Une carte cliquable dans la liste des aventures. */
function campaignCard(meta: CampaignMeta): HTMLElement {
  return el(
    "button",
    { "data-testid": `campaign-card-${meta.id}`, onclick: () => void playById(meta.id) },
    el("strong", {}, meta.title),
    meta.origin === "local" ? el("span", { class: "badge" }, "brouillon") : null,
    el("br"),
    el("span", {}, meta.description ?? ""),
  );
}

async function showMenu(): Promise<void> {
  const metas = await all.list();
  const library = metas.filter((m) => m.origin !== "local");
  const drafts = metas.filter((m) => m.origin === "local");

  const list = byId("campaign-list");
  clear(list);
  put(list, library.map(campaignCard));

  const draftList = byId("draft-list");
  clear(draftList);
  put(draftList, drafts.map(campaignCard));
  byId("drafts-title").hidden = drafts.length === 0;

  show("menu");
}

async function playById(id: string): Promise<void> {
  const campaign: Campaign | undefined = await all.get(id);
  if (!campaign) return showMenu(); // identifiant inconnu : retour au menu
  game.start(campaign, { onBack: () => void showMenu() });
  show("game");
}

byId("open-editor").onclick = () => {
  show("editor");
  void editor.open();
};

// ?campaign=<id> : accès direct à une aventure (pratique pour les tests automatisés)
const direct = params.get("campaign");
void (direct ? playById(direct) : showMenu());
