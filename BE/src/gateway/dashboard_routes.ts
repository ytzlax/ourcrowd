import { Router } from "express";

import type { DatabaseService } from "../db/database_service.js";
import { asyncHandler } from "./request_utils.js";

export function createDashboardRouter(db: DatabaseService): Router {
  const router = Router();

  router.get(
    "/summary",
    asyncHandler(async (_req, res) => {
      const summary = db.getDashboardSummary();
      res.json(summary);
    }),
  );

  return router;
}
