import { useEffect, useState } from "react";
import { Activity, Search, FileText, BarChart3, CheckCircle2 } from "lucide-react";

interface LoadingStateProps {
  productName: string;
}

const steps = [
  { icon: Search, label: "Searching Reddit discussions...", duration: 1200 },
  { icon: FileText, label: "Analyzing G2 reviews...", duration: 1500 },
  { icon: BarChart3, label: "Computing sentiment scores...", duration: 1000 },
  { icon: CheckCircle2, label: "Generating insights report...", duration: 800 },
];

const LoadingState = ({ productName }: LoadingStateProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let stepIndex = 0;
    let progressInterval: NodeJS.Timeout;

    const advanceStep = () => {
      if (stepIndex < steps.length - 1) {
        stepIndex++;
        setCurrentStep(stepIndex);
      }
    };

    // Progress animation
    progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 2;
      });
    }, 80);

    // Step transitions
    const timers = steps.slice(0, -1).map((step, index) => {
      const delay = steps.slice(0, index + 1).reduce((acc, s) => acc + s.duration, 0);
      return setTimeout(advanceStep, delay);
    });

    return () => {
      clearInterval(progressInterval);
      timers.forEach(clearTimeout);
    };
  }, []);

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
          Gathering feedback from multiple sources...
        </p>

        {/* Steps */}
        <div className="space-y-4 mb-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isComplete = index < currentStep;

            return (
              <div
                key={index}
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
            className="h-full gradient-accent transition-all duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2">{Math.round(progress)}% complete</p>
      </div>
    </div>
  );
};

export default LoadingState;
