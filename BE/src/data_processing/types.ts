import type { Company } from "../db/types.js";

export interface TavilyEnrichResponse {
    results?: TavilyEnrichResult[];
    answer?: string | null;
}

export interface TavilyEnrichResult {
    title?: string | null;
    content?: string | null;
    url?: string | null;
}

export interface CompanyEnrichmentRecord {
    name: string;
    data: string | null;
}

export interface EnrichCompaniesDataResult {
    companies: CompanyEnrichmentRecord[];
    outputPath: string;
    total: number;
    fetched: number;
    skipped: number;
}

export interface LoadCompaniesResult {
    companies: Company[];
    inserted: number;
    skipped: number;
    total: number;
}
