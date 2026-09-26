// ── Humans vs Zombies — dev-only preview ────────────────────────────────────
// The real student view with no session: local bots instead of classmates and
// a stand-in quiz. Arrow keys / WASD move, Space shoots (or sprints), E opens a
// question. ?team=zombie plays the other side, ?bots=N, ?players=N sizes the
// building like a class of N, ?lang=ar. ?board=1 shows the projector instead,
// filled with a made-up class.
//
// Route is registered only when import.meta.env.DEV, so it never ships.

import HumansVsZombiesGame from "./HumansVsZombiesGame";
import HumansVsZombiesMonitor, { type Row, type Feed } from "@/pages/teacher/HumansVsZombiesMonitor";

const NAMES = ["Sara", "Omar", "Lina", "Yousef", "Maha", "Adam", "Noor", "Khalid", "Reem", "Hala", "Zaid", "Dana", "Fares", "Mona", "Tariq", "Jood", "Ali", "Rana"];

const HvzPreview = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("board") !== "1") return <HumansVsZombiesGame sessionId="hvz-preview" studentId="me" preview />;
  const students: Row[] = NAMES.map((name, i) => ({
    id: `s${i}`, name, team: i % 3 === 0 ? "zombie" : "human", crypto: (i * 37) % 260,
    avatar_color: i % 7, avatar_face: (i * 5) % 20,
  }));
  const feed: Feed[] = [
    { id: 1, by: "Sara", victim: "Adam", kind: "infect" },
    { id: 2, by: "Lina", victim: "Omar", kind: "stun" },
    { id: 3, by: "Omar", victim: "Khalid", kind: "infect" },
    { id: 4, by: "Noor", victim: "Sara", kind: "ko" },
  ];
  const session = {
    id: "demo", code: "K7QX", status: "running", started_at: new Date(Date.now() - 60_000).toISOString(),
    settings: { mode: "humansvszombies", minutes: 6, lang: params.get("lang") === "ar" ? "ar" : "en" },
  };
  return <HumansVsZombiesMonitor session={session} sessionId="demo" demo={{ students, feed }} />;
};

export default HvzPreview;
