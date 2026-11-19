// ============================================================================
// Tests de bout en bout de l'atelier du scribe (menu, création, arbre, sauvegarde...).
// Chaque test Playwright démarre un navigateur NEUF : localStorage est donc vide au départ.
// Les `data-testid` sont des attributs ajoutés dans le code uniquement pour les tests :
// ils ne changent pas si on modifie le texte ou le style d'un bouton.
// ============================================================================

import { test, expect, type Page } from "@playwright/test";

/** Menu principal → atelier → nouvelle aventure. */
async function createCampaign(page: Page, title: string) {
  await page.goto("/");
  await page.getByTestId("open-editor").click();
  await page.getByTestId("new-title").fill(title);
  await page.getByTestId("create-campaign").click();
  await expect(page.getByTestId("node-start")).toBeVisible();
}

test.describe("menu principal", () => {
  test("l'atelier est visuellement séparé des aventures", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("workshop")).toBeVisible();
    await expect(page.getByTestId("campaign-list").getByTestId("open-editor")).toHaveCount(0);

    const workshop = await page.getByTestId("workshop").evaluate((e) => getComputedStyle(e).backgroundImage);
    const card = await page.getByTestId("campaign-card-crypte").evaluate((e) => getComputedStyle(e).backgroundImage);
    expect(workshop).not.toBe(card); // un autre style que les cartes en parchemin
    await expect(page.getByTestId("open-editor")).toBeVisible();
  });

  test("« Mes aventures » n'apparaît que s'il existe des brouillons", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Mes aventures" })).toBeHidden();
  });
});

test.describe("création et édition", () => {
  test("une aventure neuve affiche son arbre et passe la validation", async ({ page }) => {
    await createCampaign(page, "Ma quête");
    await expect(page.getByTestId("node-fin")).toBeVisible();
    await expect(page.getByTestId("node-mort")).toBeVisible();
    await expect(page.getByTestId("editor-title")).toHaveText("Ma quête");
    await expect(page.getByTestId("save-status")).toContainText("non enregistrée");
    await expect(page.getByTestId("issues")).toContainText("Aucun problème");
  });

  test("modifier le texte d'une scène met à jour l'arbre en direct", async ({ page }) => {
    await createCampaign(page, "Ma quête");
    await page.getByTestId("scene-text-input").fill("Un tout nouveau début");
    await expect(page.getByTestId("node-start")).toContainText("Un tout nouveau");
    await expect(page.getByTestId("save-status")).toContainText("non enregistrée");
  });

  test("créer une scène depuis un choix la fait apparaître dans l'arbre, avec son cul-de-sac signalé", async ({ page }) => {
    await createCampaign(page, "Ma quête");
    await page.getByTestId("add-choice").click();
    await page.getByTestId("choice-text-2").fill("Explorer la grotte");
    await page.getByTestId("choice-target-2").selectOption("__new__");

    await expect(page.getByTestId("node-scene-1")).toBeVisible();
    await expect(page.getByTestId("issues")).toContainText("scene-1 : cul-de-sac");

    // On sélectionne la nouvelle scène (via le lien de la vérification) et on en fait une fin
    await page.getByTestId("issues").getByRole("button", { name: /scene-1 : cul-de-sac/ }).click();
    await expect(page.getByTestId("scene-id")).toHaveValue("scene-1");
    await page.getByTestId("scene-kind").selectOption("victory");
    await expect(page.getByTestId("issues")).not.toContainText("cul-de-sac");
    await expect(page.getByTestId("issues")).toContainText("Aucun problème");
  });

  test("renommer une scène met à jour les flèches et reste cohérent", async ({ page }) => {
    await createCampaign(page, "Ma quête");
    await page.getByTestId("node-fin").click();
    await page.getByTestId("scene-id").fill("grande-victoire");
    await page.getByTestId("scene-id").press("Enter");
    await expect(page.getByTestId("node-grande-victoire")).toBeVisible();
    await expect(page.getByTestId("node-fin")).toHaveCount(0);
    await expect(page.getByTestId("issues")).toContainText("Aucun problème");
  });

  test("un identifiant invalide est refusé avec un message", async ({ page }) => {
    await createCampaign(page, "Ma quête");
    await page.getByTestId("scene-id").fill("Mon Id Invalide");
    await page.getByTestId("scene-id").press("Enter");
    await expect(page.getByTestId("editor-message")).toContainText("invalide");
    await expect(page.getByTestId("scene-id")).toHaveValue("start");
  });

  test("un choix sans destination bloque le test de jeu et explique pourquoi", async ({ page }) => {
    await createCampaign(page, "Ma quête");
    await page.getByTestId("add-choice").click();
    await expect(page.getByTestId("issues")).toContainText("sans destination");
    await page.getByTestId("play-test").click();
    await expect(page.getByTestId("editor-message")).toContainText("Corrige");
    await expect(page.getByTestId("graph")).toBeVisible(); // on reste dans l'éditeur
  });

  test("on peut supprimer une scène (avec confirmation) mais pas le départ", async ({ page }) => {
    await createCampaign(page, "Ma quête");
    await page.getByTestId("node-fin").click();
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("delete-scene").click();
    await expect(page.getByTestId("node-fin")).toHaveCount(0);

    await page.getByTestId("node-start").click();
    await expect(page.getByTestId("delete-scene")).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("delete-scene").click();
    await expect(page.getByTestId("editor-message")).toContainText("départ");
    await expect(page.getByTestId("node-start")).toBeVisible();
  });

  test("les effets et les conditions d'un choix s'éditent", async ({ page }) => {
    await createCampaign(page, "Ma quête");
    await page.getByTestId("choice-cond-0").selectOption("item");
    await page.getByTestId("choice-cond-item-0").fill("clé");
    await expect(page.getByTestId("issues")).toContainText('objet "clé" requis mais jamais obtenable');
    await page.getByTestId("scene-effects-add").click();
    await page.getByLabel("Type d'effet").first().selectOption("addItem");
    await page.getByLabel("Nom de l'objet").first().fill("clé");
    await expect(page.getByTestId("issues")).not.toContainText("jamais obtenable");
  });
});

test.describe("sauvegarde et reprise", () => {
  test("enregistrer, recharger la page, retrouver son brouillon et continuer", async ({ page }) => {
    await createCampaign(page, "Ma quête");
    await page.getByTestId("scene-text-input").fill("Texte sauvegardé");
    await page.getByTestId("add-choice").click();
    await page.getByTestId("choice-target-2").selectOption("__new__");
    await page.getByTestId("save-campaign").click();
    await expect(page.getByTestId("save-status")).toContainText("Enregistré");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Mes aventures" })).toBeVisible();
    await page.getByTestId("open-editor").click();
    await page.getByTestId("edit-ma-quete").click();

    await expect(page.getByTestId("editor-title")).toHaveText("Ma quête");
    await expect(page.getByTestId("node-scene-1")).toBeVisible();
    await expect(page.getByTestId("scene-text-input")).toHaveValue("Texte sauvegardé");
    await expect(page.getByTestId("save-status")).toContainText("Enregistré");

    // On continue : modification → à nouveau « non enregistrées »
    await page.getByTestId("scene-text-input").fill("Texte sauvegardé, puis modifié");
    await expect(page.getByTestId("save-status")).toContainText("non enregistrées");
  });

  test("le brouillon apparaît dans le menu principal et se joue", async ({ page }) => {
    await createCampaign(page, "Ma quête");
    await page.getByTestId("save-campaign").click();
    await page.getByTestId("back-to-workshop").click();
    await page.getByTestId("editor-exit").click();

    await expect(page.getByTestId("draft-list").getByTestId("campaign-card-ma-quete")).toBeVisible();
    await page.getByTestId("campaign-card-ma-quete").click();
    await expect(page.getByTestId("campaign-title")).toHaveText("Ma quête");
    await expect(page.getByTestId("scene-text")).toContainText("Écris ici le début");
  });

  test("tester depuis l'éditeur puis revenir retrouve le travail en cours (même non enregistré)", async ({ page }) => {
    await createCampaign(page, "Ma quête");
    await page.getByTestId("scene-text-input").fill("Texte en cours de rédaction");
    await page.getByTestId("play-test").click();
    await expect(page.getByTestId("scene-text")).toHaveText("Texte en cours de rédaction");
    await expect(page.getByTestId("back-to-menu")).toHaveText(/éditeur/);

    await page.getByTestId("back-to-menu").click();
    await expect(page.getByTestId("graph")).toBeVisible();
    await expect(page.getByTestId("scene-text-input")).toHaveValue("Texte en cours de rédaction");
    await expect(page.getByTestId("save-status")).toContainText("non enregistrée");
  });

  test("quitter l'atelier avec des modifications demande confirmation", async ({ page }) => {
    await createCampaign(page, "Ma quête");
    let asked = false;
    page.once("dialog", (d) => { asked = true; void d.dismiss(); });
    await page.getByTestId("back-to-workshop").click();
    expect(asked).toBe(true);
    await expect(page.getByTestId("graph")).toBeVisible(); // « Annuler » : on reste
  });

  test("supprimer un brouillon", async ({ page }) => {
    await createCampaign(page, "Ma quête");
    await page.getByTestId("save-campaign").click();
    await page.getByTestId("back-to-workshop").click();
    await expect(page.getByTestId("draft-ma-quete")).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("delete-ma-quete").click();
    await expect(page.getByTestId("draft-ma-quete")).toHaveCount(0);
  });
});

test.describe("copie, import et export", () => {
  test("dupliquer une aventure livrée donne une copie modifiable avec tout son arbre", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("open-editor").click();
    await page.getByTestId("duplicate-crypte").click();
    await expect(page.getByTestId("editor-title")).toHaveText("La Crypte oubliée (copie)");
    await expect(page.locator("[data-testid^='node-']")).toHaveCount(10);
    await expect(page.getByTestId("issues")).toContainText("Aucun problème");
    await expect(page.getByTestId("save-status")).toContainText("Enregistré"); // copie déjà sauvegardée
  });

  test("l'arbre de la Crypte montre jets de dés et choix conditionnels", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("open-editor").click();
    await page.getByTestId("duplicate-crypte").click();
    await expect(page.locator(".g-edge.g-success")).toHaveCount(3);
    await expect(page.locator(".g-edge.g-failure")).toHaveCount(3);
    await expect(page.locator(".g-edge.g-cond")).toHaveCount(2);
  });

  test("exporter produit un fichier .json que l'on peut réimporter", async ({ page }) => {
    await createCampaign(page, "Aller retour");
    await page.getByTestId("scene-text-input").fill("Contenu exporté");
    const download = page.waitForEvent("download");
    await page.getByTestId("export-campaign").click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("aller-retour.json");

    const path = await file.path();
    const fs = await import("node:fs");
    const content = fs.readFileSync(path, "utf8");
    expect(JSON.parse(content).scenes.start.text).toBe("Contenu exporté");

    // Réimport dans un navigateur neuf : l'identifiant d'origine est libre, il est conservé
    page.once("dialog", (d) => d.accept()); // modifications non enregistrées : on confirmera la sortie
    await page.getByTestId("back-to-workshop").click();
    await page.getByTestId("import-file").setInputFiles({ name: "aller-retour.json", mimeType: "application/json", buffer: Buffer.from(content) });
    await expect(page.getByTestId("editor-title")).toHaveText("Aller retour");
    await expect(page.getByTestId("scene-text-input")).toHaveValue("Contenu exporté");
  });

  test("importer un fichier invalide affiche une erreur claire", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("open-editor").click();
    await page.getByTestId("import-file").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("ceci n'est pas du json") });
    await expect(page.getByTestId("editor-message")).toContainText("Import impossible");
    await expect(page.getByTestId("new-title")).toBeVisible(); // on reste à l'accueil
  });

  test("importer une aventure dont l'identifiant existe déjà le renomme au lieu d'écraser", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("open-editor").click();
    const sample = {
      schemaVersion: 1, id: "crypte", title: "Faux doublon", start: "a", deathScene: "b",
      scenes: {
        a: { text: "Départ", choices: [{ text: "Aller", to: "b" }] },
        b: { text: "Fin", ending: { type: "victory", title: "Fin" } },
      },
    };
    await page.getByTestId("import-file").setInputFiles({ name: "c.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(sample)) });
    await expect(page.getByTestId("editor-title")).toHaveText("Faux doublon");
    await expect(page.getByTestId("editor-message")).toContainText("crypte-2");
    await page.getByTestId("back-to-workshop").click();
    await expect(page.getByTestId("draft-crypte-2")).toBeVisible();
  });
});
