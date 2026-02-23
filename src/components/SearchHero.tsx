import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Search, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RecentReports from "./RecentReports";

interface SearchHeroProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

const MIN_LENGTH = 2;
const MAX_LENGTH = 100;

const SearchHero = ({ onSearch, isLoading }: SearchHeroProps) => {
  const [query, setQuery] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestedProducts = useQuery(api.reports.listProductNames) ?? [];

  // Auto-focus search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const validateQuery = (value: string): string | null => {
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed.length < MIN_LENGTH) {
      return `Product name must be at least ${MIN_LENGTH} characters`;
    }
    if (trimmed.length > MAX_LENGTH) {
      return `Product name must be less than ${MAX_LENGTH} characters`;
    }
    return null;
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setValidationError(validateQuery(value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateQuery(query);
    if (error) {
      setValidationError(error);
      return;
    }
    if (query.trim()) {
      setValidationError(null);
      onSearch(query.trim());
    }
  };

  const handleSuggestionClick = (product: string) => {
    setQuery(product);
    onSearch(product);
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 pt-20">
      <div className="text-center max-w-3xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-8 animate-fade-up">
          <Sparkles className="w-4 h-4" />
          <span>AI-Powered Product Intelligence</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight animate-fade-up animation-delay-100">
          Understand how users{" "}
          <span className="text-gradient">really feel</span>
          <br />
          about your product
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-up animation-delay-200">
          Transform scattered feedback from Reddit, G2, and forums into
          actionable insights in under 5 minutes. Evidence-backed analysis for
          confident product decisions.
        </p>

        {/* Search Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto mb-8 animate-fade-up animation-delay-300"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Enter a software product name..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className={`pl-12 h-14 text-base bg-card shadow-md focus:shadow-lg transition-all ${
                validationError
                  ? "border-red-500 focus:border-red-500"
                  : "border-border focus:border-accent"
              }`}
              disabled={isLoading}
              maxLength={MAX_LENGTH + 10}
            />
            {validationError && (
              <p className="absolute -bottom-6 left-0 text-sm text-red-500">
                {validationError}
              </p>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={!query.trim() || isLoading || !!validationError}
            className="h-14 px-8 gradient-accent text-accent-foreground font-semibold shadow-glow hover:opacity-90 transition-opacity"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                Analyzing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Analyze
                <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </Button>
        </form>

        {/* Suggested Products */}
        {suggestedProducts.length > 0 && (
          <div className="animate-fade-up animation-delay-400">
            <p className="text-sm text-muted-foreground mb-3">
              Try it with a popular product:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedProducts.slice(0, 3).map((product) => (
                <button
                  key={product}
                  onClick={() => handleSuggestionClick(product)}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {product}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>


      {/* Recent Reports */}
      <RecentReports onSelect={handleSuggestionClick} isLoading={isLoading} />
    </div>
  );
};

export default SearchHero;
