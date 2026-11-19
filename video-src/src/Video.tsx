import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, body, display, mono } from "./theme";
import { SCENES } from "./scenes";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Week = any;

const FADE = 9;

const SceneShell: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, FADE, frames - 7, frames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(f, [0, FADE], [18, 0], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o, transform: `translateY(${y}px)` }}>{children}</AbsoluteFill>;
};

export const WeekVideo: React.FC<{ week: Week }> = ({ week }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  let from = 0;
  const bar = frame / durationInFrames;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {/* Fixed chrome: nothing here moves except the progress rule. */}
      <AbsoluteFill style={{ padding: "54px 150px 0", flexDirection: "row", justifyContent: "space-between", height: 120 }}>
        <div style={{ fontFamily: mono, fontSize: 24, letterSpacing: "0.16em", color: C.ink3, fontWeight: 600 }}>
          MKTG 3600 <span style={{ color: C.ox }}>·</span> WEEK {String(week.week).padStart(2, "0")}
        </div>
        <div style={{ fontFamily: body, fontSize: 26, color: C.ink3 }}>{week.chrome}</div>
      </AbsoluteFill>
      {/* Static watermark week number: an anchor for the layout, never animated. */}
      <div style={{ position: "absolute", right: 70, bottom: -90, fontFamily: display, fontWeight: 700, fontSize: 560, lineHeight: 1, color: C.ink, opacity: 0.035, letterSpacing: "-0.05em" }}>
        {String(week.week).padStart(2, "0")}
      </div>
      <div style={{ position: "absolute", left: 150, right: 150, top: 104, height: 2, background: C.rule }} />
      {week.scenes.map((s: any, i: number) => {
        const frames = Math.round(s.seconds * fps);
        const start = from;
        from += frames;
        const Comp = SCENES[s.type];
        return (
          <Sequence key={i} from={start} durationInFrames={frames} premountFor={fps}>
            <SceneShell frames={frames}>
              <Comp s={{ ...s, frames }} />
            </SceneShell>
            <Sequence from={Math.round(s.leadIn * fps)}>
              <Audio src={staticFile(s.audio)} />
            </Sequence>
          </Sequence>
        );
      })}
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 8, width: `${bar * 100}%`, background: C.ox }} />
    </AbsoluteFill>
  );
};
