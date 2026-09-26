import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X, Zap, Crosshair, Shield, Radar, Biohazard, Users, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import PaintJoystick, { type JoystickVector } from "@/components/game/PaintJoystick";
import { useFloatingRewards } from "@/components/game/GameFeedback";
import { playCorrect, playWrong } from "@/lib/sound";
import { resizeCanvas, faceImage } from "@/lib/paintFightRender";
import { resolveColor, resolveFace, FACES, CIRCLE_COLORS } from "@/lib/avatarIdentity";
import {
  TILE, PLAYER_R, HUMAN_SPEED, ZOMBIE_SPEED, SPRINT, STUN_MS, TURNING_MS, HEAD_START_MS, SHIELD_GRACE_MS,
  BULLET, AMMO, CHARGES, PERK_STREAK, SENSE_MS, VISION, TAG_DIST, POINTS, BROADCAST_MS, PEER_TIMEOUT_MS,
  buildMap, moveCircle, lineOfSight, visibilityPolygon, spawnFor, solidAt, distanceField, headingDown, roomsFor,
  type HvzMap, type Team,
} from "@/lib/humansVsZombies";
import {
  HVZ, makeView, drawBuilding, drawDarkness, drawAgent, drawTag, drawBullets, drawMinimap, drawEdgeArrow, HvzFx,
  type Bullet,
} from "@/lib/hvzRender";

// ── Humans vs Zombies, student view ─────────────────────────────────────────
// A top-down building on every phone, camera on you, and you only see what's
// in your line of sight. See src/lib/humansVsZombies.ts for the rules and for
// who decides what: this client decides whether IT was tagged or stunned and
// nothing else, and writes nothing but its own row.
//
// Everything that changes per frame lives in refs, driven by one
// requestAnimationFrame loop started once per match (same shape as Paint Fight).
//
// `preview` swaps Supabase for a handful of local bots and a stand-in quiz, so
// the whole mode can be played at /join/hvz-preview without hosting a session.

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase = "waiting" | "playing" | "done";
type Peer = {
  id: string; name: string; team: Team;
  x: number; y: number; tx: number; ty: number; angle: number;
  face: HTMLImageElement; color: string;
  stunUntil: number; turningUntil: number; shield: boolean; sprint: boolean; moving: boolean; t: number;
  bot?: { next: number; goal: { x: number; y: number } | null; field: Int32Array | null; fieldAt: number; shotAt: number };
};
type Feed = { id: number; text: string; zombie: boolean };

interface Props { sessionId: string; studentId: string; preview?: boolean }

const SAMPLE_QUESTIONS: Q[] = [
  { id: "s1", text: "What is 7 x 8?", options: ["54", "56", "48", "64"], correct_index: 1 },
  { id: "s2", text: "Which planet is closest to the Sun?", options: ["Venus", "Mars", "Mercury", "Earth"], correct_index: 2 },
  { id: "s3", text: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], correct_index: 1 },
  { id: "s4", text: "What gas do plants take in?", options: ["Oxygen", "Carbon dioxide", "Helium", "Nitrogen"], correct_index: 1 },
];
const BOT_NAMES = ["Sara", "Omar", "Lina", "Yousef", "Maha", "Adam", "Noor", "Khalid", "Reem"];

const ANSWER_COLORS = ["#E05D5D", "#3FA56B", "#7C62D6", "#E0A93A"];

const HumansVsZombiesGame = ({ sessionId, studentId, preview = false }: Props) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  const [session, setSession]   = useState<any>(null);
  const [me, setMe]             = useState<any>(null);
  const [phase, setPhase]       = useState<Phase>("waiting");
  const [ready, setReady]       = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQ, setCurrentQ] = useState<Q | null>(null);
  const [picked, setPicked]     = useState<number | null>(null);
  const [toast, setToast]       = useState<{ text: string; bad: boolean } | null>(null);
  const [feed, setFeed]         = useState<Feed[]>([]);
  const [hud, setHud] = useState({
    team: "human" as Team, ammo: AMMO.start, charges: CHARGES.start, streak: 0, points: 0,
    shield: false, sense: 0, stunned: 0, turning: 0, sprint: 0, humans: 0, zombies: 0, secsLeft: null as number | null, releaseIn: 0,
    stuns: 0, infects: 0,
  });

  const reward = useFloatingRewards();

  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const mapRef     = useRef<HvzMap | null>(null);
  const vectorRef  = useRef<JoystickVector>({ dx: 0, dy: 0, magnitude: 0 });
  const peersRef   = useRef<Record<string, Peer>>({});
  const bulletsRef = useRef<Bullet[]>([]);
  const fxRef      = useRef(new HvzFx());
  const pRef = useRef({
    x: 0, y: 0, angle: -Math.PI / 2, aim: -Math.PI / 2, team: "human" as Team, moving: false, placed: false,
    stunUntil: 0, sprintUntil: 0, turningUntil: 0, senseUntil: 0, graceUntil: 0, shield: false,
    ammo: AMMO.start, charges: CHARGES.start, streak: 0, points: 0, stuns: 0, infects: 0, shots: 0,
    aimTarget: null as string | null,
  });
  const chanRef       = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const nameRef       = useRef("");
  const faceRef       = useRef<HTMLImageElement | null>(null);
  const colorRef      = useRef("#4EA3F2");
  const faceIdxRef    = useRef<number | null>(null);
  const colorIdxRef   = useRef<number | null>(null);
  const questionsRef  = useRef<Q[]>([]);
  const lastQIdRef    = useRef<string | null>(null);
  const pickedRef     = useRef<number | null>(null);
  const showQuizRef   = useRef(false);
  const localWriteAtRef = useRef(0);
  const startedAtRef  = useRef(0);
  const endsAtRef     = useRef<number | null>(null);
  const keysRef       = useRef(new Set<string>());

  const settings = session?.settings ?? {};
  const ar = (settings.lang ?? i18n.language) === "ar";
  const arRef = useRef(ar);
  arRef.current = ar;

  const say = (text: string, bad: boolean) => {
    setToast({ text, bad });
    setTimeout(() => setToast(t => (t?.text === text ? null : t)), 2000);
  };
  const pushFeed = (text: string, zombie: boolean) => {
    const id = Date.now() + Math.random();
    setFeed(f => [...f.slice(-2), { id, text, zombie }]);
    setTimeout(() => setFeed(f => f.filter(e => e.id !== id)), 4000);
  };

  /** Broadcast to everyone else; the preview has nobody to tell. */
  const send = (event: string, payload: Record<string, unknown>) => {
    if (preview) return;
    chanRef.current?.send({ type: "broadcast", event, payload });
  };

  const writeRow = (patch: { team?: Team; crypto?: number; total_answers?: number; correct_answers?: number }) => {
    if (preview) return;
    localWriteAtRef.current = Date.now();
    supabase.from("game_students").update(patch).eq("id", studentId).then(undefined, () => {});
  };

  // ── What happens to us / because of us. Shared by the network handlers and
  //    the preview's bots, so both paths run the exact same rules. ──────────
  const onStunned = (by: string, byName: string, victimName: string) => {
    const isAr = arRef.current;
    pushFeed(isAr ? `${byName} شلّ ${victimName}` : `${byName} stunned ${victimName}`, false);
    if (by !== studentId) return;
    const p = pRef.current;
    p.points += POINTS.stun; p.stuns++;
    say(isAr ? `أصبت ${victimName}!` : `You stunned ${victimName}!`, false);
    writeRow({ crypto: p.points });
  };
  const onInfected = (by: string, byName: string, victimName: string) => {
    const isAr = arRef.current;
    pushFeed(isAr ? `${byName} عدى ${victimName}` : `${byName} infected ${victimName}`, true);
    if (by !== studentId) return;
    const p = pRef.current;
    p.points += POINTS.infect; p.infects++;
    fxRef.current.shake(10);
    say(isAr ? `حوّلت ${victimName} إلى زومبي!` : `You turned ${victimName}!`, false);
    writeRow({ crypto: p.points });
  };
  const onStunnedRef = useRef(onStunned); onStunnedRef.current = onStunned;
  const onInfectedRef = useRef(onInfected); onInfectedRef.current = onInfected;

  const upsertPeer = (id: string, d: any) => {
    const prev = peersRef.current[id];
    const name: string = d.name ?? prev?.name ?? "";
    const face = prev && prev.name === name ? prev.face : faceImage(resolveFace(name, d.af ?? null));
    const color = resolveColor(name, d.ac ?? null);
    const now = Date.now();
    peersRef.current[id] = {
      id, name, team: d.team === "zombie" ? "zombie" : "human",
      x: prev ? prev.x : d.x, y: prev ? prev.y : d.y, tx: d.x, ty: d.y, angle: d.a ?? 0,
      face, color,
      stunUntil: now + (d.st ?? 0), turningUntil: now + (d.tu ?? 0),
      shield: !!d.sh, sprint: !!d.sp, moving: !!d.mv, t: now,
    };
  };

  // ── Data + realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    if (preview) {
      const params = new URLSearchParams(window.location.search);
      const team: Team = params.get("team") === "zombie" ? "zombie" : "human";
      const lang = params.get("lang") === "ar" ? "ar" : "en";
      const s = {
        id: sessionId, status: "running",
        started_at: new Date(Date.now() - HEAD_START_MS + 3000).toISOString(),
        settings: { mode: "humansvszombies", minutes: 5, hvzRooms: roomsFor(Number(params.get("players") ?? 8)), lang },
      };
      const m = { id: studentId, name: "You", team, avatar_face: 4, avatar_color: 1, correct_answers: 0, total_answers: 0 };
      setSession(s); setMe(m);
      questionsRef.current = SAMPLE_QUESTIONS;
      setup(s, m);
      // Bots: a mixed crowd, two zombies unless you are one.
      const map = mapRef.current!;
      const nBots = Math.max(1, Math.min(9, Number(params.get("bots") ?? 7)));
      for (let i = 0; i < nBots; i++) {
        const bt: Team = i < (team === "zombie" ? 1 : 2) ? "zombie" : "human";
        const pos = spawnFor(map, bt);
        const name = BOT_NAMES[i % BOT_NAMES.length];
        peersRef.current[`bot${i}`] = {
          id: `bot${i}`, name, team: bt, x: pos.x, y: pos.y, tx: pos.x, ty: pos.y, angle: 0,
          face: faceImage(FACES[(i * 5 + 2) % FACES.length]), color: CIRCLE_COLORS[i % CIRCLE_COLORS.length],
          stunUntil: 0, turningUntil: 0, shield: false, sprint: false, moving: false, t: Date.now(),
          bot: { next: 0, goal: null, field: null, fieldAt: 0, shotAt: 0 },
        };
      }
      // Handle for poking at the match from devtools (teleporting, forcing a team).
      (window as any).__hvz = { p: pRef.current, peers: peersRef.current };
      setReady(true);
      return;
    }

    const ch = supabase.channel(`hvz-${sessionId}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (p: any) => setSession((prev: any) => ({ ...prev, ...p.new })))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_students", filter: `id=eq.${studentId}` },
        (p: any) => {
          if (Date.now() - localWriteAtRef.current < 2000) return;
          setMe((prev: any) => ({ ...prev, ...p.new }));
          // The teacher's Start can make us a zombie after we loaded.
          if (p.new?.team === "zombie" && pRef.current.team === "human") becomeZombieQuietly();
        })
      .on("broadcast", { event: "pos" }, ({ payload }: any) => {
        if (!payload?.id || payload.id === studentId) return;
        upsertPeer(payload.id, payload);
      })
      .on("broadcast", { event: "shot" }, ({ payload }: any) => {
        if (!payload?.id) return;
        bulletsRef.current.push({
          id: payload.id, by: payload.by, x: payload.x, y: payload.y,
          vx: Math.cos(payload.a) * BULLET.speed, vy: Math.sin(payload.a) * BULLET.speed, travelled: 0,
        });
      })
      .on("broadcast", { event: "stun" }, ({ payload }: any) => {
        if (!payload) return;
        const v = peersRef.current[payload.victim];
        if (v) { v.stunUntil = Date.now() + STUN_MS; fxRef.current.burst(v.x, v.y, "#8CC8FF", 12); }
        onStunnedRef.current(payload.by, payload.byName ?? "?", payload.victimName ?? "?");
      })
      .on("broadcast", { event: "infect" }, ({ payload }: any) => {
        if (!payload) return;
        const v = peersRef.current[payload.victim];
        if (v) {
          v.team = "zombie"; v.turningUntil = Date.now() + TURNING_MS;
          fxRef.current.burst(v.x, v.y, HVZ.zombie, 22, 220);
          fxRef.current.ring(v.x, v.y, HVZ.zombie, 90);
        }
        onInfectedRef.current(payload.by, payload.byName ?? "?", payload.victimName ?? "?");
      })
      .on("broadcast", { event: "shield" }, ({ payload }: any) => {
        const v = payload && peersRef.current[payload.victim];
        if (v) { v.shield = false; fxRef.current.ring(v.x, v.y, "#78DCFF", 60); }
      })
      .subscribe();
    chanRef.current = ch;

    (async () => {
      const { data: s } = await supabase.from("game_sessions").select("*").eq("id", sessionId).maybeSingle();
      if (cancelled) return;
      setSession(s);
      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        if (cancelled) return;
        questionsRef.current = (qs ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] })) as Q[];
      }
      const { data: m } = await supabase.from("game_students").select("*").eq("id", studentId).maybeSingle();
      if (cancelled) return;
      if (m) setMe(m);
      setup(s, m);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
      chanRef.current = null;
    };
  }, [sessionId, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Build the building and put us in it. */
  const setup = (s: any, m: any) => {
    const [rw, rh] = Array.isArray(s?.settings?.hvzRooms) ? s.settings.hvzRooms : [3, 3];
    mapRef.current = buildMap(sessionId, rw, rh);
    const p = pRef.current;
    nameRef.current = m?.name ?? "";
    faceIdxRef.current = m?.avatar_face ?? null;
    colorIdxRef.current = m?.avatar_color ?? null;
    faceRef.current = faceImage(resolveFace(nameRef.current, faceIdxRef.current));
    colorRef.current = resolveColor(nameRef.current, colorIdxRef.current);
    p.team = m?.team === "zombie" ? "zombie" : "human";
    p.points = m?.crypto ?? 0;
    const pos = spawnFor(mapRef.current, p.team);
    p.x = pos.x; p.y = pos.y; p.placed = true;
    if (p.team === "zombie") { p.ammo = 0; p.charges = CHARGES.start; }
  };

  const becomeZombieQuietly = () => {
    const p = pRef.current;
    p.team = "zombie"; p.ammo = 0; p.charges = CHARGES.start; p.shield = false; p.streak = 0;
    const map = mapRef.current;
    if (map) { const pos = spawnFor(map, "zombie"); p.x = pos.x; p.y = pos.y; }
  };

  // ── Session → phase, clock ──────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (session.status === "lobby") setPhase("waiting");
    else if (session.status === "running") setPhase("playing");
    else if (session.status === "finished") setPhase("done");
    startedAtRef.current = session.started_at ? new Date(session.started_at).getTime() : Date.now();
    const minutes = Number(session.settings?.minutes);
    endsAtRef.current = Number.isFinite(minutes) && minutes > 0 ? startedAtRef.current + minutes * 60_000 : null;
  }, [session?.status, session?.started_at, session?.settings?.minutes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ─────────────────────────────────────────────────────────────
  const frozenNow = () => {
    const p = pRef.current, now = Date.now();
    return showQuizRef.current || now < p.stunUntil || now < p.turningUntil
      || (p.team === "zombie" && now < startedAtRef.current + HEAD_START_MS);
  };

  const act = () => {
    const p = pRef.current, now = Date.now();
    if (frozenNow()) return;
    if (p.team === "human") {
      if (p.ammo <= 0) { say(arRef.current ? "لا ذخيرة — أجب لتحصل عليها" : "No ammo — answer to reload", true); return; }
      p.ammo--;
      const id = `${studentId}-${++p.shots}`;
      const x = p.x + Math.cos(p.aim) * (PLAYER_R + 8), y = p.y + Math.sin(p.aim) * (PLAYER_R + 8);
      bulletsRef.current.push({ id, by: studentId, x, y, vx: Math.cos(p.aim) * BULLET.speed, vy: Math.sin(p.aim) * BULLET.speed, travelled: 0 });
      fxRef.current.burst(x, y, HVZ.bullet, 5, 90);
      send("shot", { id, by: studentId, x: Math.round(x), y: Math.round(y), a: Number(p.aim.toFixed(3)) });
    } else {
      if (p.charges <= 0) { say(arRef.current ? "لا طاقة — أجب لتحصل عليها" : "No sprint left — answer to charge", true); return; }
      p.charges--;
      p.sprintUntil = now + SPRINT.ms;
      fxRef.current.ring(p.x, p.y, HVZ.zombie, 50);
    }
    setHud(h => ({ ...h, ammo: p.ammo, charges: p.charges }));
  };
  const actRef = useRef(act); actRef.current = act;

  // ── The game loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || !ready) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0, last = performance.now(), acc = 0, hudAcc = 0, netAcc = 0;
    const STEP = 1 / 60;

    const infectMe = (by: Peer) => {
      const p = pRef.current, now = Date.now();
      p.team = "zombie"; p.turningUntil = now + TURNING_MS;
      p.ammo = 0; p.charges = CHARGES.start; p.streak = 0; p.shield = false; p.sprintUntil = 0;
      fxRef.current.burst(p.x, p.y, HVZ.zombie, 26, 240);
      fxRef.current.ring(p.x, p.y, HVZ.zombie, 100);
      fxRef.current.shake(16, 450);
      setShowQuiz(false);
      say(arRef.current ? `${by.name} حوّلك إلى زومبي!` : `${by.name} got you! You're a zombie now`, true);
      writeRow({ team: "zombie" });
      send("infect", { victim: studentId, by: by.id, byName: by.name, victimName: nameRef.current });
      onInfectedRef.current(by.id, by.name, nameRef.current);
    };

    const stunMe = (b: Bullet) => {
      const p = pRef.current, now = Date.now();
      p.stunUntil = now + STUN_MS; p.sprintUntil = 0;
      fxRef.current.burst(p.x, p.y, "#8CC8FF", 16);
      fxRef.current.shake(7);
      const shooter = peersRef.current[b.by];
      say(arRef.current ? "أصبت! مشلول لثلاث ثوانٍ" : "Stunned for 3 seconds!", true);
      send("stun", { victim: studentId, by: b.by, byName: shooter?.name ?? "?", victimName: nameRef.current });
      onStunnedRef.current(b.by, shooter?.name ?? "?", nameRef.current);
    };

    /** Preview only: bots do what their phones would. */
    const stepBots = (dt: number) => {
      const map = mapRef.current!;
      const now = Date.now();
      const p = pRef.current;
      const released = now >= startedAtRef.current + HEAD_START_MS;
      const bots = Object.values(peersRef.current).filter(b => b.bot);
      const humans = [...bots.filter(b => b.team === "human").map(b => ({ x: b.x, y: b.y, ref: b as Peer | null })),
        ...(p.team === "human" ? [{ x: p.x, y: p.y, ref: null }] : [])];
      const zombies = [...bots.filter(b => b.team === "zombie").map(b => ({ x: b.x, y: b.y, ref: b as Peer | null })),
        ...(p.team === "zombie" ? [{ x: p.x, y: p.y, ref: null }] : [])];
      for (const b of bots) {
        const s = b.bot!;
        b.t = now;
        b.sprint = false;
        const frozen = now < b.stunUntil || now < b.turningUntil || (b.team === "zombie" && !released);
        b.moving = false;
        if (frozen) continue;
        let heading: number | null = null;
        if (b.team === "zombie") {
          let best: { x: number; y: number } | null = null, bd = Infinity;
          for (const h of humans) { const d = Math.hypot(h.x - b.x, h.y - b.y); if (d < bd) { bd = d; best = h; } }
          if (best) {
            if (bd < 220 && lineOfSight(map, b.x, b.y, best.x, best.y)) heading = Math.atan2(best.y - b.y, best.x - b.x);
            else {
              if (!s.field || now - s.fieldAt > 700) { s.field = distanceField(map, Math.floor(best.x / TILE), Math.floor(best.y / TILE)); s.fieldAt = now; }
              heading = headingDown(map, s.field, b.x, b.y);
            }
          }
        } else {
          let threat: { x: number; y: number } | null = null, td = Infinity;
          for (const z of zombies) { const d = Math.hypot(z.x - b.x, z.y - b.y); if (d < td) { td = d; threat = z; } }
          if (threat && td < 240 && lineOfSight(map, b.x, b.y, threat.x, threat.y)) {
            heading = Math.atan2(b.y - threat.y, b.x - threat.x) + Math.sin(now * 0.002 + b.x) * 0.6;
            if (now - s.shotAt > 1600 && released) {
              const zRef = zombies.find(z => z === threat);
              if (zRef && !(zRef.ref && now < zRef.ref.stunUntil)) {
                s.shotAt = now;
                const a = Math.atan2(threat.y - b.y, threat.x - b.x);
                bulletsRef.current.push({ id: `${b.id}-${now}`, by: b.id, x: b.x + Math.cos(a) * 22, y: b.y + Math.sin(a) * 22, vx: Math.cos(a) * BULLET.speed, vy: Math.sin(a) * BULLET.speed, travelled: 0 });
                b.angle = a;
              }
            }
          } else {
            if (!s.goal || now > s.next) {
              const r = map.rooms[Math.floor(Math.random() * map.rooms.length)];
              s.goal = { x: (r.cx + 0.5) * TILE, y: (r.cy + 0.5) * TILE };
              s.field = distanceField(map, r.cx, r.cy);
              s.next = now + 9000;
            }
            heading = s.field ? headingDown(map, s.field, b.x, b.y) : null;
            if (heading === null) s.next = 0;
          }
        }
        if (heading === null) continue;
        const speed = (b.team === "zombie" ? ZOMBIE_SPEED * 0.9 : HUMAN_SPEED * 0.85) * dt;
        const moved = moveCircle(map, b.x, b.y, Math.cos(heading) * speed, Math.sin(heading) * speed);
        b.x = b.tx = moved.x; b.y = b.ty = moved.y;
        if (b.team === "human" || !b.moving) b.angle = heading;
        b.moving = true;
      }
      // Bot humans decide their own tagging, like a phone would.
      for (const h of bots) {
        if (h.team !== "human" || !released) continue;
        const touch = (zx: number, zy: number) => Math.hypot(zx - h.x, zy - h.y) < TAG_DIST;
        let by: { id: string; name: string } | null = null;
        if (p.team === "zombie" && now >= p.stunUntil && now >= p.turningUntil && touch(p.x, p.y)) by = { id: studentId, name: nameRef.current };
        for (const z of bots) if (!by && z.team === "zombie" && now >= z.stunUntil && now >= z.turningUntil && touch(z.x, z.y)) by = { id: z.id, name: z.name };
        if (!by) continue;
        h.team = "zombie"; h.turningUntil = now + TURNING_MS;
        fxRef.current.burst(h.x, h.y, HVZ.zombie, 22, 220);
        fxRef.current.ring(h.x, h.y, HVZ.zombie, 90);
        onInfectedRef.current(by.id, by.name, h.name);
      }
    };

    const physics = (dt: number) => {
      const map = mapRef.current;
      if (!map) return;
      const p = pRef.current, now = Date.now();
      const zombie = p.team === "zombie";

      // Preview keyboard feeds the same vector the joystick does.
      if (preview) {
        const k = keysRef.current;
        const dx = (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0);
        const dy = (k.has("arrowdown") || k.has("s") ? 1 : 0) - (k.has("arrowup") || k.has("w") ? 1 : 0);
        if (dx || dy) { const l = Math.hypot(dx, dy); vectorRef.current = { dx: dx / l, dy: dy / l, magnitude: 1 }; }
        else if (k.size || vectorRef.current.magnitude) vectorRef.current = { dx: 0, dy: 0, magnitude: 0 };
      }

      const frozen = frozenNow();
      const vec = vectorRef.current;
      p.moving = !frozen && vec.magnitude > 0;
      if (p.moving) {
        p.angle = Math.atan2(vec.dy, vec.dx);
        const base = zombie ? ZOMBIE_SPEED : HUMAN_SPEED;
        const speed = base * (now < p.sprintUntil ? SPRINT.mult : 1) * Math.min(1, 0.35 + vec.magnitude);
        ({ x: p.x, y: p.y } = moveCircle(map, p.x, p.y, Math.cos(p.angle) * speed * dt, Math.sin(p.angle) * speed * dt));
      }

      // Peers glide to their last broadcast position.
      const k = Math.min(1, dt * 14);
      for (const peer of Object.values(peersRef.current)) {
        if (peer.bot) continue;
        peer.x += (peer.tx - peer.x) * k; peer.y += (peer.ty - peer.y) * k;
      }
      if (preview) stepBots(dt);

      // Humans aim at the nearest zombie they can see; otherwise straight ahead.
      if (!zombie) {
        let best = Infinity; p.aim = p.angle; p.aimTarget = null;
        for (const peer of Object.values(peersRef.current)) {
          if (peer.team !== "zombie" || now < peer.stunUntil) continue;
          const d = Math.hypot(peer.x - p.x, peer.y - p.y);
          if (d < BULLET.range && d < best && lineOfSight(map, p.x, p.y, peer.x, peer.y)) { best = d; p.aim = Math.atan2(peer.y - p.y, peer.x - p.x); p.aimTarget = peer.id; }
        }
      }

      // Bullets: walls stop them; a zombie stops them (visually); only the
      // zombie that was hit decides it was stunned.
      const keep: Bullet[] = [];
      for (const b of bulletsRef.current) {
        const sx = b.vx * dt, sy = b.vy * dt;
        b.x += sx; b.y += sy; b.travelled += Math.hypot(sx, sy);
        if (b.travelled > BULLET.range || solidAt(map, b.x, b.y)) { fxRef.current.burst(b.x, b.y, HVZ.bullet, 4, 70); continue; }
        let hit = false;
        if (zombie && b.by !== studentId && now >= p.stunUntil && now >= p.turningUntil
          && Math.hypot(b.x - p.x, b.y - p.y) < PLAYER_R + BULLET.radius) { stunMe(b); hit = true; }
        for (const peer of Object.values(peersRef.current)) {
          if (hit || peer.team !== "zombie" || peer.id === b.by || now < peer.stunUntil) continue;
          if (Math.hypot(b.x - peer.x, b.y - peer.y) >= PLAYER_R + BULLET.radius) continue;
          hit = true;
          if (peer.bot) {
            peer.stunUntil = now + STUN_MS;
            fxRef.current.burst(peer.x, peer.y, "#8CC8FF", 12);
            const shooter = b.by === studentId ? nameRef.current : peersRef.current[b.by]?.name ?? "?";
            onStunnedRef.current(b.by, shooter, peer.name);
          }
        }
        if (!hit) keep.push(b);
      }
      bulletsRef.current = keep;

      // Tagged? Judged against our exact position and their broadcast one.
      if (!zombie && now >= startedAtRef.current + HEAD_START_MS && now >= p.graceUntil) {
        for (const peer of Object.values(peersRef.current)) {
          if (peer.team !== "zombie" || now < peer.stunUntil || now < peer.turningUntil) continue;
          if (now - peer.t > 1500) continue;
          if (Math.hypot(peer.x - p.x, peer.y - p.y) >= TAG_DIST) continue;
          if (p.shield) {
            p.shield = false; p.graceUntil = now + SHIELD_GRACE_MS;
            fxRef.current.ring(p.x, p.y, "#78DCFF", 70);
            fxRef.current.burst(p.x, p.y, "#78DCFF", 14);
            say(arRef.current ? "الدرع أنقذك!" : "Your shield saved you!", false);
            send("shield", { victim: studentId });
          } else infectMe(peer);
          break;
        }
      }
      fxRef.current.step(dt);
    };

    const draw = () => {
      const map = mapRef.current;
      if (!map) return;
      const { cssW, cssH } = resizeCanvas(canvas, ctx);
      if (cssW <= 0 || cssH <= 0) return;
      const nowP = performance.now(), now = Date.now();
      const p = pRef.current;
      const zombie = p.team === "zombie";
      // About eight tiles across a phone: close enough that faces read, far
      // enough that you see a zombie coming before it's on you.
      const scale = Math.max(0.8, Math.min(1.5, Math.min(cssW, cssH * 0.7) / 340));
      const sh = fxRef.current.offset(nowP);
      const v = makeView(p.x + sh.x, p.y + sh.y, cssW, cssH, scale);
      const vision = zombie ? VISION.zombie : VISION.human;
      const sensing = zombie && now < p.senseUntil;

      drawBuilding(ctx, map, v, arRef.current);
      drawBullets(ctx, bulletsRef.current, v);

      const cutoff = now - PEER_TIMEOUT_MS;
      const seen: Peer[] = [];
      for (const id of Object.keys(peersRef.current)) {
        const peer = peersRef.current[id];
        if (peer.t < cutoff) { delete peersRef.current[id]; continue; }
        const d = Math.hypot(peer.x - p.x, peer.y - p.y);
        if (d < vision + PLAYER_R && lineOfSight(map, p.x, p.y, peer.x, peer.y)) seen.push(peer);
      }
      const R = PLAYER_R * scale;
      const drawn = [...seen.map(s => ({ y: s.y, peer: s })), { y: p.y, peer: null as Peer | null }].sort((a, b) => a.y - b.y);
      for (const d of drawn) {
        if (d.peer) {
          const q = d.peer;
          drawAgent(ctx, v.offX + q.x * scale, v.offY + q.y * scale, R, {
            face: q.face, color: q.color, zombie: q.team === "zombie", angle: q.angle, moving: q.moving,
            stunned: now < q.stunUntil, shield: q.shield, sprint: q.sprint, turning: now < q.turningUntil,
          }, nowP);
        } else {
          drawAgent(ctx, v.offX + p.x * scale, v.offY + p.y * scale, R, {
            face: faceRef.current ?? undefined, color: colorRef.current, zombie, angle: zombie ? p.angle : p.aim, moving: p.moving,
            stunned: now < p.stunUntil, shield: p.shield, sprint: now < p.sprintUntil, turning: now < p.turningUntil,
          }, nowP);
        }
      }
      fxRef.current.draw(ctx, v, nowP);

      drawDarkness(ctx, v, visibilityPolygon(map, p.x, p.y, vision), p.x, p.y, vision,
        zombie ? "rgba(6,14,6,0.9)" : "rgba(5,8,14,0.9)");

      // Reticle on whoever the gun is tracking.
      if (!zombie) {
        const target = seen.find(s => s.id === p.aimTarget);
        if (target) {
          const tx = v.offX + target.x * scale, ty = v.offY + target.y * scale;
          ctx.save();
          ctx.strokeStyle = p.ammo > 0 ? "#FFE066" : "rgba(255,255,255,0.4)";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 5]); ctx.lineDashOffset = -nowP * 0.03;
          ctx.beginPath(); ctx.arc(tx, ty, R * 1.6, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
      }

      for (const s of seen) drawTag(ctx, v.offX + s.x * scale, v.offY + s.y * scale - R * 1.45, s.name, s.team === "zombie", false);
      drawTag(ctx, v.offX + p.x * scale, v.offY + p.y * scale - R * 1.45, arRef.current ? "أنت" : "YOU", zombie, true);

      // Sense: every human, through walls, for a few seconds.
      const marks: { x: number; y: number; color: string }[] = [];
      if (sensing) {
        const humans = Object.values(peersRef.current).filter(q => q.team === "human")
          .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
        for (const h of humans) {
          marks.push({ x: h.x, y: h.y, color: "#FF6B6B" });
          ctx.save();
          ctx.globalAlpha = 0.55 + Math.sin(nowP * 0.01) * 0.2;
          ctx.strokeStyle = "#FF6B6B"; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(v.offX + h.x * scale, v.offY + h.y * scale, R * 1.3, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        for (const h of humans.slice(0, 3)) drawEdgeArrow(ctx, v, h.x, h.y, "#FF6B6B", `${Math.round(Math.hypot(h.x - p.x, h.y - p.y) / TILE)}m`);
      }

      const mw = Math.min(96, cssW * 0.24);
      drawMinimap(ctx, map, cssW - mw - 14, 118, mw, { x: p.x, y: p.y, zombie }, marks);
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      let dt = (t - last) / 1000;
      last = t;
      if (dt > 0.25) dt = 0.25;
      acc += dt; hudAcc += dt; netAcc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 8) { physics(STEP); acc -= STEP; steps++; }
      if (acc > STEP) acc = 0;
      draw();

      const p = pRef.current, now = Date.now();
      if (hudAcc >= 0.2) {
        hudAcc = 0;
        let humans = p.team === "human" ? 1 : 0, zombies = p.team === "zombie" ? 1 : 0;
        for (const q of Object.values(peersRef.current)) { if (q.team === "human") humans++; else zombies++; }
        const ends = endsAtRef.current;
        setHud({
          team: p.team, ammo: p.ammo, charges: p.charges, streak: p.streak, points: p.points, shield: p.shield,
          sense: Math.max(0, p.senseUntil - now), stunned: Math.max(0, p.stunUntil - now),
          turning: Math.max(0, p.turningUntil - now), sprint: Math.max(0, p.sprintUntil - now),
          humans, zombies, secsLeft: ends ? Math.max(0, Math.ceil((ends - now) / 1000)) : null,
          releaseIn: Math.max(0, Math.ceil((startedAtRef.current + HEAD_START_MS - now) / 1000)),
          stuns: p.stuns, infects: p.infects,
        });
      }
      if (netAcc >= BROADCAST_MS / 1000) {
        netAcc = 0;
        send("pos", {
          id: studentId, name: nameRef.current, team: p.team, af: faceIdxRef.current, ac: colorIdxRef.current,
          x: Math.round(p.x), y: Math.round(p.y), a: Number((p.team === "zombie" ? p.angle : p.aim).toFixed(2)),
          st: Math.max(0, p.stunUntil - now), tu: Math.max(0, p.turningUntil - now),
          sh: p.shield, sp: now < p.sprintUntil, mv: p.moving,
        });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, ready, studentId, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preview: keyboard. Space = action, E = quiz.
  useEffect(() => {
    if (!preview) return;
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === " ") { e.preventDefault(); actRef.current(); return; }
      if (k === "e") { openQuizRef.current(); return; }
      keysRef.current.add(k);
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [preview]);

  // ── Questions ───────────────────────────────────────────────────────────
  const nextQuestion = () => {
    const list = questionsRef.current;
    if (list.length === 0) { setCurrentQ(null); return; }
    let q = list[Math.floor(Math.random() * list.length)];
    if (list.length > 1 && q.id === lastQIdRef.current) q = list[(list.indexOf(q) + 1) % list.length];
    lastQIdRef.current = q.id;
    setCurrentQ(q);
    setPicked(null);
    pickedRef.current = null;
  };
  const openQuiz = () => { nextQuestion(); setShowQuiz(true); };
  const openQuizRef = useRef(openQuiz); openQuizRef.current = openQuiz;
  useEffect(() => { showQuizRef.current = showQuiz; }, [showQuiz]);

  const answer = (idx: number) => {
    if (!currentQ || !me || pickedRef.current !== null) return;
    pickedRef.current = idx;
    setPicked(idx);
    const correct = idx === currentQ.correct_index;
    const p = pRef.current;
    const isAr = arRef.current;
    if (correct) {
      p.streak++;
      p.points += POINTS.correct;
      playCorrect();
      if (p.team === "human") {
        p.ammo = Math.min(AMMO.max, p.ammo + AMMO.perCorrect);
        reward.fire(isAr ? `+${AMMO.perCorrect} ذخيرة` : `+${AMMO.perCorrect} ammo`, HVZ.bullet);
      } else {
        p.charges = Math.min(CHARGES.max, p.charges + CHARGES.perCorrect);
        reward.fire(isAr ? "+1 انطلاقة" : "+1 sprint", HVZ.zombie);
      }
      if (p.streak % PERK_STREAK === 0) {
        if (p.team === "human") { p.shield = true; say(isAr ? "درع! يصدّ لمسة زومبي واحدة" : "Shield! Blocks one zombie touch", false); }
        else { p.senseUntil = Date.now() + SENSE_MS; say(isAr ? "حاسة الشم! ترى كل البشر" : "Sense! You can see every human", false); }
      }
    } else {
      p.streak = 0;
      playWrong();
    }
    setHud(h => ({ ...h, ammo: p.ammo, charges: p.charges, streak: p.streak, points: p.points, shield: p.shield }));

    const updates: { total_answers: number; crypto: number; correct_answers?: number } = { total_answers: (me.total_answers ?? 0) + 1, crypto: p.points };
    if (correct) updates.correct_answers = (me.correct_answers ?? 0) + 1;
    setMe((prev: any) => ({ ...prev, ...updates }));
    writeRow(updates);
    if (!preview) {
      supabase.from("question_responses").insert({
        session_id: sessionId, student_id: me.id, question_id: currentQ.id,
        question_index: 0, answer_index: idx, is_correct: correct,
      }).then(undefined, () => {});
    }
    setTimeout(() => nextQuestion(), 850);
  };

  const zombie = hud.team === "zombie";
  const teamColor = zombie ? HVZ.zombie : HVZ.human;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // ── Waiting ─────────────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center text-white" style={{ background: HVZ.void }}>
        <div className="flex items-center gap-3">
          <Users className="h-10 w-10" style={{ color: HVZ.human }} />
          <span className="text-lg font-black opacity-40">vs</span>
          <Biohazard className="h-10 w-10" style={{ color: HVZ.zombie }} />
        </div>
        <div>
          <div className="text-[10px] tracking-[0.35em] uppercase mb-1 opacity-50">{ar ? "بشر ضد زومبي" : "HUMANS VS ZOMBIES"}</div>
          <div className="text-2xl font-extrabold">{me?.name ?? "—"}</div>
        </div>
        <p className="text-sm max-w-xs leading-relaxed font-semibold opacity-75">
          {ar
            ? "بعضكم يبدأ زومبي. إذا لمسك زومبي تتحول إلى زومبي. البشر معهم مسدس يشلّ الزومبي لثوانٍ. أجب صح لتحصل على ذخيرة أو انطلاقة — لكنك تقف مكانك وأنت تجيب، فاختر مكانًا آمنًا."
            : "A few of you start as zombies. Get touched and you turn. Humans carry a stun gun that freezes a zombie for a few seconds. Correct answers give ammo or sprints — but you stand still while you answer, so pick a safe spot."}
        </p>
        <div className="text-xs font-bold animate-pulse opacity-70">{ar ? "بانتظار المعلّم..." : "Waiting for the teacher..."}</div>
      </div>
    );
  }

  // ── Done ────────────────────────────────────────────────────────────────
  if (phase === "done") {
    const winner = settings.winner === "zombies" ? "zombie" : "human";
    const won = winner === pRef.current.team;
    return (
      <div className="fixed inset-0 overflow-y-auto flex flex-col items-center justify-center gap-6 px-6 py-8 text-center text-white" style={{ background: HVZ.void }}>
        {winner === "zombie" ? <Biohazard className="h-16 w-16" style={{ color: HVZ.zombie }} /> : <Users className="h-16 w-16" style={{ color: HVZ.human }} />}
        <div>
          <div className="text-3xl font-black" style={{ color: winner === "zombie" ? HVZ.zombie : HVZ.human }}>
            {winner === "zombie" ? (ar ? "فاز الزومبي" : "ZOMBIES WIN") : (ar ? "نجا البشر" : "HUMANS SURVIVED")}
          </div>
          <div className="mt-1 text-sm font-bold opacity-60">
            {won ? (ar ? "فريقك فاز!" : "Your team won!") : (ar ? "حظ أوفر المرة القادمة" : "Better luck next time")}
          </div>
        </div>
        <div dir="ltr" className="flex gap-2.5">
          {[
            { label: ar ? "نقاط" : "POINTS", value: String(hud.points), color: "#FFE066" },
            { label: ar ? "شلل" : "STUNS", value: String(hud.stuns), color: HVZ.human },
            { label: ar ? "عدوى" : "INFECTED", value: String(hud.infects), color: HVZ.zombie },
            { label: ar ? "صحيح" : "CORRECT", value: String(me?.correct_answers ?? 0), color: "#FFFFFF" },
          ].map(s => (
            <div key={s.label} className="px-3.5 py-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="text-[9px] tracking-widest font-bold opacity-50">{s.label}</div>
              <div className="text-2xl font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
        <button onClick={() => navigate("/join")}
          className="px-8 py-3 rounded-full font-extrabold text-sm active:scale-95 transition-transform"
          style={{ background: "#FFFFFF", color: HVZ.void }}>
          {ar ? "خروج" : "EXIT"}
        </button>
      </div>
    );
  }

  // ── Playing ─────────────────────────────────────────────────────────────
  const frozenReason =
    hud.turning > 0 ? (ar ? "تتحول إلى زومبي..." : "Turning...")
    : hud.stunned > 0 ? (ar ? "مشلول" : "STUNNED")
    : zombie && hud.releaseIn > 0 ? (ar ? `الصيد يبدأ بعد ${hud.releaseIn}` : `Hunt starts in ${hud.releaseIn}`)
    : null;
  const actionCount = zombie ? hud.charges : hud.ammo;

  return (
    <div dir={ar ? "rtl" : "ltr"} className="fixed inset-0 overflow-hidden select-none text-white" style={{ background: HVZ.void, touchAction: "none" }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {!showQuiz && <PaintJoystick vectorRef={vectorRef} />}

      {/* HUD — forced LTR so the corners don't swap in Arabic. */}
      <div dir="ltr" className="absolute inset-x-0 top-0 p-3 pointer-events-none flex items-start justify-between gap-2"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-black shadow-sm"
            style={{ background: teamColor, color: HVZ.void }}>
            {zombie ? <Biohazard className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            {zombie ? (ar ? "زومبي" : "ZOMBIE") : (ar ? "إنسان" : "HUMAN")}
          </div>
          <div className="px-2.5 py-0.5 rounded-full text-[12px] font-extrabold tabular-nums" style={{ background: "rgba(11,15,22,0.7)", color: "#FFE066" }}>
            {hud.points} {ar ? "نقطة" : "pts"}
          </div>
          {hud.shield && (
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black" style={{ background: "#78DCFF", color: HVZ.void }}>
              <Shield className="h-3.5 w-3.5" />{ar ? "درع" : "SHIELD"}
            </div>
          )}
          {hud.sense > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black" style={{ background: "#FF6B6B", color: HVZ.void }}>
              <Radar className="h-3.5 w-3.5" />{Math.ceil(hud.sense / 1000)}s
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-[13px] font-black tabular-nums" style={{ background: "rgba(11,15,22,0.75)" }}>
            <span className="flex items-center gap-1" style={{ color: HVZ.human }}><Users className="h-3.5 w-3.5" />{hud.humans}</span>
            <span className="flex items-center gap-1" style={{ color: HVZ.zombie }}><Biohazard className="h-3.5 w-3.5" />{hud.zombies}</span>
            {hud.secsLeft !== null && <span className="flex items-center gap-1 opacity-90"><Timer className="h-3.5 w-3.5" />{fmt(hud.secsLeft)}</span>}
          </div>
        </div>
      </div>

      {feed.length > 0 && (
        <div className="absolute inset-x-0 flex flex-col items-center gap-1 pointer-events-none px-4" style={{ top: "calc(max(0.75rem, env(safe-area-inset-top)) + 4.2rem)" }}>
          {feed.map(e => (
            <div key={e.id} dir={ar ? "rtl" : "ltr"} className="max-w-[70vw] truncate px-3 py-1 rounded-full text-[11px] font-extrabold shadow-sm animate-fade-up"
              style={{ background: e.zombie ? "rgba(47,107,34,0.92)" : "rgba(30,70,120,0.92)" }}>
              {e.text}
            </div>
          ))}
        </div>
      )}

      {!zombie && hud.releaseIn > 0 && !showQuiz && (
        <div className="absolute inset-x-0 top-[30%] flex justify-center pointer-events-none">
          <div className="px-4 py-2 rounded-full text-sm font-black" style={{ background: "rgba(11,15,22,0.8)", color: HVZ.zombie }}>
            {ar ? `الزومبي يخرجون بعد ${hud.releaseIn} — اختبئ!` : `Zombies get out in ${hud.releaseIn} — hide!`}
          </div>
        </div>
      )}

      {frozenReason && !showQuiz && (
        <div className="absolute inset-x-0 top-[40%] flex justify-center pointer-events-none">
          <div className="px-5 py-2.5 rounded-full text-base font-black animate-pulse"
            style={{ background: hud.stunned > 0 ? "#8CC8FF" : HVZ.zombie, color: HVZ.void }}>
            {frozenReason}
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute inset-x-0 top-[50%] flex justify-center px-8 pointer-events-none">
          <div className="px-5 py-2.5 rounded-full text-sm font-extrabold text-center shadow-lg"
            style={{ background: toast.bad ? "#B4342F" : "#1E7A45" }}>
            {toast.text}
          </div>
        </div>
      )}

      {/* Bottom controls: answer on the left, the team's action on the right. */}
      {!showQuiz && (
        <div dir="ltr" className="absolute inset-x-0 flex items-end justify-between px-4 pointer-events-none"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
          <button onClick={openQuiz}
            className={cn("pointer-events-auto z-10 px-5 py-3 rounded-full text-sm font-extrabold shadow-lg active:scale-95 transition-transform",
              actionCount === 0 && "animate-pulse")}
            style={{ background: "#FFFFFF", color: HVZ.void }}>
            {zombie ? (ar ? "أجب: +1 انطلاقة" : "Answer: +1 sprint") : (ar ? `أجب: +${AMMO.perCorrect} ذخيرة` : `Answer: +${AMMO.perCorrect} ammo`)}
          </button>
          <button
            onPointerDown={e => { e.stopPropagation(); act(); }}
            className="pointer-events-auto z-10 relative h-20 w-20 rounded-full flex flex-col items-center justify-center font-black shadow-xl active:scale-90 transition-transform"
            style={{
              background: actionCount > 0 ? teamColor : "rgba(255,255,255,0.18)",
              color: HVZ.void, border: "4px solid rgba(255,255,255,0.9)",
            }}>
            {zombie ? <Zap className="h-7 w-7" fill="currentColor" /> : <Crosshair className="h-7 w-7" />}
            <span className="text-[11px] leading-none mt-0.5">{zombie ? (ar ? "انطلق" : "SPRINT") : (ar ? "أطلق" : "SHOOT")}</span>
            <span className="absolute -top-1 -right-1 h-7 min-w-7 px-1.5 rounded-full flex items-center justify-center text-sm tabular-nums"
              style={{ background: HVZ.void, color: "#FFFFFF", border: "2px solid #FFFFFF" }}>
              {actionCount}
            </span>
          </button>
        </div>
      )}

      {/* Question screen. You stand still under it, anyone can walk up. */}
      {showQuiz && (
        <div dir={ar ? "rtl" : "ltr"} className="absolute inset-0 z-40 flex flex-col" style={{ background: "rgba(11,15,22,0.94)" }}>
          <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <div className="relative flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm" style={{ background: teamColor, color: HVZ.void }}>
                {zombie ? <Zap className="h-3.5 w-3.5" /> : <Crosshair className="h-3.5 w-3.5" />}
                <span className="text-sm font-black tabular-nums">{actionCount}</span>
              </div>
              <span className="text-xs font-bold truncate opacity-70">
                {ar ? `${hud.streak % PERK_STREAK}/${PERK_STREAK} للـ${zombie ? "حاسة" : "درع"}` : `${hud.streak % PERK_STREAK}/${PERK_STREAK} to ${zombie ? "sense" : "shield"}`}
              </span>
              <reward.Layer />
            </div>
            <button onClick={() => setShowQuiz(false)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black active:scale-95 transition-transform"
              style={{ background: "#FFFFFF", color: HVZ.void }}>
              <X className="h-3.5 w-3.5" />{ar ? "عودة" : "BACK"}
            </button>
          </div>
          <div className="px-4 text-[11px] font-bold text-center opacity-60 shrink-0">
            {ar ? "أنت واقف مكانك — انتبه لمن يقترب" : "You're standing still — watch your back"}
          </div>
          {currentQ ? (
            <div className="flex-1 flex flex-col justify-center gap-4 p-4 min-h-0 overflow-y-auto">
              <div className="px-5 py-6 rounded-[28px] shrink-0" style={{ background: "#1B2230" }}>
                {currentQ.image_url && <img src={currentQ.image_url} alt="" className="mx-auto max-h-[22vh] w-auto object-contain mb-4 rounded-2xl" />}
                <p className="text-[17px] font-extrabold leading-snug text-center">{currentQ.text}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 shrink-0">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = i === currentQ.correct_index;
                  const isPicked = picked === i;
                  const show = picked !== null;
                  let bg = ANSWER_COLORS[i % 4], col = "#FFFFFF";
                  if (show && isCorrect) bg = "#22a35a";
                  else if (show && isPicked) bg = "#d64545";
                  else if (show) { bg = "rgba(255,255,255,0.06)"; col = "rgba(255,255,255,0.35)"; }
                  return (
                    <button key={i} disabled={show} onClick={() => answer(i)}
                      className={cn("min-h-[84px] px-3 py-4 rounded-[24px] text-[15px] font-extrabold text-center flex items-center justify-center transition-all duration-200 active:scale-95",
                        show && isCorrect && "animate-answer-correct scale-[1.03]", show && isPicked && !isCorrect && "animate-answer-wrong")}
                      style={{ background: bg, color: col, boxShadow: show ? "none" : "0 5px 0 0 rgba(0,0,0,0.35)" }}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm font-bold px-6 text-center opacity-60">
              {ar ? "لا توجد أسئلة في هذا الاختبار." : "This quiz has no questions."}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HumansVsZombiesGame;
