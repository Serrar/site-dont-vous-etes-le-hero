import { readFileSync, readdirSync } from "node:fs";
import { validateCampaign } from "./engine/validate.ts";

const dir = "src/campaigns";
const files = process.argv[2]
  ? [process.argv[2]]
  : readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => `${dir}/${f}`);

let failed = false;
for (const file of files) {
  const report = validateCampaign(JSON.parse(readFileSync(file, "utf8")));
  report.errors.forEach((e) => console.error(`[${file}] ERREUR :`, e));
  report.warnings.forEach((w) => console.warn(`[${file}] Avertissement :`, w));
  console.log(`${file} : ${report.errors.length} erreur(s), ${report.warnings.length} avertissement(s)`);
  if (report.errors.length) failed = true;
}
process.exit(failed ? 1 : 0);
