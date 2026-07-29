export enum LlmModel {
  LLAMA_3_2 = "llama3.2",
  LLAMA_3_1 = "llama3.1",
  LLAMA_3_2_1B = "llama3.2:1b",
  LLAMA_3_2_3B = "llama3.2:3b",
  QWEN_2_5_0_5B = "qwen2.5:0.5b",
}

export const DEFAULT_LLM_MODEL = LlmModel.QWEN_2_5_0_5B;
