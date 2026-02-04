import { cn } from "@/lib/utils";

interface SourceBadgeProps {
  source: "reddit" | "g2";
  className?: string;
}

const SourceBadge = ({ source, className }: SourceBadgeProps) => {
  const config = {
    reddit: {
      label: "Reddit",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
      textColor: "text-orange-700 dark:text-orange-400",
    },
    g2: {
      label: "G2",
      bgColor: "bg-red-100 dark:bg-red-900/30",
      textColor: "text-red-700 dark:text-red-400",
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
