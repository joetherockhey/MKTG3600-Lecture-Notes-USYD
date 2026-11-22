// Week data (written by scripts/tts.py from weeks/<id>.json) -> what is on screen at any frame.
// A week is a list of beats. Each beat: one set, one voiced line, a cast placed on the set's marks, timed acts
// (pose / expression / walk changes), effects (bubbles, icons) and camera shots, all timed by cue words -> `at` seconds.
import { SETS, SetName, Mark, BoardSpec, V3 } from "./sets";
import { Expr, Pose, Hold, Outfit, SKIN } from "./toon";
import { FPS, clamp01 } from "./cast";

export type Who = string;
export type CastDef = {
  id: Who; look: string; v?: number; at: Mark | string; to?: Mark | string; walkAt?: number | null;
  pose?: Pose; hold?: Hold; holdCol?: string; expr?: Expr; mode?: "stand" | "sit"; mirror?: boolean; look2?: number;
};
export type Act = { who: Who; at: number | null; pose?: Pose | "none"; expr?: Expr; hold?: Hold; holdCol?: string; to?: Mark | string; mirror?: boolean; mode?: "stand" | "sit" | "fall"; eyes?: number };
export type FxDef = { kind: string; who?: Who; text?: string; at: number | null; dur?: number; pos?: V3; size?: number };
export type ShotDef = { at: number | null; shot: "wide" | "board" | "host" | "close" | "actor" | "two" | "custom"; who?: Who; glide?: boolean; pos?: V3; look?: V3; fov?: number };
export type Beat = {
  set: SetName; say: string; audio: string; leadIn: number; seconds: number; words: { w: string; t: number }[];
  board?: BoardSpec | null; cast?: CastDef[]; acts?: Act[]; fx?: FxDef[]; shots?: ShotDef[]; noHost?: boolean;
};
export type Week = { id: string; week: number; title: string; speaker: string; beats: Beat[]; total: number };

// ---------------- looks ----------------
const SKINS = [SKIN, "#f5c9a0", "#ecd0b6", "#c99067", "#a8714a"];
const HAIR = ["#3b2a20", "#6a4a2a", "#1e1a1a", "#c9a46a", "#8a3b22", "#2a1e18"];
const pick = <T,>(a: T[], v: number) => a[((v % a.length) + a.length) % a.length];
export const HOST: Outfit = { jacket: "#f2a33a", pants: "#2f3b5a", boots: "#3a2a20", hat: "hair", hair: "#3b2a20", skin: SKIN, buttons: "#fff3d6" };
export const outfit = (look: string, v = 0): Outfit => {
  const skin = pick(SKINS, v * 3 + 1), hair = pick(HAIR, v * 5 + 2);
  switch (look) {
    case "host": return HOST;
    case "exec": return { jacket: pick(["#2f3442", "#3a3550", "#2a3a4a", "#4a3a3a"], v), pants: "#2a2a33", boots: "#1e1a1a", hat: "hair", hair, skin, buttons: "#d9dde0", moustache: v % 4 === 3 ? hair : undefined };
    case "exec_f": return { jacket: pick(["#2f3442", "#5a2a4a", "#2a4a5a"], v), pants: "#2a2a33", boots: "#1e1a1a", hat: "long", hair, dress: pick(["#3a3550", "#2f3442", "#7a2a3a"], v), skin };
    case "student": return { jacket: pick(["#e2453c", "#3f9fdc", "#7cc04a", "#a05ac9", "#f08a2c"], v), pants: pick(["#3b5b9a", "#2f3b5a", "#4a4a52"], v), boots: "#f4f1ea", hat: v % 3 === 1 ? "cap" : v % 3 === 2 ? "long" : "hair", cap: pick(["#2f5f6a", "#e2453c", "#1e1a1a"], v), hair, skin };
    case "kid": return { jacket: pick(["#f08a2c", "#3fbf6a", "#e2453c"], v), pants: "#3b5b9a", boots: "#f4f1ea", hat: v % 2 ? "cap" : "hair", cap: "#e2453c", hair, skin, build: "kid" };
    case "elder": return { jacket: pick(["#8c6a4a", "#5d7a3a", "#7b5ac9"], v), pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#d8d4cc", skin, build: "stout" };
    case "worker": return { jacket: pick(["#3f7d3a", "#2f5f6a", "#b5653f"], v), pants: "#2f3b5a", boots: "#3a2a20", hat: "cap", cap: pick(["#3f7d3a", "#2f5f6a", "#b5653f"], v), skin };
    case "speaker": return { jacket: pick(["#2a4a5a", "#5a2a3a", "#2f3442"], v), pants: "#2a2a33", boots: "#1e1a1a", hat: v % 2 ? "long" : "hair", hair, skin, dress: v % 2 ? "#2a4a5a" : undefined, buttons: "#d9dde0" };
    case "chef": return { jacket: "#f4f1ea", pants: "#2f3b5a", boots: "#1e1a1a", hat: "cap", cap: "#f4f1ea", skin, buttons: "#c9ccd2" };
    case "farmer": return { jacket: pick(["#8a5a34", "#5d7a3a"], v), pants: "#3b5b9a", boots: "#4a3426", hat: "tophat", skin, moustache: v % 2 ? "#5a3b2a" : undefined, build: "stout" };
    default: // shopper / person
      return v % 2
        ? { jacket: pick(["#3f6fb5", "#8c3b4a", "#5d7a3a", "#b5653f", "#2f5f6a", "#7b5ac9"], v), pants: "#3b3f52", boots: "#4a3426", hat: "long", hair, dress: pick(["#d9a441", "#c25a7a", "#5a8fc2", "#3fbf9a"], v), skin }
        : { jacket: pick(["#3f6fb5", "#8c3b4a", "#5d7a3a", "#b5653f", "#2f5f6a", "#7b5ac9"], v), pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair, skin };
  }
};

// ---------------- positions ----------------
export const markOf = (set: SetName, m: Mark | string | undefined): [number, number, number] => {
  const S = SETS[set];
  const k = typeof m === "string" ? S.marks[m] ?? S.marks.c : m ?? S.marks.c;
  return [S.ox + k[0], (k as number[])[2] ?? 0, k[1]];
};
const SPEED = 1.35; // m/s walking

export type ActorState = {
  id: Who; o: Outfit; okey: string; i: number; x: number; y: number; z: number;
  moving: boolean; dx: number; dz: number; dist: number; pose?: Pose; hold?: Hold; holdCol?: string; expr: Expr; exprSet: boolean;
  mode: "stand" | "sit" | "fall"; mirror: boolean; eyes: number; swaps: number[];
};

/** state of every cast member at beat time t */
export const castAt = (beat: Beat, t: number): ActorState[] => {
  const cast = [...(beat.cast ?? [])];
  if (!beat.noHost && !cast.some((c) => c.id === "host")) cast.unshift({ id: "host", look: "host", at: beat.board ? "board" : "c" });
  return cast.map((c, idx) => {
    const o = outfit(c.look, c.v ?? idx);
    let pos = markOf(beat.set, c.at), pose = c.pose, hold = c.hold, holdCol = c.holdCol, expr = c.expr, mirror = !!c.mirror;
    let mode: ActorState["mode"] = c.mode ?? "stand", eyes = c.look2 ?? 0;
    // walks: initial `to` (at walkAt or 0) then any act with `to`, each from wherever the actor is at that moment
    const walks: { at: number; to: [number, number, number] }[] = [];
    if (c.to) walks.push({ at: c.walkAt ?? 0, to: markOf(beat.set, c.to) });
    const swaps: number[] = [];
    for (const a of beat.acts ?? []) if (a.who === c.id && a.at != null) {
      if (a.to) walks.push({ at: a.at, to: markOf(beat.set, a.to) });
      if (a.at <= t) {
        if (a.pose) pose = a.pose === "none" ? undefined : a.pose;
        if (a.hold) hold = a.hold;
        if (a.holdCol) holdCol = a.holdCol;
        if (a.expr) { expr = a.expr; }
        if (a.mirror !== undefined) mirror = a.mirror;
        if (a.mode) mode = a.mode;
        if (a.eyes !== undefined) eyes = a.eyes;
      }
      if (a.expr) swaps.push(a.at);
    }
    walks.sort((a, b) => a.at - b.at);
    let moving = false, dx = 0, dz = 0, dist = 0;
    for (const w of walks) {
      if (t < w.at) break;
      const vx = w.to[0] - pos[0], vz = w.to[2] - pos[2], L = Math.hypot(vx, vz), dur = L / SPEED;
      const u = clamp01((t - w.at) / Math.max(dur, 0.01));
      if (u < 1) {
        moving = true; dx = vx / L; dz = vz / L;
        // ease the first and last 0.3 s
        const s = L * u;
        dist = s;
        pos = [pos[0] + dx * s, pos[1] + (w.to[1] - pos[1]) * u, pos[2] + dz * s];
      } else pos = w.to;
    }
    return { id: c.id, o, okey: `${c.look}${c.v ?? idx}`, i: idx + (c.id === "host" ? 0 : 3), x: pos[0], y: pos[1], z: pos[2], moving, dx, dz, dist,
      pose: moving ? undefined : pose, hold, holdCol, expr: expr ?? (c.id === "host" ? "smile" : "neutral"), exprSet: expr !== undefined, mode, mirror, eyes, swaps };
  });
};

// ---------------- beat lookup ----------------
export const beatFrames = (w: Week) => w.beats.map((b) => Math.round(b.seconds * FPS));
export const beatAt = (w: Week, f: number) => {
  const fr = beatFrames(w);
  let a = 0;
  for (let i = 0; i < fr.length; i++) { if (f < a + fr[i] || i === fr.length - 1) return { i, beat: w.beats[i], f0: a, t: (f - a) / FPS, n: fr[i] }; a += fr[i]; }
  return { i: 0, beat: w.beats[0], f0: 0, t: 0, n: fr[0] };
};
/** host is speaking a word at beat time t */
export const talking = (beat: Beat, t: number) => beat.words.some((w, i) => {
  const end = i + 1 < beat.words.length ? Math.min(beat.words[i + 1].t, w.t + 0.55) : w.t + 0.45;
  return t >= w.t - 0.02 && t < end - 0.04;
});
