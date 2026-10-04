import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { FACES } from "@/lib/avatarIdentity";
import { isPaused } from "@/components/teacher/GameControls";
import {
  climbNeed, towerHeight, partialCourse, towerName, paceRate,
  ERUPT_EVERY, ERUPT_RISE, ERUPT_SECS, LAVA_START, MIN_RATE, PACE_WINDOW,
  type LfMode, type Tower,
} from "@/lib/lavaFloor";
import { drawBoard, fitCamera, faceImage, toBoard, type Camera, type LfStudent as Student } from "@/lib/lavaFloorRender";
import { LavaHud, type FeedItem } from "@/components/game/LavaHud";

// ── Lava Floor — projector ───────────────────────────────────────────────────
// This screen owns the lava: it moves it, writes a snapshot to lava_state for
// the phones every few seconds, fires the eruptions, and referees the towers
// (lava_floor_referee) when one goes under or earns its way out. Phones only
// send answers. Rules live in lavaFloor.ts.


const SNAPSHOT_MS = 3000;

interface Props { session: any; sessionId: string; }

const LavaFloorMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";
  const mode: LfMode = session?.settings?.lfMode ?? "class";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const towersRef = useRef<Tower[]>([]);
  const studentsRef = useRef<Student[]>([]);
  const landRef = useRef<Map<string, number>>(new Map());
  const lastBricks = useRef<Map<string, number>>(new Map());
  const lavaRef = useRef(LAVA_START);
  const rateRef = useRef(MIN_RATE);
  const eruptRef = useRef<{ at: number; from: number } | null>(null);
  const nextEruptRef = useRef(Date.now() + ERUPT_EVERY * 1000);
  const historyRef = useRef<{ at: number; h: Record<string, number> }[]>([]);
  const pendingRef = useRef<Map<string, number>>(new Map());
  const camRef = useRef<Camera | null>(null);
  const readyRef = useRef(false);
  const pausedRef = useRef(false);
  const feedId = useRef(0);
  const endingRef = useRef(false);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [hud, setHud] = useState({ left: 0, nextErupt: ERUPT_EVERY, lava: 0, standing: 0, total: 0, banner: false });
  const [finale, setFinale] = useState<string | null>(null);

  pausedRef.current = isPaused(session);
  const minutes = session?.settings?.minutes ?? 7;
  const startedAt = session?.started_at ? new Date(session.started_at).getTime() : Date.now();

  const pushFeed = (text: string, kind: FeedItem["kind"]) =>
    setFeed(f => [{ id: ++feedId.current, text, kind }, ...f].slice(0, 4));

  const writeLava = (patch: { level: number; rate: number; erupt_at?: string }) =>
    supabase.from("lava_state").upsert({ session_id: sessionId, at: new Date().toISOString(), ...patch }).then(undefined, () => {});

  // ── load + subscribe ───────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const loadTowers = async () => {
      const { data } = await supabase.from("lava_towers").select("*").eq("session_id", sessionId).order("idx");
      if (!alive) return;
      const prev = new Map(towersRef.current.map(t => [t.id, t]));
      const next = (data ?? []) as Tower[];
      for (const t of next) {
        const p = prev.get(t.id);
        if (!p) continue;
        const label = towerName(mode, t, ar);
        if (!p.dunked && t.dunked) pushFeed(ar ? `${label} سقط في الحمم` : `${label} fell in`, "dunk");
        if (p.dunked && !t.dunked) {
          pushFeed(ar ? `${label} خرج من الحمم` : `${label} climbed out`, "out");
          studentsRef.current.filter(s => s.lf_tower === t.id).forEach(s => landRef.current.set(s.id, Date.now()));
        }
      }
      towersRef.current = next;
    };
    const loadStudents = async () => {
      const { data } = await supabase.from("game_students")
        .select("id,name,avatar_color,avatar_face,lf_tower,crypto").eq("session_id", sessionId).order("joined_at");
      if (!alive) return;
      const list = (data ?? []) as Student[];
      // a student whose brick count went up just laid one: make them hop
      for (const s of list) {
        const before = lastBricks.current.get(s.id);
        if (before != null && (s.crypto ?? 0) > before) landRef.current.set(s.id, Date.now());
        lastBricks.current.set(s.id, s.crypto ?? 0);
      }
      studentsRef.current = list;
      if (list.some(s => !s.lf_tower)) supabase.rpc("lava_floor_assign", { p_session_id: sessionId }).then(undefined, () => {});
    };

    (async () => {
      await supabase.rpc("lava_floor_assign", { p_session_id: sessionId }).then(undefined, () => {});
      const { data: ls } = await supabase.from("lava_state").select("*").eq("session_id", sessionId).maybeSingle();
      if (ls) {
        // picking up after a reload: carry the lava on from its last snapshot
        lavaRef.current = ls.level + Math.max(0, (Date.now() - new Date(ls.at).getTime()) / 1000) * ls.rate;
        rateRef.current = ls.rate > 0 && ls.rate < 0.5 ? ls.rate : MIN_RATE;
      } else {
        await writeLava({ level: LAVA_START, rate: MIN_RATE });
      }
      await Promise.all([loadTowers(), loadStudents()]);
      readyRef.current = true;
    })();
    FACES.forEach((_, i) => faceImage(i));

    const ch = supabase.channel(`lf-monitor-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lava_towers", filter: `session_id=eq.${sessionId}` }, loadTowers)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, loadStudents)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [sessionId, mode, ar]);

  // ── the loop: lava, eruptions, referee, drawing ────────────────────────────
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    let raf = 0, last = performance.now(), lastWrite = 0;

    const frame = (pt: number) => {
      const dt = Math.min(0.1, (pt - last) / 1000);
      last = pt;
      const now = Date.now();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const towers = towersRef.current;
      const paused = pausedRef.current;

      let erupting = 0;
      if (readyRef.current && !endingRef.current) {
        if (paused) {
          // hold everything, including the countdown to the next eruption
          nextEruptRef.current += dt * 1000;
          if (now - lastWrite > SNAPSHOT_MS) { lastWrite = now; writeLava({ level: lavaRef.current, rate: 0 }); }
        } else {
          const e = eruptRef.current;
          if (e) {
            const p = (now - e.at) / 1000 / ERUPT_SECS;
            if (p >= 1) {
              lavaRef.current = Math.max(lavaRef.current, e.from + ERUPT_RISE);
              eruptRef.current = null;
              lastWrite = now;
              writeLava({ level: lavaRef.current, rate: rateRef.current });
            } else {
              lavaRef.current = Math.max(lavaRef.current, e.from + ERUPT_RISE * (1 - Math.pow(1 - p, 3)));
              erupting = Math.sin(p * Math.PI);
            }
          } else {
            lavaRef.current += rateRef.current * dt;
            if (now - lastWrite > SNAPSHOT_MS) { lastWrite = now; writeLava({ level: lavaRef.current, rate: rateRef.current }); }
          }
          if (now >= nextEruptRef.current && !eruptRef.current) startEruption();
        }

        // pace the lava to how fast the towers are really growing
        const hist = historyRef.current;
        if (!paused && (!hist.length || now - hist[hist.length - 1].at > 2000)) {
          hist.push({ at: now, h: Object.fromEntries(towers.map(t => [t.id, towerHeight(t) + partialCourse(t) / Math.max(1, t.width)])) });
          while (hist.length > 2 && now - hist[0].at > PACE_WINDOW * 1000) hist.shift();
          const span = (now - hist[0].at) / 1000;
          if (span > 10) {
            const a = hist[0].h, b = hist[hist.length - 1].h;
            rateRef.current = paceRate(towers.filter(t => !t.dunked && a[t.id] != null).map(t => Math.max(0, (b[t.id] - a[t.id]) / span)));
          }
        }

        // referee: ask the server to dunk or rescue; it re-checks on the live row
        for (const t of towers) {
          const wantDunk = !t.dunked && towerHeight(t) < lavaRef.current;
          const wantOut = t.dunked && t.climb >= climbNeed(t.width);
          if (!wantDunk && !wantOut) continue;
          if (now - (pendingRef.current.get(t.id) ?? 0) < 1500) continue;
          pendingRef.current.set(t.id, now);
          supabase.rpc("lava_floor_referee", { p_tower: t.id, p_lava: lavaRef.current, p_need: climbNeed(t.width) }).then(undefined, () => {});
        }
      }

      const board = toBoard(towers, studentsRef.current, landRef.current, mode, ar);
      camRef.current = fitCamera(camRef.current, board, lavaRef.current, h, 130);
      drawBoard(ctx, w, h, {
        towers: board, lava: lavaRef.current, cam: camRef.current,
        t: pt / 1000, now, erupting, shake: erupting * 7, ar, rulerTop: 130,
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sessionId, mode, ar]);

  const startEruption = () => {
    if (eruptRef.current || pausedRef.current) return;
    const now = Date.now();
    eruptRef.current = { at: now, from: lavaRef.current };
    nextEruptRef.current = now + ERUPT_EVERY * 1000;
    // phones follow the surge as a straight climb over the same few seconds
    writeLava({ level: lavaRef.current, rate: ERUPT_RISE / ERUPT_SECS, erupt_at: new Date(now).toISOString() });
  };

  // ── HUD tick + the clock ───────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      const left = Math.max(0, minutes * 60 - Math.floor((Date.now() - startedAt) / 1000));
      const e = eruptRef.current;
      const students = studentsRef.current;
      const dunkedIds = new Set(towersRef.current.filter(t => t.dunked).map(t => t.id));
      setHud({
        left,
        nextErupt: Math.max(0, Math.ceil((nextEruptRef.current - Date.now()) / 1000)),
        lava: lavaRef.current,
        standing: students.filter(s => s.lf_tower && !dunkedIds.has(s.lf_tower)).length,
        total: students.length,
        banner: !!e && Date.now() - e.at < 1800,
      });
      if (left === 0 && session?.status === "running" && !endingRef.current && !pausedRef.current) finish();
    }, 250);
    return () => clearInterval(t);
  }, [minutes, startedAt, session?.status]);

  // Time's up: name the winner on the board for a moment, then the results.
  const finish = () => {
    endingRef.current = true;
    const towers = towersRef.current;
    if (mode !== "solo" && towers.length) {
      const best = [...towers].sort((a, b) => towerHeight(b) - towerHeight(a))[0];
      setFinale(mode === "class"
        ? (ar ? `بنيتم ${towerHeight(best)} متر معًا` : `You built ${towerHeight(best)} meters together`)
        : (ar ? `فاز ${towerName(mode, best, ar)}` : `${towerName(mode, best, ar)} wins`));
    } else {
      const top = [...studentsRef.current].sort((a, b) => (b.crypto ?? 0) - (a.crypto ?? 0))[0];
      setFinale(top ? (ar ? `أكثر من بنى: ${top.name}` : `Top builder: ${top.name}`) : (ar ? "انتهى الوقت" : "Time's up"));
    }
    setTimeout(async () => {
      await supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", sessionId).then(undefined, () => {});
      nav(`/app/games/${sessionId}/results`, { replace: true, state: { justEnded: true } });
    }, 4500);
  };

  // Ended from the teacher's controls: straight to the results.
  useEffect(() => {
    if (session?.status === "finished" && !endingRef.current) nav(`/app/games/${sessionId}/results`, { replace: true, state: { justEnded: true } });
  }, [session?.status]);

  return (
    <LavaHud
      ar={ar} code={session?.code ?? ""} left={hud.left} nextErupt={hud.nextErupt} lava={hud.lava}
      standing={hud.standing} total={hud.total} banner={hud.banner} feed={feed} onErupt={startEruption}
      canvasRef={canvasRef}
    >
      {finale && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#140A14]/55 animate-in fade-in duration-500">
          <div className="text-center px-6">
            <div className="text-lg opacity-70 mb-2">{ar ? "انتهى الوقت" : "Time's up"}</div>
            <div className="text-[clamp(40px,7vw,96px)] font-black text-[#C6F04A]" style={{ textShadow: "0 5px 0 #140A14" }}>{finale}</div>
          </div>
        </div>
      )}
    </LavaHud>
  );
};

export default LavaFloorMonitor;
