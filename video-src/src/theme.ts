import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadWork } from "@remotion/google-fonts/WorkSans";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

// Same palette as the notes site (light theme).
export const C = {
  paper: "#F2F3F5",
  card: "#FFFFFF",
  ink: "#16181F",
  ink2: "#41465A",
  ink3: "#767C8F",
  rule: "#DCDFE6",
  ox: "#8C2F39",
  oxT: "#F7EDEE",
  petrol: "#1F5C6B",
  petrolT: "#EAF1F3",
  amber: "#B87A12",
  amberT: "#FBF2E2",
};

export const display = loadFraunces("normal", { weights: ["400", "600", "700"], subsets: ["latin"] }).fontFamily;
loadFraunces("italic", { weights: ["400", "600"], subsets: ["latin"] });
export const body = loadWork("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "600"], subsets: ["latin"] }).fontFamily;

export const tone = (t?: string) =>
  t === "petrol" ? { fg: C.petrol, bg: C.petrolT }
  : t === "amber" ? { fg: C.amber, bg: C.amberT }
  : t === "ink" ? { fg: C.ink2, bg: "#E8EAEF" }
  : { fg: C.ox, bg: C.oxT };

/** 0 → 1 once the cue's word is spoken (or at the fallback second). */
export const useIn = (at: number | null | undefined, fallback: number, opts: { pop?: boolean; delay?: number; dur?: number } = {}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round((at ?? fallback) * fps) + (opts.delay ?? 0);
  return spring({
    frame: frame - start,
    fps,
    config: opts.pop ? { damping: 13, stiffness: 170, mass: 0.7 } : { damping: 200 },
    durationInFrames: opts.pop ? undefined : (opts.dur ?? 16),
  });
};

export type Cue = { cue?: string; at?: number | null };
