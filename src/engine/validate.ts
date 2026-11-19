// ============================================================================
// validate.ts : « tests statiques » d'une campagne. On analyse le graphe des
// scènes SANS jouer : scènes inaccessibles, culs-de-sac, destinations inconnues...
//
// Ce fichier est une suite de fonctions PURES (mêmes entrées → mêmes sorties,
// aucun effet de bord) : l'éditeur peut donc les appeler en direct pendant la
// création d'une aventure.
// ============================================================================

import type { Campaign, Scene } from "./types.ts";

/** Résultat d'une validation. Les messages commencent par « <idScène> : ... » quand ils concernent une scène. */
export interface Report {
  errors: string[]; // bloquants : l'aventure ne peut pas être jouée correctement
  warnings: string[]; // à examiner, mais jouable
}

/** Options facultatives de validation. */
export interface ValidateOptions {
  /** Si fourni, vérifie que chaque `illustration` référencée existe. */
  illustrationIds?: string[];
}

/** Toutes les scènes vers lesquelles mènent les choix d'une scène (destinations directes + réussite/échec des jets). */
export function targetsOf(scene: Scene): string[] {
  // flatMap = map puis aplatit un niveau : un tableau de tableaux devient un tableau.
  return (scene.choices ?? []).flatMap((c) => {
    const t: string[] = []; // `: string[]` annonce le type du tableau vide
    if (c.to) t.push(c.to);
    if (c.test) t.push(c.test.onSuccess, c.test.onFailure);
    return t;
  });
}

/** Vrai si au moins un effet retire des PV : la scène de mort devient alors atteignable « par les dégâts ». */
export function hasDamage(c: Campaign): boolean {
  return Object.values(c.scenes).some((s) =>
    [...(s.onEnter ?? []), ...(s.choices ?? []).flatMap((ch) => ch.effects ?? [])].some(
      (e) => e.type === "hp" && e.delta < 0,
    ),
  );
}

/**
 * Ensemble des scènes atteignables depuis le départ.
 * Parcours en largeur (BFS), en ignorant les conditions : c'est le cas optimiste.
 * La scène de mort compte comme atteignable si des effets peuvent retirer des PV.
 */
export function reachableScenes(c: Campaign): Set<string> {
  const seen = new Set<string>();
  const queue: string[] = [];
  if (c.scenes[c.start]) queue.push(c.start);
  if (hasDamage(c) && c.scenes[c.deathScene]) queue.push(c.deathScene);
  while (queue.length) {
    const id = queue.shift()!; // `!` = « je t'assure que ce n'est pas undefined » (ici la file n'est pas vide)
    if (seen.has(id) || !c.scenes[id]) continue;
    seen.add(id);
    queue.push(...targetsOf(c.scenes[id]));
  }
  return seen;
}

/** Analyse statique du graphe de la campagne. */
export function validateCampaign(c: Campaign, options: ValidateOptions = {}): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = Object.keys(c.scenes);

  if (c.schemaVersion !== 1) errors.push(`schemaVersion non supportée : ${String(c.schemaVersion)}`);
  if (!c.id) errors.push("Identifiant (id) manquant");
  if (!c.title) errors.push("Titre (title) manquant");
  if (!c.scenes[c.start]) errors.push(`Scène de départ introuvable : ${c.start}`);
  if (!c.scenes[c.deathScene]) errors.push(`Scène de mort introuvable : ${c.deathScene}`);

  for (const id of ids) {
    const s = c.scenes[id];
    for (const t of targetsOf(s)) {
      if (!c.scenes[t]) errors.push(`${id} : destination inconnue "${t}"`);
    }
    for (const ch of s.choices ?? []) {
      if (!ch.to && !ch.test) errors.push(`${id} : choix "${ch.text}" sans destination`);
      if (ch.to && ch.test) errors.push(`${id} : choix "${ch.text}" a "to" ET "test"`);
    }
    if (s.illustration && options.illustrationIds && !options.illustrationIds.includes(s.illustration)) {
      errors.push(`${id} : illustration inconnue "${s.illustration}"`);
    }
    const hasChoices = (s.choices?.length ?? 0) > 0; // `?.` : « si choices existe, prends sa longueur »
    if (!s.ending && !hasChoices) errors.push(`${id} : cul-de-sac (ni choix ni fin)`);
    if (s.ending && hasChoices) warnings.push(`${id} : scène de fin avec des choix`);
    // `s.choices!` : on sait que choices existe ici (hasChoices est vrai)
    if (!s.ending && hasChoices && s.choices!.every((ch) => ch.condition)) {
      warnings.push(`${id} : tous les choix sont conditionnés (risque de blocage)`);
    }
  }

  const seen = reachableScenes(c);
  for (const id of ids) if (!seen.has(id)) errors.push(`${id} : scène inaccessible`);

  const reachableEndings = ids.filter((id) => seen.has(id) && c.scenes[id].ending);
  if (!reachableEndings.some((id) => c.scenes[id].ending!.type === "victory")) {
    errors.push("Aucune fin de type victoire n'est atteignable");
  }

  // Objets requis mais jamais obtenables
  const given = new Set<string>();
  for (const s of Object.values(c.scenes)) {
    for (const e of [...(s.onEnter ?? []), ...(s.choices ?? []).flatMap((ch) => ch.effects ?? [])]) {
      if (e.type === "addItem") given.add(e.item);
    }
  }
  for (const [id, s] of Object.entries(c.scenes)) {
    for (const ch of s.choices ?? []) {
      if (ch.condition?.type === "item" && !given.has(ch.condition.item)) {
        errors.push(`${id} : objet "${ch.condition.item}" requis mais jamais obtenable`);
      }
    }
  }

  return { errors, warnings };
}
