import "dotenv/config";

import { createDailyAlertManagerFromEnv } from "./daily_alert_manager.js";

const alertManager = createDailyAlertManagerFromEnv();

try {
  alertManager.runOnce();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[DailyAlertManager] Run aborted: ${message}`);
  process.exit(1);
} finally {
  alertManager.close();
}
