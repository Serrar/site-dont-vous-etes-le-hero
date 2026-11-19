// ============================================================================
// local.ts : les brouillons de l'utilisateur, conservés DANS SON NAVIGATEUR
// (localStorage). Rien n'est envoyé sur un serveur.
//
// Limites à connaître : les données sont liées à ce navigateur et à cette
// adresse (localhost:5173 ≠ un autre port). Vider les données du navigateur les
// efface. Pour une sauvegarde durable, utiliser « Exporter » dans l'éditeur,
// ce qui produit un fichier .json que l'on peut aussi déposer dans src/campaigns.
// ============================================================================

import type { Campaign } from "../engine/types.ts";
import { isRecord, parseCampaign } from "./parse.ts";
import type { CampaignMeta, WritableCampaignSource } from "./source.ts";

/**
 * Le strict nécessaire de `localStorage`. En décrivant seulement ce dont on a
 * besoin, on peut le remplacer par un faux stockage dans les tests.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Faux stockage en mémoire (tests, ou navigateur qui refuse localStorage). */
export function createMemoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const STORAGE_KEY = "gamebook-qa:drafts";

interface StoredRecord {
  campaign: Campaign;
  savedAt: number;
}
type Store = Record<string, StoredRecord>;

/** Lit tous les brouillons. Tolère un contenu absent ou abîmé (on ignore ce qui est invalide). */
function readStore(storage: StorageLike): Store {
  const store: Store = {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return store;
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data)) return store;
    for (const [id, record] of Object.entries(data)) {
      if (!isRecord(record) || typeof record.savedAt !== "number") continue;
      const parsed = parseCampaign(record.campaign);
      if (parsed.ok) store[id] = { campaign: parsed.campaign, savedAt: record.savedAt };
    }
  } catch {
    // JSON illisible : on repart d'un stockage vide plutôt que de planter
  }
  return store;
}

export function createLocalSource(storage: StorageLike): WritableCampaignSource {
  return {
    async list(): Promise<CampaignMeta[]> {
      return Object.values(readStore(storage))
        .map(({ campaign, savedAt }) => ({
          id: campaign.id,
          title: campaign.title,
          description: campaign.description,
          origin: "local" as const, // `as const` : garde le type littéral "local" (et pas string)
          savedAt,
        }))
        .sort((a, b) => a.title.localeCompare(b.title, "fr"));
    },
    async get(id) {
      const record = readStore(storage)[id];
      return record ? structuredClone(record.campaign) : undefined;
    },
    async save(campaign) {
      const store = readStore(storage);
      store[campaign.id] = { campaign: structuredClone(campaign), savedAt: Date.now() };
      // Peut lever une exception (stockage plein ou interdit) : l'appelant l'affiche à l'utilisateur.
      storage.setItem(STORAGE_KEY, JSON.stringify(store));
    },
    async remove(id) {
      const store = readStore(storage);
      delete store[id];
      storage.setItem(STORAGE_KEY, JSON.stringify(store));
    },
  };
}
