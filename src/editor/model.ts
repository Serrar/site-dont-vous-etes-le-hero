// ============================================================================
// model.ts : les opérations de MODIFICATION d'une campagne (ajouter une scène,
// renommer, supprimer...). Aucune interface ici : ce sont des fonctions
// ordinaires, testées seules. L'écran de l'éditeur ne fait que les appeler.
//
// Convention : ces fonctions MODIFIENT la campagne reçue (comme le ferait du JS
// classique) et lèvent une Error avec un message en français si l'opération est
// impossible. L'écran affiche ce message tel quel.
// ============================================================================

import type { Campaign, Choice, Scene } from "../engine/types.ts";

// ---------- Identifiants ----------

/** Transforme un titre en identifiant : « La Crypte oubliée ! » → « la-crypte-oubliee ». */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFD") // sépare les lettres de leurs accents (é → e + ´)
    .replace(/[\u0300-\u036f]/g, "") // supprime les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // tout ce qui n'est pas lettre/chiffre devient « - »
    .replace(/^-+|-+$/g, ""); // pas de « - » au début ni à la fin
  return slug || "sans-titre";
}

/** Un identifiant valide : minuscules, chiffres, « - » et « _ », sans espace ni accent. */
export function isValidId(id: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/.test(id);
}

/** Renvoie `base`, ou `base-2`, `base-3`... si déjà pris. `Iterable<string>` : tableau, Set, etc. */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// ---------- Création ----------

/**
 * Une aventure vierge mais déjà valide : un départ, deux choix (dont un jet de dé),
 * une victoire et une défaite. Elle passe la validation, ce qui permet de la tester
 * tout de suite et de la modifier pas à pas.
 */
export function createEmptyCampaign(id: string, title: string): Campaign {
  return {
    schemaVersion: 1,
    id,
    title,
    description: "",
    start: "start",
    deathScene: "mort",
    scenes: {
      start: {
        text: "Écris ici le début de ton histoire.",
        illustration: "scroll",
        choices: [
          { text: "Choix prudent", to: "fin" },
          { text: "Choix risqué (jet de chance)", test: { stat: "chance", difficulty: 6, onSuccess: "fin", onFailure: "mort" } },
        ],
      },
      fin: {
        text: "Écris ici la conclusion heureuse.",
        illustration: "victory",
        ending: { type: "victory", title: "Fin : la victoire" },
      },
      mort: {
        text: "Écris ici la conclusion tragique.",
        illustration: "skull",
        ending: { type: "defeat", title: "Fin : la défaite" },
      },
    },
  };
}

// ---------- Scènes ----------

/** Prochain identifiant libre de la forme « scene-1 », « scene-2 »... */
export function newSceneId(c: Campaign): string {
  let n = 1;
  while (c.scenes[`scene-${n}`]) n++;
  return `scene-${n}`;
}

/** Ajoute une scène vide (avec une liste de choix vide) et renvoie son identifiant. */
export function addScene(c: Campaign, text = "Nouvelle scène : écris ici ce qui se passe."): string {
  const id = newSceneId(c);
  c.scenes[id] = { text, choices: [] };
  return id;
}

/** Choix (et jets) qui mènent vers la scène `id`. */
export function countReferences(c: Campaign, id: string): number {
  let n = 0;
  for (const scene of Object.values(c.scenes)) {
    for (const ch of scene.choices ?? []) if (leadsTo(ch, id)) n++;
  }
  return n;
}

function leadsTo(ch: Choice, id: string): boolean {
  return ch.to === id || ch.test?.onSuccess === id || ch.test?.onFailure === id;
}

/** Renomme une scène et met à jour TOUTES les références (départ, mort, destinations, jets). */
export function renameScene(c: Campaign, oldId: string, newId: string): void {
  if (!c.scenes[oldId]) throw new Error(`Scène inconnue : ${oldId}`);
  if (newId === oldId) return;
  if (!isValidId(newId)) throw new Error('Identifiant invalide : utilise minuscules, chiffres, - et _ (ex. "grotte-2").');
  if (c.scenes[newId]) throw new Error(`L'identifiant « ${newId} » existe déjà.`);

  // On reconstruit l'objet en conservant l'ORDRE des scènes (important pour l'affichage).
  c.scenes = Object.fromEntries(Object.entries(c.scenes).map(([id, scene]) => [id === oldId ? newId : id, scene]));
  if (c.start === oldId) c.start = newId;
  if (c.deathScene === oldId) c.deathScene = newId;
  for (const scene of Object.values(c.scenes)) {
    for (const ch of scene.choices ?? []) {
      if (ch.to === oldId) ch.to = newId;
      if (ch.test?.onSuccess === oldId) ch.test.onSuccess = newId;
      if (ch.test?.onFailure === oldId) ch.test.onFailure = newId;
    }
  }
}

/**
 * Supprime une scène ainsi que les choix qui y menaient. Renvoie le nombre de choix supprimés.
 * Refuse de supprimer la scène de départ ou la scène de mort (l'aventure ne fonctionnerait plus).
 */
export function deleteScene(c: Campaign, id: string): number {
  if (!c.scenes[id]) throw new Error(`Scène inconnue : ${id}`);
  if (id === c.start) throw new Error("Impossible de supprimer la scène de départ : désigne d'abord un autre départ.");
  if (id === c.deathScene) throw new Error("Impossible de supprimer la scène de mort : désigne d'abord une autre scène de mort.");
  delete c.scenes[id];
  let removed = 0;
  for (const scene of Object.values(c.scenes)) {
    if (!scene.choices) continue;
    const kept = scene.choices.filter((ch) => !leadsTo(ch, id));
    removed += scene.choices.length - kept.length;
    scene.choices = kept;
  }
  return removed;
}

// ---------- Choix ----------

/** Déplace un choix vers le haut (delta = -1) ou le bas (delta = +1). */
export function moveChoice(scene: Scene, index: number, delta: -1 | 1): void {
  const list = scene.choices;
  const target = index + delta;
  if (!list || target < 0 || target >= list.length) return;
  // Échange de deux éléments par « déstructuration » (comme en JS moderne)
  [list[index], list[target]] = [list[target], list[index]];
}

/** Bascule un choix entre « destination directe » et « jet de dés ». */
export function setChoiceKind(choice: Choice, kind: "direct" | "test"): void {
  if (kind === "test" && !choice.test) {
    choice.test = { stat: "force", difficulty: 7, onSuccess: choice.to ?? "", onFailure: "" };
    delete choice.to;
  }
  if (kind === "direct" && choice.test) {
    choice.to = choice.test.onSuccess || undefined;
    delete choice.test;
  }
}
