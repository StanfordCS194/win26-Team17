import { ConfidenceIndicator as ConfidenceType } from "@/types/report";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfidenceIndicatorProps {
  confidence: ConfidenceType;
}

const getColor = (value: number) => {
  if (value >= 0.7) return "bg-pulse-positive";
  if (value >= 0.4) return "bg-pulse-neutral";
  return "bg-pulse-negative";
};

const getTextColor = (value: number) => {
  if (value >= 0.7) return "text-pulse-positive";
  if (value >= 0.4) return "text-pulse-neutral";
  return "text-pulse-negative";
};

const metrics: { key: keyof Omit<ConfidenceType, "overall">; label: string }[] = [
  { key: "coverage", label: "Coverage" },
  { key: "agreement", label: "Agreement" },
  { key: "sourceDiversity", label: "Source Diversity" },
];

const ConfidenceIndicator = ({ confidence }: ConfidenceIndicatorProps) => {
  const pct = Math.round(confidence.overall * 100);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className={cn("w-5 h-5", getTextColor(confidence.overall))} />
        <h3 className="text-lg font-semibold text-foreground">Data Confidence</h3>
        <span className={cn("ml-auto text-2xl font-bold", getTextColor(confidence.overall))}>
          {pct}%
        </span>
      </div>

      <div className="space-y-3">
        {metrics.map(({ key, label }) => {
          const value = confidence[key];
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-medium text-foreground">
                  {Math.round(value * 100)}%
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", getColor(value))}
                  style={{ width: `${Math.round(value * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConfidenceIndicator;
