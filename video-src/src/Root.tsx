import React from "react";
import { Composition } from "remotion";
import { WeekVideo } from "./Video";
import data from "./data.json";

const FPS = 30;

export const RemotionRoot: React.FC = () => (
  <>
    {Object.values(data as Record<string, any>).map((w) => (
      <Composition
        key={w.id}
        id={w.id}
        component={WeekVideo}
        width={1920}
        height={1080}
        fps={FPS}
        durationInFrames={w.scenes.reduce((n: number, s: any) => n + Math.round(s.seconds * FPS), 0)}
        defaultProps={{ week: w }}
      />
    ))}
  </>
);
