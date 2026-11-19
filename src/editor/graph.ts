// ============================================================================
// graph.ts : calcule la disposition de « l'arbre des choix » (en vérité un
// graphe : une scène peut être atteinte par plusieurs chemins, et on peut
// revenir en arrière).
//
// Fonction PURE : on lui donne une campagne, elle renvoie des coordonnées. Le
// dessin proprement dit (SVG) est fait ailleurs (editor.ts). Résultat : on peut
// tester la disposition sans navigateur.
//
// Principe : les scènes sont rangées en COLONNES selon la longueur du plus long
// chemin depuis le départ (colonne 0 = départ). Une scène est donc toujours à droite
// de celles qui y mènent ; seules les boucles (retours) sont dessinées « à l'envers».
// Les scènes que le départ n'atteint jamais vont dans une dernière colonne.
// ============================================================================

import type { Campaign } from "../engine/types.ts";
import { reachableScenes, targetsOf } from "../engine/validate.ts";

export const NODE_W = 140;
export const NODE_H = 46;
const COL_GAP = 78;
const ROW_GAP = 22;
const PAD = 24;

/** Aspect d'une scène : « scene » = scène à choix, les autres sont des fins. */
export type NodeKind = "scene" | "victory" | "defeat" | "neutral";

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: NodeKind;
  column: number;
  isStart: boolean;
  isDeath: boolean;
  /** Atteignable depuis le départ (voir reachableScenes). */
  reachable: boolean;
  /** Scène sans fin ni choix : l'histoire s'y arrête mal. */
  deadEnd: boolean;
  excerpt: string; // début du texte, pour s'y retrouver
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: "direct" | "success" | "failure"; // « success » / « failure » : branches d'un jet de dés
  conditional: boolean; // le choix n'apparaît que sous condition
  back: boolean; // flèche de retour (vers une colonne antérieure ou identique)
  d: string; // tracé SVG de la courbe
  lx: number; // position du libellé
  ly: number;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

/** Début d'un texte, raccourci avec « … » s'il dépasse `max` caractères. */
export function excerpt(text: string, max = 22): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max - 1) + "…" : flat;
}

export function computeLayout(c: Campaign): GraphLayout {
  const ids = Object.keys(c.scenes);
  const reachable = reachableScenes(c);

  // 1. Parcours en profondeur depuis le départ. Il sert à deux choses :
  //    - repérer les VRAIS retours en arrière (une flèche qui revient vers une scène
  //      « en cours de parcours » forme un cycle) ;
  //    - ordonner les scènes de façon à ce que chaque flèche « normale » aille vers la droite.
  const visiting = new Set<string>(); // scènes en cours de parcours (la pile)
  const visited = new Set<string>();
  const cycleEdges = new Set<string>(); // « de>vers » : flèches de retour
  const preorder: string[] = []; // ordre de découverte (sert à ranger les scènes d'une colonne)
  const postorder: string[] = []; // ordre de fin de parcours
  const visit = (id: string): void => {
    visiting.add(id);
    visited.add(id);
    preorder.push(id);
    for (const t of targetsOf(c.scenes[id])) {
      if (!c.scenes[t]) continue;
      if (visiting.has(t)) cycleEdges.add(`${id}>${t}`);
      else if (!visited.has(t)) visit(t);
    }
    visiting.delete(id);
    postorder.push(id);
  };
  if (c.scenes[c.start]) visit(c.start);

  // 2. Colonne = longueur du PLUS LONG chemin depuis le départ (sans les retours).
  //    Ainsi une scène est toujours à droite de toutes celles qui y mènent.
  //    On traite les scènes dans l'ordre topologique (= ordre de fin de parcours inversé).
  const depth = new Map<string, number>();
  if (c.scenes[c.start]) depth.set(c.start, 0);
  for (const id of [...postorder].reverse()) {
    const d = depth.get(id) ?? 0;
    depth.set(id, d);
    for (const t of targetsOf(c.scenes[id])) {
      if (c.scenes[t] && !cycleEdges.has(`${id}>${t}`)) depth.set(t, Math.max(depth.get(t) ?? 0, d + 1));
    }
  }
  const order = preorder; // scènes atteintes, dans l'ordre de découverte

  // Colonnes : une par profondeur, plus une dernière pour les scènes jamais atteintes.
  const lastColumn = order.length ? Math.max(...depth.values()) + 1 : 0;
  const columns: string[][] = [];
  for (const id of order) (columns[depth.get(id)!] ??= []).push(id); // `??=` : « crée le tableau s'il n'existe pas »
  for (let i = 0; i < columns.length; i++) columns[i] ??= []; // pas de « trou » dans les colonnes
  const loose = ids.filter((id) => !depth.has(id));
  if (loose.length) columns[lastColumn] = loose;

  const column = new Map<string, number>();
  columns.forEach((list, col) => list.forEach((id) => column.set(id, col)));

  // 3. Coordonnées : colonnes centrées verticalement.
  const maxRows = Math.max(1, ...columns.map((list) => list.length));
  const colHeight = (rows: number) => rows * NODE_H + (rows - 1) * ROW_GAP;
  const nodes: GraphNode[] = [];
  columns.forEach((list, col) => {
    const offset = (colHeight(maxRows) - colHeight(list.length)) / 2;
    list.forEach((id, row) => {
      const scene = c.scenes[id];
      nodes.push({
        id,
        x: PAD + col * (NODE_W + COL_GAP),
        y: PAD + offset + row * (NODE_H + ROW_GAP),
        w: NODE_W,
        h: NODE_H,
        kind: scene.ending ? scene.ending.type : "scene",
        column: col,
        isStart: id === c.start,
        isDeath: id === c.deathScene,
        reachable: reachable.has(id),
        deadEnd: !scene.ending && (scene.choices?.length ?? 0) === 0,
        excerpt: excerpt(scene.text),
      });
    });
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // 4. Flèches : une par destination de chaque choix (deux pour un jet de dés).
  const edges: GraphEdge[] = [];
  const backCount = new Map<string, number>(); // pour décaler les arcs de retour qui se chevauchent
  for (const id of ids) {
    (c.scenes[id].choices ?? []).forEach((choice, i) => {
      const links: { to: string; kind: GraphEdge["kind"] }[] = [];
      if (choice.to) links.push({ to: choice.to, kind: "direct" });
      if (choice.test) {
        links.push({ to: choice.test.onSuccess, kind: "success" }, { to: choice.test.onFailure, kind: "failure" });
      }
      for (const link of links) {
        const a = byId.get(id)!;
        const b = byId.get(link.to);
        if (!b) continue; // destination inconnue : pas de flèche (le validateur la signale)
        // Retour en arrière : vrai cycle, ou scène qui n'est pas dans une colonne plus à droite (scènes inaccessibles).
        const back = cycleEdges.has(`${id}>${link.to}`) || b.column <= a.column;
        const n = back ? backCount.get(a.id) ?? 0 : 0;
        if (back) backCount.set(a.id, n + 1);
        const prefix = link.kind === "success" ? "🎲✓ " : link.kind === "failure" ? "🎲✗ " : "";
        edges.push({
          id: `${id}:${i}:${link.kind}`,
          from: id,
          to: link.to,
          label: prefix + (choice.condition ? "🔒 " : "") + excerpt(choice.text, 16),
          kind: link.kind,
          conditional: !!choice.condition, // `!!` : convertit en vrai booléen
          back,
          ...geometry(a, b, back, n),
        });
      }
    });
  }

  const hasBack = edges.some((e) => e.back);
  return {
    nodes,
    edges,
    width: Math.max(320, PAD * 2 + columns.length * NODE_W + Math.max(0, columns.length - 1) * COL_GAP),
    height: PAD * 2 + colHeight(maxRows) + (hasBack ? 70 : 0),
  };
}

/**
 * Courbe de Bézier d'une flèche, et position de son libellé (au milieu de la courbe).
 * Pour une courbe cubique P0..P3, le point milieu vaut (P0 + 3·P1 + 3·P2 + P3) / 8.
 */
function geometry(a: GraphNode, b: GraphNode, back: boolean, parallel: number): Pick<GraphEdge, "d" | "lx" | "ly"> {
  // `Pick<T, "d" | "lx">` : un type formé de quelques propriétés seulement de T.
  if (a.id === b.id) {
    // boucle sur soi-même : petit arc au-dessus du nœud
    const x = a.x + a.w - 24;
    const y = a.y;
    return { d: `M${x} ${y} C${x - 10} ${y - 40}, ${x + 44} ${y - 40}, ${x + 34} ${y}`, lx: x + 12, ly: y - 30 };
  }
  if (!back) {
    const x1 = a.x + a.w;
    const y1 = a.y + a.h / 2;
    const x2 = b.x;
    const y2 = b.y + b.h / 2;
    const dx = Math.max(30, (x2 - x1) / 2);
    if (b.column - a.column > 1) {
      // La flèche saute une ou plusieurs colonnes : on la fait passer AU-DESSUS des scènes intermédiaires.
      const top = Math.max(6, Math.min(a.y, b.y) - 22);
      return {
        d: `M${x1} ${y1} C${x1 + dx} ${top}, ${x2 - dx} ${top}, ${x2} ${y2}`,
        lx: (x1 + 3 * (x1 + dx) + 3 * (x2 - dx) + x2) / 8,
        ly: (y1 + 6 * top + y2) / 8,
      };
    }
    return {
      d: `M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
      lx: (x1 + 3 * (x1 + dx) + 3 * (x2 - dx) + x2) / 8,
      ly: (y1 + 3 * y1 + 3 * y2 + y2) / 8,
    };
  }
  // retour en arrière : arc qui passe SOUS les nœuds
  const x1 = a.x + a.w / 2;
  const y1 = a.y + a.h;
  const x2 = b.x + b.w / 2;
  const y2 = b.y + b.h;
  const drop = 38 + parallel * 12;
  return {
    d: `M${x1} ${y1} C${x1} ${y1 + drop}, ${x2} ${y2 + drop}, ${x2} ${y2}`,
    lx: (x1 + 3 * x1 + 3 * x2 + x2) / 8,
    ly: (y1 + 3 * (y1 + drop) + 3 * (y2 + drop) + y2) / 8,
  };
}
