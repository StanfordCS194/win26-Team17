# KPI Code Walkthrough

This document maps each KPI from the frontend event that generates the data, through the Convex backend functions that process it, to the field displayed on the internal dashboard at `/kpis`.

For definitions, targets, and ownership see `docs/KPI_TRACKING_PLAN.md`.

---

## Data Storage

All KPI data lives in Convex. No external analytics service is used.

| Table | What it stores |
|-------|---------------|
| `analyticsEvents` | User interaction events (`search_submitted`, `dashboard_viewed`, `quote_engaged`) |
| `defensibilityRatings` | Legacy 1–5 defensibility ratings linked to a report and session |
| `feedback` | Multi-dimension survey responses (usefulness, ease of use, relevance, NPS, defensibility) |
| `productReports` | Completed reports; `sourcesAnalyzed` field powers source coverage KPI |

---

## Event Firing (Frontend)

| Event | Fired in | Trigger |
|-------|----------|---------|
| `search_submitted` | `src/pages/Index.tsx` (lines 42, 120) | User submits a product search, or product is loaded from URL param |
| `dashboard_viewed` | `src/components/Dashboard.tsx` (line 46) | Dashboard component mounts for a completed report |
| `quote_engaged` | `src/components/InsightCard.tsx` (line 75) | User expands "Show evidence quotes" on an insight card |

All events are recorded via the `recordEvent` mutation in `convex/analytics.ts`. Each event includes `sessionId` (from `localStorage` via `src/lib/session.ts`), an optional `userId`, an optional `reportId`, and a `timestamp`.

---

## KPI Calculations (Backend)

All KPIs are computed in `convex/analytics.ts`. They are individually available as separate queries, and all roll up into a single `getKPIDashboard` query that the `/kpis` page calls.

### Report Completion Rate
- **Target:** 80%+
- **Events used:** `search_submitted`, `dashboard_viewed`
- **Logic:** Count unique `sessionId`s with a `search_submitted` event. Of those, count how many also have a `dashboard_viewed` event. Rate = completions / searches.
- **Standalone query:** `getReportCompletionRate`
- **Dashboard field:** `data.completionRate`, `data.totalSearches`, `data.totalCompletions`

### Time to Insight
- **Target:** under 5 minutes
- **Events used:** `search_submitted`, `dashboard_viewed`
- **Logic:** For each session that has both events, take the earliest timestamp of each and compute the difference. Average across all qualifying sessions.
- **Standalone query:** `getAverageTimeToInsight`
- **Dashboard fields:** `data.averageTimeToInsightMinutes`, `data.averageTimeToInsightSeconds`, `data.totalSessionsMeasured`

### Evidence Engagement Rate
- **Target:** 60%+
- **Events used:** `dashboard_viewed`, `quote_engaged`
- **Logic:** Count unique sessions with a `dashboard_viewed` event. Of those, count how many also have at least one `quote_engaged` event. Rate = engaged / dashboard sessions.
- **Standalone query:** `getEvidenceEngagementRate`
- **Dashboard fields:** `data.evidenceEngagementRate`, `data.sessionsWithQuoteEngaged`, `data.totalDashboardSessions`

### Insight Defensibility Score
- **Target:** 4 / 5 average
- **Data sources:** `defensibilityRatings` table + `feedback.defensibility` field
- **Logic:** Average all 1–5 scores across both tables.
- **Standalone query:** `getDefensibilityScore`
- **Dashboard fields:** `data.defensibilityAverage`, `data.defensibilityCount`

### Source Coverage
- **Target:** 2+ sources per report
- **Data source:** `productReports.sourcesAnalyzed` field on completed reports
- **Logic:** Average `sourcesAnalyzed` across all complete reports; count reports with 2 or more sources.
- **Standalone query:** `getSourceCoverageStats`
- **Dashboard fields:** `data.averageSourcesAnalyzed`, `data.reportsWithTwoOrMoreSources`

### Return Usage Rate
- **Target:** 40%+
- **Events used:** `search_submitted`
- **Logic:** Group `search_submitted` events by `sessionId`. For each session, sort timestamps. If the second search occurred within 7 days of the first, count that session as a return. Rate = returning sessions / sessions with at least one search.
- **Standalone query:** `getReturnUsageRate`
- **Dashboard fields:** `data.returnUsageRate`, `data.totalSessionsWithOneSearch`, `data.sessionsWithSecondWithin7Days`

---

## Dashboard Rollup

`getKPIDashboard` (`convex/analytics.ts`) runs all of the above in a single query by fetching `analyticsEvents`, `defensibilityRatings`, `feedback`, and `productReports` once and computing every metric in memory. This is what `src/pages/KPIDashboard.tsx` calls via:

```ts
const data = useQuery(api.analytics.getKPIDashboard);
```

The `/kpis` page is internal only and not linked from the main navigation.

---

## Adding a New KPI

1. Decide which event(s) it needs. Add new event types to the `eventTypeValidator` union in `convex/analytics.ts` if required.
2. Fire the event from the relevant frontend component using `recordEvent`.
3. Add the computation to `getKPIDashboard` (and optionally as a standalone query).
4. Display the result in `src/pages/KPIDashboard.tsx`.
5. Update `docs/KPI_TRACKING_PLAN.md` with the new definition and target.
