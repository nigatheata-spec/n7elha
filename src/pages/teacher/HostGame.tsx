import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Play, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";

const genCode = () => {
  const c = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};

const HostGame = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [quiz, setQuiz] = useState<any>(null);
  const [code, setCode] = useState(genCode());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);

  // settings
  const [timePerQ, setTimePerQ] = useState(30);
  const [showTimer, setShowTimer] = useState(true);
  const [hackFreq, setHackFreq] = useState<"low"|"medium"|"high">("medium");
  const [hackPct, setHackPct] = useState(15);
  const [defenseEnabled, setDefenseEnabled] = useState(true);
  const [maxStudents, setMaxStudents] = useState(40);
  const [approveManual, setApproveManual] = useState(false);

  useEffect(() => {
    if (!quizId) return;
    supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle().then(({ data }) => setQuiz(data));
  }, [quizId]);

  // realtime students once session created
  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const { data } = await supabase.from("game_students").select("*").eq("session_id", sessionId).order("joined_at");
      setStudents(data ?? []);
    };
    load();
    const ch = supabase.channel(`lobby-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  const openLobby = async () => {
    if (!user || !quizId) return;
    try {
      const settings = { timePerQ, showTimer, hackFreq, hackPct, defenseEnabled, maxStudents, approveManual };
      const { data, error } = await supabase.from("game_sessions")
        .insert({ teacher_id: user.id, quiz_id: quizId, code, status: "lobby", settings }).select().single();
      if (error) throw error;
      setSessionId(data.id);
      toast.success(t("open_lobby") + " ✓");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const newCode = async () => {
    const c = genCode();
    setCode(c);
    if (sessionId) await supabase.from("game_sessions").update({ code: c }).eq("id", sessionId);
  };

  const copy = () => { navigator.clipboard.writeText(code); toast.success(t("copied")); };

  const startGame = async () => {
    if (!sessionId) return;
    await supabase.from("game_sessions").update({
      status: "running",
      started_at: new Date().toISOString(),
      current_question_index: 0,
    }).eq("id", sessionId);
    navigate(`/app/games/${sessionId}/monitor`);
  };

  const removeStudent = async (id: string) => {
    await supabase.from("game_students").delete().eq("id", id);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="font-display text-3xl font-bold">{t("host_game")}</h1>
        {quiz && <p className="text-muted-foreground mt-1">{quiz.title}</p>}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Settings */}
        <Card className="p-6 space-y-5">
          <h2 className="font-bold text-lg">{t("settings")}</h2>
          <div>
            <Label className="mb-2 block">{t("time_per_q")}: {timePerQ}s</Label>
            <Slider value={[timePerQ]} onValueChange={([v]) => setTimePerQ(v)} min={10} max={120} step={5} />
          </div>
          <div className="flex items-center justify-between">
            <Label>المؤقت ظاهر للطلاب</Label>
            <Switch checked={showTimer} onCheckedChange={setShowTimer} />
          </div>
          <div>
            <Label className="mb-2 block">{t("hack_freq")}</Label>
            <Select value={hackFreq} onValueChange={(v: any) => setHackFreq(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t("low")}</SelectItem>
                <SelectItem value="medium">{t("medium_freq")}</SelectItem>
                <SelectItem value="high">{t("high")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">نسبة الاختراق: {hackPct}%</Label>
            <Slider value={[hackPct]} onValueChange={([v]) => setHackPct(v)} min={5} max={30} step={1} />
          </div>
          <div className="flex items-center justify-between">
            <Label>تفعيل مهام الدفاع</Label>
            <Switch checked={defenseEnabled} onCheckedChange={setDefenseEnabled} />
          </div>
          <div>
            <Label className="mb-2 block">{t("max_students")}</Label>
            <Input type="number" min={2} max={100} value={maxStudents} onChange={e => setMaxStudents(Number(e.target.value))} />
          </div>
          <div className="flex items-center justify-between">
            <Label>الموافقة اليدوية</Label>
            <Switch checked={approveManual} onCheckedChange={setApproveManual} />
          </div>
        </Card>

        {/* Code + Lobby */}
        <Card className="p-6 space-y-5">
          <h2 className="font-bold text-lg">{t("game_code")}</h2>
          <div className="rounded-2xl border-2 border-primary/40 bg-gradient-hero p-6 text-center shadow-glow">
            <div className="font-mono text-6xl font-black tracking-widest text-primary text-glow-cyan">{code}</div>
            <div className="mt-2 text-xs text-muted-foreground">شاركه مع طلابك</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copy} className="flex-1"><Copy className="h-4 w-4 me-2" />{t("copy")}</Button>
            <Button variant="outline" onClick={newCode} className="flex-1">رمز جديد</Button>
          </div>

          {!sessionId ? (
            <Button onClick={openLobby} className="w-full h-12 bg-gradient-cyan shadow-glow text-base">
              <Users className="h-5 w-5 me-2" />{t("open_lobby")}
            </Button>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">{students.length} / {maxStudents} {t("students_connected")}</span>
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                </div>
                {students.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">{t("waiting_students")}...</div>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-auto">
                    {students.map(s => (
                      <div key={s.id} className="flex items-center justify-between bg-background/60 rounded-lg px-3 py-2 text-sm">
                        <span className="font-medium truncate">{s.name}</span>
                        <Button size="sm" variant="ghost" onClick={() => removeStudent(s.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={startGame} disabled={students.length < 1} className="w-full h-12 bg-gradient-cyan shadow-glow text-base">
                <Play className="h-5 w-5 me-2" />{t("start_game")}
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default HostGame;
