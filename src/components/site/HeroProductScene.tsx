import { useCallback, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import { Avatar } from "@/components/Avatar";

/* The live-classroom moment, rebuilt as real markup.
 *
 * Everything here mirrors the actual game UI — the projector view from
 * ClassicMonitor (room code header, ranked leaderboard rows, neobrutalist
 * borders) and the student answer grid from ClassicGame, down to the real
 * ANSWER_COLORS. It's a staged demo, not a screenshot: it stays sharp at any
 * density, translates with the site, and can't drift out of date the way an
 * exported PNG does.
 *
 * `tilted` adds the perspective + mouse-parallax treatment; without it the
 * same composition renders flat and straight-on.
 */

const ANSWER_COLORS = ["#3a9e6e", "#3F5A63", "#C8783A", "#8B4A3A"];

type Copy = {
  question: string;
  options: string[];
  quizTitle: string;
  players: string;
  you: string;
};

const AR: Copy = {
  question: "أي الكواكب هو الأقرب إلى الشمس؟",
  options: ["عطارد", "الزهرة", "المريخ", "نبتون"],
  quizTitle: "علوم — الوحدة الثالثة",
  players: "٢٨ لاعبًا",
  you: "أنت",
};

const EN: Copy = {
  question: "Which planet is closest to the Sun?",
  options: ["Mercury", "Venus", "Mars", "Neptune"],
  quizTitle: "Science — Unit 3",
  players: "28 players",
  you: "You",
};

const BOARD_AR = [
  { name: "ريم", pts: "٤٬٢٨٠" },
  { name: "عبدالله", pts: "٣٬٩١٥" },
  { name: "سارة", pts: "٣٬٤٤٠" },
  { name: "محمد", pts: "٣٬١٠٢" },
];
const BOARD_EN = [
  { name: "Reem", pts: "4,280" },
  { name: "Abdullah", pts: "3,915" },
  { name: "Sara", pts: "3,440" },
  { name: "Mohammed", pts: "3,102" },
];

const NB = "border-2 border-[hsl(var(--nb-border))]";
const MAX_TILT = 5;

export const HeroProductScene = ({ isAr, tilted = false }: { isAr: boolean; tilted?: boolean }) => {
  const t = isAr ? AR : EN;
  const board = isAr ? BOARD_AR : BOARD_EN;

  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!tilted) return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      setTilt({ x: -ny * MAX_TILT * 2, y: nx * MAX_TILT * 2 });
    },
    [tilted]
  );

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      className="relative w-full select-none"
      style={tilted ? { perspective: "1400px", perspectiveOrigin: "55% 40%" } : undefined}
    >
      <div
        className={tilted ? "transition-transform duration-500 ease-out" : undefined}
        style={
          tilted
            ? {
                transformStyle: "preserve-3d",
                transform: `rotateX(${6 + tilt.x}deg) rotateY(${(isAr ? 8 : -8) + tilt.y}deg) rotateZ(${isAr ? 1 : -1}deg)`,
              }
            : undefined
        }
      >
        {/* ---------- projector / teacher screen ---------- */}
        <div
          className={`relative rounded-2xl bg-[hsl(var(--cream-panel))] ${NB} shadow-[10px_10px_0_0_hsl(var(--nb-border))] overflow-hidden`}
          style={tilted ? { transformStyle: "preserve-3d" } : undefined}
        >
          {/* header — room code is the thing a teacher reads out loud */}
          <div className={`flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-white border-b-2 border-[hsl(var(--nb-border))]`}>
            <div className="min-w-0">
              <div className="text-[10px] font-bold tracking-[0.18em]" style={{ color: "hsl(199 15% 50%)" }}>
                CLASSIC
              </div>
              <div className="text-[13px] sm:text-[15px] font-black truncate" style={{ color: "#3F5A63" }}>
                {t.quizTitle}
              </div>
            </div>
            <div className={`shrink-0 rounded-xl bg-[#8FC44A] px-3 sm:px-4 py-1.5 ${NB} shadow-[3px_3px_0_0_hsl(var(--nb-border))]`}>
              <div className="text-[8px] font-bold tracking-[0.18em] text-[#14212A]/60 leading-none">
                {isAr ? "الرمز" : "CODE"}
              </div>
              <div dir="ltr" className="text-[17px] sm:text-[20px] font-black tabular-nums leading-tight text-[#14212A]">
                7K2D
              </div>
            </div>
            <div className={`shrink-0 rounded-xl bg-white px-3 py-1.5 ${NB} shadow-[3px_3px_0_0_hsl(var(--nb-border))]`}>
              <div dir="ltr" className="text-[17px] sm:text-[20px] font-black tabular-nums leading-tight" style={{ color: "#3F5A63" }}>
                0:24
              </div>
            </div>
          </div>

          {/* question */}
          <div className="px-4 sm:px-5 pt-4">
            <div className={`rounded-2xl bg-white px-4 py-4 ${NB} shadow-[4px_4px_0_0_hsl(var(--nb-border))]`}>
              <p dir="auto" className="text-[15px] sm:text-[17px] font-bold text-center leading-snug" style={{ color: "#3F5A63" }}>
                {t.question}
              </p>
            </div>
          </div>

          {/* live leaderboard */}
          <div className="px-4 sm:px-5 py-4 space-y-1.5">
            {board.map((s, i) => {
              return (
                <div
                  key={s.name}
                  className={`flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 ${NB} ${
                    i === 0 ? "shadow-[4px_4px_0_0_hsl(var(--nb-border))]" : "shadow-[2px_2px_0_0_hsl(var(--nb-border))]"
                  }`}
                  style={{ opacity: 1 - i * 0.12 }}
                >
                  <span className="w-4 text-center text-[12px] font-black tabular-nums" style={{ color: "hsl(199 15% 55%)" }}>
                    {i + 1}
                  </span>
                  <Avatar name={s.name} size={24} />
                  <span className="flex-1 truncate text-[13px] font-bold" style={{ color: "#3F5A63" }}>
                    {s.name}
                  </span>
                  {i === 0 && <Trophy className="h-3.5 w-3.5 shrink-0" style={{ color: "#8FC44A" }} />}
                  <span className="text-[13px] font-black tabular-nums" style={{ color: "#3F5A63" }}>
                    {s.pts}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            className="flex items-center justify-between px-4 sm:px-5 py-2 text-[11px] font-semibold"
            style={{ borderTop: "2px solid hsl(var(--nb-border))", color: "hsl(199 15% 50%)" }}
          >
            <span>{t.players}</span>
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#8FC44A] opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#8FC44A]" />
              </span>
              {isAr ? "مباشر" : "LIVE"}
            </span>
          </div>
        </div>

        {/* ---------- student phone, floating in front ---------- */}
        <div
          className={`absolute ${isAr ? "-left-2 sm:-left-8" : "-right-2 sm:-right-8"} bottom-[-6%] w-[38%] max-w-[190px]`}
          style={tilted ? { transform: "translateZ(90px)", transformStyle: "preserve-3d" } : undefined}
        >
          <div className={`rounded-[22px] bg-[hsl(var(--cream-panel))] p-2.5 ${NB} shadow-[8px_8px_0_0_hsl(var(--nb-border))]`}>
            <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-[hsl(var(--nb-border))]/30" />

            <div className={`mb-2 rounded-xl bg-white px-2.5 py-2 ${NB}`}>
              <p dir="auto" className="text-[10px] font-bold leading-snug text-center" style={{ color: "#3F5A63" }}>
                {t.question}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {t.options.map((o, i) => (
                <div
                  key={o}
                  dir="auto"
                  className={`flex min-h-[34px] items-center justify-center rounded-xl px-1.5 text-center text-[9.5px] font-bold leading-tight text-white ${NB} ${
                    i === 0 ? "shadow-[3px_3px_0_0_hsl(var(--nb-border))]" : "shadow-[2px_2px_0_0_hsl(var(--nb-border))]"
                  }`}
                  style={{ background: ANSWER_COLORS[i], opacity: i === 0 ? 1 : 0.82 }}
                >
                  {o}
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between px-0.5">
              <span className="text-[9px] font-bold" style={{ color: "hsl(199 15% 55%)" }}>
                {t.you}
              </span>
              <span dir="ltr" className="text-[11px] font-black tabular-nums" style={{ color: "#3F5A63" }}>
                {isAr ? "٢٬٩٤٠" : "2,940"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
