// ============================================================================
// parse.ts : transformer un contenu inconnu (fichier importé, données du
// navigateur) en Campaign fiable.
//
// Règle d'or : ce qui vient de l'extérieur (JSON, fichier, stockage) n'est
// JAMAIS fiable. TypeScript ne vérifie que notre code, pas les données reçues
// pendant l'exécution : c'est à nous de les contrôler.
// Ici on contrôle la STRUCTURE (les bons champs, les bons types). La
// cohérence de l'histoire (scènes inaccessibles...) relève de validateCampaign.
// ============================================================================

import type { Campaign } from "../engine/types.ts";
import { isValidId } from "../editor/model.ts";

/**
 * Résultat « soit réussi, soit en erreur » : une union discriminée par `ok`.
 * Avec `if (r.ok)`, TypeScript sait que `r.campaign` existe ; sinon que `r.error` existe.
 */
export type ParseResult = { ok: true; campaign: Campaign } | { ok: false; error: string };

/**
 * « Type guard » (garde de type) : la signature `v is Record<...>` dit à TypeScript :
 * « si cette fonction renvoie true, considère que v est un objet ».
 * `unknown` = « type inconnu », plus sûr que `any` : on doit tester avant d'utiliser.
 */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const ENDING_TYPES = ["victory", "defeat", "neutral"];

function fail(error: string): ParseResult {
  return { ok: false, error };
}

/** Contrôle la structure d'une valeur supposée être une campagne. */
export function parseCampaign(value: unknown): ParseResult {
  if (!isRecord(value)) return fail("Le contenu n'est pas un objet JSON.");
  if (value.schemaVersion !== 1) return fail("Version de format non supportée (schemaVersion doit valoir 1).");
  for (const key of ["id", "title", "start", "deathScene"]) {
    if (typeof value[key] !== "string" || value[key] === "") return fail(`Champ « ${key} » manquant ou invalide.`);
  }
  if (!isValidId(value.id as string)) return fail("L'identifiant (id) doit utiliser minuscules, chiffres, - et _.");
  if (value.description !== undefined && typeof value.description !== "string") return fail("« description » doit être du texte.");
  if (!isRecord(value.scenes) || Object.keys(value.scenes).length === 0) return fail("« scenes » doit contenir au moins une scène.");

  for (const [id, scene] of Object.entries(value.scenes)) {
    if (!isRecord(scene) || typeof scene.text !== "string") return fail(`Scène « ${id} » : texte manquant.`);
    if (scene.illustration !== undefined && typeof scene.illustration !== "string") return fail(`Scène « ${id} » : illustration invalide.`);
    if (scene.choices !== undefined) {
      if (!Array.isArray(scene.choices)) return fail(`Scène « ${id} » : « choices » doit être une liste.`);
      for (const choice of scene.choices) {
        if (!isRecord(choice) || typeof choice.text !== "string") return fail(`Scène « ${id} » : un choix n'a pas de texte.`);
      }
    }
    if (scene.ending !== undefined) {
      if (!isRecord(scene.ending) || !ENDING_TYPES.includes(scene.ending.type as string) || typeof scene.ending.title !== "string") {
        return fail(`Scène « ${id} » : fin invalide.`);
      }
    }
  }
  // Double assertion : on a vérifié la structure à la main ci-dessus, donc on peut
  // « forcer » le type. (`unknown` → `Campaign` en une étape est refusé par TypeScript.)
  return { ok: true, campaign: value as unknown as Campaign };
}

/** Comme parseCampaign, mais à partir du texte brut d'un fichier .json. */
export function parseCampaignJson(text: string): ParseResult {
  try {
    return parseCampaign(JSON.parse(text));
  } catch {
    // `catch` sans variable : on n'a pas besoin du détail de l'erreur
    return fail("Ce fichier n'est pas un JSON valide.");
  }
}
