// ============================================================================
// Tests de bout en bout : menu principal, choix d'aventure, ambiance visuelle, galerie.
// ============================================================================

import { test, expect } from "@playwright/test";

const CAMPAIGNS = ["crypte", "royaume-bugs"];

test("l'écran d'accueil propose le choix de l'aventure", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choisis ton aventure" })).toBeVisible();
  for (const id of CAMPAIGNS) {
    await expect(page.getByTestId(`campaign-card-${id}`)).toBeVisible();
  }
  await expect(page.getByTestId("sheet")).toBeHidden(); // le jeu n'est pas encore démarré
});

test("choisir une aventure lance la partie avec le bon titre", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("campaign-card-royaume-bugs").click();
  await expect(page.getByTestId("campaign-title")).toHaveText("Le Royaume maudit des Bugs");
  await expect(page.getByTestId("menu")).toBeHidden();
  await expect(page.getByTestId("sheet")).toContainText("PV 10");
});

test("on peut revenir au menu et changer d'aventure", async ({ page }) => {
  await page.goto("/?seed=1");
  await page.getByTestId("campaign-card-crypte").click();
  await expect(page.getByTestId("campaign-title")).toHaveText("La Crypte oubliée");
  await page.getByRole("button", { name: "Entrer par la porte principale" }).click();

  await page.getByTestId("back-to-menu").click();
  await expect(page.getByTestId("menu")).toBeVisible();

  await page.getByTestId("campaign-card-royaume-bugs").click();
  await expect(page.getByTestId("campaign-title")).toHaveText("Le Royaume maudit des Bugs");
  await expect(page.getByTestId("sheet")).toContainText("vide"); // l'état de l'autre aventure n'a pas fuité
});

test("une campagne inconnue dans l'URL ramène au menu", async ({ page }) => {
  await page.goto("/?campaign=n-existe-pas");
  await expect(page.getByTestId("menu")).toBeVisible();
});

test("Royaume des Bugs : chemin victorieux sans jet de dé", async ({ page }) => {
  await page.goto("/?campaign=royaume-bugs&seed=1");
  await page.getByRole("button", { name: "Lire le ticket attentivement" }).click();
  await page.getByRole("button", { name: "Partir vers le donjon" }).click();
  await page.getByRole("button", { name: "Passer par les égouts" }).click();
  await expect(page.getByTestId("sheet")).toContainText("badge_admin");
  await page.getByRole("button", { name: "Remonter vers le couloir des logs" }).click();
  await page.getByRole("button", { name: "Analyser les logs" }).click();
  await page.getByRole("button", { name: "Affronter le Bug Fantôme" }).click();
  await page.getByRole("button", { name: "Rédiger un cas de test précis" }).click();

  await expect(page.getByTestId("ending")).toHaveAttribute("data-type", "victory");
});

// Une partie aléatoire par aventure et par seed : doit toujours finir.
for (const id of CAMPAIGNS) {
  test(`${id} : 15 parties aléatoires finissent sur un écran de fin`, async ({ page }) => {
    test.setTimeout(90_000); // beaucoup de pages à charger : on laisse plus de temps que les 30 s par défaut
    for (let seed = 0; seed < 15; seed++) {
      await page.goto(`/?campaign=${id}&seed=${seed}`);
      for (let step = 0; step < 30; step++) {
        if (await page.getByTestId("ending").isVisible()) break;
        const buttons = page.locator("#choices button");
        const n = await buttons.count();
        expect(n, `${id} seed ${seed} : aucun choix affiché`).toBeGreaterThan(0);
        await buttons.nth(step % n).click();
      }
      await expect(page.getByTestId("ending"), `${id} seed ${seed}`).toBeVisible();
    }
  });
}

test.describe("ambiance visuelle", () => {
  test("chaque scène de la Crypte affiche une illustration, qui change avec la scène", async ({ page }) => {
    await page.goto("/?campaign=crypte&seed=1");
    const fig = page.getByTestId("illustration");
    await expect(fig.locator("svg")).toBeVisible();
    const before = await fig.innerHTML();
    await page.getByRole("button", { name: "Entrer par la porte principale" }).click();
    await expect(fig.locator("svg")).toBeVisible();
    expect(await fig.innerHTML()).not.toBe(before);
  });

  test("les boutons de choix ont l'effet parchemin (fond dégradé + texture)", async ({ page }) => {
    await page.goto("/?campaign=crypte&seed=1");
    const choice = page.getByRole("button", { name: "Entrer par la porte principale" });
    await expect(choice).toHaveCSS("background-image", /gradient/);
    await expect(choice).toHaveCSS("background-image", /svg/);
  });

  test("le texte reste lisible : contraste suffisant sur le parchemin", async ({ page }) => {
    await page.goto("/?campaign=crypte&seed=1");
    const color = await page.getByRole("button", { name: "Entrer par la porte principale" }).evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe("rgb(59, 42, 26)"); // brun très foncé sur parchemin clair
  });

  test("l'écran de fin n'a plus d'illustration vide : victoire illustrée", async ({ page }) => {
    await page.goto("/?campaign=royaume-bugs&seed=1");
    await page.getByRole("button", { name: "Lire le ticket attentivement" }).click();
    await page.getByRole("button", { name: "Partir vers le donjon" }).click();
    await page.getByRole("button", { name: "Passer par les égouts" }).click();
    await page.getByRole("button", { name: "Remonter vers le couloir des logs" }).click();
    await page.getByRole("button", { name: "Analyser les logs" }).click();
    await page.getByRole("button", { name: "Affronter le Bug Fantôme" }).click();
    await page.getByRole("button", { name: "Rédiger un cas de test précis" }).click();
    await expect(page.getByTestId("ending")).toHaveAttribute("data-type", "victory");
    await expect(page.getByTestId("illustration").locator("svg")).toBeVisible();
  });
});

test("la galerie affiche toutes les illustrations", async ({ page }) => {
  await page.goto("/gallery.html");
  const figures = page.getByTestId("gallery").locator("figure");
  expect(await figures.count()).toBeGreaterThanOrEqual(15);
  await expect(page.getByTestId("gallery").locator("svg").first()).toBeVisible();
});
