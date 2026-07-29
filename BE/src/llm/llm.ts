import { DEFAULT_LLM_MODEL, type LlmModel } from "./llm_model.js";
import type {
  JsonSchema,
  LlmConfig,
  LlmInvokeOptions,
  LlmOptions,
  OllamaGenerateRequest,
  OllamaGenerateResponse,
} from "./types.js";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

export class Llm {
  public prompt: string;
  public model: LlmModel;
  public system?: string;
  public options: LlmOptions;

  private readonly baseUrl: string;

  public constructor(config: LlmConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL;
    this.model = config.model ?? DEFAULT_LLM_MODEL;
    this.prompt = config.prompt ?? "";
    this.system = config.system;
    this.options = config.options ?? {};
    console.log(`[Llm] Initialized with model: ${this.model}`);
  }

  public async invoke(options: LlmInvokeOptions = {}): Promise<string> {
    const response = await this.callOllama(options);
    return response.response.trim();
  }

  public async invokeJson<T extends Record<string, unknown>>(
    options: Omit<LlmInvokeOptions, "format"> = {},
  ): Promise<T> {
    const raw = await this.invoke({ ...options, format: "json" });
    return this.parseJsonResponse<T>(raw);
  }

  public async invokeStructured<T>(
    schema: JsonSchema,
    options: Omit<LlmInvokeOptions, "format"> = {},
  ): Promise<T> {
    const raw = await this.invoke({ ...options, format: schema });
    return this.parseJsonResponse<T>(raw);
  }

  private async callOllama(options: LlmInvokeOptions): Promise<OllamaGenerateResponse> {
    if (!this.prompt.trim()) {
      throw new Error("[Llm] invoke requires a non-empty prompt");
    }

    const body: OllamaGenerateRequest = {
      model: this.model,
      prompt: this.prompt,
      stream: false,
      ...(options.format !== undefined ? { format: options.format } : {}),
      ...(options.system ?? this.system ? { system: options.system ?? this.system } : {}),
      ...(this.buildOllamaOptions(options.options) !== undefined
        ? { options: this.buildOllamaOptions(options.options) }
        : {}),
    };

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `[Llm] Ollama request failed: ${response.status} ${response.statusText} — ${errorBody}`,
      );
    }

    const payload: unknown = await response.json();
    return this.parseOllamaResponse(payload);
  }

  private buildOllamaOptions(
    override?: LlmOptions,
  ): OllamaGenerateRequest["options"] | undefined {
    const merged: LlmOptions = { ...this.options, ...override };
    const ollamaOptions: NonNullable<OllamaGenerateRequest["options"]> = {};

    if (merged.temperature !== undefined) {
      ollamaOptions.temperature = merged.temperature;
    }
    if (merged.topP !== undefined) {
      ollamaOptions.top_p = merged.topP;
    }
    if (merged.numPredict !== undefined) {
      ollamaOptions.num_predict = merged.numPredict;
    }

    return Object.keys(ollamaOptions).length > 0 ? ollamaOptions : undefined;
  }

  private parseOllamaResponse(payload: unknown): OllamaGenerateResponse {
    if (!this.isOllamaGenerateResponse(payload)) {
      throw new Error("[Llm] Unexpected Ollama response shape");
    }

    if (!payload.done) {
      throw new Error("[Llm] Ollama returned an incomplete response (stream=false expected)");
    }

    return payload;
  }

  private parseJsonResponse<T>(raw: string): T {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("parsed value is not a JSON object or array");
      }
      return parsed as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[Llm] Failed to parse structured JSON response: ${message}`);
    }
  }

  private isOllamaGenerateResponse(value: unknown): value is OllamaGenerateResponse {
    return (
      typeof value === "object" &&
      value !== null &&
      "response" in value &&
      typeof value.response === "string" &&
      "done" in value &&
      typeof value.done === "boolean"
    );
  }

}
