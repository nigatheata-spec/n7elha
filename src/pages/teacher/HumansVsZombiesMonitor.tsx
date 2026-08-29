import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Square, Maximize, Users, Biohazard } from "lucide-react";
import { PixelShield } from "@/components/PixelIcons";
import { BATTLE_ACTIONS, START_HEALTH, HEALTH_DRAIN_PER_SEC, DAY_CYCLE_MS, WIN_DAYS, type Team, type BattleActionKey } from "@/lib/humansVsZombies";
import { drawBattle, type Fighter } from "@/lib/hvzBattleRender";
import battlefieldUrl from "@/assets/hvz/battlefield.jpg";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import knightUrl from "@/assets/hvz/knight.png";
import zombieUrl from "@/assets/hvz/zombie.png";

type EffectPayload = {
  damage?: { targetTeam: Team; amount: number };
  steal?: { targetTeam: Team; pct: number; ms: number; beneficiaryId: string; beneficiaryTeam: Team };
  incomeDebuff?: { targetTeam: Team; tiers: number; ms: number };
  drainBoost?: { targetTeam: Team; extraRate: number; ms: number };
};
type ActionRow = {
  id: string; student_id: string; student_name: string; team: Team; action_key: BattleActionKey;
  health_delta: number; max_health_delta: number; effect: EffectPayload; cost: number; created_at: string;
};
type DrainBoostEvent = { team: Team; startMs: number; extraRate: number; ms: number };

const TEAM_COLOR: Record<Team, string> = { human: "hsl(210 70% 55%)", zombie: "hsl(100 55% 45%)" };
const zero = (): Record<Team, number> => ({ human: 0, zombie: 0 });

const AV_COLORS = { human: "#3b82f6", zombie: "#65a30d" };
const av = (name: string, team: Team) => ({ bg: AV_COLORS[team], letter: (name || "?").charAt(0).toUpperCase() });
const Avatar = ({ name, team }: { name: string; team: Team }) => {
  const { bg, letter } = av(name, team);
  return (
    <div style={{ background: bg, borderColor: bg }}
      className="pixel-avatar h-9 w-9 flex items-center justify-center font-black text-white text-sm select-none shrink-0 font-mono">
      {letter}
    </div>
  );
};


/**
 * The battlefield. Health drives the front line, so the picture and the bars
 * always agree — the teacher can read the match from across the room.
 *
 * Health is passed through a ref rather than as a prop the loop closes over:
 * the render loop is started once on mount, and reading props directly would
 * pin it to whatever the values were on that first frame.
 */
const BattleScene = ({ humans, zombies, humanPct, zombiePct }: {
  humans: Fighter[]; zombies: Fighter[]; humanPct: number; zombiePct: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ humans, zombies, humanPct, zombiePct });
  stateRef.current = { humans, zombies, humanPct, zombiePct };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const load = (src: string) => { const i = new Image(); i.src = src; return i; };
    const sprites = { field: load(battlefieldUrl), knight: load(knightUrl), zombie: load(zombieUrl) };

    let raf = 0;
    const frame = (t: number) => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
      if (cssW && cssH) {
        if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
          canvas.width = cssW * dpr; canvas.height = cssH * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawBattle(ctx, cssW, cssH, sprites, { ...stateRef.current, t });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full block" />;
};

interface Props { session: any; sessionId: string; }

const HumansVsZombiesMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { i18n } = useTranslation();
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";
  const [students, setStudents] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());
  const [ending, setEnding] = useState(false);
  const [recentActions, setRecentActions] = useState<ActionRow[]>([]);
  const [healthDeltaSum, setHealthDeltaSum]       = useState<Record<Team, number>>(zero());
  const [maxHealthDeltaSum, setMaxHealthDeltaSum] = useState<Record<Team, number>>(zero());
  const [drainBoosts, setDrainBoosts]             = useState<DrainBoostEvent[]>([]);

  const settingsRef = useRef<any>({});
  const healthDeltaRef = useRef<Record<Team, number>>(zero());
  const maxHealthDeltaRef = useRef<Record<Team, number>>(zero());
  const drainBoostsRef = useRef<DrainBoostEvent[]>([]);
  const dayInitRef = useRef(false);
  const settings = session?.settings ?? {};
  settingsRef.current = settings;

  const daysSurvived = settings.daysSurvived ?? 1;
  const dayCycleEndsAt = settings.dayCycleEndsAt ? new Date(settings.dayCycleEndsAt).getTime() : 0;
  const daySecsLeft = dayCycleEndsAt ? Math.max(0, Math.ceil((dayCycleEndsAt - now) / 1000)) : DAY_CYCLE_MS / 1000;

  const startedAtMs = session?.started_at ? new Date(session.started_at).getTime() : 0;
  const elapsedSec  = startedAtMs ? Math.max(0, (now - startedAtMs) / 1000) : 0;
  const extraDrainFor = (t: Team) => drainBoosts.filter(b => b.team === t)
    .reduce((sum, b) => sum + b.extraRate * Math.max(0, Math.min(now, b.startMs + b.ms) - b.startMs) / 1000, 0);
  const drain: Record<Team, number> = {
    human:  elapsedSec * HEALTH_DRAIN_PER_SEC + extraDrainFor("human"),
    zombie: elapsedSec * HEALTH_DRAIN_PER_SEC + extraDrainFor("zombie"),
  };
  const maxHealth: Record<Team, number> = { human: START_HEALTH + maxHealthDeltaSum.human, zombie: START_HEALTH + maxHealthDeltaSum.zombie };
  const health: Record<Team, number> = {
    human:  Math.max(0, Math.min(maxHealth.human,  START_HEALTH - drain.human + healthDeltaSum.human)),
    zombie: Math.max(0, Math.min(maxHealth.zombie, START_HEALTH - drain.zombie + healthDeltaSum.zombie)),
  };

  // ── Load students + actions, subscribe to realtime ────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const refresh = async () => {
      const { data: ss } = await supabase.from("game_students").select("*")
        .eq("session_id", sessionId).order("crypto", { ascending: false });
      setStudents(ss ?? []);
    };
    refresh();

    const loadActions = async () => {
      const { data } = await supabase.from("hvz_actions").select("*")
        .eq("session_id", sessionId).order("created_at", { ascending: true });
      const rows = (data ?? []) as ActionRow[];
      const hSum = zero(), mSum = zero();
      const boosts: DrainBoostEvent[] = [];
      for (const r of rows) {
        hSum[r.team] += r.health_delta;
        mSum[r.team] += r.max_health_delta;
        const eff = r.effect || {};
        if (eff.damage) hSum[eff.damage.targetTeam] -= eff.damage.amount;
        if (eff.drainBoost) boosts.push({ team: eff.drainBoost.targetTeam, startMs: new Date(r.created_at).getTime(), extraRate: eff.drainBoost.extraRate, ms: eff.drainBoost.ms });
      }
      healthDeltaRef.current = hSum; maxHealthDeltaRef.current = mSum; drainBoostsRef.current = boosts;
      setHealthDeltaSum(hSum); setMaxHealthDeltaSum(mSum); setDrainBoosts(boosts);
      setRecentActions(rows.slice(-8).reverse());
    };
    loadActions();

    const ch = supabase.channel(`hvz-monitor-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hvz_actions", filter: `session_id=eq.${sessionId}` },
        (p: any) => {
          const row = p.new as ActionRow;
          healthDeltaRef.current = { ...healthDeltaRef.current, [row.team]: healthDeltaRef.current[row.team] + row.health_delta };
          maxHealthDeltaRef.current = { ...maxHealthDeltaRef.current, [row.team]: maxHealthDeltaRef.current[row.team] + row.max_health_delta };
          const eff = row.effect || {};
          if (eff.damage) healthDeltaRef.current = { ...healthDeltaRef.current, [eff.damage.targetTeam]: healthDeltaRef.current[eff.damage.targetTeam] - eff.damage.amount };
          if (eff.drainBoost) drainBoostsRef.current = [...drainBoostsRef.current, { team: eff.drainBoost.targetTeam, startMs: new Date(row.created_at).getTime(), extraRate: eff.drainBoost.extraRate, ms: eff.drainBoost.ms }];
          setHealthDeltaSum(healthDeltaRef.current);
          setMaxHealthDeltaSum(maxHealthDeltaRef.current);
          setDrainBoosts(drainBoostsRef.current);
          setRecentActions(list => [row, ...list].slice(0, 8));
          const action = BATTLE_ACTIONS.find(a => a.key === row.action_key && a.team === row.team);
          if (action) toast(`${row.student_name}: ${action.nameEn}`);
        })
      .subscribe();
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => { supabase.removeChannel(ch); clearInterval(tick); };
  }, [sessionId]);

  // ── Initialize the day cycle clock once the game starts running ───────────
  useEffect(() => {
    if (dayInitRef.current) return;
    if (session?.status !== "running") return;
    dayInitRef.current = true;
    if (!settings.dayCycleEndsAt) {
      supabase.from("game_sessions").update({
        settings: { ...settingsRef.current, dayCycleEndsAt: new Date(Date.now() + DAY_CYCLE_MS).toISOString(), daysSurvived: 1 },
      }).eq("id", sessionId).then(undefined, () => {});
    }
  }, [session?.status, settings.dayCycleEndsAt, sessionId]);

  // ── Day cycle tick + both win conditions ───────────────────────────────────
  useEffect(() => {
    if (session?.status !== "running" || ending) return;
    const t = setInterval(() => {
      const hp = healthDeltaRef.current, mp = maxHealthDeltaRef.current;
      const startedAt = session?.started_at ? new Date(session.started_at).getTime() : 0;
      const nowMs = Date.now();
      const elapsed = startedAt ? Math.max(0, (nowMs - startedAt) / 1000) : 0;
      const extraDrain = (t: Team) => drainBoostsRef.current.filter(b => b.team === t)
        .reduce((sum, b) => sum + b.extraRate * Math.max(0, Math.min(nowMs, b.startMs + b.ms) - b.startMs) / 1000, 0);
      const dHuman = elapsed * HEALTH_DRAIN_PER_SEC + extraDrain("human");
      const dZombie = elapsed * HEALTH_DRAIN_PER_SEC + extraDrain("zombie");
      const humanHp  = Math.max(0, Math.min(START_HEALTH + mp.human,  START_HEALTH - dHuman + hp.human));
      const zombieHp = Math.max(0, Math.min(START_HEALTH + mp.zombie, START_HEALTH - dZombie + hp.zombie));

      if ((humanHp <= 0 || zombieHp <= 0) && !ending) {
        setEnding(true);
        const winner = humanHp <= 0 ? "zombies" : "humans";
        supabase.from("game_sessions").update({
          status: "finished", ended_at: new Date().toISOString(),
          settings: { ...settingsRef.current, winner },
        }).eq("id", sessionId).then(undefined, () => {});
        return;
      }

      const endsAt = settingsRef.current.dayCycleEndsAt ? new Date(settingsRef.current.dayCycleEndsAt).getTime() : 0;
      if (endsAt && Date.now() >= endsAt) {
        const nextDay = (settingsRef.current.daysSurvived ?? 1) + 1;
        if (nextDay > WIN_DAYS) {
          setEnding(true);
          const winner = humanHp >= zombieHp ? "humans" : "zombies";
          supabase.from("game_sessions").update({
            status: "finished", ended_at: new Date().toISOString(),
            settings: { ...settingsRef.current, daysSurvived: WIN_DAYS, winner },
          }).eq("id", sessionId).then(undefined, () => {});
        } else {
          supabase.from("game_sessions").update({
            settings: { ...settingsRef.current, daysSurvived: nextDay, dayCycleEndsAt: new Date(Date.now() + DAY_CYCLE_MS).toISOString() },
          }).eq("id", sessionId).then(undefined, () => {});
        }
      }
    }, 500);
    return () => clearInterval(t);
  }, [session?.status, session?.started_at, ending, sessionId]);

  // ── Navigate to results once finished ──────────────────────────────────────
  useEffect(() => {
    if (session?.status === "finished") nav(`/app/games/${session.id}/results`, { replace: true });
  }, [session?.status]);

  const endNow = async () => {
    if (!session || !(await confirm(ar ? "إنهاء اللعبة الآن؟" : "End the game now?"))) return;
    const winner = health.human >= health.zombie ? "humans" : "zombies";
    await supabase.from("game_sessions").update({
      status: "finished", ended_at: new Date().toISOString(),
      settings: { ...settingsRef.current, winner },
    }).eq("id", sessionId);
    nav(`/app/games/${session.id}/results`);
  };

  const goFullscreen = () => {
    const el = document.documentElement as any;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };

  const humans  = students.filter(s => s.team === "human").sort((a, b) => (b.crypto ?? 0) - (a.crypto ?? 0));
  const zombies = students.filter(s => s.team === "zombie").sort((a, b) => (b.crypto ?? 0) - (a.crypto ?? 0));

  const Roster = ({ team, list }: { team: Team; list: any[] }) => (
    <div className="flex flex-col gap-2 min-h-0">
      <div className="flex items-center gap-1.5 text-xs font-black tracking-widest uppercase shrink-0" style={{ color: TEAM_COLOR[team] }}>
        {team === "human" ? <Users className="h-4 w-4" /> : <Biohazard className="h-4 w-4" />}
        {team === "human" ? (ar ? "البشر" : "Humans") : (ar ? "الزومبي" : "Zombies")} ({list.length})
      </div>
      <div className="space-y-1.5 overflow-y-auto">
        {list.map((s, i) => (
          <div key={s.id} className="pixel-panel flex items-center gap-2.5 px-3 py-2"
            style={{ borderColor: `${TEAM_COLOR[team]}55`, background: `${TEAM_COLOR[team]}0d` }}>
            <span className="font-black text-sm w-5 tabular-nums text-center text-muted-foreground/60">{i + 1}</span>
            <Avatar name={s.name} team={team} />
            <span className="flex-1 text-sm font-bold truncate">{s.name}</span>
            <div className="flex items-center gap-1 font-black tabular-nums text-sm" style={{ color: TEAM_COLOR[team] }}>
              <PixelShield className="h-3.5 w-3.5" color="currentColor" />${s.crypto ?? 0}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="theme-hvz fixed inset-0 text-foreground overflow-hidden font-mono" style={{ background: "#0A0F0A" }}>
      {ConfirmDialog}
      <div className="h-full flex flex-col p-4 gap-3">
        {/* Top bar */}
        <div className="flex items-center justify-between text-xs gap-3 shrink-0">
          <div className="text-muted-foreground">
            {ar ? "الرمز" : "CODE"} <span className="text-primary text-base font-black tracking-widest">{session?.code}</span>
            <span className="mx-3 text-muted-foreground/30">|</span>
            {ar ? "اليوم" : "DAY"} <span className="font-bold text-foreground">{daysSurvived}/{WIN_DAYS}</span>
            <span className="mx-3 text-muted-foreground/30">|</span>
            <span className="font-bold">{daySecsLeft}{ar ? "ث" : "s"}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={goFullscreen} className="text-primary hover:text-primary hover:bg-primary/10">
              <Maximize className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={endNow} className="bg-destructive hover:bg-destructive/90 text-white font-bold">
              <Square className="h-4 w-4 me-1" />{ar ? "إنهاء" : "END"}
            </Button>
          </div>
        </div>

        {/* Dual health bars */}
        <div className="shrink-0 pixel-panel p-3 space-y-2" style={{ borderColor: "hsl(150 20% 25%)" }}>
          {(["human", "zombie"] as Team[]).map(t => (
            <div key={t} className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 w-24 shrink-0 text-xs font-black tracking-widest" style={{ color: TEAM_COLOR[t] }}>
                {t === "human" ? <Users className="h-4 w-4" /> : <Biohazard className="h-4 w-4" />}
                {t === "human" ? (ar ? "البشر" : "HUMAN") : (ar ? "الزومبي" : "ZOMBIE")}
              </div>
              <div className="relative h-4 flex-1 overflow-hidden rounded" style={{ background: "hsl(0 0% 10%)" }}>
                <div className={cn("absolute inset-y-0 left-0 transition-all duration-500", health[t] < maxHealth[t] * 0.25 && "animate-pulse")}
                  style={{ width: `${Math.min(100, (health[t] / maxHealth[t]) * 100)}%`, background: TEAM_COLOR[t] }} />
              </div>
              <span className="text-xs font-black tabular-nums w-20 text-end shrink-0" style={{ color: TEAM_COLOR[t] }}>
                {Math.round(health[t])}/{Math.round(maxHealth[t])}%
              </span>
            </div>
          ))}
        </div>

        {/* Action feed */}
        {recentActions.length > 0 && (
          <div className="shrink-0 pixel-panel px-3 py-2 flex items-center gap-2 overflow-x-auto" style={{ borderColor: "hsl(150 20% 22%)" }}>
            {recentActions.map(a => {
              const action = BATTLE_ACTIONS.find(x => x.key === a.action_key && x.team === a.team);
              return (
                <div key={a.id} className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded" style={{ background: `${TEAM_COLOR[a.team]}1a` }}>
                  <span className="text-xs font-bold" style={{ color: TEAM_COLOR[a.team] }}>{a.student_name}</span>
                  <span className="text-xs text-muted-foreground">{action ? action.nameEn : a.action_key}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Battlefield — the main event on the projector.
            The panel is given the plate's own 1407:768 aspect and centred, so
            the field is shown whole instead of being cover-cropped to whatever
            shape the projector happens to be. */}
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="pixel-panel overflow-hidden max-h-full"
            style={{ borderColor: "hsl(150 20% 25%)", aspectRatio: "1407 / 768", width: "min(100%, calc((100vh - 22rem) * 1.832))" }}>
            <BattleScene
              humans={humans.map(s => ({ id: s.id, name: s.name }))}
              zombies={zombies.map(s => ({ id: s.id, name: s.name }))}
              humanPct={maxHealth.human ? health.human / maxHealth.human : 0}
              zombiePct={maxHealth.zombie ? health.zombie / maxHealth.zombie : 0}
            />
          </div>
        </div>

        {/* Team rosters — a strip under the field, not the main view any more */}
        <div className="shrink-0 grid grid-cols-2 gap-4" style={{ maxHeight: "22vh" }}>
          {students.length === 0 ? (
            <div className="col-span-2 flex items-center justify-center text-primary text-xl animate-pulse py-6">
              {ar ? "> في انتظار اللاعبين..." : "> WAITING FOR PLAYERS..."}
            </div>
          ) : (
            <>
              <Roster team="human" list={humans} />
              <Roster team="zombie" list={zombies} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HumansVsZombiesMonitor;
