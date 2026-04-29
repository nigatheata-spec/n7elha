import { cn } from "@/lib/utils";
import logoMark from "@/assets/logo-mark.png";

export const Logo = ({ className, withText = true }: { className?: string; withText?: boolean }) => (
  <div className={cn("flex items-center gap-2", className)}>
    <img src={logoMark} alt="n7elha" className="h-9 w-9 object-contain" />
    {withText && <span className="text-xl font-bold tracking-tight text-foreground">n7elha</span>}
  </div>
);
