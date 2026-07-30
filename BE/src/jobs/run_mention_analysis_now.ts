import "dotenv/config";

import { createMentionAnalysisManagerFromEnv } from "./mention_analysis_manager.js";

const analysisManager = createMentionAnalysisManagerFromEnv();

try {
  await analysisManager.runOnce();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[MentionAnalysisManager] Run aborted: ${message}`);
  process.exit(1);
} finally {
  analysisManager.close();
}
