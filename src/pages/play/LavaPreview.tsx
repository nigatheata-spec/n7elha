// ── Lava Floor — dev-only projector preview ─────────────────────────────────
// The board with bots and no Supabase: the real rules (lavaFloor.ts) and the
// real renderer (lavaFloorRender.ts), with a local loop standing in for the
// phones and the referee.
//
// ?mode=class|teams|solo, ?n=24 players, ?teams=3, ?lang=en,
// ?erupt=5 (seconds to the first eruption).
// ?phone=1 shows the phone instead, with stand-in questions; &wrong=1 holds
// the wrong-answer flood on screen.
// Route is registered only when import.meta.env.DEV.

import { useEffect, useRef, useState } from "react";
import { CIRCLE_COLORS, FACES, colorIndexForName, faceIndexForName } from "@/lib/avatarIdentity";
import {
  climbNeed, towerHeight, partialCourse, towerColor, towerName, paceRate,
  ERUPT_EVERY, ERUPT_RISE, ERUPT_SECS, LAVA_START, PACE_WINDOW, type LfMode, type Tower,
} from "@/lib/lavaFloor";
import { drawBoard, fitCamera, faceImage, type BoardTower, type Camera } from "@/lib/lavaFloorRender";
import { LavaHud, type FeedItem } from "@/components/game/LavaHud";
import { LavaBackdrop, LavaQuestionView, LavaWrongScreen } from "@/components/game/LavaPhone";

const STAND_IN = [
  { text: "ما ناتج ٧ × ٨؟", options: ["٥٦", "٤٨", "٦٤", "٥٤"], correct_index: 0 },
  { text: "What is the past participle of 'take'?", options: ["took", "taken", "taked", "takes"], correct_index: 1 },
  { text: "أي كوكب هو الأقرب إلى الشمس؟", options: ["الزهرة", "المريخ", "عطارد", "الأرض"], correct_index: 2 },
];

const PhonePreview = ({ ar, holdWrong }: { ar: boolean; holdWrong: boolean }) => {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState(holdWrong);
  const q = STAND_IN[i % STAND_IN.length];
  const next = () => { setPicked(null); setWrong(false); setI(n => n + 1); };
  const answer = (k: number) => {
    setPicked(k);
    if (k === q.correct_index) setTimeout(next, 650); else setWrong(true);
  };
  return (
    <div className="fixed inset-0 flex flex-col" dir={ar ? "rtl" : "ltr"}>
      <LavaBackdrop />
      <LavaQuestionView q={q} picked={picked} correct={picked === q.correct_index} onAnswer={answer} ar={ar} timerFrac={0.62} />
      {wrong && <LavaWrongScreen ar={ar} answer={q.options[q.correct_index]} onDone={next} holdMs={holdWrong ? 0 : 2200} />}
    </div>
  );
};

const NAMES_AR = ["سارة", "خالد", "نورة", "عبدالله", "ريم", "فهد", "لمى", "يوسف", "جود", "تركي", "هيا", "سلمان",
  "دانة", "ماجد", "شهد", "عمر", "غلا", "بندر", "رهف", "نواف", "لين", "مشاري", "وعد", "راكان", "أريج", "زياد", "مها", "سعود"];
const NAMES_EN = ["Sara", "Khalid", "Noura", "Abdullah", "Reem", "Fahad", "Lama", "Yousef", "Joud", "Turki", "Haya", "Salman",
  "Dana", "Majed", "Shahad", "Omar", "Ghala", "Bandar", "Rahaf", "Nawaf", "Leen", "Mishari", "Waad", "Rakan", "Areej", "Ziyad", "Maha", "Saud"];

const MINUTES = 6;

type Bot = { id: string; name: string; color: string; face: number; landAt: number; skill: number; nextAt: number; tower: number };

export default function LavaPreview() {
  const params = new URLSearchParams(window.location.search);
  const ar = params.get("lang") !== "en";
  if (params.get("phone")) return <PhonePreview ar={ar} holdWrong={!!params.get("wrong")} />;
  return <BoardPreview params={params} ar={ar} />;
}

function BoardPreview({ params, ar }: { params: URLSearchParams; ar: boolean }) {
  const mode = (["class", "teams", "solo"].includes(params.get("mode") ?? "") ? params.get("mode") : "solo") as LfMode;
  const n = Math.max(2, Math.min(28, Number(params.get("n")) || 20));
  const teams = Math.max(2, Math.min(4, Number(params.get("teams")) || 3));
  const firstErupt = Number(params.get("erupt")) || ERUPT_EVERY;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const botsRef = useRef<Bot[]>([]);
  const towersRef = useRef<Tower[]>([]);
  const historyRef = useRef<{ at: number; h: number[] }[]>([]);
  const lavaRef = useRef(LAVA_START);
  const rateRef = useRef(0.03);
  const eruptRef = useRef<{ at: number; from: number } | null>(null);
  const nextEruptRef = useRef(Date.now() + firstErupt * 1000);
  const camRef = useRef<Camera | null>(null);
  const startRef = useRef(Date.now());
  const feedId = useRef(0);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [hud, setHud] = useState({ left: MINUTES * 60, nextErupt: ERUPT_EVERY, lava: 0, standing: n, banner: false });

  const pushFeed = (text: string, kind: FeedItem["kind"]) =>
    setFeed(f => [{ id: ++feedId.current, text, kind }, ...f].slice(0, 4));

  const erupt = () => {
    eruptRef.current = { at: Date.now(), from: lavaRef.current };
    nextEruptRef.current = Date.now() + ERUPT_EVERY * 1000;
  };

  useEffect(() => {
    const names = ar ? NAMES_AR : NAMES_EN;
    const now = Date.now();
    const towerCount = mode === "solo" ? n : mode === "teams" ? teams : 1;
    botsRef.current = Array.from({ length: n }, (_, i) => {
      const name = names[i % names.length];
      return {
        id: String(i), name, landAt: 0,
        color: CIRCLE_COLORS[colorIndexForName(name + i)],
        face: faceIndexForName(name + i),
        skill: 0.45 + Math.random() * 0.45,
        nextAt: now + 1500 + Math.random() * 4000,
        tower: mode === "solo" ? i : i % towerCount,
      };
    });
    towersRef.current = Array.from({ length: towerCount }, (_, i) => ({
      id: String(i), idx: i, name: mode === "solo" ? botsRef.current[i].name : null,
      width: botsRef.current.filter(b => b.tower === i).length,
      bricks: 0, base: 3, dunked: false, climb: 0, dunks: 0,
    }));
    FACES.forEach((_, i) => faceImage(i));
  }, [n, ar, mode, teams]);

  useEffect(() => {
    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0, last = performance.now();

    const frame = (pt: number) => {
      const dt = Math.min(0.05, (pt - last) / 1000);
      last = pt;
      const now = Date.now();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const towers = towersRef.current;

      // lava: paced to the typical tower, plus a surge while an eruption runs
      let erupting = 0;
      const e = eruptRef.current;
      if (e) {
        const p = (now - e.at) / 1000 / ERUPT_SECS;
        if (p >= 1) { lavaRef.current = Math.max(lavaRef.current, e.from + ERUPT_RISE); eruptRef.current = null; }
        else {
          lavaRef.current = Math.max(lavaRef.current, e.from + ERUPT_RISE * (1 - Math.pow(1 - p, 3)));
          erupting = Math.sin(p * Math.PI);
        }
      } else lavaRef.current += rateRef.current * dt;
      if (now >= nextEruptRef.current && !eruptRef.current) erupt();

      const hist = historyRef.current;
      if (!hist.length || now - hist[hist.length - 1].at > 2000) {
        hist.push({ at: now, h: towers.map(t => towerHeight(t) + partialCourse(t) / Math.max(1, t.width)) });
        while (hist.length > 2 && now - hist[0].at > PACE_WINDOW * 1000) hist.shift();
        const span = (now - hist[0].at) / 1000;
        if (span > 5) rateRef.current = paceRate(towers.map((t, i) => t.dunked ? 0 : Math.max(0, (hist[hist.length - 1].h[i] - hist[0].h[i]) / span)));
      }

      // bots answer
      for (const b of botsRef.current) {
        if (now < b.nextAt) continue;
        b.nextAt = now + 2500 + Math.random() * 4500;
        if (Math.random() >= b.skill) continue;
        const t = towers[b.tower];
        if (t.dunked) t.climb++;
        else { t.bricks++; b.landAt = now; }
      }
      // referee
      towers.forEach(t => {
        const label = towerName(mode, t, ar);
        if (!t.dunked && towerHeight(t) < lavaRef.current) {
          t.dunked = true; t.climb = 0; t.dunks++;
          pushFeed(ar ? `${label} سقط في الحمم` : `${label} fell in`, "dunk");
        } else if (t.dunked && t.climb >= climbNeed(t.width)) {
          t.dunked = false; t.climb = 0;
          t.base = Math.ceil(lavaRef.current) + 1 - Math.floor(t.bricks / t.width);
          botsRef.current.filter(b => b.tower === t.idx).forEach(b => { b.landAt = now; });
          pushFeed(ar ? `${label} خرج من الحمم` : `${label} climbed out`, "out");
        }
      });

      const board: BoardTower[] = towers.map(t => {
        const members = botsRef.current.filter(b => b.tower === t.idx);
        return {
          id: t.id, width: t.width, courses: towerHeight(t), partial: partialCourse(t),
          color: towerColor(mode, t, members[0]?.color),
          label: mode === "solo" ? undefined : towerName(mode, t, ar),
          dunked: t.dunked, climb: t.climb, need: climbNeed(t.width), members,
        };
      });
      camRef.current = fitCamera(camRef.current, board, lavaRef.current, h, 130);
      drawBoard(ctx, w, h, {
        towers: board, lava: lavaRef.current, cam: camRef.current,
        t: pt / 1000, now, erupting, shake: erupting * 7, ar, rulerTop: 130,
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const tick = setInterval(() => {
      const left = Math.max(0, MINUTES * 60 - Math.floor((Date.now() - startRef.current) / 1000));
      const e = eruptRef.current;
      setHud({
        left,
        nextErupt: Math.max(0, Math.ceil((nextEruptRef.current - Date.now()) / 1000)),
        lava: Math.max(0, lavaRef.current),
        standing: botsRef.current.filter(b => !towersRef.current[b.tower]?.dunked).length,
        banner: !!e && Date.now() - e.at < 1800,
      });
    }, 250);
    return () => { cancelAnimationFrame(raf); clearInterval(tick); };
  }, [ar, mode]);

  return (
    <LavaHud
      ar={ar} code="K7QF" left={hud.left} nextErupt={hud.nextErupt} lava={hud.lava}
      standing={hud.standing} total={n} banner={hud.banner} feed={feed} onErupt={erupt}
      canvasRef={canvasRef}
    />
  );
}
