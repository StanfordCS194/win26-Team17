import { useState } from "react";
import Header from "@/components/Header";
import SearchHero from "@/components/SearchHero";
import LoadingState from "@/components/LoadingState";
import Dashboard from "@/components/Dashboard";
import { ProductReport } from "@/data/mockData";
import { fetchReport } from "@/lib/api";

type ViewState = "search" | "loading" | "dashboard" | "error";

const Index = () => {
  const [view, setView] = useState<ViewState>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [report, setReport] = useState<ProductReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setView("loading");
    setError(null);
    try {
      const data = await fetchReport(query);
      setReport(data);
      setView("dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setView("error");
    }
  };

  const handleBack = () => {
    setView("search");
    setReport(null);
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {view === "search" && (
        <SearchHero onSearch={handleSearch} isLoading={false} />
      )}

      {view === "loading" && <LoadingState productName={searchQuery} />}

      {view === "error" && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <p className="text-destructive font-medium mb-2">Could not load report</p>
          <p className="text-muted-foreground text-sm mb-6 max-w-md text-center">
            {error}
          </p>
          <button
            type="button"
            onClick={() => { setView("search"); setError(null); }}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Back to search
          </button>
        </div>
      )}

      {view === "dashboard" && report && (
        <Dashboard report={report} onBack={handleBack} />
      )}
    </div>
  );
};

export default Index;
