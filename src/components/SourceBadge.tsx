import { cn } from "@/lib/utils";

interface SourceBadgeProps {
  source: "reddit" | "hackernews" | "stackoverflow" | "devto";
  className?: string;
}

const SourceBadge = ({ source, className }: SourceBadgeProps) => {
  const config = {
    reddit: {
      label: "Reddit",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
      textColor: "text-orange-700 dark:text-orange-400",
    },
    hackernews: {
      label: "HN",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
      textColor: "text-amber-700 dark:text-amber-400",
    },
    stackoverflow: {
      label: "SO",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      textColor: "text-blue-700 dark:text-blue-400",
    },
    devto: {
      label: "DEV",
      bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
      textColor: "text-indigo-700 dark:text-indigo-400",
    },
  };

  const { label, bgColor, textColor } = config[source];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        bgColor,
        textColor,
        className
      )}
    >
      {label}
    </span>
  );
};

export default SourceBadge;
