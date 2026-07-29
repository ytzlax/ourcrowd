import { spawn } from "node:child_process";

import { DEFAULT_LLM_MODEL, type LlmModel } from "./llm_model.js";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_STARTUP_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 500;
const REACHABILITY_TIMEOUT_MS = 2_000;

interface OllamaModelTag {
  name: string;
}

interface OllamaTagsResponse {
  models: OllamaModelTag[];
}

export interface OllamaRuntimeConfig {
  baseUrl?: string;
  model?: LlmModel;
  startupTimeoutMs?: number;
  pollIntervalMs?: number;
}

export class OllamaRuntime {
  private readonly baseUrl: string;
  private readonly model: LlmModel;
  private readonly startupTimeoutMs: number;
  private readonly pollIntervalMs: number;

  public constructor(config: OllamaRuntimeConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL;
    this.model = config.model ?? DEFAULT_LLM_MODEL;
    this.startupTimeoutMs = config.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
    this.pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  }

  public async ensureReady(): Promise<void> {
    if (!(await this.isReachable())) {
      console.log("[OllamaRuntime] Ollama not reachable, starting ollama serve...");
      await this.startServer();
      await this.waitUntilReachable();
      console.log("[OllamaRuntime] Ollama is running");
    }

    if (!(await this.hasModel())) {
      console.log(`[OllamaRuntime] Model "${this.model}" not found, pulling...`);
      await this.pullModel();
      console.log(`[OllamaRuntime] Model "${this.model}" ready`);
    }
  }

  private async isReachable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async waitUntilReachable(): Promise<void> {
    const deadline = Date.now() + this.startupTimeoutMs;

    while (Date.now() < deadline) {
      if (await this.isReachable()) {
        return;
      }

      await this.sleep(this.pollIntervalMs);
    }

    throw new Error(
      `[OllamaRuntime] Ollama did not become reachable within ${this.startupTimeoutMs}ms at ${this.baseUrl}`,
    );
  }

  private async startServer(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("ollama", ["serve"], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });

      child.on("error", (error) => {
        reject(
          new Error(
            `[OllamaRuntime] Failed to start ollama serve. Is Ollama installed and on PATH? ${error.message}`,
          ),
        );
      });

      child.unref();
      setTimeout(() => resolve(), 250);
    });
  }

  private async hasModel(): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/tags`);

    if (!response.ok) {
      throw new Error(`[OllamaRuntime] Failed to list models: ${response.status} ${response.statusText}`);
    }

    const payload: unknown = await response.json();
    if (!this.isOllamaTagsResponse(payload)) {
      throw new Error("[OllamaRuntime] Unexpected response shape from /api/tags");
    }

    return payload.models.some((entry) => this.matchesModel(entry.name));
  }

  private matchesModel(modelName: string): boolean {
    if (modelName === this.model) {
      return true;
    }

    return modelName.startsWith(`${this.model}:`);
  }

  private async pullModel(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("ollama", ["pull", this.model], { stdio: "inherit" });

      child.on("error", (error) => {
        reject(
          new Error(
            `[OllamaRuntime] Failed to run ollama pull. Is Ollama installed and on PATH? ${error.message}`,
          ),
        );
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`[OllamaRuntime] ollama pull "${this.model}" exited with code ${code ?? "unknown"}`));
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private isOllamaTagsResponse(value: unknown): value is OllamaTagsResponse {
    return (
      typeof value === "object" &&
      value !== null &&
      "models" in value &&
      Array.isArray(value.models) &&
      value.models.every(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "name" in entry &&
          typeof entry.name === "string",
      )
    );
  }
}
