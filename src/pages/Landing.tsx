import { BarChart2, ArrowRightLeft, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
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
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto animate-fade-up animation-delay-200">
            Transform scattered feedback from Reddit, HackerNews, Stack
            Overflow, and Dev.to into actionable insights in under 5 minutes.
          </p>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto animate-fade-up animation-delay-300">
            <Link
              to="/analyze"
              className="group bg-card border border-border rounded-2xl p-8 text-left flex flex-col gap-4 shadow-sm hover:border-accent/60 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <BarChart2 className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  Product Intelligence
                </h2>
                <p className="text-sm text-muted-foreground">
                  Analyze sentiment and surface key insights for a single
                  product from across the web.
                </p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-accent group-hover:gap-2 transition-all">
                Analyze a product <ArrowRight className="w-4 h-4" />
              </span>
            </Link>

            <Link
              to="/compare"
              className="group bg-card border border-border rounded-2xl p-8 text-left flex flex-col gap-4 shadow-sm hover:border-accent/60 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <ArrowRightLeft className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  Compare Products
                </h2>
                <p className="text-sm text-muted-foreground">
                  Place two products side by side and compare their sentiment
                  scores across all dimensions.
                </p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-accent group-hover:gap-2 transition-all">
                Compare now <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
