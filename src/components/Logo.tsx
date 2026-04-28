import { cn } from "@/lib/utils";

export const Logo = ({ className, withText = true }: { className?: string; withText?: boolean }) => (
  <div className={cn("flex items-center gap-2", className)}>
    <div className="relative h-9 w-9 rounded-lg bg-gradient-cyan shadow-glow flex items-center justify-center">
      <span className="font-mono text-lg font-bold text-primary-foreground">n7</span>
    </div>
    {withText && <span className="text-xl font-bold tracking-tight">n7elha</span>}
  </div>
);
