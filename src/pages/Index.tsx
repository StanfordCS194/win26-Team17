import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Header from "@/components/Header";
import SearchHero from "@/components/SearchHero";
import LoadingState from "@/components/LoadingState";
import Dashboard from "@/components/Dashboard";
import { ProductReport } from "@/types/report";

type ViewState = "search" | "loading" | "dashboard";

const Index = () => {
  const [view, setView] = useState<ViewState>("search");
  const [searchQuery, setSearchQuery] = useState("");

  const report = useQuery(
    api.reports.getByProductName,
    searchQuery ? { productName: searchQuery } : "skip"
  );

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setView("loading");
  };

  // Transition from loading → dashboard once the query resolves
  if (view === "loading" && report !== undefined) {
    setView("dashboard");
  }

  const handleBack = () => {
    setView("search");
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {view === "search" && (
        <SearchHero onSearch={handleSearch} isLoading={false} />
      )}

      {view === "loading" && <LoadingState productName={searchQuery} />}

      {view === "dashboard" && report && (
        <Dashboard report={report as ProductReport} onBack={handleBack} />
      )}

      {view === "dashboard" && !report && (
        <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold text-foreground mb-3">
              No report found
            </h2>
            <p className="text-muted-foreground mb-6">
              We don't have a report for "{searchQuery}" yet. Check back later or
              try a different product.
            </p>
            <button
              onClick={handleBack}
              className="px-6 py-3 rounded-lg bg-accent text-accent-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              Search again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
