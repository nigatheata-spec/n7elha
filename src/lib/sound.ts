// Web Audio API-based programmatic sound generation
// Handles all game sound effects with exponential envelopes and no external dependencies

let audioCtx: AudioContext | null = null;
const MASTER_GAIN = 0.18;
const MUTE_KEY = "n7_mute";

export function primeAudio() {
  if (audioCtx) return; // Already initialized
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  } catch (e) {
    console.warn("AudioContext not available");
  }
}

export function isMuted() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY) === "true";
}

export function setMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MUTE_KEY, muted ? "true" : "false");
}

function guard() {
  if (isMuted()) return null;
  primeAudio();
  return audioCtx;
}

// Helper: create oscillator with tone and envelope
function tone(freq: number, duration: number, type: "sine" | "triangle" | "square" = "sine", atkMs = 5) {
  const ctx = guard();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  osc.connect(gain);
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(MASTER_GAIN, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration / 1000);
}

// Helper: create noise burst with bandpass filter
function noiseBurst(freq: number, q: number, duration: number) {
  const ctx = guard();
  if (!ctx) return;

  const noise = ctx.createBufferSource();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * (duration / 1000), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < buffer.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(freq, ctx.currentTime);
  filter.Q.setValueAtTime(q, ctx.currentTime);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(MASTER_GAIN * 0.6, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(ctx.currentTime);
  noise.stop(ctx.currentTime + duration / 1000);
}

// ──── Game Sounds ────────────────────────────────────────────────────────
export function playSelect() {
  tone(520, 60, "triangle");
}

export function playCorrect() {
  const ctx = guard();
  if (!ctx) return;
  tone(660, 90, "sine");
  setTimeout(() => tone(990, 140, "sine"), 30);
}

export function playWrong() {
  const ctx = guard();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.connect(gain);
  gain.connect(ctx.destination);

  const startFreq = 280;
  const endFreq = 180;
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + 0.13);

  gain.gain.setValueAtTime(MASTER_GAIN, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.13);
}

export function playHackAlert() {
  const ctx = guard();
  if (!ctx) return;

  // Dual-tone siren (720Hz and 540Hz alternating)
  tone(720, 200, "square");
  setTimeout(() => tone(540, 200, "square"), 200);

  // Noise sizzle layer
  setTimeout(() => noiseBurst(1200, 8, 100), 100);
}

export function playExplode() {
  const ctx = guard();
  if (!ctx) return;

  // Noise burst (600Hz bandpass)
  noiseBurst(600, 6, 200);

  // Low sine sweep (80Hz down to 50Hz)
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);

  gain.gain.setValueAtTime(MASTER_GAIN * 0.8, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

export function playCrystal() {
  const ctx = guard();
  if (!ctx) return;

  // Three-note ascending arpeggio
  tone(880, 100, "sine");
  setTimeout(() => tone(1320, 120, "sine"), 80);
  setTimeout(() => tone(1760, 140, "sine"), 160);
}

export function playBrick() {
  const ctx = guard();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.setValueAtTime(180, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(130, ctx.currentTime + 0.11);

  gain.gain.setValueAtTime(MASTER_GAIN * 0.7, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.11);
}

export function playGameOver() {
  const ctx = guard();
  if (!ctx) return;

  // Descending arpeggio (740/560/440Hz)
  tone(740, 120, "sine");
  setTimeout(() => tone(560, 140, "sine"), 100);
  setTimeout(() => tone(440, 160, "sine"), 200);
}
