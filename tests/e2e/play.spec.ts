import { test, expect } from "@playwright/test";

// ?seed=N rend les jets de dés déterministes : indispensable pour des tests e2e stables.

test("chemin de la torche → victoire (sans aucun jet de dé)", async ({ page }) => {
  await page.goto("/?seed=1");
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
  await page.goto("/?seed=1");
  await page.getByRole("button", { name: "Entrer par la porte principale" }).click();
  await page.getByRole("button", { name: "Avancer dans le noir" }).click();
  await expect(page.getByTestId("sheet")).toContainText("PV 8");
  await expect(page.getByRole("button", { name: /Descendre l'escalier/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Affronter le gardien" })).toBeVisible();
});

test("le bouton Rejouer réinitialise la partie", async ({ page }) => {
  await page.goto("/?seed=1");
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

test("une partie aléatoire finit toujours sur un écran de fin (30 seeds)", async ({ page }) => {
  for (let seed = 0; seed < 30; seed++) {
    await page.goto(`/?seed=${seed}`);
    for (let step = 0; step < 30; step++) {
      if (await page.getByTestId("ending").isVisible()) break;
      const buttons = page.locator("#choices button");
      const n = await buttons.count();
      expect(n, `seed ${seed} : aucun choix affiché`).toBeGreaterThan(0);
      await buttons.nth(step % n).click();
    }
    await expect(page.getByTestId("ending"), `seed ${seed}`).toBeVisible();
  }
});
