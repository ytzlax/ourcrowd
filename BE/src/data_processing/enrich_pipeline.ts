import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import { resolveProjectDataDir } from "../db/connection.js";
import { DatabaseService } from "../db/database_service.js";
import type { Company } from "../db/types.js";
import { LlmModel } from "../llm/llm_model.js";
import { ClassifyCompaniesOptions } from "./types.js";
import type { CompanyClassification, CompanyForClassification, EnrichCompaniesDataResult, LoadCompaniesResult, RawCompanyClassification } from "./types.js";
import {
    readCompaniesFromFile,
    readExistingEnrichment,
    fetchTavilyCompanyData,
    parseCompanyType,
    parseMediaPresence,
    findClassificationForName,
} from "./helper.js";
import { Llm } from "../llm/llm.js";
import { buildClassificationPrompt, companyClassificationSchema, systemClassificationPrompt } from "./llm_helper.js";

const ENRICHMENT_OUTPUT_FILE = path.join(resolveProjectDataDir(), "companies_enrichment.json");
const DEFAULT_CLASSIFY_BATCH_SIZE = 3;

export async function loadCompanies(): Promise<LoadCompaniesResult> {
    const db = new DatabaseService();
    const enrichmentPath = ENRICHMENT_OUTPUT_FILE;

    try {
        const names = readCompaniesFromFile();
        const enrichmentByName = new Map(
            readExistingEnrichment(enrichmentPath).map(
                (item) => [item.name.trim().toLowerCase(), item.data] as const,
            ),
        );

        const companiesForClassification = names.map((name) => {
            const description = enrichmentByName.get(name.trim().toLowerCase());
            return {
                name,
                description: description ?? undefined,
            };
        });

        const classifications = await classifyCompanies(companiesForClassification, {
            llm: { model: LlmModel.LLAMA_3_2 },
        });
        const byName = new Map(
            classifications.map((item) => [item.name.toLowerCase(), item] as const),
        );

        const companies: Company[] = [];
        let inserted = 0;
        let skipped = 0;

        for (const name of names) {
            const existing = db.getCompanyByName(name);
            const classification = byName.get(name.toLowerCase());

            companies.push(
                db.ensureCompany({
                    name,
                    companyType: classification?.companyType,
                    mediaPresence: classification?.mediaPresence,
                }),
            );

            if (existing) {
                skipped += 1;
            } else {
                inserted += 1;
            }
        }

        db.exportToJsonFiles();

        return { companies, inserted, skipped, total: names.length };
    } finally {

    }
}

export async function enrichCompaniesData(
    options: { filePath?: string; outputPath?: string } = {},
): Promise<EnrichCompaniesDataResult> {
    const outputPath = options.outputPath ?? ENRICHMENT_OUTPUT_FILE;
    const names = readCompaniesFromFile();

    const existing = readExistingEnrichment(outputPath);
    const byName = new Map(
        existing.map((item) => [item.name.trim().toLowerCase(), item] as const),
    );

    const missing = names.filter((name) => !byName.has(name.trim().toLowerCase()));
    const skipped = names.length - missing.length;

    if (missing.length === 0) {
        console.log(
            `[enrichCompaniesData] All ${names.length} companies already enriched — nothing to fetch`,
        );
        return { companies: existing, outputPath, total: names.length, fetched: 0, skipped };
    }

    console.log(
        `[enrichCompaniesData] Fetching ${missing.length}/${names.length} companies (${skipped} already present)`,
    );

    for (let i = 0; i < missing.length; i += 1) {
        const name = missing[i];
        console.log(`[enrichCompaniesData] ${i + 1}/${missing.length}: ${name}`);
        const data = await fetchTavilyCompanyData(name);
        byName.set(name.trim().toLowerCase(), { name, data: data?.answer ?? null });
    }

    const companies = names.map((name) => {
        const existingRecord = byName.get(name.trim().toLowerCase());
        return existingRecord ?? { name, data: null };
    });

    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(companies, null, 2), "utf8");
    console.log(`[enrichCompaniesData] Wrote ${companies.length} records to ${outputPath}`);

    return {
        companies,
        outputPath,
        total: names.length,
        fetched: missing.length,
        skipped,
    };
}

export async function classifyCompanies(
    companies: CompanyForClassification[],
    options: ClassifyCompaniesOptions = {},
): Promise<CompanyClassification[]> {
    const input = companies
        .map((company) => ({
            name: company.name.trim(),
            description: company.description?.trim() || undefined,
        }))
        .filter((company) => company.name.length > 0);

    if (input.length === 0) {
        return [];
    }

    const batchSize = options.batchSize ?? DEFAULT_CLASSIFY_BATCH_SIZE;
    if (batchSize < 1) {
        throw new Error(`[classifyCompanies] batchSize must be >= 1, got ${batchSize}`);
    }

    const llm = new Llm({
        ...options.llm,
        model: options.llm?.model ?? LlmModel.QWEN_2_5_1_5B,
        system: options.llm?.system ?? systemClassificationPrompt,
        options: { temperature: 0.1, ...options.llm?.options },
    });

    const results: CompanyClassification[] = [];

    for (let offset = 0; offset < input.length; offset += batchSize) {
        const batch = input.slice(offset, offset + batchSize);
        const batchNumber = Math.floor(offset / batchSize) + 1;
        const totalBatches = Math.ceil(input.length / batchSize);
        console.log(
            `[classifyCompanies] Batch ${batchNumber}/${totalBatches} (${batch.length} companies)`,
        );

        llm.prompt = buildClassificationPrompt(batch);
        const rawItems = await llm.invokeStructured<RawCompanyClassification[]>(
            companyClassificationSchema,
        );

        for (const company of batch) {
            const raw = findClassificationForName(rawItems, company.name);

            if (!raw) {
                throw new Error(`[classifyCompanies] LLM response missing company "${company.name}"`);
            }

            results.push({
                name: company.name,
                companyType: parseCompanyType(raw.company_type),
                mediaPresence: parseMediaPresence(raw.media_presence),
            });
        }
    }

    return results;
}
