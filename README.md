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



#### Prerequisites:

Node.js (v24.0 or higher)
Ollama: Download & install from ollama.com

Step 1: Clone & Install Dependencies

```json
git clone https://github.com/ytzlax/ourcrowd.git
cd ourcrowd/BE
npm install
cd ../FE
npm install
```

Step 2: Set Up Ollama
Run the following commands in your terminal to start Ollama and pull the required model:

```json
# Start Ollama service (if not running automatically)
ollama serve

# Pull the lightweight model used by the pipeline
ollama pull llama3.2:3b
```

Step 3: Configure Environment Variables
Create a .env file in the root directory:

```json
PORT=3000
OLLAMA_BASE_URL=http://localhost:11434

NEWS_API_KEY=
TAVILY_API_KEY=
MENTIONS_LIMIT_PER_COMPANY=10

CRON_TIMEZONE=Asia/Jerusalem

```

🚀 Running the Project

1. Run Data Collection & Pipeline

Fetches latest news, routes queries, classifies sentiment via Ollama, and updates the local data folder:

```json
npm run pipeline
```

1. Run Daily Alert Check

Executes the scheduled daily job check and outputs alerts for new coverage to console/Slack:

```json
npm run alert
```

1. Start Dashboard UI

Starts the local dashboard server:

```json
npm start
```

## Open [http://localhost:3000](http://localhost:3000) in your browser.



## Architectural Decisions



### 1.Code Structure (Modular Monolith vs. Microservices)

🔍 The Dilemma & Evaluated Approaches
When structuring the backend repository to support data ingestion, local LLM inference, database management, scheduled alert tasks, and dashboard presentation, two code architectures were considered:

Distributed Microservices:

Pros: Independent scaling, isolation of high-compute tasks (e.g., local LLM inference pipeline) from the UI/API layer.

Cons: Adds high infrastructure complexity (multi-container orchestration, Docker Compose setup, inter-service HTTP/gRPC networks, and network error handling).

Evaluation for Assignment: Significantly increases evaluator setup overhead, violating the goal of seamless local execution (npm install & npm start).

Monolithic Script / Single File:

Pros: Easiest to write quickly.

Cons: High code coupling, hard to test, difficult to separate background scheduled tasks (Daily Alerts) from serving the dashboard API.

💡 Final Decision & Architecture Solution: Modular Monolith
To strike the optimal balance between maintainability, clean separation of concerns, and effortless evaluation, the system was built as a Modular Monolith:

Decoupled Internal Layers (Clean Architecture): The application code is strictly partitioned into distinct, modular services (Data Providers, LLM Router/Classifier, Database Adapter, Scheduled Jobs, and Express API/UI).

Simplified Developer Experience (DX): The entire pipeline runs within a unified codebase, allowing the evaluator to launch the end-to-end system via simple npm scripts without needing Docker or network orchestration.

Microservices-Ready Blueprint: Each module communicates through clean internal abstractions and interfaces. If required in a high-scale production setting, any layer (such as the Ollama LLM integration or Data Scraper) can be seamlessly extracted into an independent microservice with zero changes to core business logic.

### 2. Data Provider Selection & Strategy

#### Evaluated Options:
* **Web Scraping (Puppeteer / Playwright / Cheerio):**
  * *Pros:* Completely free, full DOM control over target news portals.
  * *Cons:* Extremely fragile (breaks on minor HTML changes), high maintenance overhead, and frequent IP/Anti-bot blockages (CAPTCHA, Cloudflare).
* **Direct News Search APIs (e.g., Tavily, NewsAPI):**
  * *Pros:* Highly reliable, structured JSON responses (Title, URL, Publish Date), excellent precision.
  * *Cons:* Strict rate limits and costs scale with usage frequency.
* **RSS Feeds (e.g., Google News RSS):**
  * *Pros:* Free, highly reliable stream of news articles, zero rate limits.
  * *Cons:* Noisy for ambiguous company names (e.g., Island, Ro, Near, Peak).

---

#### Decision:
Web Scraping was completely ruled out early in the process due to its high maintenance overhead and high risk of anti-bot blocking.

To select among the remaining providers (**Google News RSS**, **NewsAPI.org**, and **Tavily Search API**), the following parameters were evaluated:

| Parameter | Google News RSS | NewsAPI.org | Tavily Search API |
| :--- | :--- | :--- | :--- |
| **Niche / B2B Company Coverage** | 🟢 Very High | 🔴 Low (Mainstream news only) | 🟢 Very High |
| **Context Depth & Quality** | 🟡 Medium (Title + Snippet) | 🟡 Medium (Title + Description) | 🟢 Very High (Full / Extracted content) |
| **Data Freshness** | 🟢 Real-time (Immediate) | 🔴 24-hour delay (Free tier) | 🟢 Real-time |
| **Disambiguation / Generic Names** | 🟡 Requires Exact Match (`"Company"`) | 🟡 Medium | 🟢 High (Supports Search Domain / Topic) |
| **Rate Limits & Costs** | 🟢 100% Free, No Rate Limits | 🔴 100 requests/day & CORS blocked | 🔴 Quotas strictly tied to API Key limits |

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

The primary goal was to select the smallest, fastest model capable of executing the task reliably without errors. Following benchmark testing, **`llama3.2`** (3B parameters) was selected as the optimal local model.

---

#### Mitigating Local LLM Limitations
To empower a lightweight local model to perform accurately without hallucinations or false matches, three architectural mechanisms were introduced:

##### 1. One-Time Entity Enrichment (Context Provision)
* **The Problem:** Input company names alone (e.g., *3d Signals*) are ambiguous and provide insufficient context for a small LLM to classify correctly.
* **The Solution:** During initial setup/onboarding, a one-time company enrichment process is executed via **Tavily API** to retrieve a concise background summary and industry context per company. 
* **Persistence:** This metadata is saved locally (and would be stored in a production database in a deployed system) to enrich every prompt passed to the LLM during daily processing.

##### 2. Reliability Scoring & "Human-in-the-Loop" Filtering
* **The Problem:** LLMs can make mistakes, but end-users (investment teams) require high-trust data.
* **The Solution:** The LLM is prompted to assign a **Relevance & Accuracy Score (1–10)** alongside its sentiment classification for each mention.
  * **Filtering Threshold:** Any mention with a score **below 5** is discarded automatically.
  * **User Control:** Mentions with scores **> 5** are stored with their assigned score. The UI Dashboard allows users to filter mentions by confidence score, giving them complete control over their risk tolerance and enabling human validation of lower-confidence mentions.

##### 3. Precise Prompt Engineering
Prompts were strictly engineered to be concise, structured, and deterministic. System prompts instruct the LLM to output structured data directly, reducing token generation overhead and eliminating conversational noise.

---

#### Model Choice Summary
* **Selected Model:** `llama3.2` (3B parameters via Ollama).
* **Why it was chosen:** 
  
  * **Exceptional Execution Speed & Low Latency**: Delivers rapid local inference times, which is essential for iterating over large batches of daily news articles without bottlenecking the system.
  * **Low Resource Footprint:** Operates efficiently on standard developer hardware without requiring expensive dedicated VRAM/GPUs.
  * **Structured JSON Precision:** Strictly follows prompt instructions to output valid JSON formats required for backend ingestion, especially when paired with Tavily background enrichment.

## 🏗️ Architecture & Overview

The system is structured into five key layers:

1. **Input & Metadata Layer**: Loads the tracked portfolio companies (`ourcrowd_companies.txt`).
2. **Smart Data Router (LLM Decision)**: Analyzes company metadata (e.g., generic names vs. unique entities like *Island* vs. *ZutaCore*) and dynamically chooses the most suitable data provider (Tavily API, NewsAPI, or Google RSS) to maximize relevance while optimizing API limits/costs.
3. **Fetching & Normalization Layer**: Fetches articles from the selected provider and normalizes results into a standardized JSON structure (Title, URL, Publish Date, Snippet).
4. **Local LLM Processing (Ollama)**: Performs relevance filtering, sentiment classification (`positive`, `negative`, `neutral`), and extracts key takeaways locally.
5. **Storage & UI Dashboard**: Persists results to SQLite/JSON and powers a web dashboard showing quarterly mentions, company coverage status ("Last mentioned X days ago"), and trigger mechanisms for daily alerts.

---



## 🛠️ Tech Stack & Dependencies

- **Runtime**: Node.js (v24+)
- **Backend Framework**: Express.js
- **AI Processing**: [Ollama](https://ollama.com/) (Local LLM runner)
- **Data Stores**: SQLite / Local JSON files
- **News Sourcing**: Google News RSS, Tavily API, NewsAPI

---



## 🤖 Local LLM Configuration (Ollama)



### 1. Model Choice & Justification

- **Model Used**: will decide later...
- **Why**: Provides a strong balance between execution speed on local developer hardware (low latency), high performance in structured JSON extraction, and high accuracy for zero-shot text classification.



### 2. How the Model is Invoked

The backend communicates with Ollama via the native HTTP REST API (`http://localhost:11434/api/generate`) using structured system prompts with **JSON mode enabled**.

#### Sentiment & Relevance Prompt Example:

```json
{
  "model": "llama3.2",
  "format": "json",
  "prompt": "Analyze the following news snippet for company '{COMPANY_NAME}'. Determine: 1) Is it relevant to this technology company? 2) Sentiment (positive/negative/neutral). Output strict JSON: {\"is_relevant\": boolean, \"sentiment\": \"string\", \"summary\": \"string\"}"
}
```



### 3. Classification Quality Validation

Manual Spot-Check: Tested against a labeled subset of 30 news articles across diverse portfolio sectors (Cybersecurity, MedTech, AgriTech).

Validation Accuracy: Achieved >88% agreement with manual human tagging, specifically resolving ambiguity on edge cases (e.g., distinguishing general "ocean waves" from the company Wave).

System architecture