// A week's 3-minute animated explainer: one three.js world (engine/world.ts) posed per frame from the week's beats,
// the cartoon-3d-short post chain (ink -> lens blur -> bloom -> neutral tone map -> grade), and the voice per beat.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, getInputProps, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { BlendFunction, BloomEffect, Effect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World } from "./engine/world";
import { InkPass, noInkFallback } from "./engine/ink";
import { LensBlur } from "./engine/lensblur";
import { GradeEffect, GRADES, gradeFor } from "./engine/grade";
import { loadPhoto } from "./engine/sets";
import { Week, beatAt, beatFrames } from "./engine/timeline";

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const Inner: React.FC<{ week: Week }> = ({ week }) => {
  const f = useCurrentFrame();
  const { camera, scene, gl, size } = useThree();
  const world = useMemo(() => new World(), []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera, { widthNear: 9, widthFar: 6, distNear: 4, distFar: 40 }),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.4, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 5, radius: 0.6 }),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, 1),
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const on = useMemo(() => ({ ink: true, lens: true, bloom: true, grade: true, ...((getInputProps() as { post?: Record<string, boolean> }).post ?? {}) }), []);
  // postprocessing's composer built synchronously (the R3F wrapper creates it in an effect, after Remotion's one render)
  const composer = useMemo(() => {
    const c = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    c.addPass(new RenderPass(scene, camera));
    if (on.ink) c.addPass(fx.ink);
    if (on.lens) { c.addPass(new EffectPass(camera, fx.lens.pre)); c.addPass(new EffectPass(camera, fx.lens.main)); }
    c.addPass(new EffectPass(camera, ...[on.bloom ? fx.bloom : null, fx.tone, on.grade ? fx.grade : null].filter(Boolean) as Effect[]));
    c.setSize(size.width, size.height);
    return c;
  }, [gl, scene, camera, fx, on, size.width, size.height]);
  useFrame(() => { composer.render(); }, 1);
  const cam = camera as THREE.PerspectiveCamera;
  const focus = world.update(week, f, cam, scene);
  noInkFallback(world.root);
  // depth of field only on close framings: wides and boards stay sharp (the skill's ~1/3 rule)
  const { beat, t } = beatAt(week, f);
  const shots = (beat.shots ?? []).filter((s) => s.at != null && s.at <= t).sort((a, b) => a.at! - b.at!);
  const kind = shots.length ? shots[shots.length - 1].shot : beat.board ? "board" : "wide";
  cam.getWorldDirection(fwd);
  fpt.copy(focus);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = kind === "close" ? 14 : kind === "host" || kind === "actor" ? 10 : kind === "two" ? 6 : 0;
  gradeFor(fx.grade, "day");
  return (
    <>
      <primitive object={world.root} dispose={null} />
    </>
  );
};

const usePhotos = (week: Week) => {
  const [ok, setOk] = useState(false);
  const [h] = useState(() => delayRender("photos"));
  useEffect(() => {
    const srcs = week.beats.map((b) => b.board?.photo).filter(Boolean) as string[];
    Promise.all(srcs.map((s) => loadPhoto(s))).then(() => { setOk(true); continueRender(h); });
  }, [week, h]);
  return ok;
};

export const Lecture: React.FC<{ week: Week }> = ({ week }) => {
  const f = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const ready = usePhotos(week);
  const frames = beatFrames(week);
  let from = 0;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      {ready && (
        <ThreeCanvas width={width} height={height} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance" }} camera={{ fov: 40, near: 0.15, far: 1200 }}>
          <Inner week={week} />
        </ThreeCanvas>
      )}
      {week.beats.map((b, i) => {
        const start = from; from += frames[i];
        return (
          <Sequence key={i} from={start + Math.round(b.leadIn * 30)} durationInFrames={frames[i]}>
            <Audio src={staticFile(b.audio)} />
          </Sequence>
        );
      })}
      {/* static chip + progress rule */}
      <div style={{ position: "absolute", left: 36 * (width / 1920), top: 30 * (width / 1920), padding: `${10 * (width / 1920)}px ${18 * (width / 1920)}px`, borderRadius: 999,
        background: "rgba(20,24,40,0.72)", color: "#fff", fontFamily: '"Segoe UI", Arial, sans-serif', fontWeight: 700, fontSize: 24 * (width / 1920), letterSpacing: "0.06em" }}>
        MKTG 3600 <span style={{ color: "#f2a33a" }}>·</span> {week.id.startsWith("m-") ? "MODELS" : `WEEK ${week.week}`}
      </div>
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 6 * (width / 1920), width: `${(f / durationInFrames) * 100}%`, background: "#f2a33a" }} />
    </AbsoluteFill>
  );
};

export { beatAt };
