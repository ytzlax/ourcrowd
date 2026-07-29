import "dotenv/config";

import { createDailyMentionCronFromEnv } from "./daily_mention_cron.js";

const cronJob = createDailyMentionCronFromEnv();

try {
  await cronJob.runOnce();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[DailyMentionCronJob] Run aborted: ${message}`);
  process.exit(1);
}
