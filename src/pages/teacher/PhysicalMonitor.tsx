import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import QrScanner from "qr-scanner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Check, ChevronRight, QrCode, Square } from "lucide-react";
import { SQUARE_TYPES, parseKitQR, parseSquareQR, dispensePhysicalQuestion, type SquareType, type PhysicalQuestion } from "@/lib/physicalGames";

interface Props { session: any; sessionId: string; }

type Phase = "kit" | "ready" | "question" | "rest";

const PhysicalMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";

  const [kitId, setKitId] = useState<string | null>(session?.kit_id ?? null);
  const [phase, setPhase] = useState<Phase>(session?.kit_id ? "ready" : "kit");
  const [current, setCurrent] = useState<{ q: PhysicalQuestion; type: SquareType } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const kitIdRef = useRef(kitId);
  kitIdRef.current = kitId;
  const busyRef = useRef(false);
  const lastUnrecognizedToastRef = useRef(0);

  const warnUnrecognized = (raw: string) => {
    const now = Date.now();
    if (now - lastUnrecognizedToastRef.current < 2000) return; // avoid spamming while an unmatched code sits in frame
    lastUnrecognizedToastRef.current = now;
    toast.error(ar ? `رمز غير معروف: ${raw.slice(0, 40)}` : `Unrecognized code: ${raw.slice(0, 40)}`);
  };

  const scanning = phase === "kit" || phase === "ready";

  useEffect(() => {
    if (!scanning || !videoRef.current) return;
    const scanner = new QrScanner(
      videoRef.current,
      (result) => handleScan(result.data),
      // 2/sec is plenty for pointing a phone at a printed square, and it stops
      // the outline from re-drawing frantically while a code sits in frame.
      { highlightScanRegion: true, highlightCodeOutline: false, maxScansPerSecond: 2 }
    );
    scannerRef.current = scanner;
    scanner.start().catch((e: any) => setCameraError(e?.message || String(e)));
    return () => { scanner.stop(); scanner.destroy(); scannerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const handleScan = async (raw: string) => {
    if (busyRef.current) return;
    if (phaseRef.current === "kit") {
      const kid = parseKitQR(raw);
      if (!kid) { warnUnrecognized(raw); return; }
      busyRef.current = true;
      await connectKit(kid);
      busyRef.current = false;
      return;
    }
    if (phaseRef.current === "ready") {
      const parsed = parseSquareQR(raw);
      if (!parsed) { warnUnrecognized(raw); return; }
      if (parsed.kitId !== kitIdRef.current) {
        toast.error(ar ? "هذا الرمز من لوحة مختلفة" : "This square is from a different kit");
        return;
      }
      busyRef.current = true;
      await handleSquare(parsed.typeCode);
      busyRef.current = false;
    }
  };

  const connectKit = async (kid: string) => {
    setBusy(true);
    try {
      const { data: kit } = await supabase.from("kits").select("*").eq("id", kid).maybeSingle();
      if (!kit || kit.status !== "active") {
        toast.error(ar ? "هذه اللوحة غير مفعّلة" : "This kit isn't active");
        return;
      }
      await supabase.from("game_sessions").update({ kit_id: kid }).eq("id", sessionId);
      setKitId(kid);
      setPhase("ready"); // the Connected pill on the ready screen says this already
    } finally {
      setBusy(false);
    }
  };

  const handleSquare = async (typeCode: number) => {
    setBusy(true);
    try {
      const result = await dispensePhysicalQuestion(sessionId, session.quiz_id, typeCode);
      if (result.kind === "error") {
        toast.error(ar ? "لا توجد أسئلة في هذا الاختبار" : "This quiz has no questions");
        return;
      }
      if (result.kind === "rest") { setPhase("rest"); return; }
      setCurrent({ q: result.q, type: result.type });
      setRevealed(false);
      setPhase("question");
    } finally {
      setBusy(false);
    }
  };

  const backToScan = () => { setCurrent(null); setPhase("ready"); };

  const endGame = async () => {
    if (!confirm(ar ? "إنهاء اللعبة الآن؟" : "End the game now?")) return;
    await supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", sessionId);
    nav("/app");
  };

  return (
    <div className="min-h-full p-4 md:p-8" style={{ background: "hsl(var(--background))" }} dir={ar ? "rtl" : "ltr"}>
      <div className="max-w-md mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border-2 border-[hsl(var(--nb-border))] bg-white shadow-[2px_2px_0_0_hsl(var(--nb-border))] text-[#5b4636]">
            <QrCode className="h-3.5 w-3.5" />
            {ar ? "الألعاب الفيزيائية" : "Physical Games"}
          </div>
          <button onClick={endGame} className="text-xs font-semibold text-red-500 hover:underline">
            {ar ? "إنهاء اللعبة" : "End game"}
          </button>
        </div>

        {phase === "kit" && (
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-[#3F5A63]">{ar ? "امسح رمز اللوحة" : "Scan the board's QR"}</h1>
            <p className="text-sm text-black/50">{ar ? "الرمز الموجود على اللوحة نفسها، وليس على أحد المربعات" : "The code printed on the board itself, not on a square"}</p>
          </div>
        )}
        {phase === "ready" && (
          <div className="text-center space-y-2.5">
            <h1 className="text-xl font-bold text-[#3F5A63]">{ar ? "جاهز — امسح مربعاً" : "Ready — scan a square"}</h1>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white shadow-[2px_2px_0_0_hsl(var(--nb-border))]">
              <span className="h-2 w-2 rounded-full bg-[#3a9e6e] animate-pulse shrink-0" />
              <span className="text-xs font-semibold text-black/55">{ar ? "متصل" : "Connected"}</span>
              <span className="font-mono text-sm font-black tracking-widest text-[#3F5A63]">{kitId}</span>
            </div>
          </div>
        )}

        {scanning && (
          <div className="rounded-3xl overflow-hidden border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))] bg-black aspect-square relative">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {busy && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-semibold">
                {ar ? "جارٍ التحميل..." : "Loading..."}
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 bg-white/95 flex items-center justify-center p-4 text-center text-sm text-black/70">
                {ar ? "تعذّر الوصول إلى الكاميرا. تحقّق من أذونات المتصفح." : "Couldn't access the camera. Check browser permissions."}
              </div>
            )}
          </div>
        )}

        {phase === "rest" && (
          <div className="rounded-3xl p-8 text-center space-y-4 border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]" style={{ background: SQUARE_TYPES[4].color, color: "white" }}>
            <Square className="h-8 w-8 mx-auto opacity-80" />
            <div className="text-2xl font-bold">{ar ? "استراحة" : "Rest square"}</div>
            <p className="text-sm opacity-90">{ar ? "لا يوجد سؤال هنا — الدور التالي" : "No question here — next team's turn"}</p>
            <button onClick={backToScan} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold bg-white/95 text-[#3F5A63]">
              <ChevronRight className="h-4 w-4" />
              {ar ? "متابعة" : "Continue"}
            </button>
          </div>
        )}

        {phase === "question" && current && (
          <div className="rounded-3xl p-6 space-y-4 bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]">
            <div className="flex items-center justify-between">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white"
                style={{ background: current.type.color }}
              >
                {ar ? current.type.label_ar : current.type.label_en}
              </span>
              {current.type.kind === "double" && (
                <span className="text-xs font-bold text-[#e0b400]">×2</span>
              )}
            </div>

            <p className="text-lg font-semibold text-[#3F5A63] leading-relaxed">{current.q.text}</p>

            <div className="space-y-2">
              {current.q.options.map((opt, oi) => {
                const isCorrect = oi === current.q.correct_index;
                return (
                  <div
                    key={oi}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm transition-colors ${
                      revealed && isCorrect
                        ? "border-success bg-success/10 font-semibold"
                        : "border-[hsl(var(--nb-border))]"
                    }`}
                  >
                    <div className={`h-6 w-6 shrink-0 rounded flex items-center justify-center text-xs font-bold ${revealed && isCorrect ? "bg-success text-success-foreground" : "bg-muted"}`}>
                      {revealed && isCorrect ? <Check className="h-3.5 w-3.5" /> : ["A", "B", "C", "D"][oi]}
                    </div>
                    {opt}
                  </div>
                );
              })}
            </div>

            {!revealed ? (
              <button onClick={() => setRevealed(true)} className="w-full rounded-xl py-3 text-sm font-bold border-2 border-[hsl(var(--nb-border))] bg-[#8FC44A] text-[#3F5A63]">
                {ar ? "أظهر الإجابة" : "Reveal answer"}
              </button>
            ) : (
              <button onClick={backToScan} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold border-2 border-[hsl(var(--nb-border))] bg-[#3F5A63] text-white">
                <ChevronRight className="h-4 w-4" />
                {ar ? "امسح المربع التالي" : "Scan next square"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PhysicalMonitor;
