import { describe, it, expect } from "vitest";
import { bundledCampaigns, createBundledSource } from "../../src/catalog/bundled.ts";
import { createMemorySource } from "../../src/catalog/source.ts";
import type { Campaign } from "../../src/engine/types.ts";

describe("catalogue de campagnes embarquées", () => {
  const source = createBundledSource();

  it("propose au moins deux campagnes", async () => {
    expect((await source.list()).length).toBeGreaterThanOrEqual(2);
  });

  it("les identifiants sont uniques", async () => {
    const ids = (await source.list()).map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("l'id de chaque campagne correspond à son nom de fichier", () => {
    for (const [path, campaign] of Object.entries(bundledCampaigns)) {
      expect(path.endsWith(`/${campaign.id}.json`), `${path} contient l'id "${campaign.id}"`).toBe(true);
    }
  });

  it("chaque campagne a un titre et une description", async () => {
    for (const m of await source.list()) {
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.description?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("la liste est triée par titre", async () => {
    const titles = (await source.list()).map((m) => m.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, "fr")));
  });

  it("get() retourne la campagne demandée, undefined si inconnue", async () => {
    expect((await source.get("crypte"))?.id).toBe("crypte");
    expect(await source.get("n-existe-pas")).toBeUndefined();
  });
});

describe("source en mémoire (future base de l'éditeur)", () => {
  it("expose des campagnes fournies à la volée, sans fichier", async () => {
    const draft: Campaign = {
      schemaVersion: 1,
      id: "brouillon",
      title: "Mon brouillon",
      start: "a",
      deathScene: "a",
      scenes: { a: { text: "x", ending: { type: "neutral", title: "Fin" } } },
    };
    const source = createMemorySource([draft]);
    expect((await source.list()).map((m) => m.id)).toEqual(["brouillon"]);
    expect(await source.get("brouillon")).toBe(draft);
  });
});
