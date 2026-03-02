import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const KPIDashboard = () => {
  const data = useQuery(api.analytics.getKPIDashboard);
  const [lastViewed, setLastViewed] = useState<string>("");

  useEffect(() => {
    if (data) {
      setLastViewed(new Date().toLocaleString());
    }
  }, [data]);

  if (data === undefined) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading KPIs...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl font-bold text-foreground">
            PulseCheck — Internal KPI Dashboard
          </h1>
          {lastViewed && (
            <p className="text-sm text-muted-foreground mt-1">
              Last viewed: {lastViewed}
            </p>
          )}
        </header>

        <div className="bg-muted/50 rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">About this data</p>
          <p>
            All metrics are computed from analytics events and feedback stored in the database (full dataset, no time window). Low numbers (e.g. &quot;Total searches: 1&quot;, &quot;Sessions with 1+ search: 1&quot;) mean there have been few sessions so far—typical for a new deployment or internal testing. Completion rate, time to insight, evidence engagement, and Return usage are all session-based: we count unique sessions (e.g. sessions with at least one search, sessions that viewed a dashboard, sessions that did a second search within 7 days). As more people use the app, the dashboard will reflect the larger sample.
          </p>
        </div>

        <section className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Report Completion Rate
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <span className="text-muted-foreground">Completion rate: </span>
              <span className="font-medium">{data.completionRate}%</span>
            </li>
            <li>
              <span className="text-muted-foreground">Total searches: </span>
              <span className="font-medium">{data.totalSearches}</span>
            </li>
            <li>
              <span className="text-muted-foreground">Total completions: </span>
              <span className="font-medium">{data.totalCompletions}</span>
            </li>
          </ul>
        </section>

        <section className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Time to Insight
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <span className="text-muted-foreground">Average time: </span>
              <span className="font-medium">
                {data.averageTimeToInsightMinutes} minutes
              </span>
              <span className="text-muted-foreground ml-2">
                ({data.averageTimeToInsightSeconds} seconds)
              </span>
            </li>
            <li>
              <span className="text-muted-foreground">Sessions measured: </span>
              <span className="font-medium">{data.totalSessionsMeasured}</span>
            </li>
          </ul>
        </section>

        <section className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Source Coverage
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <span className="text-muted-foreground">
                Average sources per report:{" "}
              </span>
              <span className="font-medium">
                {Math.round(data.averageSourcesAnalyzed * 10) / 10}
              </span>
            </li>
            <li>
              <span className="text-muted-foreground">
                Reports with 2+ sources:{" "}
              </span>
              <span className="font-medium">
                {data.reportsWithTwoOrMoreSources}
              </span>
            </li>
          </ul>
        </section>

        <section className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Evidence Engagement
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <span className="text-muted-foreground">Engagement rate: </span>
              <span className="font-medium">
                {data.evidenceEngagementRate}%
              </span>
            </li>
            <li>
              <span className="text-muted-foreground">
                Sessions with quote viewed/expanded:{" "}
              </span>
              <span className="font-medium">
                {data.sessionsWithQuoteEngaged}
              </span>
            </li>
            <li>
              <span className="text-muted-foreground">
                Total dashboard sessions:{" "}
              </span>
              <span className="font-medium">
                {data.totalDashboardSessions}
              </span>
            </li>
          </ul>
        </section>

        <section className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Insight Defensibility Score
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <span className="text-muted-foreground">Average score (1–5): </span>
              <span className="font-medium">{data.defensibilityAverage}</span>
            </li>
            <li>
              <span className="text-muted-foreground">Total ratings: </span>
              <span className="font-medium">{data.defensibilityCount}</span>
            </li>
          </ul>
        </section>

        <section className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Feedback (survey)
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <span className="text-muted-foreground">Usefulness (1–5 avg): </span>
              <span className="font-medium">{data.usefulnessAverage ?? "—"}</span>
            </li>
            <li>
              <span className="text-muted-foreground">Ease of use (1–5 avg): </span>
              <span className="font-medium">{data.easeOfUseAverage ?? "—"}</span>
            </li>
            <li>
              <span className="text-muted-foreground">Relevance (1–5 avg): </span>
              <span className="font-medium">{data.relevanceAverage ?? "—"}</span>
            </li>
            <li>
              <span className="text-muted-foreground">Feedback responses: </span>
              <span className="font-medium">{data.feedbackCount ?? 0}</span>
            </li>
            <li>
              <span className="text-muted-foreground">NPS average (0–10): </span>
              <span className="font-medium">{data.npsAverage ?? "—"}</span>
            </li>
            <li>
              <span className="text-muted-foreground">NPS score (promoters − detractors): </span>
              <span className="font-medium">{data.npsScore != null ? data.npsScore : "—"}</span>
            </li>
          </ul>
        </section>

        <section className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Return Usage Rate
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <span className="text-muted-foreground">Return rate (2nd search within 7 days): </span>
              <span className="font-medium">{data.returnUsageRate}%</span>
            </li>
            <li>
              <span className="text-muted-foreground">Sessions with 1+ search: </span>
              <span className="font-medium">{data.totalSessionsWithOneSearch}</span>
            </li>
            <li>
              <span className="text-muted-foreground">Sessions with 2nd search within 7 days: </span>
              <span className="font-medium">{data.sessionsWithSecondWithin7Days}</span>
            </li>
          </ul>
        </section>

        <p className="text-xs text-muted-foreground text-center pt-4">
          This page is for internal use only. Data updates in real time.
        </p>
      </div>
    </div>
  );
};

export default KPIDashboard;
