# KPI Tracking Implementation Plan

**Owner:** KPI lead (you)  
**Goal:** Design and implement a systematic way to track all six KPIs.  
**GitHub issue:** Design systematic way to track KPIs

---

## Definitions

- **Completion (report completion):** A session is “complete” when the same `sessionId` has both a `search_submitted` event and a `dashboard_viewed` event. **Report completion rate** = (sessions that completed / sessions that submitted a search) × 100.
- **Session:** Identified by `sessionId` from `getSessionId()` (stored in `localStorage` under `pulsecheck_session_id`). One session = one browser/device visit until the storage is cleared.
- **User:** Currently the same as session (no persistent user ID across devices). For “return usage” we would use a long-lived anonymous ID; not yet implemented.
- **First interaction (time to insight):** For sessions that have both `search_submitted` and `dashboard_viewed`, we take the earliest timestamp of each and compute the difference. Only sessions where `dashboard_viewed` &gt; `search_submitted` are included. **Time to insight** = average of those differences (in seconds or minutes).
- **Source:** A data source that contributed mentions to a report (e.g. Reddit, G2). **Source coverage** = count of unique sources per report; stored as `sourcesAnalyzed` on each report.
- **Evidence engagement:** A session that viewed the dashboard is “engaged with evidence” if it has at least one `quote_engaged` event (user expanded “Show evidence quotes” on an insight). **Evidence engagement rate** = (sessions with quote_engaged / sessions with dashboard_viewed) × 100.
- **Defensibility score:** 1–5 rating from the in-app prompt “I could share this with my team or leadership,” stored per report/session in `defensibilityRatings`. **Insight defensibility score** = average of all ratings.
- **Return usage:** A **user** is identified by a long-lived `userId` from `getUserId()` (localStorage key `pulsecheck_user_id`). **Return usage rate** = (users who ran a second report within 7 days of their first / users who ran at least one report) × 100. “Second report within 7 days” = same user has 2+ `search_submitted` events and the second event’s timestamp is within 7 days of the first.

---

## How we track this

| KPI | Events / data | Convex query | Notes |
|-----|----------------|-------------|--------|
| Report completion rate | `search_submitted`, `dashboard_viewed` (by sessionId) | `getReportCompletionRate` | 80%+ target |
| Time to insight | Earliest `search_submitted` and `dashboard_viewed` per session | `getAverageTimeToInsight` | &lt;5 min target |
| Evidence engagement rate | `dashboard_viewed`, `quote_engaged` (by sessionId) | `getEvidenceEngagementRate` | 60%+ target |
| Insight defensibility score | `defensibilityRatings` table | `getDefensibilityScore` | 4/5 average target |
| Source coverage per report | `productReports.sourcesAnalyzed` (complete reports) | `getSourceCoverageStats` | 2+ sources target |
| Return usage rate | `search_submitted` with `userId` (long-lived); 2nd search within 7 days | `getReturnUsageRate` | 40%+ target; uses `getUserId()` |

All of the above (except return usage) are also returned in one call via **`getKPIDashboard`**. Internal KPI page: `/kpis`.

**Where we store data:** Convex only. Tables: `analyticsEvents` (event types above), `defensibilityRatings` (reportId, sessionId, score, timestamp).

---

## Phase 1: Define & Document (Do First)

| Step | Action | Output |
|------|--------|--------|
| **1.1** | Write exact definitions for each KPI in one place (what counts as “complete”, “session”, “user”, “first interaction”, “source”). | Definitions doc (e.g. in this file or `MEASURING_FOR_SUCCESS.md`) |
| **1.2** | Map each KPI to required data: which events, which fields, frontend vs backend. | Event/data mapping table |
| **1.3** | Decide where analytics data will live: Convex-only, or Convex + external (e.g. PostHog/Mixpanel). Document the choice. | One-page “where we store what” |
| **1.4** | Decide identity model: anonymous ID in `localStorage` only, or future auth. Document how “user” and “session” are defined for return usage and completion. | Identity/session spec (short) |

---

## Phase 2: Backend Foundation

| Step | Action | Output |
|------|--------|--------|
| **2.1** | Add Convex schema for analytics: e.g. `analyticsEvents` (event type, reportId, sessionId, userId, timestamp, payload) and optionally `feedback` (e.g. defensibility rating, reportId, sessionId). | Updated `convex/schema.ts` (or new tables) |
| **2.2** | Add mutations/actions to record: “search submitted” (productName, timestamp), “report delivered” (reportId, timestamp). Ensure report creation flow calls these so “time to insight” has a clear start time. | New or updated Convex functions |
| **2.3** | Add a way to store “defensibility” rating (1–5) linked to report/session. | Mutation + optional table or field |
| **2.4** | Document how “source coverage per report” is computed (e.g. from existing `sourcesAnalyzed` or new field). Add a simple Convex query or dashboard query for “average sources per report” and “reports with 2+ sources”. | Query + one-line note in plan |

---

## Phase 3: Frontend Events (Instrumentation)

| Step | Action | Output |
|------|--------|--------|
| **3.1** | Introduce session ID (and optional anonymous user ID) on first load; persist in `localStorage` so return visits can be recognized. | Session/user ID helper used across app |
| **3.2** | On “Analyze” submit: send event “search_submitted” (productName, sessionId, userId, timestamp). | Event fired from search flow |
| **3.3** | When dashboard is shown for a completed report: send “dashboard_viewed” (reportId, sessionId, timestamp). | Event fired from dashboard mount/visibility |
| **3.4** | On first meaningful interaction on dashboard (e.g. first scroll or first click on insight/quote): send “first_dashboard_interaction” (reportId, sessionId, timestamp). | Event fired once per report view |
| **3.5** | On expand/view of a quote (or insight card): send “quote_engaged” or “insight_quote_viewed” (reportId, insight type, sessionId). | Event fired from quote/insight components |
| **3.6** | After report is viewed, show a short in-app prompt: “I could share this with my team or leadership” 1–5. On submit, send rating to backend (reportId, sessionId, score). | Defensibility prompt component + backend call |

---

## Phase 4: Aggregation & Reporting

| Step | Action | Output |
|------|--------|--------|
| **4.1** | Implement (or document) computation for each KPI: report completion rate, time to insight, evidence engagement rate, return usage rate, defensibility score, source coverage. Prefer Convex queries or scheduled jobs. | Queries/scripts that produce KPI numbers |
| **4.2** | Create a single place to view KPIs: e.g. internal Convex dashboard, simple admin page, or exported CSV/Notion. | “KPI dashboard” or runbook |
| **4.3** | Add a short “How we track this” column or section to your “Measuring for Success” doc so each KPI points to the same event names and data source. | Updated OKR/KPI doc |

---

## Phase 5: Ownership & Cadence

| Step | Action | Output |
|------|--------|--------|
| **5.1** | Set a weekly review (e.g. every Monday): run KPI numbers, note trends, update score key if needed. | Recurring calendar invite + 1-paragraph “how we review” |
| **5.2** | Tie KPI results to OKR scoring monthly: e.g. “KR1 on track because completion rate is X%”. | One bullet in monthly OKR update |
| **5.3** | Document who owns KPI review and where the definitions live (link this plan + definitions). | README or team doc update |

### Ownership & cadence (process)

- **Owner:** KPI lead (see top of this doc). They are responsible for reviewing KPIs and updating the “Measuring for Success” OKR/KPI scores.
- **Weekly review:** Open the internal KPI dashboard at **`/kpis`** (e.g. every Monday). Note completion rate, time to insight, evidence engagement, defensibility, return usage, and source coverage. Note any trend (up/down) and whether targets are met. No formal report required; this is for the team to stay aware.
- **Monthly OKR link:** When scoring OKRs (e.g. 0 / 0.3 / 0.5 / 0.7 / 1.0), use the KPI numbers as evidence. Example: “KR1 scored 0.5 because report completion rate is 72% (target 80%+) and 3 users shared a report in a product decision.”
- **Where definitions live:** This file (`docs/KPI_TRACKING_PLAN.md`) contains the **Definitions** and **How we track this** sections above. Link here from any “Measuring for Success” or OKR doc so the team knows how each KPI is defined and where the data comes from.

---

## Checklist Summary

- [ ] Phase 1: Definitions, event mapping, storage decision, identity/session spec
- [ ] Phase 2: Convex schema + functions for events and feedback; source coverage query
- [ ] Phase 3: Session/user ID, 5 frontend events + defensibility prompt
- [ ] Phase 4: KPI computations + single place to view them + doc update
- [ ] Phase 5: Weekly review, monthly OKR link, ownership doc

---

## Suggested Order (If Doing Sequentially)

1. **1.1 → 1.2 → 1.3 → 1.4** (definitions and design; unblocks everything).
2. **2.1 → 2.2** (backend can record “search submitted” and “report delivered”).
3. **3.1 → 3.2 → 3.3 → 3.4** (completion + time to insight).
4. **4.1** for completion and time-to-insight (so you can already measure two KPIs).
5. **3.5** then **4.1** for evidence engagement.
6. **2.3 → 3.6** then **4.1** for defensibility.
7. **2.4** and **4.1** for source coverage (quick win).
8. **3.1** (user ID) + **4.1** for return usage.
9. **4.2 → 4.3 → Phase 5** (dashboard, docs, cadence).

You can parallelize after Phase 1: e.g. one person on backend (Phase 2), another on frontend events (Phase 3).
