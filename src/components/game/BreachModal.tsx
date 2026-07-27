import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type TaskKey = "upload" | "tap10" | "simon" | "slider" | "reorder" | "match" | "memory" | "speed";
const TASKS: TaskKey[] = ["upload","tap10","simon","slider","reorder","match","memory","speed"];

const TEAL = "#3F5A63";
const CORAL = "#FF8254";
const GREEN = "#3a9e6e";
const RED = "#dc2626";

const pillBtn = "rounded-full border-2 border-[hsl(var(--nb-border))] px-5 py-2.5 text-sm font-semibold shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_0_hsl(var(--nb-border))] transition-all disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_0_hsl(var(--nb-border))] disabled:cursor-not-allowed";
const tile = "rounded-xl border-2 border-[hsl(var(--nb-border))] bg-white shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all";

export const BreachModal = ({ me, onDone, ar }: { me: any; onDone: () => void; ar?: boolean }) => {
  const task = useMemo<TaskKey>(() => TASKS[Math.floor(Math.random() * TASKS.length)], []);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div
        className="max-w-lg w-full rounded-2xl bg-white p-6"
        style={{ border: `2px solid hsl(199 23% 18%)`, boxShadow: "6px 6px 0 0 hsl(199 23% 18%)" }}
      >
        <div className="text-center mb-5">
          <div
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[hsl(var(--nb-border))] mb-3"
            style={{ background: `${CORAL}18`, color: CORAL }}
          >
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold" style={{ color: TEAL, fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
            {ar ? "أنت تحت الاختراق!" : "You're under attack!"}
          </h2>
          <p className="text-sm text-black/45 mt-1">{ar ? "دافع لاستعادة الوصول" : "Defend yourself to recover access"}</p>
        </div>
        <Task taskKey={task} onDone={onDone} ar={ar} />
      </div>
    </div>
  );
};

const Task = ({ taskKey, onDone, ar }: { taskKey: TaskKey; onDone: () => void; ar?: boolean }) => {
  if (taskKey === "upload") return <Upload onDone={onDone} ar={ar} />;
  if (taskKey === "tap10") return <Tap10 onDone={onDone} ar={ar} />;
  if (taskKey === "simon") return <Simon onDone={onDone} ar={ar} />;
  if (taskKey === "slider") return <SliderT onDone={onDone} ar={ar} />;
  if (taskKey === "reorder") return <Reorder onDone={onDone} ar={ar} />;
  if (taskKey === "match") return <Match onDone={onDone} ar={ar} />;
  if (taskKey === "memory") return <Memory onDone={onDone} ar={ar} />;
  return <Speed onDone={onDone} ar={ar} />;
};

const Upload = ({ onDone, ar }: { onDone: () => void; ar?: boolean }) => {
  const [p, setP] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setP(x => Math.min(100, x + 2)), 100);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (p >= 100) setTimeout(onDone, 400); }, [p]);
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold" style={{ color: TEAL }}>{ar ? "جارٍ تثبيت الترقيع الأمني..." : "Installing security patch..."}</div>
      <div className="h-3 rounded-full overflow-hidden border-2 border-[hsl(var(--nb-border))] bg-[hsl(40_47%_85%)]">
        <div className="h-full transition-all" style={{ width: `${p}%`, background: GREEN }} />
      </div>
      <div className="text-xs text-end font-semibold" style={{ color: TEAL }}>{p}%</div>
    </div>
  );
};

const Tap10 = ({ onDone, ar }: { onDone: () => void; ar?: boolean }) => {
  const [next, setNext] = useState(1);
  const order = useMemo(() => Array.from({length:10}, (_,i)=>i+1).sort(()=>Math.random()-0.5), []);
  return (
    <div>
      <div className="text-sm font-semibold mb-3" style={{ color: TEAL }}>
        {ar ? "اضغط من 1 إلى 10 — التالي:" : "Tap 1 to 10 — next:"} <span style={{ color: GREEN }}>{next}</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {order.map(n => (
          <button key={n} disabled={n < next} onClick={() => {
            if (n === next) { if (n === 10) onDone(); else setNext(n+1); }
          }} className={cn(tile, "aspect-square text-lg font-bold", n < next ? "opacity-20" : "hover:translate-x-px hover:translate-y-px")}
          style={{ color: TEAL }}>{n}</button>
        ))}
      </div>
    </div>
  );
};

const SIMON_COLORS = [TEAL, GREEN, CORAL, "#C8783A"];
const Simon = ({ onDone, ar }: { onDone: () => void; ar?: boolean }) => {
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
      <div className="text-sm font-semibold mb-3" style={{ color: TEAL }}>
        {showing ? (ar ? "راقب التسلسل" : "Watch the sequence") : (ar ? "كرّر التسلسل" : "Repeat the sequence")} ({step}/{seq.length})
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SIMON_COLORS.map((c, i) => (
          <button key={i} disabled={showing}
            onClick={() => {
              if (i === seq[step]) { if (step+1 === seq.length) onDone(); else setStep(step+1); }
              else setStep(0);
            }}
            className={cn("aspect-square rounded-xl border-2 border-[hsl(var(--nb-border))] transition-all", show===i && "scale-95")}
            style={{ background: c, boxShadow: "2px 2px 0 0 hsl(199 23% 18%)" }} />
        ))}
      </div>
    </div>
  );
};

const SliderT = ({ onDone, ar }: { onDone: () => void; ar?: boolean }) => {
  const target = useMemo(() => 30 + Math.floor(Math.random()*40), []);
  const [v, setV] = useState(0);
  const ok = Math.abs(v - target) <= 1;
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold" style={{ color: TEAL }}>
        {ar ? "حرّك إلى:" : "Slide to:"} <span style={{ color: GREEN }}>{target}</span>
      </div>
      <input type="range" min={0} max={100} value={v} onChange={e=>setV(+e.target.value)} className="w-full accent-[#3a9e6e]" />
      <div className="text-center font-bold" style={{ color: TEAL }}>{v}</div>
      <button disabled={!ok} onClick={onDone} className={cn(pillBtn, "w-full text-white")} style={{ background: TEAL }}>
        {ar ? "تأكيد" : "Confirm"}
      </button>
    </div>
  );
};

const Reorder = ({ onDone, ar }: { onDone: () => void; ar?: boolean }) => {
  const [arr, setArr] = useState(() => [1,2,3,4,5].sort(()=>Math.random()-0.5));
  const sorted = arr.every((v,i,a) => i===0 || a[i-1] <= v);
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold" style={{ color: TEAL }}>
        {ar ? "رتّب تصاعدياً (اضغط للتبديل مع اليمين)" : "Sort ascending (tap to swap right)"}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {arr.map((n,i) => (
          <button key={i} onClick={() => {
            if (i === arr.length-1) return;
            const a = [...arr]; [a[i], a[i+1]] = [a[i+1], a[i]]; setArr(a);
          }} className={cn(tile, "aspect-square text-lg font-bold hover:translate-x-px hover:translate-y-px")} style={{ color: TEAL }}>{n}</button>
        ))}
      </div>
      <button disabled={!sorted} onClick={onDone} className={cn(pillBtn, "w-full text-white")} style={{ background: TEAL }}>
        {ar ? "تأكيد" : "Confirm"}
      </button>
    </div>
  );
};

const Match = ({ onDone, ar }: { onDone: () => void; ar?: boolean }) => {
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
      <div className="text-sm font-semibold mb-3" style={{ color: TEAL }}>{ar ? "طابق الأزواج" : "Match the pairs"}</div>
      <div className="grid grid-cols-4 gap-2">
        {pairs.map((v,i) => {
          const flipped = open.includes(i) || done.includes(i);
          return (
            <button key={i} disabled={flipped} onClick={() => open.length<2 && setOpen([...open,i])}
              className={cn(tile, "aspect-square text-lg font-bold")}
              style={{ color: flipped ? GREEN : TEAL, borderColor: flipped ? GREEN : "hsl(199 23% 18%)" }}>
              {flipped ? v : "?"}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const Memory = ({ onDone, ar }: { onDone: () => void; ar?: boolean }) => <Match onDone={onDone} ar={ar} />;

const Speed = ({ onDone, ar }: { onDone: () => void; ar?: boolean }) => {
  const [n, setN] = useState(12);
  return (
    <div>
      <div className="text-sm font-semibold mb-3" style={{ color: TEAL }}>
        {ar ? `اضغط ${n} مرات` : `Tap ${n} more times`}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({length:12}).map((_,i) => (
          <button key={i} onClick={() => { if (n>1) setN(n-1); else onDone(); }}
            className={cn(tile, "aspect-square hover:translate-x-px hover:translate-y-px")} />
        ))}
      </div>
    </div>
  );
};
