import { SentimentType, type Mention } from "../db/types.js";

export interface CompanyAlertGroup {
  companyName: string;
  mentions: Mention[];
}

const BORDER = "=".repeat(72);
const DIVIDER = "-".repeat(72);

export function formatSentimentLabel(sentiment: SentimentType): string {
  switch (sentiment) {
    case SentimentType.POSITIVE:
      return "POSITIVE";
    case SentimentType.NEGATIVE:
      return "NEGATIVE";
    case SentimentType.NEUTRAL:
      return "NEUTRAL";
    default: {
      const _exhaustive: never = sentiment;
      return String(_exhaustive);
    }
  }
}

export function formatAlertDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function formatEmptyAlertMessage(lookbackHours = 24): string {
  return (
    `[INFO] Daily check complete. No new press mentions found in the last ` +
    `${lookbackHours} hours.`
  );
}

export function formatDailyAlertBox(
  groups: CompanyAlertGroup[],
  alertDate: string = formatAlertDate(),
): string {
  const totalMentions = groups.reduce(
    (sum, group) => sum + group.mentions.length,
    0,
  );

  const lines: string[] = [
    BORDER,
    `🚨 DAILY PRESS MENTIONS ALERT [${alertDate}]`,
    BORDER,
    `Total new mentions: ${totalMentions}`,
    "",
  ];

  for (const group of groups) {
    lines.push(`── ${group.companyName} ${"─".repeat(Math.max(1, 66 - group.companyName.length))}`);
    lines.push("");

    for (const mention of group.mentions) {
      lines.push(`  Title:      ${mention.title}`);
      lines.push(`  Sentiment:  ${formatSentimentLabel(mention.sentiment)}`);
      lines.push(`  Source:     ${mention.url}`);
      lines.push(`  Published:  ${mention.publishedAt}`);
      lines.push("");
    }

    lines.push(DIVIDER);
    lines.push("");
  }

  lines.push(BORDER);
  return lines.join("\n");
}
