import type { Campaign } from "../engine/types.ts";

export interface CampaignMeta {
  id: string;
  title: string;
  description?: string;
}

/**
 * D'où viennent les campagnes ? L'interface ne le dit pas, et c'est voulu.
 * Aujourd'hui : fichiers JSON embarqués. Demain : brouillons de l'éditeur,
 * localStorage, API serveur... Il suffira d'écrire une autre implémentation.
 */
export interface CampaignSource {
  list(): Promise<CampaignMeta[]>;
  get(id: string): Promise<Campaign | undefined>;
}

/** Source en mémoire : sert pour les tests et pour les brouillons de l'éditeur. */
export function createMemorySource(campaigns: Campaign[]): CampaignSource {
  return {
    async list() {
      return campaigns
        .map(({ id, title, description }) => ({ id, title, description }))
        .sort((a, b) => a.title.localeCompare(b.title, "fr"));
    },
    async get(id) {
      return campaigns.find((c) => c.id === id);
    },
  };
}
