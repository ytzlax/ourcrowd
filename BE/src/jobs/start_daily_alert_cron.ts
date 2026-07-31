import "dotenv/config";

import { createDailyAlertManagerFromEnv } from "./daily_alert_manager.js";

const alertManager = createDailyAlertManagerFromEnv();
alertManager.start();
