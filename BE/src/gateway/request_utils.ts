import type { NextFunction, Request, Response } from "express";

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

  if (statusRaw === undefined || statusRaw === "all") {
    return { search, status: "all" };
  }

  if (!isMentionStatus(statusRaw)) {
    throw new ApiError(
      400,
      `Invalid status filter. Expected one of: all, ${Object.values(MentionStatus).join(", ")}`,
      ApiErrorCode.BAD_REQUEST,
    );
  }

  return { search, status: statusRaw };
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isMentionStatus(value: string): value is MentionStatus {
  return Object.values(MentionStatus).includes(value as MentionStatus);
}
