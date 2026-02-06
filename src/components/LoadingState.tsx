import { Activity, Search, BarChart3, CheckCircle2, FileText } from "lucide-react";

interface LoadingStateProps {
  productName: string;
  status?: "pending" | "fetching" | "analyzing" | "complete" | "error";
}

const steps = [
  { id: "pending", icon: Search, label: "Starting analysis..." },
  { id: "fetching", icon: FileText, label: "Fetching Reddit discussions..." },
  { id: "analyzing", icon: BarChart3, label: "Analyzing sentiment..." },
  { id: "complete", icon: CheckCircle2, label: "Generating report..." },
];

const LoadingState = ({ productName, status = "pending" }: LoadingStateProps) => {
  const currentStepIndex = steps.findIndex((s) => s.id === status);
  const progress = Math.max(10, ((currentStepIndex + 1) / steps.length) * 100);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">
        {/* Pulsing Logo */}
        <div className="relative mb-8">
          <div className="w-20 h-20 rounded-2xl gradient-accent flex items-center justify-center mx-auto shadow-glow animate-pulse-ring">
            <Activity className="w-10 h-10 text-accent-foreground" />
          </div>
          <div className="absolute inset-0 w-20 h-20 rounded-2xl gradient-accent opacity-30 blur-xl mx-auto" />
        </div>

        {/* Product Name */}
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Analyzing {productName}
        </h2>
        <p className="text-muted-foreground mb-8">
          Gathering feedback from Reddit...
        </p>

        {/* Steps */}
        <div className="space-y-4 mb-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === status;
            const isComplete = index < currentStepIndex;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                  isActive
                    ? "bg-accent/10 text-foreground"
                    : isComplete
                    ? "text-pulse-positive"
                    : "text-muted-foreground/50"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : isComplete
                      ? "bg-pulse-positive-light text-pulse-positive"
                      : "bg-secondary"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className={`w-5 h-5 ${isActive ? "animate-pulse" : ""}`} />
                  )}
                </div>
                <span className="text-sm font-medium">{step.label}</span>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
          <div
            className="h-full gradient-accent transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          This may take 30-60 seconds
        </p>
      </div>
    </div>
  );
};

export default LoadingState;
