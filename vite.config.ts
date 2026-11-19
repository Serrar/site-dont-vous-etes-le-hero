// Configuration de Vite (serveur de développement) et de Vitest (tests unitaires).
// Vitest ne cherche les tests que dans tests/unit ; les tests de navigateur (tests/e2e) sont lancés par Playwright.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
  },
});
