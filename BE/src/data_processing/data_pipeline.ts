import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import { resolveProjectDataDir } from "../db/connection.js";
import { DatabaseService } from "../db/database_service.js";
import type { Company } from "../db/types.js";
import type { EnrichCompaniesDataResult, LoadCompaniesResult } from "./types.js";
import {
    readCompaniesFromFile,
    readExistingEnrichment,
    fetchTavilyCompanyData,
} from "./helper.js";

const ENRICHMENT_OUTPUT_FILE = path.join(resolveProjectDataDir(), "companies_enrichment.json");

export async function loadCompanies(): Promise<LoadCompaniesResult> {
    const db = new DatabaseService();

    try {
        const names = readCompaniesFromFile();
        const companies: Company[] = [];
        let inserted = 0;
        let skipped = 0;

        for (const name of names) {
            const existing = db.getCompanyByName(name);
            companies.push(db.ensureCompany({ name }));

            if (existing) {
                skipped += 1;
            } else {
                inserted += 1;
            }
        }

        db.exportToJsonFiles();

        return { companies, inserted, skipped, total: names.length };
    } finally {
        db.close();
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
