import { Router } from "express";

import type { DatabaseService } from "../db/database_service.js";
import { ApiError, ApiErrorCode } from "./api_error.js";
import { asyncHandler, parseListCompaniesQuery } from "./request_utils.js";

export function createCompaniesRouter(db: DatabaseService): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = parseListCompaniesQuery(req);
      const companies = db.listCompaniesWithStats(query);
      res.json({ companies });
    }),
  );

  router.get(
    "/:id/mentions",
    asyncHandler(async (req, res) => {
      const companyId = req.params.id;
      const company = db.getCompanyById(companyId);

      if (!company) {
        throw new ApiError(
          404,
          `Company not found: ${companyId}`,
          ApiErrorCode.NOT_FOUND,
        );
      }

      const mentions = db.getQuarterlyMentions({ companyId });
      res.json({ companyId, mentions });
    }),
  );

  return router;
}
