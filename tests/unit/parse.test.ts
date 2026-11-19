// ============================================================================
// Tests de la lecture d'un fichier importé (src/catalog/parse.ts).
// Principe : ce qui vient de l'extérieur n'est jamais fiable, il faut le contrôler.
// `it.each(tableau)` : le même test répété pour chaque ligne du tableau.
// ============================================================================

import { describe, it, expect } from "vitest";
import crypte from "../../src/campaigns/crypte.json";
import bugs from "../../src/campaigns/royaume-bugs.json";
import { parseCampaign, parseCampaignJson } from "../../src/catalog/parse.ts";

const clone = () => structuredClone(crypte) as unknown as Record<string, any>; // `any` : pour casser volontairement la structure

describe("parseCampaign", () => {
  it("accepte les campagnes livrées avec le projet", () => {
    expect(parseCampaign(crypte).ok).toBe(true);
    expect(parseCampaign(bugs).ok).toBe(true);
  });

  it("accepte le texte JSON d'une campagne (aller-retour fichier)", () => {
    const r = parseCampaignJson(JSON.stringify(crypte, null, 2));
    expect(r.ok && r.campaign.id).toBe("crypte");
  });

  it.each([
    ["du texte qui n'est pas du JSON", "ceci n'est pas du json", /JSON valide/],
    ["un tableau au lieu d'un objet", "[]", /pas un objet/],
    ["un nombre", "42", /pas un objet/],
    ["null", "null", /pas un objet/],
  ])("refuse %s", (_label, text, message) => {
    const r = parseCampaignJson(text);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(message);
  });

  it.each([
    ["une version de format inconnue", (c: any) => (c.schemaVersion = 2), /schemaVersion/],
    ["un titre manquant", (c: any) => delete c.title, /title/],
    ["un identifiant invalide", (c: any) => (c.id = "Mon Aventure"), /identifiant/],
    ["aucune scène", (c: any) => (c.scenes = {}), /au moins une scène/],
    ["une scène sans texte", (c: any) => delete c.scenes.hall.text, /hall.*texte/],
    ["des choix qui ne sont pas une liste", (c: any) => (c.scenes.hall.choices = "oups"), /hall.*liste/],
    ["un choix sans texte", (c: any) => delete c.scenes.hall.choices[0].text, /hall.*choix/],
    ["un type de fin inconnu", (c: any) => (c.scenes.tresor.ending.type = "epique"), /tresor.*fin/],
  ])("refuse %s", (_label, damage, message) => {
    const c = clone();
    damage(c);
    const r = parseCampaign(c);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(message);
  });
});
