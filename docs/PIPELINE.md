# PulseCheck Analysis Pipeline

Technical documentation for the sentiment analysis pipeline. Covers architecture, data flow, scoring formulas, and extension points.

## Architecture

The pipeline runs as a Convex action (`convex/pipeline.ts`) triggered when a user searches for a product. It progresses through six sequential stages:

```
                     +------------------+
                     |   User Search    |
                     +--------+---------+
                              |
                  +-----------v-----------+
  Stage 1         |       COLLECT         |   convex/services/reddit.ts
  Status:         |  Fetch Reddit posts   |   searchSoftwareProduct()
  "fetching"      |  and comments via RSS |
                  +-----------+-----------+
                              |
                  +-----------v-----------+
  Stage 2         |     PREPROCESS        |   convex/services/dedup.ts
                  |  Deduplicate content  |   deduplicateMentions()
                  |  Filter short text    |
                  +-----------+-----------+
                              |
                  +-----------v-----------+
  Stage 3         |       CLASSIFY        |   convex/services/classifier.ts
  Status:         |  Per-mention labels:  |   classifyMentions()
  "classifying"   |  sentiment + aspects  |   Uses @convex-dev/agent
                  +-----------+-----------+
                              |
                  +-----------v-----------+
  Stage 4         |      AGGREGATE        |   convex/services/scoring.ts
  Status:         |  Deterministic score  |   computeAllScores()
  "analyzing"     |  computation (PRD     |   Pure functions, no LLM
                  |  formulas)            |
                  +-----------+-----------+
                              |
                  +-----------v-----------+
  Stage 5         |     SYNTHESIZE        |   convex/services/classifier.ts
                  |  LLM generates exec   |   synthesizeReport()
                  |  summary + grouped    |
                  |  strengths/issues     |
                  +-----------+-----------+
                              |
                  +-----------v-----------+
  Stage 6         |      ASSEMBLE         |   convex/pipeline.ts
  Status:         |  Save full report     |   saveReportResults()
  "complete"      |  to Convex database   |
                  +-----------+-----------+
```

Status flow visible in the UI loading screen:
`pending -> fetching -> classifying -> analyzing -> complete`

If any stage fails, the pipeline catches the error and sets status to `"error"` with a message.

---

## Stage Details

### Stage 1: Collect

**File:** `convex/services/reddit.ts`
**Function:** `searchSoftwareProduct(client, productName, options)`

Fetches public Reddit data via RSS feeds (no API key required).

- Searches software-focused subreddits first (r/software, r/SaaS, r/productivity)
- Falls back to general Reddit search with queries like "{product} review", "{product} vs"
- Fetches up to 10 posts with up to 20 comments each
- Filters results using fuzzy product name matching and software keyword detection
- Deduplicates posts by ID across multiple search queries

**Input:** Product name (string)
**Output:** Array of `{ post, comments[] }` objects

### Stage 2: Preprocess

**File:** `convex/services/dedup.ts`
**Function:** `deduplicateMentions(mentions)`

Removes near-identical content before classification to avoid wasting LLM calls and skewing scores.

1. Normalizes text: lowercase, collapse whitespace, trim
2. Filters out mentions shorter than 20 characters
3. Detects duplicates via three checks:
   - Exact normalized match
   - Substring containment (handles quoted content within larger posts)
   - First 100 characters match (catches reposts with minor trailing differences)

**Input:** Array of raw mentions with `text` field
**Output:** Deduplicated array (same type, preserving first occurrence)

### Stage 3: Classify

**File:** `convex/services/classifier.ts`
**Function:** `classifyMentions(ctx, productName, mentions)`

Each mention is individually classified by the LLM using `@convex-dev/agent` with Google Gemini. This is the key architectural decision: per-mention classification produces structured intermediate data that the deterministic scoring formulas in Stage 4 operate on.

**Per-mention output schema:**

| Field            | Type                                       | Description                                          |
|------------------|--------------------------------------------|------------------------------------------------------|
| `sentiment`      | `"positive" \| "neutral" \| "negative"`    | Overall sentiment of the mention                     |
| `sentimentScore` | `number` (0-100)                           | 0 = extremely negative, 50 = neutral, 100 = positive |
| `aspects`        | `Array<Aspect>`                            | Which product aspects the mention discusses           |
| `relevant`       | `boolean`                                  | Whether the mention is genuinely about the product   |

Mentions are classified in batches of 10 using `Promise.allSettled`. Individual classification failures are logged and skipped -- the pipeline continues as long as some mentions succeed.

**Input:** Array of `RawMention` objects
**Output:** Array of `ClassifiedMention` objects (raw mention + classification labels)

### Stage 4: Aggregate

**File:** `convex/services/scoring.ts`
**Function:** `computeAllScores(mentions)`

All scores are computed deterministically from the classified mention data using the PRD-defined formulas. No LLM calls. Pure functions. See the "Scoring Formulas" section below for details.

**Input:** Array of `ClassifiedMention` objects
**Output:** `ScoringResult` containing overall score, aspect scores, issue radar, and confidence indicator

### Stage 5: Synthesize

**File:** `convex/services/classifier.ts`
**Function:** `synthesizeReport(ctx, productName, mentions, scores)`

A second LLM call generates the human-readable report narrative. It receives the pre-classified mentions and pre-computed scores -- it does not re-analyze sentiment. Its job is to:

1. Identify 2-4 positive themes (strengths) with supporting mention references
2. Identify 2-4 negative themes (issues) with supporting mention references
3. Write a 2-3 sentence executive summary

Mention indices are mapped back to actual quote objects (text, author, date, URL) for the final report.

**Input:** Classified mentions + computed scores
**Output:** `{ summary, strengths[], issues[] }` with embedded quote objects

### Stage 6: Assemble

**File:** `convex/pipeline.ts`
**Function:** `saveReportResults()`

Combines all computed data into a single database write:
- Overall score, aspect scores (from Stage 4)
- Issue radar, confidence indicator (from Stage 4)
- Summary, strengths, issues with quotes (from Stage 5)
- Total mentions count and sources analyzed

---

## Scoring Formulas

All formulas are implemented in `convex/services/scoring.ts` as pure functions.

### Overall Sentiment Score

```
score = 50 + ((positiveCount - negativeCount) / totalCount) * 50
```

- Range: 0-100
- 50 = neutral (equal positive and negative, or all neutral)
- \>50 = net positive sentiment
- <50 = net negative sentiment
- Only counts mentions where `classification.relevant === true`

**Worked example:** 60 mentions total, 36 positive, 12 negative, 12 neutral
```
score = 50 + ((36 - 12) / 60) * 50 = 50 + (24/60) * 50 = 50 + 20 = 70
```

### Aspect Scores

Same formula as overall score, but only counting mentions that have the specific aspect in their `classification.aspects` array.

```
aspectScore = 50 + ((aspectPositive - aspectNegative) / aspectTotal) * 50
```

- Computed independently for each aspect: Price, Quality, Durability, Usability
- Aspects with zero mentions default to 50 (neutral)
- A single mention can contribute to multiple aspects if it discusses more than one

**Worked example:** Price aspect has 20 mentions: 14 positive, 4 negative, 2 neutral
```
priceScore = 50 + ((14 - 4) / 20) * 50 = 50 + (10/20) * 50 = 50 + 25 = 75
```

### Issue Radar

```
radarScore = (aspectMentionCount / totalMentions) * (100 - aspectSentimentScore)
```

Prioritizes issues by combining frequency (how often an aspect is discussed) with negativity (how negative the sentiment is). High radar score = frequently mentioned AND negatively perceived.

- Results are sorted descending by score
- An aspect with score 100 (all positive) has radar score 0
- An aspect with score 0 (all negative) and high frequency has the highest radar score

**Worked example:** 100 total mentions. Price has 40 mentions with sentiment score 25.
```
priceRadar = (40 / 100) * (100 - 25) = 0.4 * 75 = 30
```

Quality has 10 mentions with sentiment score 80.
```
qualityRadar = (10 / 100) * (100 - 80) = 0.1 * 20 = 2
```

Price ranks higher on the issue radar (30 vs 2).

### Confidence Indicator

Composite metric reflecting data quality:

```
overall = coverage * agreement * sourceDiversity
```

**Coverage** -- What fraction of the 4 expected aspects have sufficient data?
```
coverage = (number of aspects with > 5 mentions) / 4
```
- Range: 0 to 1
- 0 = no aspect has enough data
- 1 = all 4 aspects have > 5 mentions each

**Agreement** -- How consistent is sentiment within each aspect?
```
For each aspect:
  aspectAgreement = (largest sentiment group count) / (aspect mention count)

agreement = average of aspectAgreement across all 4 aspects
```
- Range: ~0.33 to 1
- 1 = unanimous sentiment direction within each aspect
- Aspects with no mentions default to agreement of 1 (no disagreement)

**Source Diversity** -- How many unique voices contribute?
```
sourceDiversity = min(1, uniqueAuthors / totalMentions)
```
- Range: 0 to 1
- 1 = every mention is from a different author
- Low values indicate a few authors dominating the conversation

**Worked example:** 4 aspects all with 8+ mentions (coverage = 1.0). Average agreement across aspects = 0.75. 30 unique authors out of 40 mentions (diversity = 0.75).
```
overall = 1.0 * 0.75 * 0.75 = 0.5625 (displayed as 56%)
```

---

## Aspect Definitions

Each mention can be tagged with zero or more of these aspects:

| Aspect       | What it covers                                                        |
|--------------|-----------------------------------------------------------------------|
| **Price**    | Cost, pricing, value for money, subscription, free tier, expensive, cheap |
| **Quality**  | Build quality, reliability, polish, bugs, stability, craftsmanship    |
| **Durability** | Longevity, lasting, breaking, wear, lifespan, long-term use         |
| **Usability** | Ease of use, UX, UI, learning curve, intuitive, workflow, navigation |

These definitions are provided to the LLM classifier as part of its system instructions (`convex/services/classifier.ts`). The classifier decides which aspects apply based on the actual content of each mention.

---

## Data Flow

```
Reddit RSS     ->  Raw posts + comments
                        |
extractMentions()  ->  RawMention[] (text, author, date, url, source)
                        |
deduplicateMentions()  ->  RawMention[] (deduplicated)
                        |
classifyMentions()  ->  ClassifiedMention[] (raw + classification labels)
                        |
         +-------- relevantMentions = filter(relevant === true) --------+
         |                                                              |
  computeAllScores()                                      synthesizeReport()
         |                                                              |
  ScoringResult:                                          SynthesizedReport:
  - overallScore                                          - summary
  - aspects[]                                             - strengths[]
  - issueRadar[]                                          - issues[]
  - confidence                                            (with embedded quotes)
         |                                                              |
         +------------- saveReportResults() ----------------------------+
                              |
                     Convex Database
                     (productReports table)
```

---

## Key Files

| File                              | Responsibility                                    |
|-----------------------------------|---------------------------------------------------|
| `convex/pipeline.ts`             | Pipeline orchestration, 6-stage flow               |
| `convex/services/reddit.ts`      | Reddit RSS data fetching and filtering             |
| `convex/services/dedup.ts`       | Content deduplication                              |
| `convex/services/classifier.ts`  | LLM classification (per-mention) and synthesis     |
| `convex/services/scoring.ts`     | Deterministic score computation (all PRD formulas) |
| `convex/schema.ts`               | Database schema for productReports                 |
| `convex/reports.ts`              | Report queries, mutations, and entry point action  |

---

## Extending the Pipeline

### Adding or changing aspects

1. Update the `ASPECTS` array in `convex/services/scoring.ts`
2. Update the classifier instructions in `convex/services/classifier.ts` to include definitions for the new aspects
3. Update the Zod schema (`mentionClassificationSchema`) in `classifier.ts` to include the new enum values
4. The scoring formulas, schema, and frontend are all generic over aspect names -- no other changes needed

### Changing scoring formulas

All formulas are in `convex/services/scoring.ts` as individual exported functions:
- `computeOverallScore()` -- overall sentiment
- `computeAspectScores()` -- per-aspect sentiment
- `computeIssueRadar()` -- issue prioritization
- `computeConfidence()` -- data quality indicator

Each function is pure (no side effects) and independently testable. Tests are in `src/test/scoring.test.ts`.

### Switching LLM providers

The classifier uses `@convex-dev/agent` with `@ai-sdk/google` (Gemini). To switch providers:

1. Install the provider package (e.g., `@ai-sdk/openai`, `@ai-sdk/anthropic`)
2. Update the `getModel()` function in `convex/services/classifier.ts`
3. Set the appropriate API key in Convex environment variables

No other code changes are needed -- the classification schema and scoring logic are provider-independent.

### Adding data sources beyond Reddit

1. Create a new fetcher in `convex/services/` following the pattern of `reddit.ts`
2. Have it return `RawMention[]` (same interface: text, author, date, url, source)
3. In `convex/pipeline.ts`, call the new fetcher in Stage 1 and merge results with Reddit mentions
4. Update the `source` field type if adding a new source literal

---

## Testing

- **Scoring functions:** `src/test/scoring.test.ts` -- 32 unit tests covering all formulas, edge cases, and boundary conditions
- **Deduplication:** `src/test/dedup.test.ts` -- 11 unit tests covering exact/near/substring/prefix duplicates
- **Reddit client:** `src/test/reddit.test.ts` -- 15 tests covering RSS parsing, caching, retry logic

Run all tests: `npm run test`
