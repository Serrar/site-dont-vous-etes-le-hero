// ============================================================================
// editor.ts : l'écran « L'atelier du scribe » (création et modification d'aventures).
//
// Deux vues :
//  - l'accueil de l'atelier : nouvelle aventure, brouillons, copie d'une aventure
//    existante, import d'un fichier ;
//  - l'espace de travail : à gauche l'ARBRE des scènes et des choix (on clique sur
//    une scène pour la modifier), à droite les formulaires et les vérifications.
//
// Ce fichier ne contient presque pas de logique « métier » : les opérations sur
// la campagne sont dans model.ts, la disposition de l'arbre dans graph.ts, la
// validation dans engine/validate.ts, le stockage dans catalog/local.ts.
// Ici, on ne fait que construire l'écran et relier les boutons à ces fonctions.
// ============================================================================

import type { Campaign, Choice, Effect, Scene, StatName } from "../engine/types.ts";
import { validateCampaign } from "../engine/validate.ts";
import { illustrationIds, illustrations } from "../illustrations/index.ts";
import type { CampaignSource, WritableCampaignSource } from "../catalog/source.ts";
import { parseCampaignJson } from "../catalog/parse.ts";
import { clear, downloadText, el, put, svgEl } from "../ui/dom.ts";
import type { Child } from "../ui/dom.ts";
import { computeLayout, excerpt } from "./graph.ts";
import type { GraphEdge, GraphLayout, GraphNode } from "./graph.ts";
import {
  addScene,
  countReferences,
  createEmptyCampaign,
  deleteScene,
  moveChoice,
  renameScene,
  setChoiceKind,
  slugify,
  uniqueId,
} from "./model.ts";

/** Ce dont l'éditeur a besoin de l'extérieur (« injection de dépendances » : facile à remplacer en test). */
export interface EditorDeps {
  root: HTMLElement; // l'élément de la page où dessiner l'éditeur
  bundled: CampaignSource; // aventures livrées avec le projet (lecture seule)
  local: WritableCampaignSource; // brouillons de l'utilisateur
  onExit: () => void; // retour au menu principal
  onPlay: (campaign: Campaign) => void; // lancer un test de l'aventure en cours d'édition
}

export interface Editor {
  /** Ouvre l'accueil de l'atelier. */
  open(): Promise<void>;
  /** Réaffiche l'écran en cours (utile au retour d'un test de jeu). */
  resume(): void;
}

/** L'aventure en cours d'édition et son état d'enregistrement. */
interface EditorState {
  campaign: Campaign;
  selected: string; // identifiant de la scène sélectionnée
  dirty: boolean; // modifications non enregistrées ?
  saved: boolean; // existe déjà dans les brouillons ?
  savedAt?: number;
}

// ---------- Petits utilitaires d'interface ----------

/** Valeur saisie dans le champ qui a déclenché l'événement. `as` : assertion de type (voir GUIDE-TYPESCRIPT.md). */
const val = (e: Event): string => (e.target as HTMLInputElement).value;

const STAT_LABELS: Record<StatName, string> = { force: "Force", habilete: "Habileté", chance: "Chance" };
// Object.keys renvoie string[] ; on affirme que ce sont bien des StatName.
const STATS = Object.keys(STAT_LABELS) as StatName[];

/** Étiquette + champ de formulaire. */
function field(label: string, control: Child): HTMLElement {
  return el("label", { class: "ed-field" }, el("span", {}, label), control);
}

function option(value: string, label: string): HTMLOptionElement {
  return el("option", { value }, label);
}

function btn(label: string, onclick: () => void, testid?: string, extraClass = ""): HTMLButtonElement {
  return el("button", { type: "button", class: `btn ${extraClass}`.trim(), "data-testid": testid, onclick }, label);
}

/** Bloc replié/déplié (balise HTML <details>). */
function details(title: string, body: Child, open: boolean, testid?: string): HTMLElement {
  return el("details", { class: "ed-panel", open, "data-testid": testid }, el("summary", {}, title), body);
}

function section(title: string, ...children: Child[]): HTMLElement {
  return el("section", { class: "ed-panel" }, el("h2", {}, title), ...children);
}

function formatDate(ts: number | undefined): string {
  return ts ? new Date(ts).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "?";
}

function blankEffect(type: string): Effect {
  if (type === "addItem") return { type: "addItem", item: "" };
  if (type === "removeItem") return { type: "removeItem", item: "" };
  return { type: "hp", delta: -1 };
}

/** Valeur spéciale d'une liste de destinations : « créer une nouvelle scène ». */
const NEW_SCENE = "__new__";

export function createEditor(deps: EditorDeps): Editor {
  const { root, bundled, local } = deps;

  let state: EditorState | null = null;

  // Zones de l'écran, recréées à chaque affichage. On les initialise avec des éléments
  // vides pour ne pas avoir à gérer « undefined » partout.
  let msgEl: HTMLElement = el("p");
  let statusEl: HTMLElement = el("span");
  let titleEl: HTMLElement = el("span");
  let graphScroll: HTMLElement = el("div");
  let sceneBox: HTMLElement = el("div");
  let campaignBox: HTMLElement = el("div");
  let issuesBox: HTMLElement = el("ul");
  let currentLayout: GraphLayout | null = null;

  // Avertit si on ferme l'onglet avec des modifications non enregistrées.
  window.addEventListener("beforeunload", (e) => {
    if (state?.dirty) e.preventDefault();
  });
  // Ctrl+S / Cmd+S : enregistrer.
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && state && !root.hidden) {
      e.preventDefault();
      void save(); // `void` : on lance la tâche asynchrone sans attendre son résultat
    }
  });

  function notify(text: string, kind: "info" | "error" = "info"): void {
    msgEl.textContent = text;
    msgEl.dataset.kind = kind;
  }

  async function allIds(): Promise<string[]> {
    const lists = await Promise.all([bundled.list(), local.list()]);
    return lists.flat().map((m) => m.id);
  }

  // ==========================================================================
  // ACCUEIL DE L'ATELIER
  // ==========================================================================

  async function showHome(): Promise<void> {
    state = null;
    const [drafts, builtin] = await Promise.all([local.list(), bundled.list()]);
    msgEl = el("p", { class: "ed-message", role: "status", "data-testid": "editor-message" });

    const titleInput = el("input", { type: "text", placeholder: "Titre de la nouvelle aventure", "data-testid": "new-title" });
    const fileInput = el("input", {
      type: "file",
      accept: ".json,application/json",
      "data-testid": "import-file",
      onchange: (e: Event) => void importFile((e.target as HTMLInputElement).files?.[0]),
    });

    clear(root);
    root.append(
      btn("← Menu principal", deps.onExit, "editor-exit"),
      el("h1", {}, "L'atelier du scribe"),
      msgEl,
      section(
        "Nouvelle aventure",
        el(
          "div",
          { class: "ed-row" },
          titleInput,
          btn("Créer", () => void createNew(titleInput.value), "create-campaign"),
        ),
        el("p", { class: "ed-hint" }, "L'aventure créée est déjà jouable : modifie-la pas à pas."),
      ),
      section(
        "Mes brouillons",
        drafts.length
          ? drafts.map((meta) =>
              el(
                "div",
                { class: "ed-row ed-item", "data-testid": `draft-${meta.id}` },
                el("div", { class: "grow" }, el("strong", {}, meta.title), el("br"), el("small", {}, `${meta.id} · enregistré le ${formatDate(meta.savedAt)}`)),
                btn("Modifier", () => void editDraft(meta.id), `edit-${meta.id}`),
                btn("Dupliquer", () => void duplicate(meta.id, local), `duplicate-${meta.id}`),
                btn("Exporter", () => void exportById(meta.id, local), `export-${meta.id}`),
                btn("Supprimer", () => void removeDraft(meta.id, meta.title), `delete-${meta.id}`, "btn-danger"),
              ),
            )
          : el("p", { class: "ed-hint" }, "Aucun brouillon pour l'instant."),
      ),
      section(
        "Partir d'une aventure existante",
        el("p", { class: "ed-hint" }, "Les aventures livrées avec le jeu ne sont pas modifiables : on en crée une copie."),
        builtin.map((meta) =>
          el(
            "div",
            { class: "ed-row ed-item" },
            el("div", { class: "grow" }, el("strong", {}, meta.title)),
            btn("Dupliquer pour modifier", () => void duplicate(meta.id, bundled), `duplicate-${meta.id}`),
          ),
        ),
      ),
      section("Importer une aventure (.json)", el("p", { class: "ed-hint" }, "Un fichier exporté depuis l'éditeur, ou écrit à la main."), fileInput),
    );
  }

  function openCampaign(c: Campaign, saved: boolean, savedAt?: number): void {
    state = {
      campaign: c,
      selected: c.start in c.scenes ? c.start : Object.keys(c.scenes)[0] ?? "",
      dirty: !saved,
      saved,
      savedAt,
    };
    showWorkspace();
  }

  async function createNew(title: string): Promise<void> {
    const name = title.trim() || "Nouvelle aventure";
    const id = uniqueId(slugify(name), await allIds());
    openCampaign(createEmptyCampaign(id, name), false);
  }

  async function editDraft(id: string): Promise<void> {
    const c = await local.get(id);
    if (!c) return notify("Brouillon introuvable.", "error");
    const meta = (await local.list()).find((m) => m.id === id);
    openCampaign(c, true, meta?.savedAt);
  }

  /** Copie une aventure (brouillon ou livrée) en nouveau brouillon, l'enregistre et l'ouvre. */
  async function duplicate(id: string, from: CampaignSource): Promise<void> {
    const original = await from.get(id);
    if (!original) return notify("Aventure introuvable.", "error");
    const copy = structuredClone(original);
    copy.id = uniqueId(`${original.id}-copie`, await allIds());
    copy.title = `${original.title} (copie)`;
    try {
      await local.save(copy);
    } catch (err) {
      return notify(`Impossible d'enregistrer : ${(err as Error).message}`, "error");
    }
    openCampaign(copy, true, Date.now());
  }

  async function exportById(id: string, from: CampaignSource): Promise<void> {
    const c = await from.get(id);
    if (c) exportCampaign(c);
  }

  async function removeDraft(id: string, title: string): Promise<void> {
    if (!confirm(`Supprimer définitivement le brouillon « ${title} » ?`)) return;
    await local.remove(id);
    await showHome();
    notify(`Brouillon « ${title} » supprimé.`);
  }

  async function importFile(file: File | undefined): Promise<void> {
    if (!file) return;
    const result = parseCampaignJson(await file.text());
    if (!result.ok) return notify(`Import impossible : ${result.error}`, "error");
    const c = result.campaign;
    const newId = uniqueId(c.id, await allIds());
    const renamed = newId !== c.id;
    c.id = newId;
    try {
      await local.save(c);
    } catch (err) {
      return notify(`Impossible d'enregistrer : ${(err as Error).message}`, "error");
    }
    openCampaign(c, true, Date.now());
    notify(renamed ? `Aventure importée (identifiant changé en « ${newId} », l'ancien existait déjà).` : "Aventure importée.");
  }

  function exportCampaign(c: Campaign): void {
    downloadText(`${c.id}.json`, JSON.stringify(c, null, 2) + "\n");
  }

  // ==========================================================================
  // ESPACE DE TRAVAIL
  // ==========================================================================

  function showWorkspace(): void {
    const s = state;
    if (!s) return void showHome();

    msgEl = el("p", { class: "ed-message", role: "status", "data-testid": "editor-message" });
    statusEl = el("span", { class: "ed-status", "data-testid": "save-status" });
    titleEl = el("strong", { class: "ed-title", "data-testid": "editor-title" });
    graphScroll = el("div", { class: "graph-scroll", "data-testid": "graph" });
    sceneBox = el("div", { "data-testid": "scene-panel" });
    campaignBox = el("div", { "data-testid": "campaign-panel" });
    issuesBox = el("ul", { class: "issues", "data-testid": "issues" });

    clear(root);
    root.append(
      el(
        "div",
        { class: "ed-topbar" },
        btn("← Atelier", () => void leaveWorkspace(), "back-to-workshop"),
        titleEl,
        statusEl,
        el(
          "span",
          { class: "ed-actions" },
          btn("💾 Enregistrer", () => void save(), "save-campaign"),
          btn("▶ Tester", play, "play-test"),
          btn("⇩ Exporter", () => exportCampaign(s.campaign), "export-campaign"),
        ),
      ),
      msgEl,
      el(
        "div",
        { class: "ed-grid" },
        el(
          "section",
          { class: "ed-panel" },
          el("h2", {}, "Arbre de l'histoire"),
          el(
            "p",
            { class: "ed-legend" },
            "⚑ départ · ★ victoire · ☠ défaite · ◆ fin neutre · ⚠ cul-de-sac · trait plein : choix · tirets : jet de dés (🎲✓ réussite, 🎲✗ échec) · pointillés fins : 🔒 choix conditionnel · cadre rouge pointillé : scène inaccessible. Clique une scène pour la modifier.",
          ),
          graphScroll,
        ),
        el(
          "div",
          { class: "ed-side" },
          details("Scène sélectionnée", sceneBox, true, "scene-details"),
          details("Vérifications", issuesBox, true, "issues-details"),
          details("Réglages de l'aventure", campaignBox, false, "campaign-details"),
        ),
      ),
    );
    renderAll();
  }

  async function leaveWorkspace(): Promise<void> {
    if (state?.dirty && !confirm("Quitter sans enregistrer ? Les modifications en cours seront perdues.")) return;
    await showHome();
  }

  async function save(): Promise<void> {
    const s = state;
    if (!s) return;
    try {
      await local.save(s.campaign);
      s.dirty = false;
      s.saved = true;
      s.savedAt = Date.now();
      renderStatus();
      notify("Aventure enregistrée dans ce navigateur. Utilise « Exporter » pour en garder un fichier.");
    } catch (err) {
      notify(`Impossible d'enregistrer : ${(err as Error).message}`, "error");
    }
  }

  function play(): void {
    const s = state;
    if (!s) return;
    const report = validateCampaign(s.campaign, { illustrationIds });
    if (report.errors.length) {
      notify(`Corrige d'abord les ${report.errors.length} erreur(s) listées dans « Vérifications » avant de tester.`, "error");
      return;
    }
    deps.onPlay(structuredClone(s.campaign)); // on teste une COPIE : jouer ne modifie jamais l'aventure
  }

  // ---------- Rafraîchissements ----------

  /** Tout redessiner. */
  function renderAll(): void {
    renderStatus();
    renderGraph();
    renderCampaignPanel();
    renderScenePanel();
    renderIssues();
  }

  /** Une modification « légère » (frappe dans un champ) : on ne reconstruit pas les formulaires (le curseur resterait perdu). */
  function touch(): void {
    if (!state) return;
    state.dirty = true;
    renderStatus();
    renderGraph();
    renderIssues();
  }

  /** Une modification de structure (ajout, suppression, changement de type) : on reconstruit aussi les formulaires. */
  function structural(): void {
    touch();
    renderCampaignPanel();
    renderScenePanel();
  }

  function renderStatus(): void {
    const s = state;
    if (!s) return;
    statusEl.dataset.dirty = String(s.dirty);
    statusEl.textContent = s.dirty
      ? s.saved
        ? "● Modifications non enregistrées"
        : "● Nouvelle aventure, non enregistrée"
      : `✓ Enregistré le ${formatDate(s.savedAt)}`;
    titleEl.textContent = s.campaign.title || "(sans titre)";
  }

  function select(id: string): void {
    if (!state) return;
    state.selected = id;
    renderGraph();
    renderScenePanel();
    ensureVisible(id);
  }

  /** Fait défiler l'arbre pour montrer la scène, seulement si elle est hors de vue. */
  function ensureVisible(id: string): void {
    const node = currentLayout?.nodes.find((n) => n.id === id);
    if (!node) return;
    const box = graphScroll;
    const margin = 16;
    const outX = node.x < box.scrollLeft + margin || node.x + node.w > box.scrollLeft + box.clientWidth - margin;
    const outY = node.y < box.scrollTop + margin || node.y + node.h > box.scrollTop + box.clientHeight - margin;
    if (outX || outY) {
      box.scrollTo({
        left: Math.max(0, node.x - box.clientWidth / 2 + node.w / 2),
        top: Math.max(0, node.y - box.clientHeight / 2 + node.h / 2),
        behavior: "smooth",
      });
    }
  }

  // ---------- L'arbre (SVG) ----------

  function glyph(n: GraphNode): string {
    const parts: string[] = [];
    if (n.isStart) parts.push("⚑");
    if (n.kind === "victory") parts.push("★");
    else if (n.kind === "defeat") parts.push("☠");
    else if (n.kind === "neutral") parts.push("◆");
    if (n.deadEnd) parts.push("⚠");
    return parts.length ? parts.join("") + " " : "";
  }

  function edgeEl(e: GraphEdge): SVGElement {
    const classes = ["g-edge", `g-${e.kind}`, e.conditional ? "g-cond" : "", e.back ? "g-back" : ""].filter(Boolean).join(" ");
    return svgEl(
      "g",
      { class: classes, "data-testid": `edge-${e.id}` },
      svgEl("title", {}, `${e.from} → ${e.to} : ${e.label}`),
      svgEl("path", { d: e.d, "marker-end": "url(#arrow)" }),
      svgEl("text", { x: e.lx, y: e.ly, "text-anchor": "middle" }, e.label),
    );
  }

  function nodeEl(n: GraphNode, selected: boolean): SVGElement {
    const classes = [
      "g-node",
      `g-${n.kind}`,
      n.isStart ? "g-start" : "",
      n.reachable ? "" : "g-lost",
      n.deadEnd ? "g-dead" : "",
      selected ? "g-selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const idLabel = n.id.length > 15 ? n.id.slice(0, 14) + "…" : n.id;
    return svgEl(
      "g",
      {
        class: classes,
        transform: `translate(${n.x} ${n.y})`,
        tabindex: 0,
        role: "button",
        "aria-label": `Scène ${n.id}`,
        "data-testid": `node-${n.id}`,
        onclick: () => select(n.id),
        onkeydown: (e: Event) => {
          const key = (e as KeyboardEvent).key;
          if (key === "Enter" || key === " ") {
            e.preventDefault();
            select(n.id);
          }
        },
      },
      svgEl("title", {}, `${n.id} : ${n.excerpt}`),
      svgEl("rect", { width: n.w, height: n.h, rx: 8 }),
      svgEl("text", { x: 10, y: 19, class: "g-id" }, glyph(n) + idLabel),
      svgEl("text", { x: 10, y: 36, class: "g-ex" }, n.excerpt),
    );
  }

  function renderGraph(): void {
    const s = state;
    if (!s) return;
    const layout = computeLayout(s.campaign);
    currentLayout = layout;
    const svg = svgEl(
      "svg",
      {
        class: "graph",
        width: layout.width,
        height: layout.height,
        viewBox: `0 0 ${layout.width} ${layout.height}`,
        role: "group",
        "aria-label": "Arbre des scènes et des choix",
      },
      svgEl(
        "defs",
        {},
        svgEl(
          "marker",
          { id: "arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" },
          svgEl("path", { d: "M0 0L10 5L0 10z", class: "g-arrow" }),
        ),
      ),
      layout.edges.map(edgeEl),
      layout.nodes.map((n) => nodeEl(n, n.id === s.selected)),
    );
    graphScroll.replaceChildren(svg);
  }

  // ---------- Vérifications ----------

  function renderIssues(): void {
    const s = state;
    if (!s) return;
    const c = s.campaign;
    const report = validateCampaign(c, { illustrationIds });
    clear(issuesBox);
    if (!report.errors.length && !report.warnings.length) {
      issuesBox.append(el("li", { class: "ok" }, "✓ Aucun problème détecté : l'aventure est cohérente."));
      return;
    }
    // Les messages concernant une scène commencent par « <id> : » : on en fait un lien vers la scène.
    const item = (msg: string, kind: "error" | "warning"): HTMLElement => {
      const match = /^(\S+) : /.exec(msg);
      const target = match && c.scenes[match[1]] ? match[1] : undefined;
      return el(
        "li",
        { class: kind },
        kind === "error" ? "⛔ " : "⚠ ",
        target ? el("button", { type: "button", class: "link", onclick: () => select(target) }, msg) : msg,
      );
    };
    put(issuesBox, report.errors.map((m) => item(m, "error")), report.warnings.map((m) => item(m, "warning")));
  }

  // ---------- Réglages de l'aventure ----------

  function sceneSelect(current: string, onPick: (id: string) => void, testid: string): HTMLSelectElement {
    const ids = Object.keys(state!.campaign.scenes);
    return el(
      "select",
      { value: current, "data-testid": testid, onchange: (e: Event) => onPick(val(e)) },
      ids.map((id) => option(id, id)),
    );
  }

  function renderCampaignPanel(): void {
    const s = state;
    if (!s) return;
    const c = s.campaign;
    clear(campaignBox);
    campaignBox.append(
      field("Titre", el("input", { type: "text", value: c.title, "data-testid": "campaign-title-input", oninput: (e: Event) => { c.title = val(e); touch(); } })),
      field("Description (affichée dans le menu)", el("textarea", { rows: 3, value: c.description ?? "", "data-testid": "campaign-description-input", oninput: (e: Event) => { c.description = val(e); touch(); } })),
      field("Scène de départ", sceneSelect(c.start, (id) => { c.start = id; structural(); }, "start-select")),
      field("Scène de mort (quand les PV tombent à 0)", sceneSelect(c.deathScene, (id) => { c.deathScene = id; structural(); }, "death-select")),
      el("p", { class: "ed-hint" }, "Identifiant : ", el("code", {}, c.id), " (fixe : c'est le nom du fichier exporté)."),
    );
  }

  // ---------- Formulaire de la scène sélectionnée ----------

  /** Liste de destinations : toutes les scènes, plus « créer une nouvelle scène ». */
  function targetSelect(current: string | undefined, onPick: (id: string) => void, testid: string): HTMLSelectElement {
    const c = state!.campaign;
    const ids = Object.keys(c.scenes);
    const options = [
      option("", "— choisir une scène —"),
      ...ids.map((id) => option(id, `${id} — ${excerpt(c.scenes[id].text, 26)}`)),
      option(NEW_SCENE, "➕ Créer une nouvelle scène…"),
    ];
    if (current && !c.scenes[current]) options.push(option(current, `${current} (introuvable)`));
    return el(
      "select",
      {
        value: current ?? "",
        "data-testid": testid,
        onchange: (e: Event) => {
          const v = val(e);
          onPick(v === NEW_SCENE ? addScene(c) : v);
          structural();
        },
      },
      options,
    );
  }

  function statSelect(current: StatName, onPick: (stat: StatName) => void): HTMLSelectElement {
    return el(
      "select",
      { value: current, onchange: (e: Event) => onPick(val(e) as StatName) },
      STATS.map((st) => option(st, STAT_LABELS[st])),
    );
  }

  /** Éditeur d'une liste d'effets. `get`/`set` : comment lire et écrire la liste dans la scène ou le choix. */
  function effectsEditor(label: string, get: () => Effect[], set: (list: Effect[]) => void, testid: string): HTMLElement {
    const list = get();
    const rows = list.map((fx, i) => {
      const typeSelect = el(
        "select",
        {
          value: fx.type,
          "aria-label": "Type d'effet",
          onchange: (e: Event) => {
            const next = [...list];
            next[i] = blankEffect(val(e));
            set(next);
            structural();
          },
        },
        option("hp", "PV (+ / −)"),
        option("addItem", "Gagne un objet"),
        option("removeItem", "Perd un objet"),
      );
      let input: HTMLInputElement;
      if (fx.type === "hp") {
        const hp = fx; // dans ce `if`, TypeScript sait que fx est l'effet « hp » (donc hp.delta existe)
        input = el("input", { type: "number", value: hp.delta, "aria-label": "Variation de PV", oninput: (e: Event) => { hp.delta = Number(val(e)); touch(); } });
      } else {
        const item = fx; // ici : « addItem » ou « removeItem », qui ont tous deux un champ item
        input = el("input", { type: "text", value: item.item, placeholder: "nom de l'objet", "aria-label": "Nom de l'objet", oninput: (e: Event) => { item.item = val(e); touch(); } });
      }
      return el("div", { class: "ed-row ed-effect" }, typeSelect, input, btn("✕", () => { set(list.filter((_, j) => j !== i)); structural(); }, undefined, "btn-icon"));
    });
    return el(
      "div",
      { class: "ed-effects", "data-testid": testid },
      el("strong", {}, label),
      rows,
      btn("+ Effet", () => { set([...list, { type: "hp", delta: -1 }]); structural(); }, `${testid}-add`),
    );
  }

  function conditionEditor(choice: Choice, index: number): HTMLElement {
    const cond = choice.condition;
    const kindSelect = el(
      "select",
      {
        value: cond ? cond.type : "none",
        "data-testid": `choice-cond-${index}`,
        onchange: (e: Event) => {
          const kind = val(e);
          if (kind === "item") choice.condition = { type: "item", item: "" };
          else if (kind === "stat") choice.condition = { type: "stat", stat: "force", min: 4 };
          else delete choice.condition;
          structural();
        },
      },
      option("none", "Toujours visible"),
      option("item", "Seulement si le joueur possède un objet"),
      option("stat", "Seulement si une caractéristique est suffisante"),
    );
    let detail: Child = null;
    if (cond?.type === "item") {
      const c = cond;
      detail = el("input", { type: "text", value: c.item, placeholder: "nom de l'objet", "aria-label": "Objet requis", "data-testid": `choice-cond-item-${index}`, oninput: (e: Event) => { c.item = val(e); touch(); } });
    } else if (cond?.type === "stat") {
      const c = cond;
      detail = el(
        "div",
        { class: "ed-row" },
        statSelect(c.stat, (st) => { c.stat = st; touch(); }),
        el("input", { type: "number", value: c.min, min: 1, max: 20, "aria-label": "Valeur minimale", oninput: (e: Event) => { c.min = Number(val(e)); touch(); } }),
      );
    }
    return el("div", { class: "ed-cond" }, field("Visibilité du choix", kindSelect), detail);
  }

  function choiceCard(scene: Scene, choice: Choice, index: number): HTMLElement {
    const list = scene.choices!;
    const kindSelect = el(
      "select",
      {
        value: choice.test ? "test" : "direct",
        "data-testid": `choice-kind-${index}`,
        onchange: (e: Event) => {
          setChoiceKind(choice, val(e) === "test" ? "test" : "direct");
          structural();
        },
      },
      option("direct", "Mène directement à une scène"),
      option("test", "Jet de dés (réussite ou échec)"),
    );

    let destination: HTMLElement;
    if (choice.test) {
      const t = choice.test;
      destination = el(
        "div",
        { class: "ed-test" },
        el(
          "div",
          { class: "ed-row" },
          field("Caractéristique", statSelect(t.stat, (st) => { t.stat = st; touch(); })),
          field("Difficulté", el("input", { type: "number", value: t.difficulty, min: 2, max: 12, "data-testid": `choice-difficulty-${index}`, oninput: (e: Event) => { t.difficulty = Number(val(e)); touch(); } })),
        ),
        field("Si réussite →", targetSelect(t.onSuccess, (id) => { t.onSuccess = id; }, `choice-success-${index}`)),
        field("Si échec →", targetSelect(t.onFailure, (id) => { t.onFailure = id; }, `choice-failure-${index}`)),
        el("small", { class: "ed-hint" }, "Réussite si 1d6 + caractéristique ≥ difficulté."),
      );
    } else {
      destination = field("Destination →", targetSelect(choice.to, (id) => { choice.to = id || undefined; }, `choice-target-${index}`));
    }

    return el(
      "div",
      { class: "ed-choice", "data-testid": `choice-card-${index}` },
      el(
        "div",
        { class: "ed-choice-head" },
        el("strong", {}, `Choix ${index + 1}`),
        el(
          "span",
          {},
          el("button", { type: "button", class: "btn btn-icon", title: "Monter", disabled: index === 0, onclick: () => { moveChoice(scene, index, -1); structural(); } }, "↑"),
          el("button", { type: "button", class: "btn btn-icon", title: "Descendre", disabled: index === list.length - 1, onclick: () => { moveChoice(scene, index, 1); structural(); } }, "↓"),
          el("button", { type: "button", class: "btn btn-icon btn-danger", title: "Supprimer ce choix", "data-testid": `choice-delete-${index}`, onclick: () => { list.splice(index, 1); structural(); } }, "✕"),
        ),
      ),
      field("Texte du choix", el("input", { type: "text", value: choice.text, "data-testid": `choice-text-${index}`, oninput: (e: Event) => { choice.text = val(e); touch(); } })),
      field("Type", kindSelect),
      destination,
      conditionEditor(choice, index),
      effectsEditor(
        "Effets de ce choix",
        () => choice.effects ?? [],
        (l) => { if (l.length) choice.effects = l; else delete choice.effects; },
        `choice-effects-${index}`,
      ),
    );
  }

  function changeSceneKind(scene: Scene, kind: string): void {
    if (kind === "choices") {
      delete scene.ending;
      scene.choices ??= []; // `??=` : crée la liste seulement si elle n'existe pas
    } else {
      if (scene.choices?.length && !confirm("Une fin n'a pas de choix : les choix de cette scène seront supprimés. Continuer ?")) {
        renderScenePanel(); // on annule : on réaffiche l'état d'origine
        return;
      }
      delete scene.choices;
      scene.ending = { type: kind as "victory" | "defeat" | "neutral", title: scene.ending?.title ?? "Fin" };
    }
    structural();
  }

  function renderScenePanel(): void {
    const s = state;
    if (!s) return;
    const c = s.campaign;
    const id = s.selected;
    const scene = c.scenes[id];
    clear(sceneBox);
    if (!scene) {
      sceneBox.append(el("p", { class: "ed-hint" }, "Clique sur une scène de l'arbre pour la modifier."));
      return;
    }

    // Identifiant (renommage : toutes les références sont mises à jour)
    const idInput = el("input", {
      type: "text",
      value: id,
      "data-testid": "scene-id",
      onchange: (e: Event) => {
        const wanted = val(e).trim();
        try {
          renameScene(c, id, wanted);
          s.selected = wanted;
          structural();
        } catch (err) {
          notify((err as Error).message, "error");
          idInput.value = id;
        }
      },
    });

    // Illustration (aperçu en direct)
    const preview = el("div", { class: "illu-preview", "data-testid": "illustration-preview" });
    const showPreview = (illu: string | undefined): void => {
      preview.innerHTML = illu && illustrations[illu] ? illustrations[illu] : ""; // SVG du dépôt : contenu de confiance
    };
    showPreview(scene.illustration);
    const illuSelect = el(
      "select",
      {
        value: scene.illustration ?? "",
        "data-testid": "scene-illustration",
        onchange: (e: Event) => {
          const v = val(e);
          if (v) scene.illustration = v;
          else delete scene.illustration;
          showPreview(v || undefined);
          touch();
        },
      },
      option("", "(aucune)"),
      illustrationIds.map((i) => option(i, i)),
    );

    const kindSelect = el(
      "select",
      { value: scene.ending ? scene.ending.type : "choices", "data-testid": "scene-kind", onchange: (e: Event) => changeSceneKind(scene, val(e)) },
      option("choices", "Scène avec des choix"),
      option("victory", "Fin : victoire"),
      option("defeat", "Fin : défaite"),
      option("neutral", "Fin : neutre"),
    );

    const refs = countReferences(c, id);
    const canDelete = id !== c.start && id !== c.deathScene;

    put(
      sceneBox,
      field("Identifiant de la scène", idInput),
      field("Texte de la scène", el("textarea", { rows: 6, value: scene.text, "data-testid": "scene-text-input", oninput: (e: Event) => { scene.text = val(e); touch(); } })),
      field("Illustration", illuSelect),
      preview,
      field("Type de scène", kindSelect),
      scene.ending
        ? field("Titre de la fin", el("input", { type: "text", value: scene.ending.title, "data-testid": "ending-title", oninput: (e: Event) => { scene.ending!.title = val(e); touch(); } }))
        : null,
      effectsEditor(
        "Effets à l'arrivée dans la scène",
        () => scene.onEnter ?? [],
        (l) => { if (l.length) scene.onEnter = l; else delete scene.onEnter; },
        "scene-effects",
      ),
    );

    if (!scene.ending) {
      const choices = (scene.choices ??= []);
      put(
        sceneBox,
        el("h3", {}, `Choix (${choices.length})`),
        choices.map((choice, i) => choiceCard(scene, choice, i)),
        btn("➕ Ajouter un choix", () => { choices.push({ text: "Nouveau choix" }); structural(); }, "add-choice"),
      );
    }

    put(
      sceneBox,
      el(
        "div",
        { class: "ed-row ed-scene-actions" },
        btn("⚑ Définir comme départ", () => { c.start = id; structural(); }, "set-start"),
        btn(
          "🗑 Supprimer la scène",
          () => {
            const msg = refs ? `Supprimer « ${id} » ? ${refs} choix qui y mènent seront aussi supprimés.` : `Supprimer « ${id} » ?`;
            if (!confirm(msg)) return;
            try {
              deleteScene(c, id);
              s.selected = c.start;
              structural();
            } catch (err) {
              notify((err as Error).message, "error");
            }
          },
          "delete-scene",
          "btn-danger",
        ),
      ),
      !canDelete ? el("p", { class: "ed-hint" }, "La scène de départ et la scène de mort ne peuvent pas être supprimées (change-les d'abord dans les réglages).") : null,
    );
  }

  return {
    open: showHome,
    resume() {
      if (state) showWorkspace();
      else void showHome();
    },
  };
}
