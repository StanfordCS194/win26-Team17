# Sentiment Analysis Pipeline

## Purpose

Takes a product name + brand name from the user, fetches real Reddit discussions about it, analyzes sentiment with Claude, and stores a structured report in Convex. The pipeline powers the core search → loading → dashboard flow of PulseCheck.

## How it Works

1. User enters a product name and brand name, clicks "Analyze"
2. Frontend calls the `analyzeProduct` Convex action
3. The action checks if a report already exists (cache hit → skip pipeline)
4. If no cached report: fetches Reddit posts/comments via public JSON API
5. Filters low-quality content (deleted, low-score, too short)
6. Sends filtered content to Claude with a structured prompt
7. Claude returns JSON with 6 standardized aspect scores, strengths, issues, and quotes
8. The action validates the response and stores it via `createReport` mutation
9. Convex reactivity: `useQuery` in the frontend picks up the new report automatically

## Architecture

### Data Model

Uses the existing `productReports` table schema. Every report has exactly 6 aspect categories for comparability:
- Value for Money
- Quality & Durability
- Ease of Use
- Customer Support
- Features & Functionality
- Overall Satisfaction

### System Flow

```
SearchHero (product + brand input)
  → Index.tsx calls useAction(api.pipeline.analyzeProduct)
  → pipeline.ts orchestrates:
      1. Check cache (getByProductName)
      2. fetchRedditDiscussions() — 3 search queries, top 5 posts' comments
      3. filterAndPreprocess() — remove deleted/low-quality content
      4. analyzeWithClaude() — single Claude API call with structured prompt
      5. createReport mutation — store in Convex
  → useQuery(getByProductName) reactively picks up new report
  → Dashboard renders
```

### Key Components

| File | Purpose |
|------|---------|
| `convex/reddit.ts` | Reddit public JSON API fetching + filtering |
| `convex/analyze.ts` | Claude analysis with structured prompt |
| `convex/pipeline.ts` | Orchestrator Convex action |
| `src/pages/Index.tsx` | Triggers pipeline, manages view transitions |
| `src/components/SearchHero.tsx` | Product + brand name input form |
| `src/components/LoadingState.tsx` | Animated loading with progress (capped at 90%) |

## Implementation

### Backend (Convex)

**`convex/reddit.ts`** — Reddit data fetching
- Uses Reddit's public JSON API (`reddit.com/search.json`) — no OAuth
- Search queries: `"[brand] [product] review"`, `"worth it"`, `"pros cons"`
- Fetches up to 8 posts per query, comments from top 5 posts
- Deduplicates by post/comment ID
- Rate limiting: 1.1s delay between requests
- Exports: `fetchRedditDiscussions()`, `filterAndPreprocess()`

**`convex/analyze.ts`** — LLM analysis
- Uses `@anthropic-ai/sdk` with `claude-sonnet-4-20250514`
- Single structured prompt outputting JSON matching ProductReport schema
- Enforces all 6 standard aspects in every response
- Extracts real quotes with author/date/URL from Reddit content
- Validates output: fills missing aspects with neutral score (50)

**`convex/pipeline.ts`** — Orchestrator action
- Convex `action` (can call external APIs + mutations)
- Cache check → Reddit fetch → filter → Claude analysis → store
- User-friendly error messages

### Frontend

**`src/pages/Index.tsx`**
- `useAction(api.pipeline.analyzeProduct)` to trigger pipeline
- `handleSearch` accepts `(productName, brandName)` and calls action async
- Transition bug fix: `report !== undefined` → `report` (truthy check)
- Error handling with `toast.error()`

**`src/components/SearchHero.tsx`**
- Two input fields: product name + brand name
- Both required before "Analyze" button enables
- `onSearch` callback passes both fields

**`src/components/LoadingState.tsx`**
- Step timers: 8s + 7s + 7s + 8s = 30s total
- Progress capped at 90% (real completion triggers dashboard)
- Updated labels: removed G2 reference

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Single Convex action (not multiple) | Simpler, no intermediate state management, pipeline is fast enough |
| Reddit public JSON API (no OAuth) | No API key needed, sufficient for demo, fewer moving parts |
| 6 fixed aspect categories | Enables product-to-product comparison, consistent scoring |
| Claude Sonnet (not Opus/Haiku) | Best speed/cost/quality balance for structured analysis |
| Progress capped at 90% | Real pipeline completion triggers actual transition, avoids fake "100%" |
| Cache by product name | Same product analyzed twice returns instantly |

## Dependencies

- `@anthropic-ai/sdk` — Claude API client
- `ANTHROPIC_API_KEY` — must be set in Convex environment (`npx convex env set ANTHROPIC_API_KEY <key>`)
- Reddit public JSON API — no credentials needed

## Log

2025-02-05 :: William :: Initial pipeline implementation: Reddit fetch + Claude analysis + Convex action orchestrator. Added brand name field to SearchHero, fixed transition bug in Index.tsx, updated LoadingState timing.
