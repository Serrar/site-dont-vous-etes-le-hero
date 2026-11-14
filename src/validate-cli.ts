import { readFileSync } from "node:fs";
import { validateCampaign } from "./engine/validate.ts";

const file = process.argv[2] ?? "src/campaigns/crypte.json";
const report = validateCampaign(JSON.parse(readFileSync(file, "utf8")));
report.errors.forEach((e) => console.error("ERREUR :", e));
report.warnings.forEach((w) => console.warn("Avertissement :", w));
console.log(`${report.errors.length} erreur(s), ${report.warnings.length} avertissement(s)`);
process.exit(report.errors.length ? 1 : 0);
