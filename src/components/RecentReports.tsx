import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Clock, TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";

interface RecentReportsProps {
  onSelect: (productName: string) => void;
  isLoading: boolean;
}

const RecentReports = ({ onSelect, isLoading }: RecentReportsProps) => {
  const recentReports = useQuery(api.reports.listRecentReports, { limit: 6 });

  if (!recentReports || recentReports.length === 0) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600";
    if (score >= 50) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 70) return <TrendingUp className="w-4 h-4" />;
    if (score >= 50) return <Minus className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="mt-12 w-full max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">Recent Reports</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {recentReports.map((report) => (
          <button
            key={report.productName}
            onClick={() => onSelect(report.productName)}
            disabled={isLoading}
            className="group p-4 rounded-lg bg-card border border-border hover:border-accent/50 hover:shadow-md transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground truncate group-hover:text-accent transition-colors">
                  {report.productName}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {report.totalMentions} mentions
                </p>
              </div>

              <div className={`flex items-center gap-1 ${getScoreColor(report.overallScore)}`}>
                {getScoreIcon(report.overallScore)}
                <span className="text-sm font-semibold">{report.overallScore}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <span>{formatDate(report.generatedAt)}</span>
              {report.isExpired && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="w-3 h-3" />
                  Stale
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default RecentReports;
