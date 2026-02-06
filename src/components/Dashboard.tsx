import { ProductReport } from "@/types/report";
import ScoreGauge from "./ScoreGauge";
import InsightCard from "./InsightCard";
import AspectScoreCard from "./AspectScore";
import { ArrowLeft, Calendar, Database, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardProps {
  report: ProductReport;
  onBack: () => void;
}

const Dashboard = ({ report, onBack }: DashboardProps) => {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Analyze another product
        </Button>

        {/* Header Section */}
        <div className="bg-card rounded-2xl border border-border p-8 mb-8 animate-fade-up">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Product Info */}
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                {report.productName}
              </h1>
              <p className="text-muted-foreground mb-4">Product Intelligence Report</p>

              {/* Meta Info */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Generated{" "}
                    {new Date(report.generatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Database className="w-4 h-4" />
                  <span>{report.sourcesAnalyzed} sources</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span>{report.totalMentions.toLocaleString()} mentions analyzed</span>
                </div>
              </div>
            </div>

            {/* Overall Score */}
            <div className="flex-shrink-0">
              <ScoreGauge
                score={report.overallScore}
                size="lg"
                label="Overall Sentiment"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="mt-6 pt-6 border-t border-border">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Executive Summary
            </h2>
            <p className="text-foreground leading-relaxed">{report.summary}</p>
          </div>
        </div>

        {/* Aspect Scores */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-foreground mb-4">
            Aspect Analysis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {report.aspects.map((aspect, index) => (
              <AspectScoreCard key={aspect.name} aspect={aspect} index={index} />
            ))}
          </div>
        </section>

        {/* Strengths & Issues Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Strengths */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-pulse-positive" />
              <h2 className="text-xl font-bold text-foreground">Top Strengths</h2>
            </div>
            <div className="space-y-4">
              {report.strengths.map((strength, index) => (
                <InsightCard
                  key={index}
                  insight={strength}
                  type="strength"
                  index={index}
                />
              ))}
            </div>
          </section>

          {/* Issues */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-pulse-negative" />
              <h2 className="text-xl font-bold text-foreground">Top Issues to Fix</h2>
            </div>
            <div className="space-y-4">
              {report.issues.map((issue, index) => (
                <InsightCard
                  key={index}
                  insight={issue}
                  type="issue"
                  index={index}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            This report was generated using AI-powered analysis of public feedback from
            Reddit and G2. All insights are backed by direct user quotes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
