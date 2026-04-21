import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TaskKey = "upload" | "tap10" | "simon" | "slider" | "reorder" | "match" | "memory" | "speed";
const TASKS: TaskKey[] = ["upload","tap10","simon","slider","reorder","match","memory","speed"];

export const BreachModal = ({ me, onDone }: { me: any; onDone: () => void }) => {
  const task = useMemo<TaskKey>(() => TASKS[Math.floor(Math.random() * TASKS.length)], []);
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex items-center justify-center p-4 animate-fade-in">
      <div className="max-w-lg w-full border-2 border-destructive rounded-2xl bg-card p-6 shadow-[0_0_60px_hsl(0_100%_60%/0.5)]">
        <div className="text-center mb-4">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive animate-pulse" />
          <h2 className="font-mono text-2xl text-destructive mt-2">⚠ SECURITY_BREACH ⚠</h2>
          <p className="font-mono text-xs text-muted-foreground mt-1">DEFEND TO RECOVER ACCESS</p>
        </div>
        <Task taskKey={task} onDone={onDone} />
      </div>
    </div>
  );
};

const Task = ({ taskKey, onDone }: { taskKey: TaskKey; onDone: () => void }) => {
  if (taskKey === "upload") return <Upload onDone={onDone} />;
  if (taskKey === "tap10") return <Tap10 onDone={onDone} />;
  if (taskKey === "simon") return <Simon onDone={onDone} />;
  if (taskKey === "slider") return <SliderT onDone={onDone} />;
  if (taskKey === "reorder") return <Reorder onDone={onDone} />;
  if (taskKey === "match") return <Match onDone={onDone} />;
  if (taskKey === "memory") return <Memory onDone={onDone} />;
  return <Speed onDone={onDone} />;
};

const Upload = ({ onDone }: { onDone: () => void }) => {
  const [p, setP] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setP(x => Math.min(100, x + 2)), 100);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (p >= 100) setTimeout(onDone, 400); }, [p]);
  return (
    <div className="space-y-3">
      <div className="font-mono text-sm">UPLOADING_PATCH...</div>
      <div className="h-3 rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-primary shadow-glow transition-all" style={{ width: `${p}%` }} />
      </div>
      <div className="font-mono text-xs text-end">{p}%</div>
    </div>
  );
};

const Tap10 = ({ onDone }: { onDone: () => void }) => {
  const [next, setNext] = useState(1);
  const order = useMemo(() => Array.from({length:10}, (_,i)=>i+1).sort(()=>Math.random()-0.5), []);
  return (
    <div>
      <div className="font-mono text-sm mb-2">TAP_1_TO_10 — NEXT: <span className="text-primary">{next}</span></div>
      <div className="grid grid-cols-5 gap-2">
        {order.map(n => (
          <button key={n} disabled={n < next} onClick={() => {
            if (n === next) { if (n === 10) onDone(); else setNext(n+1); }
          }} className={cn("aspect-square rounded-lg font-mono text-xl border-2",
            n < next ? "opacity-20" : "border-primary/50 bg-card hover:bg-primary/10")}>{n}</button>
        ))}
      </div>
    </div>
  );
};

const COLORS = ["bg-primary","bg-success","bg-destructive","bg-accent"];
const Simon = ({ onDone }: { onDone: () => void }) => {
  const seq = useMemo(() => Array.from({length:5}, () => Math.floor(Math.random()*4)), []);
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(-1);
  const [showing, setShowing] = useState(true);
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      setShow(seq[i]);
      setTimeout(() => setShow(-1), 350);
      i++;
      if (i >= seq.length) { clearInterval(t); setTimeout(()=>setShowing(false), 500); }
    }, 600);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <div className="font-mono text-sm mb-2">{showing ? "WATCH_SEQUENCE" : "REPEAT_SEQUENCE"} ({step}/{seq.length})</div>
      <div className="grid grid-cols-2 gap-2">
        {COLORS.map((c, i) => (
          <button key={i} disabled={showing}
            onClick={() => {
              if (i === seq[step]) { if (step+1 === seq.length) onDone(); else setStep(step+1); }
              else setStep(0);
            }}
            className={cn("aspect-square rounded-lg border-2 border-border transition-all", c, show===i && "scale-95 ring-4 ring-white/60")} />
        ))}
      </div>
    </div>
  );
};

const SliderT = ({ onDone }: { onDone: () => void }) => {
  const target = useMemo(() => 30 + Math.floor(Math.random()*40), []);
  const [v, setV] = useState(0);
  const ok = Math.abs(v - target) <= 1;
  return (
    <div className="space-y-3">
      <div className="font-mono text-sm">SLIDE_TO: <span className="text-primary">{target}</span></div>
      <input type="range" min={0} max={100} value={v} onChange={e=>setV(+e.target.value)} className="w-full" />
      <div className="font-mono text-center">{v}</div>
      <Button disabled={!ok} onClick={onDone} className="w-full bg-primary text-primary-foreground">CONFIRM</Button>
    </div>
  );
};

const Reorder = ({ onDone }: { onDone: () => void }) => {
  const [arr, setArr] = useState(() => [1,2,3,4,5].sort(()=>Math.random()-0.5));
  const sorted = arr.every((v,i,a) => i===0 || a[i-1] <= v);
  return (
    <div className="space-y-3">
      <div className="font-mono text-sm">SORT_ASCENDING (TAP TO SWAP RIGHT)</div>
      <div className="grid grid-cols-5 gap-2">
        {arr.map((n,i) => (
          <button key={i} onClick={() => {
            if (i === arr.length-1) return;
            const a = [...arr]; [a[i], a[i+1]] = [a[i+1], a[i]]; setArr(a);
          }} className="aspect-square rounded-lg border-2 border-primary/50 bg-card font-mono text-xl">{n}</button>
        ))}
      </div>
      <Button disabled={!sorted} onClick={onDone} className="w-full bg-primary text-primary-foreground">CONFIRM</Button>
    </div>
  );
};

const Match = ({ onDone }: { onDone: () => void }) => {
  const pairs = useMemo(() => {
    const items = ["A","B","C","D"];
    return [...items, ...items].sort(()=>Math.random()-0.5);
  }, []);
  const [open, setOpen] = useState<number[]>([]);
  const [done, setDone] = useState<number[]>([]);
  useEffect(() => {
    if (open.length === 2) {
      if (pairs[open[0]] === pairs[open[1]]) {
        setDone(d => [...d, ...open]); setOpen([]);
      } else setTimeout(() => setOpen([]), 600);
    }
  }, [open]);
  useEffect(() => { if (done.length === pairs.length) setTimeout(onDone, 400); }, [done]);
  return (
    <div>
      <div className="font-mono text-sm mb-2">MATCH_PAIRS</div>
      <div className="grid grid-cols-4 gap-2">
        {pairs.map((v,i) => {
          const flipped = open.includes(i) || done.includes(i);
          return <button key={i} disabled={flipped} onClick={() => open.length<2 && setOpen([...open,i])}
            className={cn("aspect-square rounded-lg border-2 font-mono text-xl",
              flipped ? "border-primary bg-primary/10 text-primary" : "border-border bg-card")}>
              {flipped ? v : "?"}
            </button>;
        })}
      </div>
    </div>
  );
};

const Memory = ({ onDone }: { onDone: () => void }) => <Match onDone={onDone} />;

const Speed = ({ onDone }: { onDone: () => void }) => {
  const [n, setN] = useState(12);
  return (
    <div>
      <div className="font-mono text-sm mb-2">CLICK_{n}_TIMES</div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({length:12}).map((_,i) => (
          <button key={i} onClick={() => { if (n>1) setN(n-1); else onDone(); }}
            className="aspect-square rounded-lg border-2 border-primary/50 bg-card hover:bg-primary/10" />
        ))}
      </div>
    </div>
  );
};
