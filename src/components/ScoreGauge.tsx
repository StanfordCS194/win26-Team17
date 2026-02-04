import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  label?: string;
}

const ScoreGauge = ({ score, size = "md", showLabel = true, label }: ScoreGaugeProps) => {
  const sizeClasses = {
    sm: "w-12 h-12 text-sm",
    md: "w-20 h-20 text-xl",
    lg: "w-28 h-28 text-3xl",
  };

  const getScoreColor = () => {
    if (score >= 70) return "text-pulse-positive";
    if (score >= 50) return "text-pulse-neutral";
    return "text-pulse-negative";
  };

  const getScoreBg = () => {
    if (score >= 70) return "bg-pulse-positive-light";
    if (score >= 50) return "bg-pulse-neutral-light";
    return "bg-pulse-negative-light";
  };

  const getScoreRing = () => {
    if (score >= 70) return "ring-pulse-positive/20";
    if (score >= 50) return "ring-pulse-neutral/20";
    return "ring-pulse-negative/20";
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold ring-4",
          sizeClasses[size],
          getScoreBg(),
          getScoreColor(),
          getScoreRing()
        )}
      >
        {score}
      </div>
      {showLabel && label && (
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
      )}
    </div>
  );
};

export default ScoreGauge;
