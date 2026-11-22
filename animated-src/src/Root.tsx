import React from "react";
import { Composition } from "remotion";
import { Lecture } from "./Lecture";
import data from "./data.json";
import { Week, beatFrames } from "./engine/timeline";

export const RemotionRoot: React.FC = () => (
  <>
    {Object.values(data as unknown as Record<string, Week>).map((w) => (
      <Composition key={w.id} id={w.id} component={Lecture} width={1280} height={720} fps={30}
        durationInFrames={beatFrames(w).reduce((a, b) => a + b, 0)} defaultProps={{ week: w }} />
    ))}
  </>
);
