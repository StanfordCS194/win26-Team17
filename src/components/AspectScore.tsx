import { AspectScore as AspectScoreType } from "@/types/report";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AspectScoreProps {
  aspect: AspectScoreType;
  index: number;
}

const AspectScoreCard = ({ aspect, index }: AspectScoreProps) => {
  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-pulse-positive";
    if (score >= 50) return "bg-pulse-neutral";
    return "bg-pulse-negative";
  };

  const getScoreTextColor = (score: number) => {
    if (score >= 70) return "text-pulse-positive";
    if (score >= 50) return "text-pulse-neutral";
    return "text-pulse-negative";
  };

  const getTrendIcon = () => {
    switch (aspect.trend) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-pulse-positive" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-pulse-negative" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTrendLabel = () => {
    switch (aspect.trend) {
      case "up":
        return "Improving";
      case "down":
        return "Declining";
      default:
        return "Stable";
    }
  };

  return (
    <div
      className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow animate-fade-up"
      style={{ animationDelay: `${(index + 3) * 100}ms` }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{aspect.name}</h3>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {getTrendIcon()}
          <span>{getTrendLabel()}</span>
        </div>
      </div>

      {/* Score Display */}
      <div className="flex items-end gap-3 mb-4">
        <span className={cn("text-4xl font-bold", getScoreTextColor(aspect.score))}>
          {aspect.score}
        </span>
        <span className="text-sm text-muted-foreground mb-1">/ 100</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-secondary rounded-full h-2 mb-3 overflow-hidden">
        <div
          className={cn("h-full rounded-full score-bar", getScoreColor(aspect.score))}
          style={{ width: `${aspect.score}%` }}
        />
      </div>

      {/* Mentions */}
      <p className="text-sm text-muted-foreground">
        Based on <span className="font-medium text-foreground">{aspect.mentions}</span>{" "}
        mentions
      </p>
    </div>
  );
};

export default AspectScoreCard;
