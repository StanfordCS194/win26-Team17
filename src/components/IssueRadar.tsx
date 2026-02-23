import { IssueRadarItem } from "@/types/report";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface IssueRadarProps {
  items: IssueRadarItem[];
}

const getSeverityColor = (score: number) => {
  if (score >= 40) return "bg-pulse-negative";
  if (score >= 15) return "bg-pulse-neutral";
  return "bg-pulse-positive";
};

const getSeverityTextColor = (score: number) => {
  if (score >= 40) return "text-pulse-negative";
  if (score >= 15) return "text-pulse-neutral";
  return "text-pulse-positive";
};

const IssueRadar = ({ items }: IssueRadarProps) => {
  const maxScore = Math.max(...items.map((i) => i.score), 1);
  const hasIssues = items.some((i) => i.score > 0);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-pulse-negative" />
        <h3 className="text-lg font-semibold text-foreground">Issue Radar</h3>
      </div>

      {!hasIssues ? (
        <p className="text-sm text-muted-foreground">No significant issues detected.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.aspect}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-foreground">
                  {item.aspect}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {item.mentionCount} mentions
                  </span>
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      getSeverityTextColor(item.score)
                    )}
                  >
                    {item.score}
                  </span>
                </div>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    getSeverityColor(item.score)
                  )}
                  style={{ width: `${(item.score / maxScore) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        Higher scores indicate more frequent and more negative feedback.
      </p>
    </div>
  );
};

export default IssueRadar;
