import "dotenv/config";

import { createMentionFetchManagerFromEnv } from "./mention_fetch_manager.js";

const fetchManager = createMentionFetchManagerFromEnv();

try {
  await fetchManager.runOnce();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[MentionFetchManager] Run aborted: ${message}`);
  process.exit(1);
} finally {
  fetchManager.close();
}
