import type { LlmModel } from "./llm_model.js";

export interface JsonSchema {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean";
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
}

export type LlmResponseFormat = "json" | JsonSchema;

export interface LlmOptions {
  temperature?: number;
  topP?: number;
  numPredict?: number;
}

export interface LlmConfig {
  baseUrl?: string;
  model?: LlmModel;
  prompt?: string;
  system?: string;
  options?: LlmOptions;
}

export interface LlmInvokeOptions {
  format?: LlmResponseFormat;
  system?: string;
  options?: LlmOptions;
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: false;
  format?: LlmResponseFormat;
  system?: string;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}
