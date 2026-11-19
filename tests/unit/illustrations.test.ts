// ============================================================================
// Tests de la bibliothèque d'illustrations SVG.
// `it.each(liste)("%s : ...", (id) => ...)` répète le test pour chaque identifiant (%s = valeur).
// Les expressions /.../ sont des expressions régulières (comme en JS).
// ============================================================================

import { describe, it, expect } from "vitest";
import { illustrations, illustrationIds } from "../../src/illustrations/index.ts";
import { bundledCampaigns } from "../../src/catalog/bundled.ts";

describe("bibliothèque d'illustrations", () => {
  it.each(illustrationIds)("%s : SVG autonome et sûr", (id) => {
    const svg = illustrations[id];
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("viewBox");
    // Aucun contenu externe ni exécutable : tout est dessiné dans le fichier
    expect(svg).not.toMatch(/<script|<image|<foreignObject|href=|xlink:|url\((?!#)|javascript:|\son[a-z]+\s*=/i);
    expect(svg.match(/https?:\/\/[^"' ]+/g) ?? []).toEqual(["http://www.w3.org/2000/svg"]);
    expect(svg.length).toBeLessThan(6000);
  });

  it("partage le même style grimoire (trait tremblé + cadre de planche)", () => {
    for (const id of illustrationIds) {
      expect(illustrations[id], id).toContain('filter="url(#hand)"');
      expect(illustrations[id], id).toContain('class="ik"');
    }
  });

  it("n'utilise que des couleurs de la palette (classes CSS), jamais de couleurs en dur", () => {
    for (const id of illustrationIds) {
      expect(illustrations[id], id).not.toMatch(/fill="#|stroke="#|fill:\s*#/i);
    }
  });

  it("chaque illustration est utilisée par au moins une scène (pas de ressource orpheline)", () => {
    const used = new Set(
      Object.values(bundledCampaigns).flatMap((c) => Object.values(c.scenes).map((s) => s.illustration)),
    );
    for (const id of illustrationIds) expect(used.has(id), `"${id}" jamais utilisée`).toBe(true);
  });
});
