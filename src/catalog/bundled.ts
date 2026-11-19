// ============================================================================
// bundled.ts : les campagnes livrées avec le projet (dossier src/campaigns).
// ============================================================================

import type { Campaign } from "../engine/types.ts";
import { createMemorySource } from "./source.ts";

// `import.meta.glob` est une fonction spéciale de Vite (l'outil qui sert le site) :
// elle importe automatiquement tous les fichiers qui correspondent au motif.
// Ajouter une aventure = déposer un fichier .json dans src/campaigns, rien d'autre.
// `as Record<string, Campaign>` : « fais-moi confiance, voici le type du résultat »
// (une assertion de type : TypeScript ne peut pas le deviner pour du JSON).
const modules = import.meta.glob("../campaigns/*.json", { eager: true, import: "default" }) as Record<string, Campaign>;

/** Campagnes embarquées, indexées par chemin de fichier. */
export const bundledCampaigns: Record<string, Campaign> = modules;

export function createBundledSource() {
  return createMemorySource(Object.values(bundledCampaigns), "bundled");
}
