import type { NextFunction, Request, Response } from "express";

import { ApiError, ApiErrorCode } from "./api_error.js";

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      message: error.message,
      code: error.code,
    });
    return;
  }

  console.error("[gateway] Unhandled error:", error);

  res.status(500).json({
    message: "Internal server error",
    code: ApiErrorCode.INTERNAL,
  });
}
