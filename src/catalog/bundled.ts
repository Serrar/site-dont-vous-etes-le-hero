import type { Campaign } from "../engine/types.ts";
import { createMemorySource } from "./source.ts";

// Tout fichier src/campaigns/*.json est automatiquement découvert : ajouter une aventure = ajouter un fichier.
const modules = import.meta.glob("../campaigns/*.json", { eager: true, import: "default" }) as Record<string, Campaign>;

/** Campagnes embarquées, indexées par chemin de fichier. */
export const bundledCampaigns: Record<string, Campaign> = modules;

export function createBundledSource() {
  return createMemorySource(Object.values(bundledCampaigns));
}
