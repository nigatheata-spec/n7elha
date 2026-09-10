import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Play } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { createSampleQuiz } from "@/lib/sampleQuiz";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

/** One tap: a sample quiz appears in the teacher's account and the host screen
 *  opens. The empty states use this so a new teacher's first minute ends with
 *  a room code on the board, not a blank page. */
export const TryGameButton = ({ className }: { className?: string }) => {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const id = await createSampleQuiz(user.id, i18n.language);
      nav(`/app/host/${id}`);   // the host screen opening is the confirmation
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <button onClick={go} disabled={busy}
      className={cn("inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white font-bold text-sm disabled:opacity-60 active:scale-95 transition-transform", className)}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
      {ar ? "جرّب لعبة خلال دقيقة" : "Try a game in 60 seconds"}
    </button>
  );
};
