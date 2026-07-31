import type { IsoDateTimeString } from "@/types";

export function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number): string {
  return `${value}%`;
}

export function formatDateTime(value: IsoDateTimeString): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
