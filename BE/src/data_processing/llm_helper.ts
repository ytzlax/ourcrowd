import { CompanyType, MediaPresence } from "../db/types.js";
import { JsonSchema } from "../llm/types.js";
import { CompanyForClassification } from "./types.js";

export const systemClassificationPrompt =
    "You are a venture portfolio company classifier. " +
    "Given company names, classify each company's business type and media presence. " +
    "Respond only with valid JSON matching the requested schema.";

export const companyClassificationSchema: JsonSchema = {
    type: "array",
    items: {
        type: "object",
        properties: {
            name: { type: "string" },
            company_type: {
                type: "string",
                enum: Object.values(CompanyType),
            },
            media_presence: {
                type: "string",
                enum: Object.values(MediaPresence),
            },
        },
        required: ["name", "company_type", "media_presence"],
    },
};

export function buildClassificationPrompt(
    companies: CompanyForClassification[],
): string {
    const companyList = companies
        .map((c, i) => `${i + 1}. Name: ${c.name}${c.description ? ` | Context: ${c.description}` : ""}`)
        .join("\n");

    return [
        `Classify the following ${companies.length} companies based on their primary business model and media presence.`,
        "",
        "Companies to classify:",
        companyList,
        "",
        "Allowed Values:",
        `- company_type: ONLY [${Object.values(CompanyType).join(", ")}]`,
        `- media_presence: ONLY [${Object.values(MediaPresence).join(", ")}]`,
        "",
        "Classification Rules:",
        "- company_type:",
        "  * B2B: Primary customers are businesses, data centers, or industry clients (e.g. ZutaCore, Snowflake).",
        "  * B2C: Primary customers are end consumers (e.g. Netflix, Spotify).",
        "  * Enterprise: Sells exclusively large-scale infrastructure/software to Fortune 500 corporations.",
        "  * OpenSource: Core business is built around maintaining a public open-source codebase (e.g. Red Hat, Docker).",
        "",
        "- media_presence:",
        "  * high_mainstream: Frequent coverage in mainstream media (e.g. Bloomberg, Forbes, TechCrunch).",
        "  * niche_tech: Coverage mainly in industry-specific trade publications or specialized tech blogs.",
        "  * low_pr: Very little public PR or news footprint.",
        "",
        "Expected Output Format (JSON Array ONLY, no surrounding markdown or explanation):",
        JSON.stringify([
            {
                name: "ExampleCorp",
                company_type: "B2B",
                media_presence: "niche_tech"
            }
        ], null, 2),
    ].join("\n");
}