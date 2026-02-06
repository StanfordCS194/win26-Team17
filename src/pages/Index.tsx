import { useState, useEffect, useCallback } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import Header from "@/components/Header";
import SearchHero from "@/components/SearchHero";
import LoadingState from "@/components/LoadingState";
import Dashboard from "@/components/Dashboard";
import { ProductReport } from "@/types/report";

type ViewState = "search" | "loading" | "dashboard" | "error";

const Index = () => {
  const [view, setView] = useState<ViewState>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportId, setReportId] = useState<Id<"productReports"> | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const analyzeProduct = useAction(api.reports.analyzeProduct);

  // Check for product in URL on mount
  useEffect(() => {
    if (initialLoadDone) return;

    const params = new URLSearchParams(window.location.search);
    const productParam = params.get("product");

    if (productParam) {
      setSearchQuery(productParam);
      setView("loading");
      setIsAnalyzing(true);

      analyzeProduct({ productName: productParam })
        .then((result) => {
          setReportId(result.reportId);
        })
        .catch((err) => {
          console.error("Failed to load product from URL:", err);
          setError("Failed to load product. Please try again.");
          setView("error");
          setIsAnalyzing(false);
        });
    }

    setInitialLoadDone(true);
  }, [initialLoadDone, analyzeProduct]);

  // Query for the report by product name
  const report = useQuery(
    api.reports.getByProductName,
    searchQuery ? { productName: searchQuery } : "skip"
  );

  // Handle status changes
  useEffect(() => {
    if (view !== "loading") return;

    if (report === undefined) {
      // Still loading from Convex
      return;
    }

    if (report === null) {
      // No report found (shouldn't happen if pipeline started)
      return;
    }

    if (report.status === "complete") {
      setView("dashboard");
      setIsAnalyzing(false);
    } else if (report.status === "error") {
      setView("error");
      setError(report.errorMessage || "An error occurred");
      setIsAnalyzing(false);
    }
    // If pending/fetching/analyzing, stay in loading view
  }, [report, view]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setError(null);
    setView("loading");
    setIsAnalyzing(true);

    try {
      const result = await analyzeProduct({ productName: query });
      setReportId(result.reportId);
    } catch (err) {
      console.error("Failed to start analysis:", err);
      setError("Failed to start analysis. Please try again.");
      setView("error");
      setIsAnalyzing(false);
    }
  };

  const handleBack = useCallback(() => {
    setView("search");
    setSearchQuery("");
    setReportId(null);
    setError(null);
  }, []);

  // Escape key to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (view === "dashboard" || view === "error")) {
        handleBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, handleBack]);

  const handleRefresh = async () => {
    if (!searchQuery) return;

    setError(null);
    setView("loading");
    setIsAnalyzing(true);

    try {
      const result = await analyzeProduct({ productName: searchQuery, forceRefresh: true });
      setReportId(result.reportId);
    } catch (err) {
      console.error("Failed to refresh analysis:", err);
      setError("Failed to refresh analysis. Please try again.");
      setView("error");
      setIsAnalyzing(false);
    }
  };

  // Convert Convex report to ProductReport type (handle optional fields)
  const toProductReport = (r: NonNullable<typeof report>): ProductReport => ({
    productName: r.productName,
    overallScore: r.overallScore ?? 50,
    totalMentions: r.totalMentions ?? 0,
    sourcesAnalyzed: r.sourcesAnalyzed ?? 1,
    generatedAt: r.generatedAt,
    summary: r.summary ?? "Analysis in progress...",
    strengths: r.strengths ?? [],
    issues: r.issues ?? [],
    aspects: r.aspects ?? [],
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {view === "search" && (
        <SearchHero onSearch={handleSearch} isLoading={isAnalyzing} />
      )}

      {view === "loading" && (
        <LoadingState
          productName={searchQuery}
          status={report?.status}
        />
      )}

      {view === "dashboard" && report && report.status === "complete" && (
        <Dashboard
          report={toProductReport(report)}
          onBack={handleBack}
          onRefresh={handleRefresh}
          isRefreshing={isAnalyzing}
        />
      )}

      {view === "error" && (
        <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Something went wrong
            </h2>
            <p className="text-muted-foreground mb-6">
              {error || "We couldn't analyze this product. Please try again."}
            </p>
            <button
              onClick={handleBack}
              className="px-6 py-3 rounded-lg bg-accent text-accent-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
