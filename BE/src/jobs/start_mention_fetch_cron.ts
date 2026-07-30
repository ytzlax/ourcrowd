import "dotenv/config";

import { createMentionFetchManagerFromEnv } from "./mention_fetch_manager.js";

const fetchManager = createMentionFetchManagerFromEnv();
fetchManager.start();
