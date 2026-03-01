import { useRef, useState } from "react";
import { Activity, ArrowRightLeft, HelpCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const HOVER_CLOSE_DELAY = 100;

const Header = () => {
  const location = useLocation();
  const isCompare = location.pathname === "/compare";
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpPinned, setHelpPinned] = useState(false);
  const helpLeaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHelpLeaveTimeout = () => {
    if (helpLeaveTimeoutRef.current !== null) {
      clearTimeout(helpLeaveTimeoutRef.current);
      helpLeaveTimeoutRef.current = null;
    }
  };

  const scheduleHelpClose = () => {
    clearHelpLeaveTimeout();
    if (helpPinned) return;
    helpLeaveTimeoutRef.current = setTimeout(() => setHelpOpen(false), HOVER_CLOSE_DELAY);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 rounded-lg gradient-accent flex items-center justify-center shadow-glow">
            <Activity className="w-5 h-5 text-accent-foreground" />
          </div>
          <span className="text-xl font-semibold text-foreground tracking-tight">
            PulseCheck
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/"
                className={cn(
                  "hover:text-foreground transition-colors",
                  !isCompare && "text-foreground font-medium"
                )}
              >
                Product Intelligence
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>Get a full report and sentiment analysis for one product.</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/compare"
                className={cn(
                  "flex items-center gap-1.5 hover:text-foreground transition-colors",
                  isCompare && "text-foreground font-medium"
                )}
              >
                <ArrowRightLeft className="w-4 h-4" />
                Compare products
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>Compare two products side by side.</p>
            </TooltipContent>
          </Tooltip>
          <Popover open={helpOpen} onOpenChange={(open) => { setHelpOpen(open); if (!open) setHelpPinned(false); }}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="Explain navigation options"
                onMouseEnter={() => { clearHelpLeaveTimeout(); setHelpOpen(true); }}
                onMouseLeave={scheduleHelpClose}
                onClick={() => { const next = !helpOpen; setHelpOpen(next); setHelpPinned(next); }}
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              className="max-w-sm"
              onMouseEnter={clearHelpLeaveTimeout}
              onMouseLeave={scheduleHelpClose}
            >
              <p className="font-medium mb-1">Navigation options</p>
              <ul className="text-xs space-y-0.5 text-muted-foreground">
                <li><strong className="text-foreground">Product Intelligence:</strong> Get a full report and sentiment analysis for one product.</li>
                <li><strong className="text-foreground">Compare products:</strong> Compare two products side by side.</li>
              </ul>
            </PopoverContent>
          </Popover>
          <span className="px-2 py-1 rounded-md bg-accent/10 text-accent text-xs font-medium">
            Beta
          </span>
        </nav>
      </div>
    </header>
  );
};

export default Header;
