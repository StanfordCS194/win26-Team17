# PulseCheck Architecture

## Overview

PulseCheck is a product intelligence platform that aggregates and analyzes user feedback from public sources to help product managers understand sentiment about software products.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT                                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  React + Vite + TypeScript                                         │ │
│  │  ├── Pages: Search, Dashboard                                      │ │
│  │  ├── Components: Header, ScoreGauge, InsightCard, QuoteCard        │ │
│  │  ├── Hooks: useReport (Convex subscription)                        │ │
│  │  └── Styling: Tailwind + shadcn/ui                                 │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Deployed on: Vercel                                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                          Convex React hooks
                          (real-time subscriptions)
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Convex (Serverless Backend)                                       │ │
│  │                                                                     │ │
│  │  Queries (read)           Mutations (write)     Actions (async)    │ │
│  │  ├── getReport            ├── createReport      ├── runPipeline    │ │
│  │  ├── getReportByProduct   ├── updateReport      ├── fetchReddit    │ │
│  │  ├── listReports          ├── saveInsights      ├── analyzeData    │ │
│  │  └── getReportStatus      └── saveMentions      └── generateReport │ │
│  │                                                                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Database: Convex (built-in)                                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  Reddit API  │  │  Gemini API  │  │    VADER     │                   │
│  │  (data)      │  │  (analysis)  │  │  (scoring)   │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Report    │──────<│   Mention   │       │   Aspect    │
│             │       │             │       │             │
│ productName │       │ reportId    │       │ reportId    │
│ status      │       │ source      │       │ name        │
│ overallScore│       │ text        │       │ score       │
│ summary     │       │ author      │       │ mentionCount│
│ createdAt   │       │ sentiment   │       │ trend       │
│ expiresAt   │       │ url         │       └─────────────┘
└─────────────┘       └─────────────┘
       │
       │
       ▼
┌─────────────┐       ┌─────────────┐
│   Insight   │──────<│    Quote    │
│             │       │             │
│ reportId    │       │ insightId   │
│ type        │       │ mentionId   │
│ title       │       │ text        │
│ description │       │ source      │
│ frequency   │       │ author      │
│ rank        │       │ url         │
└─────────────┘       └─────────────┘
```

### Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `reports` | Main report metadata | productName, status, overallScore, summary |
| `mentions` | Raw data from sources | reportId, source, text, sentimentScore |
| `insights` | Extracted themes | reportId, type (strength/issue), title, frequency |
| `quotes` | Supporting evidence | insightId, mentionId, text, url |
| `aspects` | Category scores | reportId, name (Features/UX/Pricing), score |

---

## Data Pipeline

### Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA PIPELINE                                  │
│                                                                          │
│  1. REQUEST                                                              │
│     └── User searches for "Notion"                                       │
│     └── Check cache: if valid cached report exists, return it            │
│     └── Create new report with status: "pending"                         │
│                                                                          │
│  2. QUERY GENERATION                                                     │
│     └── Generate diverse search queries for the product                  │
│     └── Queries target: complaints, praise, comparisons, pricing         │
│     └── Update status: "querying"                                        │
│                                                                          │
│  3. DATA COLLECTION                                                      │
│     └── For each query, fetch Reddit posts + comments                    │
│     └── Filter by relevance and recency                                  │
│     └── Store raw mentions in database                                   │
│     └── Update status: "fetching"                                        │
│                                                                          │
│  4. SENTIMENT ANALYSIS                                                   │
│     └── Run VADER on each mention                                        │
│     └── Calculate compound sentiment score (-1 to +1)                    │
│     └── Store scores with mentions                                       │
│     └── Update status: "analyzing"                                       │
│                                                                          │
│  5. THEME EXTRACTION                                                     │
│     └── Group mentions by theme/topic                                    │
│     └── Identify strengths (positive themes) and issues (negative)       │
│     └── Select best supporting quotes for each theme                     │
│     └── Update status: "writing"                                         │
│                                                                          │
│  6. REPORT GENERATION                                                    │
│     └── Calculate overall score (0-100)                                  │
│     └── Generate executive summary                                       │
│     └── Rank insights by importance                                      │
│     └── Calculate aspect scores                                          │
│     └── Update status: "complete"                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Status Flow

```
pending → querying → fetching → analyzing → writing → complete
                                                  ↘
                                                   error
```

---

## Caching Strategy

| Scenario | Behavior |
|----------|----------|
| First search for product | Full pipeline runs (~30-60 seconds) |
| Search within 24 hours | Return cached report instantly |
| Search after 24 hours | Show stale data, offer refresh |
| User clicks "Refresh" | Run full pipeline, replace cached data |

**Cache Key**: Normalized product name (lowercase, trimmed)
**TTL**: 24 hours

---

## API Integration

### Reddit API

| Endpoint | Purpose | Rate Limit |
|----------|---------|------------|
| `GET /search` | Search for posts | 100 req/min |
| `GET /r/{subreddit}/comments/{id}` | Get comments | 100 req/min |

**Authentication**: OAuth2 (client credentials flow)
**Key subreddits**: r/SaaS, r/productivity, r/software, r/startups, product-specific

### Gemini API

| Endpoint | Purpose | Rate Limit |
|----------|---------|------------|
| `POST /generateContent` | Query generation, theme extraction, summarization | 60 req/min |

**Model**: gemini-1.5-flash (fast, cheap)

---

## Frontend Components

### Component Hierarchy

```
App
├── Header                    # Logo, navigation
├── Pages
│   ├── Index                 # Main page, manages view state
│   │   ├── SearchHero        # Search input, suggestions
│   │   ├── LoadingState      # Pipeline progress
│   │   └── Dashboard         # Report display
│   └── NotFound              # 404 page
└── Components
    ├── ScoreGauge            # Circular score display
    ├── AspectScore           # Features/UX/Pricing cards
    ├── InsightCard           # Strength/Issue with quotes
    ├── QuoteCard             # Individual quote
    └── SourceBadge           # Reddit/G2 indicator
```

### State Management

| State | Location | Updates |
|-------|----------|---------|
| View state (search/loading/dashboard) | React useState | User actions |
| Report data | Convex subscription | Real-time from backend |
| Search query | React useState | User input |

---

## Directory Structure

```
/
├── convex/                      # Backend (Convex)
│   ├── schema.ts                # Database schema
│   ├── reports.ts               # Report queries/mutations
│   ├── pipeline.ts              # Pipeline orchestration
│   ├── services/
│   │   ├── reddit.ts            # Reddit API client
│   │   ├── gemini.ts            # Gemini API client
│   │   └── sentiment.ts         # VADER wrapper
│   └── _generated/              # Convex auto-generated
│
├── src/                         # Frontend (React)
│   ├── pages/
│   │   ├── Index.tsx            # Main page
│   │   └── NotFound.tsx         # 404
│   ├── components/
│   │   ├── ui/                  # shadcn components
│   │   ├── Header.tsx
│   │   ├── SearchHero.tsx
│   │   ├── LoadingState.tsx
│   │   ├── Dashboard.tsx
│   │   ├── ScoreGauge.tsx
│   │   ├── AspectScore.tsx
│   │   ├── InsightCard.tsx
│   │   ├── QuoteCard.tsx
│   │   └── SourceBadge.tsx
│   ├── hooks/
│   │   └── useReport.ts         # Convex subscription
│   ├── lib/
│   │   └── utils.ts             # Utility functions
│   ├── data/
│   │   └── mockData.ts          # Types + mock data (dev only)
│   ├── App.tsx                  # Router setup
│   ├── main.tsx                 # Entry point
│   └── index.css                # Global styles
│
├── public/                      # Static assets
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── convex.json                  # Convex config
```

---

## Data Sources

### Current (MVP)

| Source | API | Data Type | Value |
|--------|-----|-----------|-------|
| Reddit | Official REST API | Posts, comments | Honest user opinions, discussions |

### Planned (Future)

| Source | API/Method | Data Type | Value |
|--------|------------|-----------|-------|
| HackerNews | Algolia API | Posts, comments | Developer/founder perspectives |
| G2 | Serper (scraping) | Reviews | Professional B2B reviews |
| ProductHunt | GraphQL API | Launches, comments | Early adopter feedback |
| Twitter/X | REST API | Tweets | Real-time reactions |

### Source Interface

All data sources implement a common interface:

```typescript
interface DataSource {
  name: string;
  fetchMentions(productName: string, queries: string[]): Promise<RawMention[]>;
}

interface RawMention {
  source: string;
  text: string;
  author: string;
  date: string;
  url: string;
  metadata?: Record<string, any>;
}
```

---

## Error Handling

| Error Type | Handling |
|------------|----------|
| Reddit API rate limit | Exponential backoff, retry up to 3 times |
| Reddit API auth failure | Re-authenticate, retry |
| Gemini API error | Fallback to simpler analysis, log error |
| Empty search results | Return report with "insufficient data" message |
| Pipeline timeout (>5 min) | Mark report as error, allow retry |

---

## Performance Considerations

| Concern | Solution |
|---------|----------|
| Cold start latency | Convex is serverless, keep functions warm |
| Large response payloads | Paginate quotes, lazy load |
| Slow pipeline | Show real-time progress via subscriptions |
| API costs | Cache aggressively, batch requests |

---

## Security

| Concern | Solution |
|---------|----------|
| API keys | Stored in Convex environment variables |
| User input | Sanitize product names before API calls |
| Rate limiting | Convex has built-in rate limiting |
| Data privacy | Only process public data (Reddit, G2) |

---

## Testing Strategy

| Type | Scope | Tools |
|------|-------|-------|
| Unit | Sentiment scoring, data parsing | Vitest |
| Integration | Pipeline stages | Vitest + Convex dev |
| E2E | Full user flow | Manual testing |

---

## Deployment

| Component | Platform | CI/CD |
|-----------|----------|-------|
| Frontend | Vercel | Auto-deploy on push to main |
| Backend | Convex | Auto-deploy with `npx convex deploy` |

### Environment Variables

```bash
# Convex
CONVEX_DEPLOYMENT=<your-deployment>

# Reddit
REDDIT_CLIENT_ID=<reddit-app-id>
REDDIT_CLIENT_SECRET=<reddit-app-secret>

# Gemini
GEMINI_API_KEY=<gemini-api-key>
```

---

## Monitoring

| Metric | Tool |
|--------|------|
| Function invocations | Convex dashboard |
| Error rates | Convex dashboard |
| API usage | Reddit/Gemini dashboards |
| Frontend performance | Vercel analytics |

---

## Future Enhancements

1. **More data sources** - HN, G2, ProductHunt, Twitter
2. **Competitor analysis** - Compare products side-by-side
3. **Trend tracking** - Sentiment over time
4. **Alerts** - Notify when sentiment changes significantly
5. **Export** - PDF/CSV report downloads
6. **API access** - Let users integrate programmatically
