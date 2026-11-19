// ============================================================================
// Tests de bout en bout du jeu avec Playwright : un vrai navigateur clique sur la page.
// `await` partout : chaque action du navigateur prend du temps, on attend sa fin.
// `getByRole("button", { name })` retrouve un bouton par son texte visible (comme un utilisateur) ;
// `getByTestId("x")` retrouve l'élément portant data-testid="x".
// ============================================================================

import { test, expect } from "@playwright/test";

// ?seed=N rend les jets de dés déterministes : indispensable pour des tests e2e stables.

test("chemin de la torche → victoire (sans aucun jet de dé)", async ({ page }) => {
  await page.goto("/?campaign=crypte&seed=1");
  await expect(page.getByTestId("restart")).toBeHidden(); // pas de bouton « Rejouer » avant la fin
  await page.getByRole("button", { name: "Entrer par la porte principale" }).click();
  await page.getByRole("button", { name: "Ramasser la torche" }).click();
  await expect(page.getByTestId("sheet")).toContainText("torche");
  await page.getByRole("button", { name: "Poursuivre dans le couloir" }).click();
  await page.getByRole("button", { name: /Descendre l'escalier/ }).click();
  await page.getByRole("button", { name: "Ouvrir le coffre" }).click();

  await expect(page.getByTestId("ending")).toHaveText("Fin : le trésor");
  await expect(page.getByTestId("ending")).toHaveAttribute("data-type", "victory");
});

test("sans torche, le choix de l'escalier est masqué", async ({ page }) => {
  await page.goto("/?campaign=crypte&seed=1");
  await page.getByRole("button", { name: "Entrer par la porte principale" }).click();
  await page.getByRole("button", { name: "Avancer dans le noir" }).click();
  await expect(page.getByTestId("sheet")).toContainText("PV 8");
  await expect(page.getByRole("button", { name: /Descendre l'escalier/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Affronter le gardien" })).toBeVisible();
});

test("le bouton Rejouer réinitialise la partie", async ({ page }) => {
  await page.goto("/?campaign=crypte&seed=1");
  await page.getByRole("button", { name: "Entrer par la porte principale" }).click();
  await page.getByRole("button", { name: "Ramasser la torche" }).click();
  await page.getByRole("button", { name: "Poursuivre dans le couloir" }).click();
  await page.getByRole("button", { name: /Descendre l'escalier/ }).click();
  await page.getByRole("button", { name: "Ouvrir le coffre" }).click();
  await page.getByTestId("restart").click();

  await expect(page.getByTestId("ending")).toBeHidden();
  await expect(page.getByTestId("sheet")).toContainText("PV 10");
  await expect(page.getByTestId("sheet")).toContainText("vide");
});
