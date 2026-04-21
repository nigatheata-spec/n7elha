import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Terminal } from "lucide-react";

const PASSWORDS = ["alpha", "bravo", "delta", "echo", "ghost", "shadow", "matrix", "neon", "quantum", "vortex"];

const Join = () => {
  const [params] = useSearchParams();
  const [code, setCode] = useState((params.get("code") || "").toUpperCase());
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const c = code.trim().toUpperCase();
      const n = name.trim();
      if (c.length !== 4 || !n) { toast.error("أدخل الرمز والاسم"); return; }
      const { data: session, error: se } = await supabase.from("game_sessions")
        .select("*").eq("code", c).in("status", ["lobby", "running"]).maybeSingle();
      if (se) throw se;
      if (!session) { toast.error("الرمز غير صحيح"); return; }
      const password = PASSWORDS[Math.floor(Math.random() * PASSWORDS.length)];
      const { data: student, error } = await supabase.from("game_students")
        .insert({ session_id: session.id, name: n, password }).select().single();
      if (error) throw error;
      localStorage.setItem(`hash_student_${session.id}`, student.id);
      navigate(`/play/${session.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="theme-game min-h-screen bg-background text-foreground bg-grid flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Terminal className="h-14 w-14 mx-auto text-primary text-glow-cyan" />
          <h1 className="font-mono text-4xl font-black text-primary text-glow-cyan mt-3">HASH</h1>
          <p className="text-muted-foreground mt-1 font-mono text-xs">> ENTER ACCESS CODE</p>
        </div>
        <form onSubmit={join} className="space-y-4 border-glow rounded-2xl p-6 bg-card/60 backdrop-blur">
          <div>
            <label className="text-xs font-mono text-muted-foreground">GAME_CODE</label>
            <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={4}
              className="font-mono text-3xl text-center tracking-[0.5em] bg-background/60 border-primary/40 h-16 text-primary" />
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground">USERNAME</label>
            <Input value={name} onChange={e => setName(e.target.value)} maxLength={24}
              className="font-mono bg-background/60 border-primary/40 h-12" placeholder="hacker_01" />
          </div>
          <Button type="submit" disabled={loading}
            className="w-full h-12 bg-primary text-primary-foreground font-mono font-bold tracking-wider shadow-glow hover:bg-primary/90">
            {loading ? "..." : "> CONNECT"}
          </Button>
        </form>
      </div>
    </div>
  );
};
export default Join;
