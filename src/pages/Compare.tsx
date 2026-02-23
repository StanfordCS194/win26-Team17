import { useState, useCallback, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { getSessionSearches, addSessionSearch } from "@/lib/sessionSearchHistory";
import { api } from "../../convex/_generated/api";
import Header from "@/components/Header";
import ScoreGauge from "@/components/ScoreGauge";
import { CompareCharts } from "@/components/CompareCharts";
import { ProductReport } from "@/types/report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowRightLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

const MIN_LENGTH = 2;
const MAX_LENGTH = 100;

type AreaStatus = "idle" | "loading" | "ready" | "error";

const toProductReport = (r: {
  productName: string;
  overallScore?: number;
  totalMentions?: number;
  sourcesAnalyzed?: number;
  generatedAt: string;
  summary?: string;
  strengths?: ProductReport["strengths"];
  issues?: ProductReport["issues"];
  aspects?: ProductReport["aspects"];
}): ProductReport => ({
  productName: r.productName,
  overallScore: r.overallScore ?? 50,
  totalMentions: r.totalMentions ?? 0,
  sourcesAnalyzed: r.sourcesAnalyzed ?? 1,
  generatedAt: r.generatedAt,
  summary: r.summary ?? "",
  strengths: r.strengths ?? [],
  issues: r.issues ?? [],
  aspects: r.aspects ?? [],
});

const Compare = () => {
  const [area1Query, setArea1Query] = useState("");
  const [area2Query, setArea2Query] = useState("");
  const [area1Status, setArea1Status] = useState<AreaStatus>("idle");
  const [area2Status, setArea2Status] = useState<AreaStatus>("idle");
  const [area1Error, setArea1Error] = useState<string | null>(null);
  const [area2Error, setArea2Error] = useState<string | null>(null);
  const [sessionSearches, setSessionSearches] = useState<string[]>(getSessionSearches);

  const analyzeProduct = useAction(api.reports.analyzeProduct);
  const report1 = useQuery(
    api.reports.getByProductName,
    area1Query.trim() ? { productName: area1Query.trim() } : "skip"
  );
  const report2 = useQuery(
    api.reports.getByProductName,
    area2Query.trim() ? { productName: area2Query.trim() } : "skip"
  );

  const runAnalysis = useCallback(
    async (area: 1 | 2, productName: string) => {
      const setStatus = area === 1 ? setArea1Status : setArea2Status;
      const setError = area === 1 ? setArea1Error : setArea2Error;
      const setQuery = area === 1 ? setArea1Query : setArea2Query;
      const trimmed = productName.trim();
      if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) return;
      setQuery(trimmed);
      setSessionSearches(addSessionSearch(trimmed));
      setError(null);
      setStatus("loading");
      try {
        await analyzeProduct({ productName: trimmed });
        // "ready" is set in useEffect when report.status === "complete"
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analysis failed");
        setStatus("error");
      }
    },
    [analyzeProduct]
  );

  // Sync status from Convex reports
  useEffect(() => {
    if (!area1Query.trim() || report1 === undefined) return;
    if (report1?.status === "complete" && area1Status === "loading") setArea1Status("ready");
    if (report1?.status === "error" && area1Status === "loading") {
      setArea1Error(report1.errorMessage ?? "Error");
      setArea1Status("error");
    }
  }, [area1Query, report1, area1Status]);
  useEffect(() => {
    if (!area2Query.trim() || report2 === undefined) return;
    if (report2?.status === "complete" && area2Status === "loading") setArea2Status("ready");
    if (report2?.status === "error" && area2Status === "loading") {
      setArea2Error(report2.errorMessage ?? "Error");
      setArea2Status("error");
    }
  }, [area2Query, report2, area2Status]);

  const report1Complete = report1?.status === "complete";
  const report2Complete = report2?.status === "complete";
  const canCompare = report1Complete && report2Complete;
  const r1 = report1Complete ? toProductReport(report1) : null;
  const r2 = report2Complete ? toProductReport(report2) : null;

  const allAspectNames = Array.from(
    new Set([
      ...(r1?.aspects.map((a) => a.name) ?? []),
      ...(r2?.aspects.map((a) => a.name) ?? []),
    ])
  ).sort();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Title */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
              <ArrowRightLeft className="w-4 h-4" />
              Compare areas
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Compare search results
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Analyze two products side by side. Enter a product name for each area or pick from
              existing reports.
            </p>
          </div>

          {/* Two-area search */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            {/* Area 1 */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-1">Area 1</h2>
              <p className="text-sm text-muted-foreground mb-4">First product or search</p>
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Product name..."
                  value={area1Query}
                  onChange={(e) => setArea1Query(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runAnalysis(1, area1Query)}
                  className="flex-1"
                />
                <Button
                  onClick={() => runAnalysis(1, area1Query)}
                  disabled={
                    area1Query.trim().length < MIN_LENGTH ||
                    area1Query.trim().length > MAX_LENGTH ||
                    area1Status === "loading"
                  }
                >
                  {area1Status === "loading" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {sessionSearches.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sessionSearches.slice(0, 5).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setArea1Query(name);
                        runAnalysis(1, name);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              {area1Error && (
                <p className="mt-2 text-sm text-destructive">{area1Error}</p>
              )}
            </div>

            {/* Area 2 */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-1">Area 2</h2>
              <p className="text-sm text-muted-foreground mb-4">Second product or search</p>
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Product name..."
                  value={area2Query}
                  onChange={(e) => setArea2Query(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runAnalysis(2, area2Query)}
                  className="flex-1"
                />
                <Button
                  onClick={() => runAnalysis(2, area2Query)}
                  disabled={
                    area2Query.trim().length < MIN_LENGTH ||
                    area2Query.trim().length > MAX_LENGTH ||
                    area2Status === "loading"
                  }
                >
                  {area2Status === "loading" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {sessionSearches.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sessionSearches.slice(0, 5).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setArea2Query(name);
                        runAnalysis(2, name);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              {area2Error && (
                <p className="mt-2 text-sm text-destructive">{area2Error}</p>
              )}
            </div>
          </div>

          {/* Comparison results */}
          {canCompare && r1 && r2 && (
            <div className="space-y-8 animate-fade-up">
              {/* Overall score row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card rounded-2xl border border-border p-6 flex flex-col items-center">
                  <p className="text-sm font-medium text-muted-foreground mb-2">{r1.productName}</p>
                  <ScoreGauge score={r1.overallScore} size="lg" label="Overall sentiment" />
                </div>
                <div className="bg-card rounded-2xl border border-border p-6 flex flex-col items-center">
                  <p className="text-sm font-medium text-muted-foreground mb-2">{r2.productName}</p>
                  <ScoreGauge score={r2.overallScore} size="lg" label="Overall sentiment" />
                </div>
              </div>

              {/* Interactive charts */}
              {allAspectNames.length > 0 && r1 && r2 && (
                <CompareCharts
                  r1={r1}
                  r2={r2}
                  aspectNames={allAspectNames}
                />
              )}

              {/* Summary row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Summary — {r1.productName}
                  </h3>
                  <p className="text-foreground text-sm leading-relaxed line-clamp-4">
                    {r1.summary}
                  </p>
                </div>
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Summary — {r2.productName}
                  </h3>
                  <p className="text-foreground text-sm leading-relaxed line-clamp-4">
                    {r2.summary}
                  </p>
                </div>
              </div>

              {/* Aspect comparison table */}
              {allAspectNames.length > 0 && (
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <h3 className="text-lg font-semibold text-foreground p-4 border-b border-border">
                    Aspect comparison
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                            Aspect
                          </th>
                          <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                            {r1.productName}
                          </th>
                          <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                            {r2.productName}
                          </th>
                          <th className="text-center p-3 text-sm font-medium text-muted-foreground w-24">
                            Difference
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {allAspectNames.map((name) => {
                          const a1 = r1.aspects.find((a) => a.name === name);
                          const a2 = r2.aspects.find((a) => a.name === name);
                          const s1 = a1?.score ?? null;
                          const s2 = a2?.score ?? null;
                          const diff =
                            s1 !== null && s2 !== null ? s1 - s2 : null;
                          return (
                            <tr key={name} className="border-b border-border/80 hover:bg-muted/30">
                              <td className="p-3 font-medium text-foreground">{name}</td>
                              <td className="p-3 text-right">
                                {s1 !== null ? (
                                  <span
                                    className={
                                      s1 >= 70
                                        ? "text-pulse-positive"
                                        : s1 >= 50
                                          ? "text-pulse-neutral"
                                          : "text-pulse-negative"
                                    }
                                  >
                                    {s1}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                {s2 !== null ? (
                                  <span
                                    className={
                                      s2 >= 70
                                        ? "text-pulse-positive"
                                        : s2 >= 50
                                          ? "text-pulse-neutral"
                                          : "text-pulse-negative"
                                    }
                                  >
                                    {s2}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {diff !== null ? (
                                  <span
                                    className={
                                      diff > 0
                                        ? "text-pulse-positive font-medium"
                                        : diff < 0
                                          ? "text-pulse-negative font-medium"
                                          : "text-muted-foreground"
                                    }
                                  >
                                    {diff > 0 ? "+" : ""}
                                    {diff}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground justify-center">
                <span>
                  {r1.productName}: {r1.totalMentions} mentions, {r1.sourcesAnalyzed} sources
                </span>
                <span>•</span>
                <span>
                  {r2.productName}: {r2.totalMentions} mentions, {r2.sourcesAnalyzed} sources
                </span>
              </div>
            </div>
          )}

          {!canCompare && (area1Query || area2Query) && (
            <p className="text-center text-muted-foreground py-8">
              Run analysis for both areas to see the comparison. You can also{" "}
              <Link to="/" className="text-accent hover:underline">
                analyze a single product
              </Link>{" "}
              from the home page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Compare;
