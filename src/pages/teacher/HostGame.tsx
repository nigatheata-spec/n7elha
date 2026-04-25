import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Play, Users, Trash2, Clock, Coins } from "lucide-react";
import { toast } from "sonner";

const genCode = () => {
  const c = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};

const HostGame = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const { user } = useAuth();

  const [quiz, setQuiz] = useState<any>(null);
  const [code, setCode] = useState(genCode());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);

  // simplified settings: time, crypto cap, time per question
  const [timePerQ, setTimePerQ] = useState(20);
  const [minutes, setMinutes] = useState(7);
  const [cryptoCap, setCryptoCap] = useState(1000);
  const [maxStudents, setMaxStudents] = useState(40);

  useEffect(() => {
    if (!quizId) return;
    supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle().then(({ data }) => setQuiz(data));
  }, [quizId]);

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
      const settings = { timePerQ, minutes, cryptoCap, maxStudents };
      const { data, error } = await supabase.from("game_sessions")
        .insert({ teacher_id: user.id, quiz_id: quizId, code, status: "lobby", settings }).select().single();
      if (error) throw error;
      setSessionId(data.id);
      toast.success("✓");
    } catch (e: any) { toast.error(e.message); }
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
      current_question_started_at: new Date().toISOString(),
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
        <Card className="p-6 space-y-5">
          <h2 className="font-bold text-lg">{ar ? "إعدادات اللعبة" : "Game settings"}</h2>

          <div>
            <Label className="mb-2 flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />{ar ? "مدة اللعبة (دقائق)" : "Game duration (minutes)"}: {minutes}</Label>
            <Slider value={[minutes]} onValueChange={([v]) => setMinutes(v)} min={2} max={20} step={1} />
            <p className="text-xs text-muted-foreground mt-1">{ar ? "تنتهي اللعبة بعد انقضاء الوقت" : "Game ends when time runs out"}</p>
          </div>

          <div>
            <Label className="mb-2 flex items-center gap-2"><Coins className="h-4 w-4 text-primary" />{ar ? "هدف الكريبتو" : "Crypto goal"}: {cryptoCap}</Label>
            <Slider value={[cryptoCap]} onValueChange={([v]) => setCryptoCap(v)} min={200} max={5000} step={100} />
            <p className="text-xs text-muted-foreground mt-1">{ar ? "تنتهي إذا وصل أحد إلى هذا الرقم" : "Game ends when any player reaches this"}</p>
          </div>

          <div>
            <Label className="mb-2 block">{ar ? "وقت كل سؤال (ث)" : "Time per question (s)"}: {timePerQ}</Label>
            <Slider value={[timePerQ]} onValueChange={([v]) => setTimePerQ(v)} min={10} max={60} step={5} />
          </div>

          <div>
            <Label className="mb-2 block">{t("max_students")}</Label>
            <Input type="number" min={2} max={100} value={maxStudents} onChange={e => setMaxStudents(Number(e.target.value))} />
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="font-bold text-lg">{t("game_code")}</h2>
          <div className="rounded-2xl border-2 border-primary/40 bg-gradient-hero p-6 text-center shadow-glow">
            <div className="font-mono text-6xl font-black tracking-widest text-primary text-glow-cyan">{code}</div>
            <div className="mt-2 text-xs text-muted-foreground">{ar ? "شارك مع طلابك" : "Share with your students"}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copy} className="flex-1"><Copy className="h-4 w-4 me-2" />{t("copy")}</Button>
            <Button variant="outline" onClick={newCode} className="flex-1">{ar ? "رمز جديد" : "New code"}</Button>
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
