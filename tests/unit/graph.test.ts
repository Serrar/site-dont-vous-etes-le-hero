// ============================================================================
// Tests de la disposition de l'arbre (src/editor/graph.ts).
// On ne dessine rien : on vérifie les COORDONNÉES calculées, ce qui est à la fois
// rapide et fiable. (Le rendu visuel est couvert par les tests Playwright.)
// ============================================================================

import { describe, it, expect } from "vitest";
import crypte from "../../src/campaigns/crypte.json";
import bugs from "../../src/campaigns/royaume-bugs.json";
import { computeLayout, excerpt } from "../../src/editor/graph.ts";
import type { GraphNode } from "../../src/editor/graph.ts";
import type { Campaign } from "../../src/engine/types.ts";

const fresh = (c: unknown): Campaign => structuredClone(c as Campaign);
const nodeOf = (nodes: GraphNode[], id: string): GraphNode => nodes.find((n) => n.id === id)!;

/** Deux rectangles se chevauchent-ils ? */
const overlap = (a: GraphNode, b: GraphNode) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe.each([
  ["crypte", crypte],
  ["royaume-bugs", bugs],
])("disposition de %s", (_name, data) => {
  const campaign = fresh(data);
  const layout = computeLayout(campaign);

  it("contient un nœud par scène", () => {
    expect(layout.nodes.map((n) => n.id).sort()).toEqual(Object.keys(campaign.scenes).sort());
  });

  it("place le départ dans la première colonne, à gauche de tout le reste", () => {
    const start = nodeOf(layout.nodes, campaign.start);
    expect(start.column).toBe(0);
    for (const n of layout.nodes) if (n.id !== start.id) expect(n.x).toBeGreaterThan(start.x);
  });

  it("ne superpose jamais deux nœuds", () => {
    for (const a of layout.nodes) for (const b of layout.nodes) if (a.id < b.id) expect(overlap(a, b), `${a.id}/${b.id}`).toBe(false);
  });

  it("garde tous les nœuds dans le cadre", () => {
    for (const n of layout.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(layout.width);
      expect(n.y + n.h).toBeLessThanOrEqual(layout.height);
    }
  });

  it("trace une flèche par destination de choix (deux pour un jet de dés)", () => {
    const expected = Object.values(campaign.scenes)
      .flatMap((s) => s.choices ?? [])
      .reduce((total, ch) => total + (ch.to ? 1 : 0) + (ch.test ? 2 : 0), 0);
    expect(layout.edges).toHaveLength(expected);
  });

  it("produit des tracés SVG bien formés, avec un libellé placé", () => {
    for (const e of layout.edges) {
      expect(e.d, e.id).toMatch(/^M-?[\d.]+ -?[\d.]+ C(-?[\d.]+ -?[\d.]+,? ?){3}$/);
      expect(Number.isFinite(e.lx) && Number.isFinite(e.ly), e.id).toBe(true);
    }
  });

  it("marque toutes les scènes comme atteignables", () => {
    expect(layout.nodes.filter((n) => !n.reachable).map((n) => n.id)).toEqual([]);
  });
});

describe("cas particuliers", () => {
  it("distingue les branches des jets de dés et les choix conditionnels", () => {
    const { edges } = computeLayout(fresh(crypte));
    expect(edges.filter((e) => e.kind === "success")).toHaveLength(3);
    expect(edges.filter((e) => e.kind === "failure")).toHaveLength(3);
    const conditional = edges.filter((e) => e.conditional).map((e) => e.to);
    expect(conditional.sort()).toEqual(["escalier", "tresor"]);
  });

  it("range une scène orpheline dans une dernière colonne et la déclare inaccessible", () => {
    const c = fresh(crypte);
    c.scenes.orpheline = { text: "Personne ne vient ici.", ending: { type: "neutral", title: "?" } };
    const { nodes } = computeLayout(c);
    const lost = nodeOf(nodes, "orpheline");
    expect(lost.reachable).toBe(false);
    for (const n of nodes) if (n.id !== "orpheline") expect(lost.column).toBeGreaterThan(n.column);
  });

  it("repère un cul-de-sac", () => {
    const c = fresh(crypte);
    delete c.scenes.escalier.choices;
    expect(nodeOf(computeLayout(c).nodes, "escalier").deadEnd).toBe(true);
    expect(nodeOf(computeLayout(c).nodes, "tresor").deadEnd).toBe(false); // une fin n'est pas un cul-de-sac
  });

  it("dessine un retour en arrière comme une flèche « back » (sans casser la disposition)", () => {
    const c = fresh(crypte);
    c.scenes.torche.choices!.push({ text: "Retourner au hall", to: "hall" });
    const layout = computeLayout(c);
    const back = layout.edges.find((e) => e.from === "torche" && e.to === "hall")!;
    expect(back.back).toBe(true);
    expect(layout.edges.filter((e) => e.back)).toHaveLength(1);
  });

  it("gère une boucle d'une scène sur elle-même", () => {
    const c = fresh(crypte);
    c.scenes.hall.choices!.push({ text: "Attendre", to: "hall" });
    const loop = computeLayout(c).edges.find((e) => e.from === "hall" && e.to === "hall")!;
    expect(loop.back).toBe(true);
    expect(loop.d.startsWith("M")).toBe(true);
  });

  it("ignore une destination inconnue (le validateur la signale)", () => {
    const c = fresh(crypte);
    c.scenes.hall.choices![0].to = "nulle-part";
    const { edges } = computeLayout(c);
    expect(edges.some((e) => e.to === "nulle-part")).toBe(false);
  });

  it("ne plante pas sur une campagne sans scène de départ valide", () => {
    const c = fresh(crypte);
    c.start = "absente";
    const layout = computeLayout(c);
    expect(layout.nodes).toHaveLength(Object.keys(c.scenes).length);
  });

  it("excerpt raccourcit les textes longs", () => {
    expect(excerpt("court")).toBe("court");
    expect(excerpt("Un texte beaucoup trop long pour tenir", 10)).toBe("Un texte …");
    expect(excerpt("a   b\n c")).toBe("a b c");
  });
});
