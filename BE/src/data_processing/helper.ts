import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { CompanyEnrichmentRecord, RawCompanyClassification, TavilyEnrichResponse } from "./types.js";
import { CompanyType, MediaPresence } from "../db/types.js";
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

const COMPANIES_FILE = path.resolve(MODULE_DIR, "../../ourcrowd_companies.txt");

export function parseCompaniesFile(content: string): string[] {
    return content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

export function readCompaniesFromFile(): string[] {
    const content = readFileSync(COMPANIES_FILE, "utf8");
    return parseCompaniesFile(content);
}

export function readExistingEnrichment(outputPath: string): CompanyEnrichmentRecord[] {
    if (!existsSync(outputPath)) {
        return [];
    }

    try {
        const raw: unknown = JSON.parse(readFileSync(outputPath, "utf8"));
        if (!Array.isArray(raw)) {
            console.warn(`[enrichCompaniesData] Ignoring invalid enrichment file: ${outputPath}`);
            return [];
        }

        return raw.filter(isCompanyEnrichmentRecord);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[enrichCompaniesData] Failed to read ${outputPath}: ${message}`);
        return [];
    }
}

function isCompanyEnrichmentRecord(raw: unknown): raw is CompanyEnrichmentRecord {
    if (typeof raw !== "object" || raw === null) {
        return false;
    }

    const record = raw as Record<string, unknown>;
    return (
        typeof record.name === "string" &&
        (typeof record.data === "string" || record.data === null)
    );
}

export async function fetchTavilyCompanyData(
    companyName: string
): Promise<TavilyEnrichResponse | null> {
    const apiKey = process.env.TAVILY_API_KEY?.trim() ?? "";
    if (!apiKey) {
        throw new Error("[enrichCompaniesData] TAVILY_API_KEY is required");
    }

    const name = companyName.trim();
    if (!name) {
        throw new Error("[enrichCompaniesData] Company name is required");
    }

    const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            query: `What does ${name} company do? business model customers`,
            search_depth: "basic",
            max_results: 2,
            include_answer: true,
        }),
    });

    if (!response.ok) {
        throw new Error(
            `[enrichCompaniesData] Tavily failed for "${name}": ${response.status} ${response.statusText}`,
        );
    }

    const raw: unknown = await response.json();
    if (!(typeof raw === "object" && raw !== null && "answer" in raw)) {
        console.warn(`[enrichCompaniesData] Unexpected Tavily payload for "${name}"`);
        return null;
    }

    return raw as TavilyEnrichResponse;
}

export function parseCompanyType(value: string): CompanyType {
    const normalized = value.trim();
    const match = Object.values(CompanyType).find(
        (entry) => entry.toLowerCase() === normalized.toLowerCase(),
    );

    if (!match) {
        throw new Error(`[classifyCompanies] Invalid company_type: "${value}"`);
    }

    return match;
}

export function parseMediaPresence(value: string): MediaPresence {
    const normalized = value.trim().toLowerCase();

    if (Object.values(MediaPresence).includes(normalized as MediaPresence)) {
        return normalized as MediaPresence;
    }

    throw new Error(`[classifyCompanies] Invalid media_presence: "${value}"`);
}
function normalizeCompanyName(name: string): string {
    return name
      .replace(/\([^)]*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

export function findClassificationForName(
    rawItems: RawCompanyClassification[],
    name: string,
): RawCompanyClassification | undefined {
    const needle = name.trim().toLowerCase();
    const exact = rawItems.find((item) => item.name.trim().toLowerCase() === needle);
    if (exact) {
        return exact;
    }

    const needleBase = normalizeCompanyName(name);
    return rawItems.find((item) => normalizeCompanyName(item.name) === needleBase);
}