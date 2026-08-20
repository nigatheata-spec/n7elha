import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Square } from "lucide-react";
import { findActiveSessionForKit, dispensePhysicalQuestion, SQUARE_TYPES, type DispenseResult } from "@/lib/physicalGames";

// Public, unauthenticated page opened directly by any phone's camera app when
// it scans a printed square QR — the page load itself IS the scan. Each
// student/team just points their own camera here; there's no lobby or join
// step because dispensePhysicalQuestion is a self-contained DB round trip
// keyed off (session, difficulty), not client-side state shared between
// devices.

const ScanSquare = () => {
  const { kitId, typeCode } = useParams();
  const { i18n } = useTranslation();
  const [state, setState] = useState<"loading" | "no-kit" | "no-session" | "done">("loading");
  const [result, setResult] = useState<DispenseResult | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [ar, setAr] = useState(i18n.language === "ar");
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !kitId || !typeCode) return;
    started.current = true;
    (async () => {
      const found = await findActiveSessionForKit(kitId);
      if ("error" in found) { setState(found.error === "kit-inactive" ? "no-kit" : "no-session"); return; }
      setAr((found.session.settings?.lang ?? i18n.language) === "ar");
      const r = await dispensePhysicalQuestion(found.session.id, found.session.quiz_id, Number(typeCode));
      setResult(r);
      setState("done");
    })();
  }, [kitId, typeCode, i18n.language]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "hsl(40 38% 92%)" }} dir={ar ? "rtl" : "ltr"}>
      <div className="w-full max-w-md">
        {state === "loading" && (
          <div className="text-center text-[#3F5A63] font-semibold">
            {ar ? "جارٍ التحميل..." : "Loading..."}
          </div>
        )}

        {state === "no-kit" && (
          <div className="rounded-3xl p-8 text-center bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]">
            <p className="text-[#3F5A63] font-semibold">{ar ? "هذه اللوحة غير مفعّلة" : "This board isn't active"}</p>
          </div>
        )}

        {state === "no-session" && (
          <div className="rounded-3xl p-8 text-center bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]">
            <p className="text-[#3F5A63] font-semibold">
              {ar ? "لا توجد لعبة نشطة الآن" : "No active game right now"}
            </p>
            <p className="text-sm text-black/50 mt-1">
              {ar ? "اطلب من معلمك بدء وضع الألعاب الفيزيائية" : "Ask your teacher to start Physical Games mode"}
            </p>
          </div>
        )}

        {state === "done" && result?.kind === "rest" && (
          <div className="rounded-3xl p-8 text-center space-y-4 border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]" style={{ background: SQUARE_TYPES[4].color, color: "white" }}>
            <Square className="h-8 w-8 mx-auto opacity-80" />
            <div className="text-2xl font-bold">{ar ? "استراحة" : "Rest square"}</div>
            <p className="text-sm opacity-90">{ar ? "لا يوجد سؤال هنا — الدور التالي" : "No question here — next team's turn"}</p>
          </div>
        )}

        {state === "done" && result?.kind === "error" && (
          <div className="rounded-3xl p-8 text-center bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]">
            <p className="text-[#3F5A63] font-semibold">{ar ? "لا توجد أسئلة في هذا الاختبار" : "This quiz has no questions"}</p>
          </div>
        )}

        {state === "done" && result?.kind === "question" && (
          <div className="rounded-3xl p-6 space-y-4 bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]">
            <div className="flex items-center justify-between">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white"
                style={{ background: result.type.color }}
              >
                {ar ? result.type.label_ar : result.type.label_en}
              </span>
              {result.type.kind === "double" && (
                <span className="text-xs font-bold text-[#e0b400]">×2</span>
              )}
            </div>

            <p className="text-lg font-semibold text-[#3F5A63] leading-relaxed">{result.q.text}</p>

            <div className="space-y-2">
              {result.q.options.map((opt, oi) => {
                const isCorrect = oi === result.q.correct_index;
                return (
                  <div
                    key={oi}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm transition-colors ${
                      revealed && isCorrect ? "border-success bg-success/10 font-semibold" : "border-[hsl(var(--nb-border))]"
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
              <button onClick={() => setRevealed(true)} className="w-full rounded-xl py-3 text-sm font-bold border-2 border-[hsl(var(--nb-border))] bg-[#FF8254] text-white">
                {ar ? "أظهر الإجابة" : "Reveal answer"}
              </button>
            ) : (
              <p className="text-center text-sm text-black/45">
                {ar ? "امسحوا المربع التالي عندما ينتقل الدور" : "Scan the next square when it's your turn again"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanSquare;
