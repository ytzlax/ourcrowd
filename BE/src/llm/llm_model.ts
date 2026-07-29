export enum LlmModel {
  LLAMA_3_2 = "llama3.2",
  LLAMA_3_1 = "llama3.1",
  LLAMA_3_2_1B = "llama3.2:1b",
  LLAMA_3_2_3B = "llama3.2:3b",
}

export const DEFAULT_LLM_MODEL = LlmModel.LLAMA_3_2_1B;
