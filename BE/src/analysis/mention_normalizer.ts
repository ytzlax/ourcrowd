import type { Mention } from "../data_layer/base_data_provider.js";

const MAX_SNIPPET_LENGTH = 2000;

export interface NormalizedMentionContent {
  title: string;
  snippet: string;
  combinedText: string;
}

export function normalizeMentionForAnalysis(mention: Mention): NormalizedMentionContent {
  const title = cleanText(mention.title);
  const snippet = truncateText(cleanText(mention.snippet), MAX_SNIPPET_LENGTH);

  return {
    title,
    snippet,
    combinedText: [title, snippet].filter((part) => part.length > 0).join("\n\n"),
  };
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}
