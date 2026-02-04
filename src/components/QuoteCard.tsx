import { Quote as QuoteType } from "@/data/mockData";
import SourceBadge from "./SourceBadge";
import { ExternalLink, Quote } from "lucide-react";

interface QuoteCardProps {
  quote: QuoteType;
}

const QuoteCard = ({ quote }: QuoteCardProps) => {
  return (
    <div className="bg-secondary/50 rounded-lg p-4 border border-border/50 hover:border-border transition-colors">
      <div className="flex items-start gap-3">
        <Quote className="w-5 h-5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-relaxed mb-3">
            "{quote.text}"
          </p>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <SourceBadge source={quote.source} />
              <span className="text-xs text-muted-foreground">
                {quote.author} · {new Date(quote.date).toLocaleDateString()}
              </span>
            </div>
            <a
              href={quote.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline flex items-center gap-1"
            >
              View source
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteCard;
