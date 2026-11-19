// ============================================================================
// source.ts : D'OÙ viennent les campagnes ?
//
// Le jeu ne sait pas (et ne veut pas savoir) si une campagne vient d'un fichier
// embarqué, du navigateur de l'utilisateur ou d'un serveur. Il parle à une
// « source » via une interface. Pour brancher une nouvelle origine, on écrit
// une nouvelle implémentation : rien d'autre ne change.
// ============================================================================

import type { Campaign } from "../engine/types.ts";

/** Résumé d'une campagne (assez pour l'afficher dans une liste, sans charger tout son contenu). */
export interface CampaignMeta {
  id: string;
  title: string;
  description?: string;
  /** « bundled » : fichier livré avec le projet (lecture seule). « local » : brouillon de l'utilisateur. */
  origin?: "bundled" | "local";
  /** Date du dernier enregistrement (millisecondes, comme Date.now()). Brouillons seulement. */
  savedAt?: number;
}

/**
 * Une `interface` peut décrire des méthodes. `Promise<X>` : le résultat arrive
 * plus tard (on l'attend avec `await`). Une source distante (serveur) sera
 * forcément asynchrone ; on prévoit donc ce cas dès maintenant.
 */
export interface CampaignSource {
  list(): Promise<CampaignMeta[]>;
  get(id: string): Promise<Campaign | undefined>;
}

/** Source qu'on peut aussi modifier : enregistrer et supprimer. */
export interface WritableCampaignSource extends CampaignSource {
  save(campaign: Campaign): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Source en mémoire : sert pour les campagnes embarquées et pour les tests. */
export function createMemorySource(
  campaigns: Campaign[],
  origin: "bundled" | "local" = "bundled",
): CampaignSource {
  return {
    async list() {
      return campaigns
        .map(({ id, title, description }) => ({ id, title, description, origin }))
        .sort((a, b) => a.title.localeCompare(b.title, "fr"));
    },
    async get(id) {
      return campaigns.find((c) => c.id === id);
    },
  };
}

/**
 * Regroupe plusieurs sources en une seule. La liste est la concaténation des listes ;
 * `get` interroge les sources dans l'ordre et renvoie le premier résultat trouvé
 * (en cas d'identifiant en double, la première source gagne).
 */
export function createCompositeSource(sources: CampaignSource[]): CampaignSource {
  return {
    async list() {
      const lists = await Promise.all(sources.map((s) => s.list()));
      return lists.flat();
    },
    async get(id) {
      for (const source of sources) {
        const found = await source.get(id);
        if (found) return found;
      }
      return undefined;
    },
  };
}
