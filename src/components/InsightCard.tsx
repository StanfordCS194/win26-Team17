import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getSessionId, getUserId } from "@/lib/session";
import { Insight } from "@/types/report";
import QuoteCard from "./QuoteCard";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  insight: Insight;
  type: "strength" | "issue";
  index: number;
  reportId?: Id<"productReports">;
}

const InsightCard = ({ insight, type, index, reportId }: InsightCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const recordEvent = useMutation(api.analytics.recordEvent);

  const isStrength = type === "strength";
  const accentColor = isStrength ? "pulse-positive" : "pulse-negative";
  const accentBg = isStrength ? "bg-pulse-positive-light" : "bg-pulse-negative-light";
  const accentText = isStrength ? "text-pulse-positive" : "text-pulse-negative";

  return (
    <div
      className={cn(
        "bg-card rounded-xl border border-border overflow-hidden transition-shadow hover:shadow-md animate-fade-up",
        `animation-delay-${(index + 1) * 100}`
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Number badge */}
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0",
              accentBg,
              accentText
            )}
          >
            {index + 1}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {insight.title}
            </h3>
            <p className="text-sm text-muted-foreground">{insight.description}</p>

            {/* Frequency indicator */}
            <div className="flex items-center gap-2 mt-3">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                <span className={cn("font-semibold", accentText)}>
                  {insight.frequency}
                </span>{" "}
                mentions
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expand/Collapse */}
      <button
        onClick={() => {
          const next = !isExpanded;
          if (next && reportId) {
            recordEvent({
              eventType: "quote_engaged",
              sessionId: getSessionId(),
              userId: getUserId(),
              reportId,
              timestamp: Date.now(),
            }).catch(() => {});
          }
          setIsExpanded(next);
        }}
        className="w-full px-5 py-3 border-t border-border bg-secondary/30 flex items-center justify-between hover:bg-secondary/50 transition-colors"
      >
        <span className="text-sm font-medium text-muted-foreground">
          {isExpanded ? "Hide" : "Show"} evidence quotes ({insight.quotes.length})
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Quotes Section */}
      {isExpanded && (
        <div className="p-5 pt-4 border-t border-border space-y-3">
          {insight.quotes.map((quote, qIndex) => (
            <QuoteCard key={qIndex} quote={quote} />
          ))}
        </div>
      )}
    </div>
  );
};

export default InsightCard;
