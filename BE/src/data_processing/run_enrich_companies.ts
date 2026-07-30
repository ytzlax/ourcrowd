import "dotenv/config";

import { enrichCompaniesData } from "./enrich_pipeline.js";

const filePath = process.argv[2];
const outputPath = process.argv[3];

try {
  console.time("enrichCompaniesData");
  const result = await enrichCompaniesData({
    ...(filePath ? { filePath } : {}),
    ...(outputPath ? { outputPath } : {}),
  });
  console.timeEnd("enrichCompaniesData");
  console.log(
    `[enrichCompaniesData] Done — total=${result.total}, fetched=${result.fetched}, skipped=${result.skipped}, output=${result.outputPath}`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[enrichCompaniesData] Failed: ${message}`);
  process.exit(1);
}
