import "dotenv/config";

import { loadCompanies } from "./enrich_pipeline.js";

try {
  console.time("loadCompanies");
  const result = await loadCompanies();
  console.timeEnd("loadCompanies");
  console.log(
    `[loadCompanies] Done — total=${result.total}, inserted=${result.inserted}, skipped=${result.skipped}`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[loadCompanies] Failed: ${message}`);
  process.exit(1);
}
