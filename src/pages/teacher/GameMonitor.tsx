import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SkipForward, Square, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fmt = (n: number) => n.toLocaleString();

const GameMonitor = () => {
  const { sessionId } = useParams();
  const nav = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [hacks, setHacks] = useState<any[]>([]);
  const [hackFilter, setHackFilter] = useState<"all"|"success"|"fail">("all");

  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const { data: s } = await supabase.from("game_sessions").select("*, quizzes(id, title)").eq("id", sessionId).maybeSingle();
      setSession(s);
      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        setQuestions(qs ?? []);
      }
    };
    load();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const refresh = async () => {
      const [{ data: ss }, { data: rs }, { data: hs }] = await Promise.all([
        supabase.from("game_students").select("*").eq("session_id", sessionId).order("crypto", { ascending: false }),
        supabase.from("question_responses").select("*").eq("session_id", sessionId),
        supabase.from("hack_events").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }),
      ]);
      setStudents(ss ?? []); setResponses(rs ?? []); setHacks(hs ?? []);
    };
    refresh();
    const ch = supabase.channel(`monitor-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` }, (p:any) => setSession((prev:any)=>({...prev,...p.new})))
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "question_responses", filter: `session_id=eq.${sessionId}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hack_events", filter: `session_id=eq.${sessionId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  const qIdx = session?.current_question_index ?? 0;
  const currentQ = questions[qIdx];
  const currentResponses = responses.filter(r => r.question_index === qIdx);
  const distribution = useMemo(() => {
    const d = [0,0,0,0];
    currentResponses.forEach(r => { if (r.answer_index >= 0 && r.answer_index < 4) d[r.answer_index]++; });
    return d;
  }, [currentResponses]);

  const startNext = async () => {
    if (!session) return;
    if (qIdx + 1 >= questions.length) {
      await endGame();
      return;
    }
    await supabase.from("game_sessions").update({
      current_question_index: qIdx + 1,
      current_question_started_at: new Date().toISOString(),
    }).eq("id", session.id);
  };

  const startFirst = async () => {
    if (!session) return;
    await supabase.from("game_sessions").update({
      current_question_index: 0,
      current_question_started_at: new Date().toISOString(),
    }).eq("id", session.id);
  };

  const endGame = async () => {
    if (!session) return;
    await supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", session.id);
    toast.success("انتهت اللعبة");
    nav(`/app/games/${session.id}/results`);
  };

  if (!session) return <div>...</div>;

  const filteredHacks = hacks.filter(h => hackFilter === "all" ? true : hackFilter === "success" ? h.success : !h.success);
  const answeredCount = new Set(currentResponses.map(r => r.student_id)).size;
  const notStarted = !session.current_question_started_at;

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{session.quizzes?.title}</h1>
          <p className="text-muted-foreground text-sm font-mono">CODE: <span className="text-primary">{session.code}</span> · Q {qIdx+1}/{questions.length}</p>
        </div>
        <div className="flex gap-2">
          {notStarted ? (
            <Button onClick={startFirst} className="bg-gradient-cyan shadow-glow"><Play className="h-4 w-4 me-2" />ابدأ السؤال الأول</Button>
          ) : (
            <Button onClick={startNext} className="bg-gradient-cyan"><SkipForward className="h-4 w-4 me-2" />السؤال التالي</Button>
          )}
          <Button variant="destructive" onClick={endGame}><Square className="h-4 w-4 me-2" />إنهاء</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-5">
        <Card className="p-4 space-y-3 h-fit">
          <div className="text-xs text-muted-foreground">الطلاب المتصلون</div>
          <div className="text-3xl font-bold">{students.length}</div>
          <div className="text-xs text-muted-foreground">أجابوا على هذا السؤال</div>
          <div className="text-2xl font-bold text-primary">{answeredCount} / {students.length}</div>
        </Card>

        <Tabs defaultValue="current">
          <TabsList>
            <TabsTrigger value="current">السؤال الحالي</TabsTrigger>
            <TabsTrigger value="leaderboard">الترتيب</TabsTrigger>
            <TabsTrigger value="hacks">سجل الاختراقات ({hacks.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="current">
            <Card className="p-6">
              {!currentQ ? <p className="text-muted-foreground">لا يوجد سؤال نشط</p> : (
                <>
                  <p className="text-lg font-medium mb-4">{currentQ.text}</p>
                  <div className="space-y-2">
                    {currentQ.options.map((o: string, i: number) => {
                      const count = distribution[i];
                      const pct = currentResponses.length ? (count / currentResponses.length) * 100 : 0;
                      const isCorrect = i === currentQ.correct_index;
                      return (
                        <div key={i} className={cn("rounded-lg border-2 p-3", isCorrect ? "border-success bg-success/10" : "border-border")}>
                          <div className="flex items-center justify-between mb-1.5 text-sm">
                            <span><span className="font-mono me-2 opacity-60">{String.fromCharCode(65+i)}.</span>{o} {isCorrect && <Badge className="ms-2 bg-success">✓</Badge>}</span>
                            <span className="font-mono text-xs">{count} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div className={cn("h-full transition-all", isCorrect ? "bg-success" : "bg-primary/60")} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard">
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs">
                  <tr><th className="p-3 text-start">#</th><th className="p-3 text-start">الاسم</th><th className="p-3">كريبتو</th><th className="p-3">صحيحة</th><th className="p-3">دقة</th><th className="p-3">اخترق</th><th className="p-3">تم اختراقه</th></tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const acc = s.total_answers ? (s.correct_answers / s.total_answers) * 100 : 0;
                    return (
                      <tr key={s.id} className="border-t border-border">
                        <td className="p-3 font-mono">{i+1}</td>
                        <td className="p-3 font-medium">{s.name}</td>
                        <td className="p-3 text-center font-mono text-accent">{fmt(s.crypto)}</td>
                        <td className="p-3 text-center">{s.correct_answers}/{s.total_answers}</td>
                        <td className="p-3 text-center">{acc.toFixed(0)}%</td>
                        <td className="p-3 text-center">{s.hacks_made}</td>
                        <td className="p-3 text-center">{s.hacks_received}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="hacks">
            <div className="flex gap-2 mb-3">
              {(["all","success","fail"] as const).map(f => (
                <Button key={f} size="sm" variant={hackFilter===f?"default":"outline"} onClick={()=>setHackFilter(f)}>
                  {f==="all"?"الكل":f==="success"?"ناجح":"فاشل"}
                </Button>
              ))}
            </div>
            <Card className="max-h-[60vh] overflow-auto">
              {filteredHacks.length === 0 ? <div className="p-6 text-center text-muted-foreground">لا يوجد</div> : (
                <ul className="divide-y divide-border">
                  {filteredHacks.map(h => {
                    const hk = students.find(x=>x.id===h.hacker_id)?.name ?? "?";
                    const tg = students.find(x=>x.id===h.target_id)?.name ?? "?";
                    const t = new Date(h.created_at).toLocaleTimeString();
                    return (
                      <li key={h.id} className={cn("p-3 text-sm font-mono", h.success ? "text-success" : "text-destructive")}>
                        {t} — {hk} {h.success ? "اخترق" : "فشل في اختراق"} {tg}
                        {h.success && <span className="ms-2 text-accent">+{fmt(h.crypto_transferred)}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
export default GameMonitor;
