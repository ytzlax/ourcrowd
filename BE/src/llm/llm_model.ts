export enum LlmModel {
  LLAMA_3_2 = "llama3.2",
  LLAMA_3_1 = "llama3.1",
  LLAMA_3_2_1B = "llama3.2:1b",
  QWEN_2_5_0_5B = "qwen2.5:0.5b",
  QWEN_2_5_1_5B = "qwen2.5:1.5b",
}

export const DEFAULT_LLM_MODEL = LlmModel.LLAMA_3_2;
