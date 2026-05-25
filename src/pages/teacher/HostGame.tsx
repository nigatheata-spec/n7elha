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

  // Limits: at least one of (minutes, cryptoCap) must be enabled.
  const [useTimer, setUseTimer] = useState(true);
  const [useCap, setUseCap] = useState(true);
  const [minutes, setMinutes] = useState(7);
  const [cryptoCap, setCryptoCap] = useState(2000); // grand total for the room
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
    if (!useTimer && !useCap) { toast.error(ar ? "اختر حدًا واحدًا على الأقل (وقت أو كريبتو)" : "Pick at least one limit"); return; }
    try {
      const settings: any = { maxStudents };
      if (useTimer) settings.minutes = minutes;
      if (useCap) settings.cryptoCap = cryptoCap;
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

          <p className="text-xs text-muted-foreground">{ar ? "اختر حدًا واحدًا على الأقل لإنهاء اللعبة" : "Pick at least one limit to end the game"}</p>

          <div className={`rounded-lg border p-3 ${useTimer ? "border-primary/50 bg-primary/5" : "border-border opacity-60"}`}>
            <label className="flex items-center justify-between mb-2 cursor-pointer">
              <span className="flex items-center gap-2 font-medium"><Clock className="h-4 w-4 text-primary" />{ar ? "مدة اللعبة (دقائق)" : "Game duration (minutes)"}: {minutes}</span>
              <input type="checkbox" checked={useTimer} onChange={e => setUseTimer(e.target.checked)} className="h-4 w-4 accent-primary" />
            </label>
            <Slider value={[minutes]} onValueChange={([v]) => setMinutes(v)} min={2} max={30} step={1} disabled={!useTimer} />
          </div>

          <div className={`rounded-lg border p-3 ${useCap ? "border-primary/50 bg-primary/5" : "border-border opacity-60"}`}>
            <label className="flex items-center justify-between mb-2 cursor-pointer">
              <span className="flex items-center gap-2 font-medium"><Coins className="h-4 w-4 text-primary" />{ar ? "إجمالي الكريبتو للغرفة" : "Total room crypto goal"}: {cryptoCap}</span>
              <input type="checkbox" checked={useCap} onChange={e => setUseCap(e.target.checked)} className="h-4 w-4 accent-primary" />
            </label>
            <Slider value={[cryptoCap]} onValueChange={([v]) => setCryptoCap(v)} min={500} max={20000} step={500} disabled={!useCap} />
            <p className="text-xs text-muted-foreground mt-1">{ar ? "ينتهي عند وصول مجموع الغرفة لهذا الرقم" : "Ends when the room's combined crypto reaches this"}</p>
          </div>

          <div>
            <Label className="mb-2 block">{t("max_students")}</Label>
            <Input type="number" min={2} max={100} value={maxStudents} onChange={e => setMaxStudents(Number(e.target.value))} />
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="font-bold text-lg">{t("game_code")}</h2>
          <div className="rounded-2xl border border-border bg-muted/40 p-6 text-center">
            <div className="font-mono text-6xl font-black tracking-widest text-accent">{code}</div>
            <div className="mt-2 text-xs text-muted-foreground">{ar ? "شارك مع طلابك" : "Share with your students"}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copy} className="flex-1"><Copy className="h-4 w-4 me-2" />{t("copy")}</Button>
            <Button variant="outline" onClick={newCode} className="flex-1">{ar ? "رمز جديد" : "New code"}</Button>
          </div>

          {!sessionId ? (
            <Button onClick={openLobby} className="w-full h-12 bg-accent text-white hover:bg-accent/90 text-base">
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
              <Button onClick={startGame} disabled={students.length < 1} className="w-full h-12 bg-accent text-white hover:bg-accent/90 text-base">
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
