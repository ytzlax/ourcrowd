import "dotenv/config";

import { createMentionAnalysisManagerFromEnv } from "./mention_analysis_manager.js";

const analysisManager = createMentionAnalysisManagerFromEnv();
analysisManager.start();
