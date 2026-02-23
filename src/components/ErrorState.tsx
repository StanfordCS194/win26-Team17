import { AlertTriangle, RefreshCw, ArrowLeft, WifiOff, Clock, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  error: string | null;
  productName?: string;
  onRetry?: () => void;
  onBack: () => void;
  isRetrying?: boolean;
}

// Categorize errors for better messaging
function categorizeError(error: string | null): {
  icon: React.ReactNode;
  title: string;
  description: string;
  canRetry: boolean;
} {
  const errorLower = (error || "").toLowerCase();

  if (errorLower.includes("rate limit") || errorLower.includes("429")) {
    return {
      icon: <Clock className="w-12 h-12 text-amber-500" />,
      title: "Rate Limited",
      description: "We're making too many requests. Please wait a moment and try again.",
      canRetry: true,
    };
  }

  if (errorLower.includes("network") || errorLower.includes("fetch") || errorLower.includes("timeout")) {
    return {
      icon: <WifiOff className="w-12 h-12 text-red-500" />,
      title: "Connection Error",
      description: "Unable to connect to the server. Please check your internet connection.",
      canRetry: true,
    };
  }

  if (errorLower.includes("not found") || errorLower.includes("no data") || errorLower.includes("no public discussions") || errorLower.includes("limited data")) {
    return {
      icon: <AlertTriangle className="w-12 h-12 text-amber-500" />,
      title: "No Data Found",
      description: error || "We couldn't find enough discussions about this product. Try a more specific software product name.",
      canRetry: false,
    };
  }

  if (errorLower.includes("server") || errorLower.includes("500") || errorLower.includes("503")) {
    return {
      icon: <ServerCrash className="w-12 h-12 text-red-500" />,
      title: "Server Error",
      description: "Something went wrong on our end. Our team has been notified.",
      canRetry: true,
    };
  }

  if (errorLower.includes("invalid") || errorLower.includes("validation")) {
    return {
      icon: <AlertTriangle className="w-12 h-12 text-amber-500" />,
      title: "Invalid Input",
      description: error || "Please check your input and try again.",
      canRetry: false,
    };
  }

  // Default error
  return {
    icon: <AlertTriangle className="w-12 h-12 text-red-500" />,
    title: "Something Went Wrong",
    description: error || "An unexpected error occurred. Please try again.",
    canRetry: true,
  };
}

const ErrorState = ({ error, productName, onRetry, onBack, isRetrying }: ErrorStateProps) => {
  const { icon, title, description, canRetry } = categorizeError(error);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          {icon}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-foreground mb-3">
          {title}
        </h2>

        {/* Description */}
        <p className="text-muted-foreground mb-2">
          {description}
        </p>

        {/* Product name if available */}
        {productName && (
          <p className="text-sm text-muted-foreground mb-6">
            Product: <span className="font-medium">{productName}</span>
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          {canRetry && onRetry && (
            <Button
              onClick={onRetry}
              disabled={isRetrying}
              className="gradient-accent text-accent-foreground"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Search
          </Button>
        </div>

        {/* Keyboard hint */}
        <p className="text-xs text-muted-foreground mt-6">
          Press <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">Esc</kbd> to go back
        </p>
      </div>
    </div>
  );
};

export default ErrorState;
