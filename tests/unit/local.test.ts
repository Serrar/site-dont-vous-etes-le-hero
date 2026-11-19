// ============================================================================
// Tests du stockage des brouillons (src/catalog/local.ts) et de la fusion de sources.
// On utilise un FAUX stockage en mémoire à la place de localStorage : pas de navigateur requis.
// `async`/`await` : ces opérations renvoient des Promises ; `await` attend le résultat.
// ============================================================================

import { describe, it, expect } from "vitest";
import crypte from "../../src/campaigns/crypte.json";
import { createLocalSource, createMemoryStorage } from "../../src/catalog/local.ts";
import { createCompositeSource, createMemorySource } from "../../src/catalog/source.ts";
import type { Campaign } from "../../src/engine/types.ts";
import { createEmptyCampaign } from "../../src/editor/model.ts";

describe("brouillons (stockage local)", () => {
  it("enregistre puis relit une campagne à l'identique", async () => {
    const local = createLocalSource(createMemoryStorage());
    const c = createEmptyCampaign("ma-quete", "Ma quête");
    await local.save(c);
    expect(await local.get("ma-quete")).toEqual(c);
  });

  it("liste les brouillons avec leur origine et leur date, triés par titre", async () => {
    const local = createLocalSource(createMemoryStorage());
    await local.save(createEmptyCampaign("b", "Zèbre"));
    await local.save(createEmptyCampaign("a", "Abeille"));
    const metas = await local.list();
    expect(metas.map((m) => m.title)).toEqual(["Abeille", "Zèbre"]);
    expect(metas[0].origin).toBe("local");
    expect(metas[0].savedAt).toBeGreaterThan(0);
  });

  it("une nouvelle sauvegarde remplace la précédente (même identifiant)", async () => {
    const local = createLocalSource(createMemoryStorage());
    const c = createEmptyCampaign("q", "Avant");
    await local.save(c);
    c.title = "Après";
    await local.save(c);
    expect((await local.list()).map((m) => m.title)).toEqual(["Après"]);
  });

  it("ne partage pas d'objet avec l'appelant (modifier la copie lue ne change rien au stockage)", async () => {
    const local = createLocalSource(createMemoryStorage());
    await local.save(createEmptyCampaign("q", "Titre"));
    const read = (await local.get("q"))!;
    read.title = "Modifié sans enregistrer";
    expect((await local.get("q"))!.title).toBe("Titre");
  });

  it("supprime un brouillon", async () => {
    const local = createLocalSource(createMemoryStorage());
    await local.save(createEmptyCampaign("q", "Titre"));
    await local.remove("q");
    expect(await local.list()).toEqual([]);
    expect(await local.get("q")).toBeUndefined();
  });

  it("survit à un stockage corrompu (on repart de zéro au lieu de planter)", async () => {
    const storage = createMemoryStorage();
    storage.setItem("gamebook-qa:drafts", "{pas du json");
    const local = createLocalSource(storage);
    expect(await local.list()).toEqual([]);
    await local.save(createEmptyCampaign("q", "Titre")); // et on peut de nouveau écrire
    expect(await local.list()).toHaveLength(1);
  });

  it("ignore un brouillon invalide sans perdre les valides", async () => {
    const storage = createMemoryStorage();
    const local = createLocalSource(storage);
    await local.save(createEmptyCampaign("ok", "Valide"));
    const raw = JSON.parse(storage.getItem("gamebook-qa:drafts")!);
    raw.casse = { campaign: { id: "casse" }, savedAt: 1 };
    storage.setItem("gamebook-qa:drafts", JSON.stringify(raw));
    expect((await local.list()).map((m) => m.id)).toEqual(["ok"]);
  });

  it("remonte l'erreur quand le stockage refuse d'écrire (quota dépassé)", async () => {
    const full = { ...createMemoryStorage(), setItem: () => { throw new Error("Quota dépassé"); } };
    const local = createLocalSource(full);
    await expect(local.save(createEmptyCampaign("q", "Titre"))).rejects.toThrow("Quota dépassé");
  });
});

describe("source composite (aventures livrées + brouillons)", () => {
  it("fusionne les listes et distingue l'origine", async () => {
    const local = createLocalSource(createMemoryStorage());
    await local.save(createEmptyCampaign("mien", "Mon brouillon"));
    const source = createCompositeSource([createMemorySource([crypte as Campaign], "bundled"), local]);
    const metas = await source.list();
    expect(metas.map((m) => [m.id, m.origin])).toEqual([["crypte", "bundled"], ["mien", "local"]]);
  });

  it("get cherche dans toutes les sources ; en cas de doublon, la première gagne", async () => {
    const a = createEmptyCampaign("meme", "Version A");
    const b = createEmptyCampaign("meme", "Version B");
    const source = createCompositeSource([createMemorySource([a]), createMemorySource([b], "local")]);
    expect((await source.get("meme"))!.title).toBe("Version A");
    expect(await source.get("absente")).toBeUndefined();
  });
});
