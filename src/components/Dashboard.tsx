import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getSessionId, getUserId } from "@/lib/session";
import { ProductReport } from "@/types/report";
import ScoreGauge from "./ScoreGauge";
import InsightCard from "./InsightCard";
import AspectScoreCard from "./AspectScore";
import ConfidenceIndicator from "./ConfidenceIndicator";
import IssueRadar from "./IssueRadar";
import { ArrowLeft, Calendar, Database, FileText, RefreshCw, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardProps {
  report: ProductReport;
  reportId: Id<"productReports">;
  onBack: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const Dashboard = ({ report, reportId, onBack, onRefresh, isRefreshing }: DashboardProps) => {
  const [copied, setCopied] = useState(false);
  const [defensibilitySubmitted, setDefensibilitySubmitted] = useState(false);
  const recordEvent = useMutation(api.analytics.recordEvent);
  const recordDefensibilityRating = useMutation(api.analytics.recordDefensibilityRating);

  useEffect(() => {
    recordEvent({
      eventType: "dashboard_viewed",
      sessionId: getSessionId(),
      userId: getUserId(),
      reportId,
      timestamp: Date.now(),
    }).catch(() => {});
  }, [recordEvent, reportId]);

  // Check if report is older than 24 hours
  const reportAge = Date.now() - new Date(report.generatedAt).getTime();
  const isStale = reportAge > 24 * 60 * 60 * 1000;

  const handleDefensibilityRating = (score: number) => {
    recordDefensibilityRating({
      reportId,
      sessionId: getSessionId(),
      score,
      timestamp: Date.now(),
    }).catch(() => {});
    setDefensibilitySubmitted(true);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}?product=${encodeURIComponent(report.productName)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Analyze another product
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleShare}
              className="text-muted-foreground"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </>
              )}
            </Button>

            {onRefresh && (
              <Button
                variant="outline"
                onClick={onRefresh}
                disabled={isRefreshing}
                className={isStale ? "border-amber-500 text-amber-600 hover:bg-amber-50" : ""}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Refreshing..." : isStale ? "Refresh (stale)" : "Refresh"}
              </Button>
            )}
          </div>
        </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {report.aspects.map((aspect, index) => (
              <AspectScoreCard key={aspect.name} aspect={aspect} index={index} />
            ))}
          </div>
        </section>

        {/* Confidence & Issue Radar */}
        <section className="mb-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ConfidenceIndicator confidence={report.confidence} />
            <IssueRadar items={report.issueRadar} />
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
                  reportId={reportId}
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
                  reportId={reportId}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Defensibility prompt */}
        {!defensibilitySubmitted && (
          <div className="mt-10 p-6 bg-card rounded-xl border border-border">
            <p className="text-sm font-medium text-foreground mb-3">
              I could share this with my team or leadership
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <Button
                  key={score}
                  variant="outline"
                  size="sm"
                  className="w-10 h-10 p-0"
                  onClick={() => handleDefensibilityRating(score)}
                >
                  {score}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            This report was generated using AI-powered analysis of public feedback from
            Reddit, HackerNews, Stack Overflow, Dev.to, and G2. All insights are backed by direct user quotes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
