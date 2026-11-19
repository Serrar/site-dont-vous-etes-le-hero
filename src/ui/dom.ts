// ============================================================================
// dom.ts : petits outils pour construire des éléments HTML/SVG en JavaScript
// sans écrire `document.createElement` + `setAttribute` à chaque ligne.
//
// Exemple :
//   el("button", { class: "btn", onclick: () => alert("Salut") }, "Clique-moi")
// construit  <button class="btn">Clique-moi</button>  avec son gestionnaire de clic.
//
// Intérêt : on utilise `textContent` (jamais `innerHTML`) pour le texte de
// l'utilisateur, ce qui évite toute injection de code (faille XSS).
// ============================================================================

/**
 * Un « enfant » : un nœud DOM, du texte, un nombre, ou rien (null/undefined/false,
 * pratique pour écrire `condition && el(...)`), ou un tableau d'enfants (récursif).
 */
export type Child = Node | string | number | null | undefined | false | Child[];

/** Attributs et gestionnaires d'événements. `unknown` : n'importe quelle valeur, à tester avant usage. */
export type Props = Record<string, unknown>;

const SVG_NS = "http://www.w3.org/2000/svg";

/** Propriétés qu'on affecte APRÈS avoir ajouté les enfants (un <select> doit connaître ses <option> d'abord). */
const PROPERTY_KEYS = ["value", "checked", "selected", "disabled"];

function applyProps(node: Element, props: Props): void {
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (PROPERTY_KEYS.includes(key)) continue;
    if (key.startsWith("on") && typeof value === "function") {
      // « onclick » → événement « click »
      node.addEventListener(key.slice(2), value as EventListener);
    } else {
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }
}

function appendChildren(node: Element, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) appendChildren(node, child);
    else node.append(typeof child === "object" ? child : String(child));
  }
}

function finish(node: Element, props: Props, children: Child[]): void {
  appendChildren(node, children);
  for (const key of PROPERTY_KEYS) {
    if (key in props && props[key] !== undefined) {
      (node as unknown as Record<string, unknown>)[key] = props[key];
    }
  }
}

/**
 * Crée un élément HTML.
 * `<K extends keyof HTMLElementTagNameMap>` est un « générique » : K est un nom de balise
 * connu ("div", "input"...) et le type renvoyé en dépend (el("input") donne un
 * HTMLInputElement, donc on a `.value` sans erreur ; el("a") donne un HTMLAnchorElement...).
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[] // `...children` : « le reste des arguments », rassemblé en tableau
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  applyProps(node, props);
  finish(node, props, children);
  return node;
}

/** Crée un élément SVG (il faut un « espace de noms » particulier, d'où une fonction à part). */
export function svgEl(tag: string, props: Props = {}, ...children: Child[]): SVGElement {
  const node = document.createElementNS(SVG_NS, tag) as SVGElement;
  applyProps(node, props);
  finish(node, props, children);
  return node;
}

/**
 * Ajoute des enfants à un élément existant. À préférer à `parent.append(...)` natif, qui
 * ne comprend ni les tableaux ni `null` (il écrirait littéralement « null » dans la page).
 */
export function put(parent: Element, ...children: Child[]): void {
  appendChildren(parent, children);
}

/** Vide un élément de tous ses enfants. */
export function clear(node: Element): void {
  node.replaceChildren();
}

/**
 * Récupère un élément par son id. Le `!` (non-null assertion) dit à TypeScript :
 * « il existe forcément » (getElementById peut renvoyer null sinon).
 */
export function byId(id: string): HTMLElement {
  return document.getElementById(id)!;
}

/** Déclenche le téléchargement d'un fichier texte (sans serveur). */
export function downloadText(filename: string, text: string, mime = "application/json"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = el("a", { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
