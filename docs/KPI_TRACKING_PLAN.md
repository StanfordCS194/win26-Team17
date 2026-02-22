# KPI Tracking Implementation Plan

**Owner:** KPI lead (you)  
**Goal:** Design and implement a systematic way to track all six KPIs.  
**GitHub issue:** Design systematic way to track KPIs

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
