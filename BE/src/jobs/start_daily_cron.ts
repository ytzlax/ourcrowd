import "dotenv/config";

import { createDailyMentionCronFromEnv } from "./daily_mention_cron.js";

const cronJob = createDailyMentionCronFromEnv();
cronJob.start();
