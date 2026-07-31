import type { NextFunction, Request, Response } from "express";

import {
  RELEVANCE_SCORE_MAX,
  RELEVANCE_SCORE_MIN,
} from "../analysis/analysis_types.js";
import { MentionStatus, type ListCompaniesQuery } from "../db/types.js";
import { ApiError, ApiErrorCode } from "./api_error.js";

export function asyncHandler(
  handler: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

export function parseListCompaniesQuery(req: Request): ListCompaniesQuery {
  const search = parseOptionalString(req.query.search);
  const statusRaw = parseOptionalString(req.query.status);
  const minScore = parseOptionalMinScore(req.query.minScore);

  if (statusRaw === undefined || statusRaw === "all") {
    return { search, status: "all", minScore };
  }

  if (!isMentionStatus(statusRaw)) {
    throw new ApiError(
      400,
      `Invalid status filter. Expected one of: all, ${Object.values(MentionStatus).join(", ")}`,
      ApiErrorCode.BAD_REQUEST,
    );
  }

  return { search, status: statusRaw, minScore };
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalMinScore(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" && typeof raw !== "number") {
    throw new ApiError(
      400,
      `Invalid minScore. Expected integer ${RELEVANCE_SCORE_MIN}-${RELEVANCE_SCORE_MAX}`,
      ApiErrorCode.BAD_REQUEST,
    );
  }

  const parsed = typeof raw === "number" ? raw : Number.parseInt(raw, 10);
  if (
    !Number.isInteger(parsed) ||
    parsed < RELEVANCE_SCORE_MIN ||
    parsed > RELEVANCE_SCORE_MAX
  ) {
    throw new ApiError(
      400,
      `Invalid minScore. Expected integer ${RELEVANCE_SCORE_MIN}-${RELEVANCE_SCORE_MAX}`,
      ApiErrorCode.BAD_REQUEST,
    );
  }

  return parsed;
}

function isMentionStatus(value: string): value is MentionStatus {
  return Object.values(MentionStatus).includes(value as MentionStatus);
}
