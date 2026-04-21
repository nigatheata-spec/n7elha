import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString();

const GameResults = () => {
  const { sessionId } = useParams();
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [hacks, setHacks] = useState<any[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data: s } = await supabase.from("game_sessions").select("*, quizzes(title)").eq("id", sessionId).maybeSingle();
      setSession(s);
      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        setQuestions(qs ?? []);
      }
      const [{ data: ss }, { data: rs }, { data: hs }] = await Promise.all([
        supabase.from("game_students").select("*").eq("session_id", sessionId).order("crypto", { ascending: false }),
        supabase.from("question_responses").select("*").eq("session_id", sessionId),
        supabase.from("hack_events").select("*").eq("session_id", sessionId),
      ]);
      setStudents(ss ?? []); setResponses(rs ?? []); setHacks(hs ?? []);
    })();
  }, [sessionId]);

  const stats = useMemo(() => {
    const totalAns = responses.length;
    const correct = responses.filter(r => r.is_correct).length;
    const succHacks = hacks.filter(h => h.success).length;
    const winner = students[0];
    const dur = session?.started_at && session?.ended_at
      ? Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime())/1000) : 0;
    return {
      avgAcc: totalAns ? (correct/totalAns)*100 : 0,
      succHacks, failHacks: hacks.length - succHacks,
      winner, durationMin: Math.floor(dur/60), durationSec: dur%60,
    };
  }, [responses, hacks, students, session]);

  const exportCsv = () => {
    const rows = [["Rank","Name","Crypto","Correct","Total","Accuracy%","HacksMade","HacksReceived"]];
    students.forEach((s,i) => {
      const acc = s.total_answers ? (s.correct_answers/s.total_answers)*100 : 0;
      rows.push([String(i+1), s.name, String(s.crypto), String(s.correct_answers), String(s.total_answers), acc.toFixed(0), String(s.hacks_made), String(s.hacks_received)]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${session?.quizzes?.title || "game"}-results.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!session) return <div>...</div>;

  return (
    <div className="space-y-5 max-w-6xl">
      <Card className="p-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><div className="text-xs text-muted-foreground">اللعبة</div><div className="font-bold">{session.quizzes?.title}</div></div>
          <div><div className="text-xs text-muted-foreground">المدة</div><div className="font-bold font-mono">{stats.durationMin}m {stats.durationSec}s</div></div>
          <div><div className="text-xs text-muted-foreground">الطلاب</div><div className="font-bold">{students.length}</div></div>
          <div><div className="text-xs text-muted-foreground">متوسط الدقة</div><div className="font-bold text-primary">{stats.avgAcc.toFixed(0)}%</div></div>
          <div><div className="text-xs text-muted-foreground">الفائز 🏆</div><div className="font-bold text-accent">{stats.winner?.name ?? "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">إجمالي الاختراقات</div><div className="font-bold">{hacks.length} ({stats.succHacks}✓ / {stats.failHacks}✗)</div></div>
        </div>
      </Card>

      <Tabs defaultValue="rank">
        <TabsList>
          <TabsTrigger value="rank">الترتيب</TabsTrigger>
          <TabsTrigger value="qa">تحليل الأسئلة</TabsTrigger>
          <TabsTrigger value="hk">ملخص الاختراقات</TabsTrigger>
        </TabsList>

        <TabsContent value="rank">
          <div className="flex justify-end mb-2">
            <Button onClick={exportCsv} variant="outline"><Download className="h-4 w-4 me-2" />تصدير CSV</Button>
          </div>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50"><tr>
                <th className="p-3 text-start">#</th><th className="p-3 text-start">الاسم</th>
                <th className="p-3">كريبتو</th><th className="p-3">صحيحة</th><th className="p-3">دقة</th>
                <th className="p-3">اخترق</th><th className="p-3">تم اختراقه</th>
              </tr></thead>
              <tbody>{students.map((s,i)=>{
                const acc = s.total_answers?(s.correct_answers/s.total_answers)*100:0;
                return <tr key={s.id} className="border-t border-border">
                  <td className="p-3 font-mono">{i+1}{i===0&&<Trophy className="inline h-4 w-4 ms-1 text-accent" />}</td>
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3 text-center font-mono text-accent">{fmt(s.crypto)}</td>
                  <td className="p-3 text-center">{s.correct_answers}/{s.total_answers}</td>
                  <td className="p-3 text-center">{acc.toFixed(0)}%</td>
                  <td className="p-3 text-center">{s.hacks_made}</td>
                  <td className="p-3 text-center">{s.hacks_received}</td>
                </tr>;
              })}</tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="qa">
          <div className="space-y-3">
            {questions.map((q, idx) => {
              const rs = responses.filter(r => r.question_index === idx);
              const correct = rs.filter(r => r.is_correct).length;
              const acc = rs.length ? (correct/rs.length)*100 : 0;
              const dist = [0,0,0,0]; rs.forEach(r => { if(r.answer_index<4) dist[r.answer_index]++; });
              return (
                <Card key={q.id} className={cn("p-5", acc < 50 && "border-destructive/40")}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="font-medium">{idx+1}. {q.text}</p>
                    <div className={cn("font-mono text-sm", acc<50?"text-destructive":"text-success")}>{acc.toFixed(0)}%</div>
                  </div>
                  <div className="space-y-1.5">
                    {q.options.map((o:string, i:number) => {
                      const c = dist[i]; const p = rs.length ? (c/rs.length)*100 : 0;
                      const isC = i === q.correct_index;
                      return (
                        <div key={i}>
                          <div className="text-xs flex justify-between mb-0.5"><span>{String.fromCharCode(65+i)}. {o} {isC&&"✓"}</span><span className="font-mono">{c} ({p.toFixed(0)}%)</span></div>
                          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className={cn("h-full", isC?"bg-success":"bg-primary/50")} style={{width:`${p}%`}} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="hk">
          <div className="grid sm:grid-cols-3 gap-3">
            <Card className="p-5"><div className="text-xs text-muted-foreground">إجمالي</div><div className="text-3xl font-bold">{hacks.length}</div></Card>
            <Card className="p-5 border-success/40"><div className="text-xs text-muted-foreground">ناجح</div><div className="text-3xl font-bold text-success">{stats.succHacks}</div></Card>
            <Card className="p-5 border-destructive/40"><div className="text-xs text-muted-foreground">فاشل</div><div className="text-3xl font-bold text-destructive">{stats.failHacks}</div></Card>
          </div>
          <Card className="mt-3 max-h-[50vh] overflow-auto">
            <ul className="divide-y divide-border">
              {hacks.map(h => {
                const hk = students.find(x=>x.id===h.hacker_id)?.name ?? "?";
                const tg = students.find(x=>x.id===h.target_id)?.name ?? "?";
                return <li key={h.id} className={cn("p-3 text-sm font-mono", h.success?"text-success":"text-destructive")}>
                  {new Date(h.created_at).toLocaleTimeString()} — {hk} → {tg} {h.success?`(+${fmt(h.crypto_transferred)})`:"(فشل)"}
                </li>;
              })}
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
export default GameResults;
