import axios, { type AxiosError } from "axios";

import type { ApiErrorResponse } from "@/types";

const apiClient = axios.create({
  baseURL: "/api",
  headers: {
    Accept: "application/json",
  },
  timeout: 15_000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    const message =
      error.response?.data?.message ??
      error.message ??
      "An unexpected error occurred";

    return Promise.reject(new Error(message));
  },
);

export { apiClient };
