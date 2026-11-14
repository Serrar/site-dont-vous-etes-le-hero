import type { Campaign, Scene } from "./types.ts";

export interface Report {
  errors: string[];
  warnings: string[];
}

export function targetsOf(scene: Scene): string[] {
  return (scene.choices ?? []).flatMap((c) => {
    const t: string[] = [];
    if (c.to) t.push(c.to);
    if (c.test) t.push(c.test.onSuccess, c.test.onFailure);
    return t;
  });
}

/** Analyse statique du graphe de la campagne. */
export function validateCampaign(c: Campaign): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = Object.keys(c.scenes);

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
    const hasChoices = (s.choices?.length ?? 0) > 0;
    if (!s.ending && !hasChoices) errors.push(`${id} : cul-de-sac (ni choix ni fin)`);
    if (s.ending && hasChoices) warnings.push(`${id} : scène de fin avec des choix`);
    if (!s.ending && hasChoices && s.choices!.every((ch) => ch.condition)) {
      warnings.push(`${id} : tous les choix sont conditionnés (risque de blocage)`);
    }
  }

  // Accessibilité (parcours en largeur, conditions ignorées = cas optimiste)
  const seen = new Set<string>();
  const queue = c.scenes[c.start] ? [c.start] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id) || !c.scenes[id]) continue;
    seen.add(id);
    queue.push(...targetsOf(c.scenes[id]));
  }
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
