# Portfolio Press Mentions Monitoring & Dashboard (OurCrowd Task 2026)

An automated news monitoring pipeline and dashboard built in Node.js. The system tracks news mentions across a seed list of portfolio companies, dynamically selects optimal news providers, classifies mention sentiment using a local LLM via Ollama, and delivers daily alerts.

## Project Structure

```text
root/
├── BE/                      # Backend (Express API, pipeline, jobs)
│   ├── src/
│   │   ├── analysis/        # Mention normalization & sentiment classification
│   │   ├── data_layer/      # News providers (RSS, Tavily, NewsAPI) + smart router
│   │   ├── data_processing/ # Company load/enrich & data pipeline
│   │   ├── db/              # SQLite persistence
│   │   ├── gateway/         # Express controllers & API routes
│   │   ├── jobs/            # Cron jobs (fetch, analysis, daily alerts)
│   │   ├── llm/             # Ollama LLM client & routing
│   │   └── utils/           # Shared helpers
│   └── ourcrowd_companies.txt
├── FE/                      # Frontend dashboard (Vite + React)
│   └── src/
│       ├── api/             # API client
│       ├── components/      # UI (companies, mentions, summary)
│       ├── hooks/           # Dashboard data hooks
│       └── types/           # Shared FE types
├── data/                    # Local SQLite DB & JSON artifacts
├── charts/                  # Architecture diagrams
└── README.md
```



## ⚙️ Setup instructions



### Prerequisites

- Node.js (v24.0 or higher)
- Ollama: Download & install from ollama.com



### Step 1: Clone & Install Dependencies

```bash
git clone https://github.com/ytzlax/ourcrowd.git
cd ourcrowd/BE
npm install
cd ../FE
npm install
```



### Step 2: Set Up Ollama

Run the following commands in your terminal to start Ollama and pull the required model:

```bash
# Start Ollama service (if not running automatically)
ollama serve

# Pull the lightweight model used by the pipeline
ollama pull llama3.2
```



### Step 3: Configure Environment Variables

Create a .env file in the root directory:

```env
PORT=3000
OLLAMA_BASE_URL=http://localhost:11434

NEWS_API_KEY=
TAVILY_API_KEY=
MENTIONS_LIMIT_PER_COMPANY=10

CRON_TIMEZONE=Asia/Jerusalem
ALERT_CRON_SCHEDULE=0 9 * * *
ALERT_LOOKBACK_HOURS=24
```



### 🚀 Running the Project



#### 1. Run Data Collection & Pipeline

Fetches latest news, routes queries, classifies sentiment via Ollama, and updates the local data folder:

```bash
npm run pipeline
```



#### 2. Run Daily Alert Check

Runs a daily summary: queries mentions from the last 24 hours (configurable via `ALERT_LOOKBACK_HOURS`), groups them by company, and prints a structured console alert box. Default schedule is 09:00 Asia/Jerusalem:

```bash
# Long-running daily schedule
npm run alert-cron

# One-shot (for testing / evaluation)
npm run alert-cron:now
```



#### 3. Start Dashboard UI

Starts the local dashboard server:

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---



## Architectural Decisions



### 1. Code Structure (Modular Monolith vs. Microservices)

🔍 The Dilemma & Evaluated Approaches

When structuring the backend repository to support data ingestion, local LLM inference, database management, scheduled alert tasks, and dashboard presentation, two code architectures were considered:

**Distributed Microservices:**

- Pros: Independent scaling, isolation of high-compute tasks (e.g., local LLM inference pipeline) from the UI/API layer.
- Cons: Adds high infrastructure complexity (multi-container orchestration, Docker Compose setup, inter-service HTTP/gRPC networks, and network error handling).
- Evaluation for Assignment: Significantly increases evaluator setup overhead, violating the goal of seamless local execution (npm install & npm start).

**Monolithic Script / Single File:**

- Pros: Easiest to write quickly.
- Cons: High code coupling, hard to test, difficult to separate background scheduled tasks (Daily Alerts) from serving the dashboard API.

💡 Final Decision & Architecture Solution: Modular Monolith

To strike the optimal balance between maintainability, clean separation of concerns, and effortless evaluation, the system was built as a Modular Monolith:

- Decoupled Internal Layers (Clean Architecture): The application code is strictly partitioned into distinct, modular services (Data Providers, LLM Router/Classifier, Database Adapter, Scheduled Jobs, and Express API/UI).
- Simplified Developer Experience (DX): The entire pipeline runs within a unified codebase, allowing the evaluator to launch the end-to-end system via simple npm scripts without needing Docker or network orchestration.
- Microservices-Ready Blueprint: Each module communicates through clean internal abstractions and interfaces. If required in a high-scale production setting, any layer (such as the Ollama LLM integration or Data Scraper) can be seamlessly extracted into an independent microservice with zero changes to core business logic.



### 2. Data Provider Selection & Strategy



#### Evaluated Options

- **Web Scraping (Puppeteer / Playwright / Cheerio):**
  - *Pros:* Completely free, full DOM control over target news portals.
  - *Cons:* Extremely fragile (breaks on minor HTML changes), high maintenance overhead, and frequent IP/Anti-bot blockages (CAPTCHA, Cloudflare).
- **Direct News Search APIs (e.g., Tavily, NewsAPI):**
  - *Pros:* Highly reliable, structured JSON responses (Title, URL, Publish Date), excellent precision.
  - *Cons:* Strict rate limits and costs scale with usage frequency.
- **RSS Feeds (e.g., Google News RSS):**
  - *Pros:* Free, highly reliable stream of news articles, zero rate limits.
  - *Cons:* Noisy for ambiguous company names (e.g., Island, Ro, Near, Peak).



#### Decision

Web Scraping was completely ruled out early in the process due to its high maintenance overhead and high risk of anti-bot blocking.

To select among the remaining providers (**Google News RSS**, **NewsAPI.org**, and **Tavily Search API**), the following parameters were evaluated:


| Parameter                          | Google News RSS                       | NewsAPI.org                        | Tavily Search API                         |
| ---------------------------------- | ------------------------------------- | ---------------------------------- | ----------------------------------------- |
| **Niche / B2B Company Coverage**   | 🟢 Very High                          | 🔴 Low (Mainstream news only)      | 🟢 Very High                              |
| **Context Depth & Quality**        | 🟡 Medium (Title + Snippet)           | 🟡 Medium (Title + Description)    | 🟢 Very High (Full / Extracted content)   |
| **Data Freshness**                 | 🟢 Real-time (Immediate)              | 🔴 24-hour delay (Free tier)       | 🟢 Real-time                              |
| **Disambiguation / Generic Names** | 🟡 Requires Exact Match (`"Company"`) | 🟡 Medium                          | 🟢 High (Supports Search Domain / Topic)  |
| **Rate Limits & Costs**            | 🟢 100% Free, No Rate Limits          | 🔴 100 requests/day & CORS blocked | 🔴 Quotas strictly tied to API Key limits |


---



#### Final Strategy: Fallback Cascade Architecture

Without budget constraints, **Tavily Search API** would be the ideal single choice. However, to optimize costs while ensuring maximum coverage, a 3-tier **Fallback Cascade** mechanism was designed:

1. **Primary Provider — Google News RSS (Tier 1):** The system first queries Google News RSS because it is 100% free with zero rate limits, provides real-time coverage, and handles most portfolio companies effectively.
2. **Secondary Fallback — NewsAPI.org (Tier 2):** If Google News RSS fails or returns low-confidence results, the system cascades to NewsAPI.org to check mainstream press coverage within its free-tier query budget (100 requests/day).
3. **Final Fallback — Tavily Search API (Tier 3):** If the previous tiers fail to return relevant mentions (i.e., results that pass the LLM relevance threshold or return empty results for hard-to-track B2B companies), the system invokes Tavily as the high-precision option.

This tiered approach guarantees that expensive API credits are consumed strictly as a last resort, balancing cost-efficiency with high data quality.

### 3. LLM Selection & Reliability Strategy



#### The Dilemma: Local LLM Constraints vs. Accuracy

In an ideal scenario, a large cloud-based model (e.g., GPT-4o, Claude 3.5 Sonnet) would be used for high-accuracy text analysis. However, since the system is strictly required to run a **local model via Ollama**, hardware performance and execution speed become major constraints.

The primary goal was to select the smallest, fastest model capable of executing the task reliably without errors. Following benchmark testing, `llama3.2` (3B parameters) was selected as the optimal local model.

#### Mitigating Local LLM Limitations

To empower a lightweight local model to perform accurately without hallucinations or false matches, three architectural mechanisms were introduced:

##### 1. One-Time Entity Enrichment (Context Provision)

- **The Problem:** Input company names alone (e.g., *3d Signals*) are ambiguous and provide insufficient context for a small LLM to classify correctly.
- **The Solution:** During initial setup/onboarding, a one-time company enrichment process is executed via **Tavily API** to retrieve a concise background summary and industry context per company.
- **Persistence:** This metadata is saved locally (and would be stored in a production database in a deployed system) to enrich every prompt passed to the LLM during daily processing.



##### 2. Reliability Scoring & "Human-in-the-Loop" Filtering

- **The Problem:** LLMs can make mistakes, but end-users (investment teams) require high-trust data.
- **The Solution:** The LLM is prompted to assign a **Relevance & Accuracy Score (1–10)** alongside its sentiment classification for each mention.
  - **Filtering Threshold:** Any mention with a score **below 5** is discarded automatically.
  - **User Control:** Mentions with scores **> 5** are stored with their assigned score. The UI Dashboard allows users to filter mentions by confidence score, giving them complete control over their risk tolerance and enabling human validation of lower-confidence mentions.



##### 3. Precise Prompt Engineering

Prompts were strictly engineered to be concise, structured, and deterministic. System prompts instruct the LLM to output structured data directly, reducing token generation overhead and eliminating conversational noise.

---



#### Model Choice Summary & Invocation Architecture

- **Selected Model:** `llama3.2` (3B parameters via Ollama).
- **Why it was chosen:**
  - **Exceptional Execution Speed & Low Latency:** Delivers rapid local inference times, which is essential for iterating over large batches of daily news articles without bottlenecking the system.
  - **Low Resource Footprint:** Operates efficiently on standard developer hardware without requiring expensive dedicated VRAM/GPUs.
  - **Structured JSON Precision:** Strictly follows prompt instructions to output valid JSON formats required for backend ingestion, especially when paired with Tavily background enrichment.

---



#### Model Invocation & Prompt Engineering Architecture

The local LLM is invoked programmatically per article mention using a structured **Few-Shot Prompting Strategy** to ensure deterministic execution and clean JSON outputs without conversational filler.

##### 1. Input Construction & Dynamic Context Injection

Before calling the LLM, the system dynamically constructs the prompt payload containing:

- **Enriched Entity Context:** Injects the target company's name and its background context (retrieved during initial enrichment).
- **Normalized Article Content:** Passes the article title and combined snippet text.



##### 2. Prompt Structure & Guidelines

The prompt explicitly defines a 3-part execution task alongside strict evaluation heuristics:

1. **Relevance Scoring (**`1-10`**):**
  - `1–3`: Unrelated / Same name used in a different domain (e.g., Apple fruit vs. Apple Inc.).
  - `4–6`: Incidental / Secondary mention.
  - `7–10`: Article directly covers the target company.
2. **Sentiment Classification:** Evaluates business impact (`positive`, `negative`, `neutral`).
3. **One-Sentence Summary:** Concise summary if relevance score > 5 (or `"N/A"` if < 5).



##### 3. Few-Shot Examples (In-Context Learning)

To prevent formatting drift and ensure exact schema adherence across lightweight models, the prompt embeds two representative few-shot examples (one low-relevance edge case and one high-relevance standard case).

##### 4. Strict Output Format

The LLM is instructed to enforce a strict JSON-only schema:

```json
{
  "score": 8,
  "sentiment": "positive",
  "summary": "Company X raised $10M in Series A funding to expand operations."
}
```



#### Model Evaluation & Validation Methodology

To assess and validate the local model's classification capabilities, a multi-stage evaluation strategy was conducted:

##### 1. Initial Manual Benchmarking (Qualitative Spot-Check)

- A sample of ~10 article mentions was manually inspected.
- Each link was visited directly to manually verify whether the target company was truly the main subject and whether the assigned sentiment accurately reflected the article's context.



##### 2. Automated Validation via External Frontier LLM

- The entire dataset of generated mentions and classifications was evaluated against an independent, highly capable cloud model (**Google Gemini**).
- Gemini was tasked with reviewing each entry line-by-line, crawling the underlying article URLs, and cross-validating both the relevance scoring and the sentiment accuracy generated by `llama3.2`.



##### 3. Production Recommendations (LLM-as-a-Judge)

- For a full-scale production environment, an automated **"LLM-as-a-Judge" pipeline** is recommended. Using a secondary, larger frontier model (e.g., GPT-4o or Gemini Pro) to asynchronously audit a percentage of local inferences provides continuous quality control and automated drift monitoring without introducing operational overhead to the main pipeline.



## 🏗️ Architecture & Overview

System Architecture

The system is structured into five key layers:

1. **Data Processing Layer**: The Data Processing Layer handles the initial setup and data preparation for the system. Upon system startup, it executes two one-time initialization processes:
  - **Company Seed Ingestion**: Reads the company seed list (ourcrowd_companies) and populates the companies table in the database, establishing the master list of entities to monitor.
  - **Company Context Enrichment**: Performs web searches via the Tavily API for each tracked company to collect background details and context. This enriched metadata is saved to companies_enrichment.json and served as contextual knowledge to the local LLM (Ollama) to improve classification and relevance filtering accuracy.
2. **Data Ingestion Layer**: The Data Ingestion Layer operates on a recurring scheduled interval (every 10 minutes) to poll external news sources for recent media coverage of the tracked portfolio companies. To maximize coverage while optimizing API rate limits and costs, it implements a waterfall fallback strategy:
  - **Google RSS Feed**: The primary source checked on every cycle. If new relevant mentions are discovered, they are extracted and written directly to the processing queue (mentions Q).
  - **NewsAPI**:Serves as the first fallback tier. If Google RSS returns no new mentions for a company, the pipeline queries NewsAPI. Discovered items are written to mentions Q
  - **Tavily API**:Acts as the final fallback search provider. If both RSS and NewsAPI yield no results, a targeted web search is executed via Tavily API to capture any obscure or recently indexed coverage.
  Any newly discovered news item is written into the mentions Q table in the DB Layer.
3. **LLM & Analysis Layer**: The Analysis Layer runs on a scheduled 5-minute interval and is responsible for evaluating, filtering, and classifying raw news items queued in the database.
  - **Processing Queue**: The job reads pending raw mentions from the mentions Q table that were fetched during the ingestion phase.
  - **Context Retrieval**: Before invoking the model, the layer loads enriched company background details from companies_enrichment.json to provide contextual grounding for the prompt.
  - **Ollama Analysis**: Each news item is analyzed locally via Ollama using structured prompt engineering to perform two key functions:
    - **Relevance Verification**: Validates whether the news item directly references the tracked portfolio company (filtering out false positives with common company names).
    - **Sentiment Classification**: Classifies valid mentions as Positive, Negative, or Neutral.
4. **DB Layer**: The DB Layer acts as the central data store and communication bridge between the ingestion pipeline, local LLM analysis workers, and the API gateway. It maintains state and decouples asynchronous background jobs through dedicated entities:
  * **companies Table**: Stores the master list of tracked portfolio and fund companies loaded during system startup.
  * **mentions Q Table**: Serves as an asynchronous message queue buffer. Newly discovered raw news mentions fetched from Google RSS, NewsAPI, or Tavily are written here to await sentiment analysis.
  * **mentions Table**: Stores fully processed, validated, and sentiment-classified press coverage. Each record includes links to the original source URL, publication timestamp, and sentiment score (Positive, Negative, or Neutral) used by the API layer to serve the UI dashboard.
  * **mention_fetch_cursor Table**: Singleton progress cursor for the mention-fetch job. Stores `lastCompanyIndex` so each ingestion cycle resumes from the next company in the portfolio list instead of restarting from the beginning.
5. **Gateway API & UI Layer**: The Gateway API & UI Layer forms the user-facing interface and client interaction layer of the application. It provides clean REST endpoints for frontend consumption and presents data through an intuitive executive dashboard.
  * **Gateway API**:A lightweight backend service/REST API that interfaces with the DB Layer. It serves endpoints for fetching tracked companies, quarterly press appearances, sentiment breakdowns, and computed company status metrics.
  * **UI**: A web frontend that visualizes press coverage across tracked portfolio companies:
    * **Quarterly Coverage**: Displays press mentions filtered by the last quarter, categorized by sentiment (Positive, Negative, Neutral), with direct links back to original source articles.
    * **Mention Status Indicator**: Surfaces real-time status for each company based on its latest press activity (e.g., Last mentioned 3 days ago, 45 days ago, or No coverage found).

Alongside these layers, a daily alert job (`npm run alert-cron`, or `npm run alert-cron:now` on demand) reads analyzed mentions from the last 24 hours, deduplicates by company+URL, groups them by company, and prints a structured console summary. When no new coverage exists, it logs a simple INFO status line.

---



## 🛠️ Tech Stack & Dependencies

- **Runtime**: Node.js (v24+)
- **Backend Framework**: Express.js
- **AI Processing**: [Ollama](https://ollama.com/) (Local LLM runner)
- **Data Stores**: SQLite / Local JSON files
- **News Sourcing**: Google News RSS, Tavily API, NewsAPI

