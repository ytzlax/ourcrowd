export enum ApiErrorCode {
  BAD_REQUEST = "BAD_REQUEST",
  NOT_FOUND = "NOT_FOUND",
  INTERNAL = "INTERNAL",
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;

  public constructor(
    statusCode: number,
    message: string,
    code: ApiErrorCode = ApiErrorCode.INTERNAL,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
