import { Activity } from "lucide-react";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg gradient-accent flex items-center justify-center shadow-glow">
            <Activity className="w-5 h-5 text-accent-foreground" />
          </div>
          <span className="text-xl font-semibold text-foreground tracking-tight">
            PulseCheck
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <span className="text-foreground font-medium">Product Intelligence</span>
          <span className="px-2 py-1 rounded-md bg-accent/10 text-accent text-xs font-medium">
            Beta
          </span>
        </nav>
      </div>
    </header>
  );
};

export default Header;
