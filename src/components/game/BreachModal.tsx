import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// A hacked player has to earn their way back in. Every task needs real
// attention, and a mistake costs progress: nothing here finishes by itself or
// by mashing the screen.
type TaskKey = "code" | "simon" | "tap" | "match" | "sort";
const TASKS: TaskKey[] = ["code", "simon", "tap", "match", "sort"];

const G = "hsl(120 90% 62%)";
const G_DIM = "hsl(120 100% 55% / 0.45)";
const RED = "hsl(0 85% 60%)";

const shuffle = <T,>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export const BreachModal = ({ onDone, ar }: { me?: unknown; onDone: () => void; ar?: boolean }) => {
  const task = useMemo<TaskKey>(() => TASKS[Math.floor(Math.random() * TASKS.length)], []);
  return (
    <div dir={ar ? "rtl" : "ltr"} className="fixed inset-0 z-50 flex items-center justify-center p-4 font-mono" style={{ background: "rgba(5,5,5,0.94)" }}>
      <div className="max-w-md w-full p-5 sm:p-6" style={{ border: `2px solid ${RED}`, background: "#0a0f0c", boxShadow: `0 0 50px hsl(0 100% 60% / 0.35)` }}>
        <div className="text-center mb-5">
          <AlertTriangle className="h-10 w-10 mx-auto animate-pulse" style={{ color: RED }} />
          <h2 className="text-xl sm:text-2xl font-black mt-2" style={{ color: RED }}>{ar ? "تم اختراقك" : "YOU GOT HACKED"}</h2>
          <p className="text-xs mt-1" style={{ color: "hsl(0 0% 70%)" }}>{ar ? "أكمل المهمة لتستعيد الوصول" : "Finish the task to get back in"}</p>
        </div>
        <Task taskKey={task} onDone={onDone} ar={ar} />
      </div>
    </div>
  );
};

const Task = ({ taskKey, onDone, ar }: { taskKey: TaskKey; onDone: () => void; ar?: boolean }) => {
  if (taskKey === "code") return <TypeCode onDone={onDone} ar={ar} />;
  if (taskKey === "simon") return <Simon onDone={onDone} ar={ar} />;
  if (taskKey === "tap") return <TapInOrder onDone={onDone} ar={ar} />;
  if (taskKey === "match") return <Match onDone={onDone} ar={ar} />;
  return <Sort onDone={onDone} ar={ar} />;
};

const Prompt = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm mb-3" style={{ color: G }}>{children}</div>
);

/** Retype a 7-character access code. Only the code counts, no near misses. */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TypeCode = ({ onDone, ar }: { onDone: () => void; ar?: boolean }) => {
  const [code, setCode] = useState(() => Array.from({ length: 7 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(""));
  const [v, setV] = useState("");
  const [bad, setBad] = useState(false);
  const submit = () => {
    if (v.trim().toUpperCase() === code) return onDone();
    setBad(true);
    setV("");
    // A wrong code rotates it, so it can't be fixed by editing one letter.
    setCode(Array.from({ length: 7 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(""));
    setTimeout(() => setBad(false), 900);
  };
  return (
    <div>
      <Prompt>{ar ? "> اكتب رمز الوصول بالضبط" : "> type the access code exactly"}</Prompt>
      <div className="text-center text-3xl font-black tracking-[0.25em] py-3 mb-3 select-none" dir="ltr"
        style={{ color: "hsl(0 0% 96%)", border: `2px solid ${G_DIM}` }}>
        {code}
      </div>
      <input
        value={v}
        onChange={e => setV(e.target.value.toUpperCase().slice(0, 7))}
        onKeyDown={e => e.key === "Enter" && submit()}
        onPaste={e => e.preventDefault()}
        autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
        dir="ltr"
        className="w-full bg-transparent text-center text-2xl font-bold tracking-[0.25em] py-2.5 outline-none"
        style={{ border: `2px solid ${bad ? RED : G}`, color: G }}
        placeholder="_______"
      />
      <button onClick={submit} disabled={v.length < 7} className="mt-3 w-full py-3 font-bold disabled:opacity-40"
        style={{ background: G, color: "#06110d" }}>
        {bad ? (ar ? "رمز خاطئ — رمز جديد" : "WRONG — NEW CODE") : (ar ? "إرسال" : "SUBMIT")}
      </button>
    </div>
  );
};

/** Repeat a 6-step sequence. A mistake replays it from the start. */
const PADS = ["hsl(120 80% 45%)", "hsl(200 90% 55%)", "hsl(0 80% 55%)", "hsl(45 95% 55%)"];
const Simon = ({ onDone, ar }: { onDone: () => void; ar?: boolean }) => {
  const seq = useMemo(() => Array.from({ length: 6 }, () => Math.floor(Math.random() * 4)), []);
  const [step, setStep] = useState(0);
  const [lit, setLit] = useState(-1);
  const [showing, setShowing] = useState(true);
  const [round, setRound] = useState(0);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setShowing(true);
    const timers: ReturnType<typeof setTimeout>[] = [];
    seq.forEach((p, i) => {
      timers.push(setTimeout(() => setLit(p), 700 + i * 650));
      timers.push(setTimeout(() => setLit(-1), 700 + i * 650 + 400));
    });
    timers.push(setTimeout(() => setShowing(false), 700 + seq.length * 650));
    return () => timers.forEach(clearTimeout);
  }, [seq, round]);
  const press = (i: number) => {
    if (showing) return;
    if (i === seq[step]) {
      if (step + 1 === seq.length) onDone(); else setStep(step + 1);
    } else {
      setBad(true); setStep(0);
      setTimeout(() => { setBad(false); setRound(r => r + 1); }, 700);
    }
  };
  return (
    <div>
      <Prompt>
        {showing ? (ar ? "> راقب التسلسل" : "> watch the sequence") : (ar ? "> كرّره" : "> repeat it")}
        <span className="ms-2 opacity-70">{step}/{seq.length}</span>
      </Prompt>
      <div className="grid grid-cols-2 gap-2.5" style={{ outline: bad ? `2px solid ${RED}` : "none", outlineOffset: 4 }}>
        {PADS.map((c, i) => (
          <button key={i} onClick={() => press(i)} disabled={showing}
            className="aspect-[4/3] transition-all duration-100"
            style={{ background: c, opacity: lit === i ? 1 : showing ? 0.25 : 0.55, transform: lit === i ? "scale(0.96)" : "none", boxShadow: lit === i ? `0 0 24px ${c}` : "none" }} />
        ))}
      </div>
    </div>
  );
};

/** Tap 1 to 16 in order. A wrong tap reshuffles the grid and starts over. */
const TapInOrder = ({ onDone, ar }: { onDone: () => void; ar?: boolean }) => {
  const N = 16;
  const [order, setOrder] = useState(() => shuffle(Array.from({ length: N }, (_, i) => i + 1)));
  const [next, setNext] = useState(1);
  const [bad, setBad] = useState(false);
  const tap = (n: number) => {
    if (n < next) return;
    if (n === next) { if (n === N) onDone(); else setNext(n + 1); return; }
    setBad(true); setNext(1); setOrder(shuffle(order));
    setTimeout(() => setBad(false), 600);
  };
  return (
    <div>
      <Prompt>{ar ? `> اضغط من 1 إلى ${N} بالترتيب — التالي:` : `> tap 1 to ${N} in order — next:`} <b style={{ color: "hsl(0 0% 96%)" }}>{next}</b></Prompt>
      <div className="grid grid-cols-4 gap-2" style={{ outline: bad ? `2px solid ${RED}` : "none", outlineOffset: 4 }}>
        {order.map(n => (
          <button key={n} onClick={() => tap(n)}
            className="aspect-square text-xl font-black"
            style={{ border: `2px solid ${n < next ? "transparent" : G_DIM}`, color: n < next ? "transparent" : G }}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
};

/** Find 6 pairs. Cards only show while two are open. */
const SYMBOLS = ["#", "$", "%", "&", "@", "λ"];
const Match = ({ onDone, ar }: { onDone: () => void; ar?: boolean }) => {
  const cards = useMemo(() => shuffle([...SYMBOLS, ...SYMBOLS]), []);
  const [open, setOpen] = useState<number[]>([]);
  const [done, setDone] = useState<number[]>([]);
  const finished = useRef(false);
  const flip = (i: number) => {
    if (open.length === 2 || open.includes(i) || done.includes(i)) return;
    const o = [...open, i];
    setOpen(o);
    if (o.length < 2) return;
    if (cards[o[0]] === cards[o[1]]) {
      const d = [...done, ...o];
      setDone(d); setOpen([]);
      if (d.length === cards.length && !finished.current) { finished.current = true; setTimeout(onDone, 400); }
    } else setTimeout(() => setOpen([]), 700);
  };
  return (
    <div>
      <Prompt>{ar ? "> طابق الأزواج" : "> match the pairs"} <span className="ms-2 opacity-70">{done.length / 2}/{SYMBOLS.length}</span></Prompt>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((v, i) => {
          const shown = open.includes(i) || done.includes(i);
          return (
            <button key={i} onClick={() => flip(i)}
              className="aspect-square text-2xl font-black"
              style={{ border: `2px solid ${done.includes(i) ? G : G_DIM}`, color: G, background: shown ? "hsl(120 100% 55% / 0.12)" : "transparent", opacity: done.includes(i) ? 0.45 : 1 }}>
              {shown ? v : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/** Sort 6 two-digit numbers smallest first: tap one, then another to swap them. */
const Sort = ({ onDone, ar }: { onDone: () => void; ar?: boolean }) => {
  const [arr, setArr] = useState(() => {
    const s = new Set<number>();
    while (s.size < 6) s.add(10 + Math.floor(Math.random() * 90));
    let a = shuffle([...s]);
    while (a.every((v, i, x) => i === 0 || x[i - 1] < v)) a = shuffle(a);
    return a;
  });
  const [sel, setSel] = useState<number | null>(null);
  const tap = (i: number) => {
    if (sel === null) return setSel(i);
    if (sel === i) return setSel(null);
    const a = [...arr]; [a[sel], a[i]] = [a[i], a[sel]];
    setArr(a); setSel(null);
    if (a.every((v, k, x) => k === 0 || x[k - 1] < v)) setTimeout(onDone, 400);
  };
  return (
    <div>
      <Prompt>{ar ? "> رتّب من الأصغر للأكبر (اضغط رقمين لتبديلهما)" : "> sort smallest to largest (tap two to swap)"}</Prompt>
      <div className="grid grid-cols-3 gap-2" dir="ltr">
        {arr.map((n, i) => (
          <button key={n} onClick={() => tap(i)}
            className={cn("py-4 text-2xl font-black transition-colors")}
            style={{ border: `2px solid ${sel === i ? "hsl(0 0% 96%)" : G_DIM}`, color: sel === i ? "hsl(0 0% 96%)" : G, background: sel === i ? "hsl(120 100% 55% / 0.15)" : "transparent" }}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
};
