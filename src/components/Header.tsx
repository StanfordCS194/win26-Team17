import { Activity, ArrowRightLeft } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const Header = () => {
  const location = useLocation();
  const isCompare = location.pathname === "/compare";

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
          <Link
            to="/"
            className={cn(
              "hover:text-foreground transition-colors",
              !isCompare && "text-foreground font-medium"
            )}
          >
            Product Intelligence
          </Link>
          <Link
            to="/compare"
            className={cn(
              "flex items-center gap-1.5 hover:text-foreground transition-colors",
              isCompare && "text-foreground font-medium"
            )}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Compare
          </Link>
          <span className="px-2 py-1 rounded-md bg-accent/10 text-accent text-xs font-medium">
            Beta
          </span>
        </nav>
      </div>
    </header>
  );
};

export default Header;
