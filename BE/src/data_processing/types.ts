import { CompanyType, MediaPresence, type Company } from "../db/types.js";
import { LlmConfig } from "../llm/types.js";

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

export interface CompanyClassification {
    name: string;
    companyType: CompanyType;
    mediaPresence: MediaPresence;
}


export interface CompanyForClassification {
    name: string;
    description?: string;
}


export interface RawCompanyClassification extends Record<string, unknown> {
    name: string;
    company_type: string;
    media_presence: string;
}

export interface ClassifyCompaniesOptions {
    llm?: LlmConfig;
    /** Max companies per LLM call. Smaller batches are more reliable for local models. */
    batchSize?: number;
  }