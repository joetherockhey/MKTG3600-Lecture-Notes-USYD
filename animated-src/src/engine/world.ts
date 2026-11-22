// One three.js scene with every set; update(week, frame, camera) poses it for that frame (a pure function of the frame).
// Light rig, sky and two-tone uniforms follow the skill's world.ts (day preset, camera-relative sun frozen per beat).
import * as THREE from "three";
import { SetBuilder, SETS, paintBoard, V3 } from "./sets";
import { LIGHTS, LOOK } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, Stage, CamInfo, person, blob, viewOf, lidAt, bubble, icon, Icon, popScale, FPS, q } from "./cast";
import { Week, Beat, beatAt, castAt, talking, ShotDef, ActorState } from "./timeline";
import { FrontOpts, SideOpts, Expr } from "./toon";

export type Cam = { pos: V3; look: V3; fov: number; roll: number };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mixCam = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3, fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
/** slow push toward the look point: ~0.2 %/frame, the skill's "every hold creeps" rule */
const push = (c: Cam, frames: number, rate = 0.0008): Cam => {
  const k = Math.exp(-rate * frames);
  return { ...c, pos: c.look.map((l, i) => l + (c.pos[i] - l) * k) as V3 };
};
const HFOV = (fov: number) => 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * (16 / 9));

const FX_DUR = 2.6;

export class World {
  root = new THREE.Group();
  private sets = new SetBuilder();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
  private sun = new THREE.DirectionalLight("#fff0d6", 2.6);
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 300);
  private frustum = new THREE.Frustum(); private m4 = new THREE.Matrix4(); private sph = new THREE.Sphere(); private v = new THREE.Vector3();

  constructor() {
    const R = this.root;
    R.add(this.sets.root);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el)); gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  /** camera for a shot description at beat time t */
  private shotCam(beat: Beat, s: ShotDef, cast: ActorState[]): Cam {
    const S = SETS[beat.set], ox = S.ox;
    const host = cast.find((c) => c.id === "host") ?? cast[0];
    const who = (s.who ? cast.find((c) => c.id === s.who) : null) ?? host;
    const B = S.board;
    switch (s.shot) {
      case "custom": return { pos: [ox + s.pos![0], s.pos![1], s.pos![2]], look: [ox + s.look![0], s.look![1], s.look![2]], fov: s.fov ?? 40, roll: 0 };
      case "board": {
        // frame the whole board AND the host head-to-toe (horizontal and vertical fit, whichever needs more distance)
        const bx = ox + B.c[0], hx = host ? host.x : bx, hy = host ? host.y : 0;
        const left = Math.min(bx - B.w / 2, hx - 0.9), right = Math.max(bx + B.w / 2, hx + 0.9), cx = (left + right) / 2;
        const top = B.c[1] + B.h / 2 + 0.3, bot = hy - 0.2, fov = 40, tv = Math.tan((fov * Math.PI) / 360) / 1.08;
        // top edge fits at the board's depth, bottom edge at the host's (nearer) depth: (top-bot) <= (2d - e) * tan
        const e = Math.max(0, (host ? host.z : B.c[2]) - B.c[2]);
        const dH = ((right - left) * 1.25) / 2 / Math.tan(HFOV(fov) / 2), dV = ((top - bot) / tv + e) / 2;
        const d = Math.max(dH, dV), ly = top - d * tv;
        return { pos: [cx, ly, B.c[2] + d], look: [cx, ly, B.c[2]], fov, roll: 0 };
      }
      case "host": case "actor": {
        const a = s.shot === "host" ? host : who;
        const hy = a.y + (a.mode === "sit" ? 1.2 : 1.5);
        return { pos: [a.x + 0.45, hy + 0.15, a.z + 4.4], look: [a.x + 0.15, hy, a.z], fov: 34, roll: 0 };
      }
      case "close": {
        const a = s.who ? who : host, hy = a.y + (a.mode === "sit" ? 1.25 : 1.62);
        return { pos: [a.x + 0.25, hy + 0.05, a.z + 2.2], look: [a.x + 0.05, hy - 0.05, a.z], fov: 32, roll: 0.02 };
      }
      case "two": {
        const a = host, b = who === host ? cast.find((c) => c.id !== "host") ?? host : who;
        const cx = (a.x + b.x) / 2, cz = Math.max(a.z, b.z), span = (Math.abs(a.x - b.x) + 2.4) * 1.3, fov = 36;
        const d = Math.max(5, span / 2 / Math.tan(HFOV(fov) / 2)), ly = Math.min(a.y, b.y) + 1.35;
        return { pos: [cx + 0.3, ly + 0.35, cz + d], look: [cx, ly, cz], fov, roll: 0 };
      }
      default: return { pos: [ox + S.wide.pos[0], S.wide.pos[1], S.wide.pos[2]], look: [ox + S.wide.look[0], S.wide.look[1], S.wide.look[2]], fov: S.wide.fov, roll: 0 };
    }
  }

  camAt(beat: Beat, t: number): Cam {
    const shots = (beat.shots ?? []).filter((s) => s.at != null).sort((a, b) => a.at! - b.at!);
    if (!shots.length || shots[0].at! > 0.001) shots.unshift({ at: 0, shot: beat.board ? "board" : "wide" });
    let cur = shots[0];
    for (const s of shots) if (s.at! <= t) cur = s;
    const idx = shots.indexOf(cur);
    // framing freezes on the actors' positions at the shot start (no tracking jitter), then creeps in
    // character shots follow their subject (walks are linear, so tracking is smooth); set shots freeze at the cut
    const live = castAt(beat, t);
    const cam = (s: ShotDef) => this.shotCam(beat, s, s.shot === "wide" || s.shot === "board" || s.shot === "custom" ? castAt(beat, s.at!) : live);
    let c = push(cam(cur), (t - cur.at!) * FPS);
    if (cur.glide && idx > 0) {
      const prev = shots[idx - 1], k = glide((t - cur.at!) / 0.8);
      if (k < 1) c = mixCam(push(cam(prev), (t - prev.at!) * FPS), c, k);
    }
    return c;
  }

  update(week: Week, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const { beat, t } = beatAt(week, f);
    const S = SETS[beat.set], L = LIGHTS.day, K = LOOK.day;
    const cast = castAt(beat, t);
    // ---- camera ----
    const c = this.camAt(beat, t);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.15; cam.far = 1200; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = new THREE.Vector3(...c.look);
    // ---- light: sun 75 deg right of the set's wide view, 48 deg up (frozen per set) ----
    const az = THREE.MathUtils.degToRad(S.indoor ? 35 : 60), el = THREE.MathUtils.degToRad(S.indoor ? 55 : 46);
    const sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize(); // toward +x (right), +z (camera side)
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = 16;
    const shadowC = new THREE.Vector3(S.ox, 0, -1);
    this.sun.position.copy(shadowC).addScaledVector(sunDir, 120); this.sun.target.position.copy(shadowC);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 40; sc.far = 220; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * 1.4;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...(S.indoor ? ([0.52, 0.5, 0.6] as [number, number, number]) : L.shade)); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad; CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((d) => THREE.MathUtils.degToRad(d));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = 40; this.fog.far = 320;
    scene.fog = this.fog; scene.background = null;
    // ---- board ----
    const board = this.sets.boards[beat.set];
    paintBoard(board, beat.board ?? null, t, S.board.style);
    // ---- cast + effects ----
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const ci: CamInfo = { pos: cam.position, right, sun: sunDir };
    const st: Stage = { places: [], fx: [] };
    const speaking = talking(beat, t);
    for (const a of cast) {
      let expr: Expr = a.expr;
      // the host lip-flaps on spoken words (only while wearing a resting face)
      if (a.id === "host" && speaking && (!a.exprSet || expr === "smile" || expr === "neutral" || expr === "smile_closed")) expr = Math.floor(f / 3) % 3 === 1 ? "smile" : "grin";
      const blink = lidAt(t, a.i, a.swaps);
      const ph = (a.dist / 1.6) % 1;
      if (a.moving) {
        const view = viewOf(ci, a.x, a.z, a.dx, a.dz);
        const fo: FrontOpts = { phase: ph, expr, mode: "stroll", blink, hold: a.hold, holdCol: a.holdCol, arm: a.hold ? "hold" : undefined };
        const so: SideOpts = { phase: ph * 2 % 1, expr, mode: "march", blink, stomp: 0.7, stride: 0.6 * view.fs };
        st.places.push(person(ci, { i: a.i, o: a.o, okey: a.okey }, a.x, a.y, a.z, view, fo, so));
      } else {
        const fo: FrontOpts = { expr, mode: a.mode === "fall" ? "fall" : a.mode, blink, arm: a.pose, hold: a.hold, holdCol: a.holdCol, look: a.eyes, facing: 0 };
        st.places.push(person(ci, { i: a.i, o: a.o, okey: a.okey }, a.x, a.y, a.z, { side: false, mirror: false }, fo, {}, a.mirror));
      }
      if (a.mode !== "fall") blob(st, sunDir, a.x, a.y, a.z, S.indoor);
    }
    const shotsNow = (beat.shots ?? []).filter((x) => x.at != null && x.at <= t).sort((a, b) => a.at! - b.at!);
    const tight = shotsNow.length ? ["close", "actor", "host"].includes(shotsNow[shotsNow.length - 1].shot) : false;
    for (const fx of beat.fx ?? []) {
      if (fx.at == null) continue;
      const dur = fx.dur ?? FX_DUR, u = t - fx.at, s = popScale(u, dur);
      if (s <= 0.01) continue;
      const a = fx.who ? cast.find((c) => c.id === fx.who) : undefined;
      let x: number, y: number, z: number;
      if (fx.pos) { x = S.ox + fx.pos[0]; y = fx.pos[1]; z = fx.pos[2]; }
      else if (a) { const head = a.y + (a.mode === "sit" ? 1.75 : 2.25); x = a.x; y = head; z = a.z + 0.05; }
      else { x = c.look[0]; y = c.look[1] + 0.9; z = c.look[2]; }
      const size = (fx.size ?? 1) * (tight ? 0.72 : 1);
      if (tight && a) y -= 0.55; // keep bubbles/icons inside close framings
      if (fx.kind === "think" || fx.kind === "say") {
        const w = 1.55 * size * s, h = w * 0.65, side = a ? 0.75 * size : 0;
        st.fx.push({ key: `bub|${fx.kind}|${fx.text}`, cw: 800, ch: 520, draw: (p) => bubble(p, fx.kind as "think" | "say", fx.text ?? ""),
          x: x + right.x * side, y: y + 0.35 * size, z: z + right.z * side + 0.1, w, h, soft: true });
      } else {
        const ph = fx.kind === "stars" ? q(((u * 0.8) % 1), 30) : 0;
        const w = 0.62 * size * s;
        st.fx.push({ key: `icon|${fx.kind}|${ph}`, cw: 400, ch: 400, draw: (p) => icon(p, fx.kind as Icon, ph), x, y: y + 0.15, z: z + 0.1, w, h: w, soft: true, rot: 0.12 * Math.sin(u * 5) * (1 - clamp01(u / 1.2)) });
      }
    }
    // ---- bind cards ----
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1, p.z), 2))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size;
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true; a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, Math.atan2(cam.position.x - p.x, cam.position.z - p.z), 0);
      a.mesh.scale.set(p.mirror ? -1 : 1, 1, 1);
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(!!p.soft); e.mesh.visible = true; e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1);
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    return focus;
  }
}
