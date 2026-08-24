import { useTranslation } from "react-i18next";
import { Star, Users, Radio } from "lucide-react";

/* The student view rebuilt as live markup rather than a screenshot: it stays sharp
   at any density, needs no asset pipeline, and reads from the same tokens as the
   real game, so it cannot silently drift from what the app actually looks like.
   Colours mirror ANSWER_COLORS in ClassicGame.tsx. */
const ANSWER_COLORS = ["#3a9e6e", "#3F5A63", "#C8783A", "#8B4A3A"];

export const ProductPreview = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const t = isAr
    ? {
        kicker: "من جهة الطالب",
        title: "رمز واحد، ولا شيء يُحمَّل",
        sub: "لا تطبيق يُحمَّل، ولا حساب يُنشأ. يفتح الطالب المتصفح، يكتب رمز الجلسة، ويبدأ اللعب خلال ثوانٍ.",
        q: "أي كوكب يُعرف بالكوكب الأحمر؟",
        a: ["المريخ", "الزهرة", "زحل", "المشتري"],
        you: "أنت",
        code: "رمز الجلسة",
        liveLabel: "مباشر الآن",
        joined: "طالبًا انضموا",
      }
    : {
        kicker: "STUDENT SIDE",
        title: "One code. Nothing to install.",
        sub: "No app to install, no account to create. A student opens the browser, types the session code, and is playing within seconds.",
        q: "Which planet is known as the Red Planet?",
        a: ["Mars", "Venus", "Saturn", "Jupiter"],
        you: "You",
        code: "SESSION CODE",
        liveLabel: "LIVE NOW",
        joined: "students joined",
      };

  return (
    <section className="relative overflow-hidden px-5 sm:px-8 md:px-14 py-16 sm:py-24 border-t border-black/5">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] gap-12 lg:gap-20 items-center">
        <div className="max-w-xl">
          <span className={`text-[12px] font-semibold text-[#FF8254] ${isAr ? "tracking-normal" : "tracking-[0.25em]"}`}>{t.kicker}</span>
          <h2
            className="mt-3 text-[28px] sm:text-[40px] tracking-tight leading-[1.1]"
            style={{ color: "#3F5A63", fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}
          >
            {t.title}
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-black/65">{t.sub}</p>

          {/* Join-code card: the four-character code is the whole onboarding story. */}
          <div className="mt-8 inline-flex items-center gap-5 rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white px-6 py-4 shadow-[5px_5px_0_0_hsl(var(--nb-border))]">
            <div>
              <div className={`text-[10px] font-semibold text-black/40 ${isAr ? "" : "tracking-[0.2em]"}`}>{t.code}</div>
              <div className="mt-1 text-[30px] font-black tabular-nums leading-none tracking-[0.15em] text-[#3F5A63]">
                4821
              </div>
            </div>
            <div className="h-10 w-px bg-black/10" />
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#FF8254] opacity-70 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FF8254]" />
              </span>
              <span className="text-[11px] font-bold text-[#3F5A63]">{t.liveLabel}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-[13px] text-black/50">
            <Users className="h-4 w-4 text-[#3F5A63]" />
            <span><strong className="text-[#3F5A63]">24</strong> {t.joined}</span>
          </div>
        </div>

        {/* ---- phone ---- */}
        <div className="relative mx-auto w-full max-w-[380px]">
          <div className="relative rounded-[3rem] border-4 border-[hsl(var(--nb-border))] bg-[#22333A] p-3 shadow-[10px_10px_0_0_hsl(var(--nb-border))]">
            <div
              className="relative overflow-hidden rounded-[2.35rem] px-5 pb-6 pt-4"
              style={{ background: "hsl(var(--cream-panel))" }}
            >
              {/* notch */}
              <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-black/15" />

              {/* score strip, matching the real header */}
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-bold text-[#3F5A63]">{t.you}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white px-2.5 py-1 text-[12.5px] font-black tabular-nums text-[#3F5A63] shadow-[2px_2px_0_0_hsl(var(--nb-border))]">
                  <Star className="h-3 w-3 fill-[#FF8254] text-[#FF8254]" />
                  2,750
                </span>
              </div>

              {/* question card */}
              <div className="mt-3 rounded-xl border-2 border-[hsl(var(--nb-border))] bg-white p-3 shadow-[3px_3px_0_0_hsl(var(--nb-border))]">
                <p dir="auto" className="text-center text-[14px] font-bold leading-snug text-[#3F5A63]">{t.q}</p>
              </div>

              {/* answers */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {t.a.map((opt, i) => (
                  <div
                    key={opt}
                    dir="auto"
                    className="flex min-h-[64px] items-center justify-center rounded-xl border-2 border-[hsl(var(--nb-border))] px-2 text-center text-[13px] font-bold text-white shadow-[3px_3px_0_0_hsl(var(--nb-border))]"
                    style={{ background: ANSWER_COLORS[i] }}
                  >
                    {opt}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-black/35">
                <Radio className="h-3 w-3" />
                nefelha
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
