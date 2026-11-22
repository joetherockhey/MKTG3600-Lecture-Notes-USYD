// Cast as lit flat cards in the 3D world (from the cartoon-3d-short skill's cast.ts, trimmed to what the lecture
// explainers need): canvas pool, Actor / Fx meshes, distance tiers, camera-relative 2D light, front/side view choice,
// blinks, contact shadows. Plus lecture effects: thought and speech bubbles with short text, and icon pops.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, Outfit, FrontOpts, SideOpts, fxShadow, fxContact, fxBurst, fxStars, INK } from "./toon";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

export const FPS = 30;
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(BODY, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 2; }
  }
}

// ---------------- placements ----------------
export type Place = { key: string; draw: (p: Pen) => void; x: number; y: number; z: number; scale?: number; mirror?: boolean; size: [number, number, number] };
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean; front?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[] };

export const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
export const q = (v: number, n = 120) => Math.round(v * n) / n;
const tmp = new THREE.Vector3();
/** canvas size by distance; sized for a 1280x720 / 1920x1080 landscape frame */
const tier = (d: number): [number, number, number] => d < 2.6 ? [1440, 2400, 2.4] : d < 5.5 ? [960, 1600, 1.6] : d < 12 ? [480, 800, 0.8] : [240, 400, 0.4];
/** canvas angle the sun comes FROM on an upright camera-facing card (45-degree steps for a small cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = cam.sun.dot(cam.right) * (mirror ? -1 : 1), sy = -cam.sun.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};
/** front or side view for someone at (x, z) moving along (dx, dz) */
export const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1, dl = Math.hypot(dx, dz) || 1;
  const c = (tx * dx + tz * dz) / (tl * dl);
  return { side: Math.abs(c) < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};
const LID = [0.5, 1, 1, 0.5];
/** eyelid 0 open .. 1 shut: blinks every 0.5-2.3 s, plus one across every expression change (swaps, seconds) */
export const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round(ts * FPS) + 2; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 2000; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

export type Who = { i: number; o: Outfit; okey: string };
export const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, mirrorFront = false): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z));
  const size = tier(d);
  const mirror = view.side ? view.mirror : mirrorFront, light = light2D(cam, mirror), seed = (who.i % 7) + 1;
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return { key, x, y, z, mirror, size, draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)) };
};

/** contact pool + soft sun-away tail under a standing card */
export const blob = (out: Stage, sun: THREE.Vector3, x: number, y: number, z: number, indoor = false) => {
  const hl = Math.hypot(sun.x, sun.z) || 1, ox = -sun.x / hl, oz = -sun.z / hl, rot = Math.atan2(-ox, -oz);
  if (!indoor) {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, sun.y)));
    const len = Math.min(2.2, Math.max(0.5, 1.6 / Math.tan(el))), h = len + 0.55, c = 0.3 * h;
    out.fx.push({ key: "blob|shadow|#b4b8d0", cw: 128, ch: 256, draw: (p) => fxShadow(p, "#b4b8d0"), x: x + ox * c, y: y + 0.018, z: z + oz * c, w: 0.72, h, flat: true, rot });
  }
  out.fx.push({ key: "blob|contact|#7d7f9c", cw: 128, ch: 128, draw: (p) => fxContact(p, "#7d7f9c"), x, y: y + 0.022, z, w: indoor ? 0.7 : 0.52, h: indoor ? 0.5 : 0.4, flat: true, rot: indoor ? 0 : rot });
};

// ---------------- lecture effects ----------------
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
/** wrap text to lines that fit maxW at the given font */
export const wrap = (g: CanvasRenderingContext2D, text: string, maxW: number) => {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const w of para.split(" ")) {
      const t = line ? line + " " + w : w;
      if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
};
const fitText = (g: CanvasRenderingContext2D, text: string, maxW: number, maxH: number, big: number, weight = 700) => {
  for (let s = big; s > 14; s -= 2) {
    g.font = `${weight} ${s}px ${FONT}`;
    const lines = wrap(g, text, maxW);
    if (lines.length * s * 1.15 <= maxH && lines.every((l) => g.measureText(l).width <= maxW)) return { lines, s };
  }
  g.font = `${weight} 14px ${FONT}`;
  return { lines: wrap(g, text, maxW), s: 14 };
};
/** thought (cloud + trailing puffs) or speech (rounded + tail) bubble, 800 x 520 canvas; tail toward the bottom-left */
export const bubble = (p: Pen, kind: "think" | "say", text: string) => {
  const g = p.g;
  g.lineJoin = "round";
  if (kind === "think") {
    const lobes: [number, number, number][] = [[230, 200, 150], [400, 150, 170], [570, 200, 150], [610, 300, 120], [430, 330, 170], [240, 320, 140], [150, 260, 110]];
    for (const [x, y, r] of lobes) p.ell(x, y, r, r * 0.78, null, 14);
    for (const [x, y, r] of lobes) p.ell(x, y, r, r * 0.78, "#ffffff", 0);
    p.ell(140, 430, 38, 30, "#ffffff", 9); p.ell(78, 488, 20, 16, "#ffffff", 7);
  } else {
    g.beginPath(); g.moveTo(170, 380); g.lineTo(100, 505); g.lineTo(290, 390); g.closePath();
    g.fillStyle = "#ffffff"; g.fill(); g.lineWidth = 12; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.roundRect(40, 40, 720, 360, 90); g.fillStyle = "#ffffff"; g.fill(); g.lineWidth = 12; g.stroke();
    g.beginPath(); g.moveTo(176, 388); g.lineTo(115, 492); g.lineTo(282, 392); g.fillStyle = "#ffffff"; g.fill();
  }
  const { lines, s } = fitText(g, text, kind === "think" ? 470 : 620, kind === "think" ? 270 : 300, 92);
  g.fillStyle = INK; g.textAlign = "center"; g.textBaseline = "middle";
  const cy = kind === "think" ? 245 : 220;
  lines.forEach((l, i) => g.fillText(l, 400, cy + (i - (lines.length - 1) / 2) * s * 1.15));
};

export type Icon = "bulb" | "heart" | "money" | "question" | "exclaim" | "tick" | "cross" | "stars" | "burst" | "clock" | "chart" | "sparkle" | "eye" | "brain" | "zzz";
/** icon pops, 400 x 400 canvas, bold flat colours with ink */
export const icon = (p: Pen, k: Icon, t = 0) => {
  const g = p.g, txt = (s: string, size: number, col: string, x = 200, y = 210) => {
    g.font = `900 ${size}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 22; g.strokeStyle = INK; g.lineJoin = "round"; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y);
  };
  switch (k) {
    case "bulb":
      g.save(); g.translate(-50, -80); fxBurst(p, 0.55, "#fff3b0", 12, 150, 195); g.restore();
      p.ell(200, 170, 95, 100, "#ffd94a", 12);
      p.poly([[160, 255], [240, 255], [232, 318], [168, 318]], "#c9ccd2", 10);
      p.stroke([[170, 280], [230, 280]], 8); p.stroke([[172, 300], [228, 300]], 8);
      p.stroke([[175, 175], [200, 215], [225, 175]], 9, "#b07a1a"); break;
    case "heart":
      g.beginPath(); g.moveTo(200, 330); g.bezierCurveTo(40, 230, 60, 70, 200, 130); g.bezierCurveTo(340, 70, 360, 230, 200, 330);
      g.fillStyle = "#ef4a5c"; g.fill(); g.lineWidth = 14; g.strokeStyle = INK; g.stroke(); break;
    case "money": p.ell(200, 200, 150, 150, "#f2c230", 14); p.ell(200, 200, 112, 112, null, 6); txt("$", 190, "#fff6c8"); break;
    case "question": txt("?", 300, "#4aa3ef"); break;
    case "exclaim": txt("!", 300, "#ef4a3c"); break;
    case "tick": p.ell(200, 200, 150, 150, "#3fbf6a", 14); p.stroke([[125, 205], [180, 262], [282, 140]], 34, "#ffffff"); break;
    case "cross": p.ell(200, 200, 150, 150, "#ef4a3c", 14); p.stroke([[140, 140], [260, 260]], 34, "#ffffff"); p.stroke([[260, 140], [140, 260]], 34, "#ffffff"); break;
    case "stars": g.save(); g.translate(-10, 95); fxStars(p, t); g.restore(); break;
    case "burst": g.save(); g.translate(-50, -50); fxBurst(p, 0.6, "#fff3b0", 12, 60, 190); g.restore(); break;
    case "clock":
      p.ell(200, 200, 150, 150, "#ffffff", 14);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; p.dot(200 + 118 * Math.cos(a), 200 + 118 * Math.sin(a), 9); }
      p.stroke([[200, 200], [200, 105]], 16); p.stroke([[200, 200], [270, 230]], 16); break;
    case "chart":
      p.poly([[50, 330], [350, 330], [350, 345], [50, 345]], INK, 0);
      [[80, 230, "#4aa3ef"], [160, 170, "#3fbf6a"], [240, 110, "#f2c230"]].forEach(([x, top, c]) => p.poly([[x as number, 330], [(x as number) + 60, 330], [(x as number) + 60, top as number], [x as number, top as number]], c as string, 10));
      p.stroke([[70, 220], [170, 150], [250, 95], [330, 50]], 12, "#ef4a3c"); break;
    case "sparkle":
      for (const [x, y, r] of [[200, 190, 120], [90, 90, 50], [320, 300, 55]] as const) {
        g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r);
        g.fillStyle = "#ffe066"; g.fill(); g.lineWidth = 10; g.strokeStyle = INK; g.stroke();
      } break;
    case "eye": p.ell(200, 200, 170, 105, "#ffffff", 14); p.ell(200, 200, 70, 70, "#4a9ee0", 10); p.ell(200, 200, 32, 32, INK, 0); p.ell(222, 180, 12, 12, "#ffffff", 0); break;
    case "brain":
      for (const [x, y, r] of [[150, 160, 80], [250, 160, 80], [130, 240, 70], [270, 240, 70], [200, 250, 80]] as const) p.ell(x, y, r, r * 0.85, null, 14);
      for (const [x, y, r] of [[150, 160, 80], [250, 160, 80], [130, 240, 70], [270, 240, 70], [200, 250, 80]] as const) p.ell(x, y, r, r * 0.85, "#f4a6c0", 0);
      p.stroke([[200, 100], [205, 180], [195, 300]], 8); p.arc(150, 200, 40, 30, 200, 340, 7); p.arc(250, 210, 40, 30, 200, 340, 7); break;
    case "zzz": txt("Z", 150, "#9fb8ff", 150, 260); txt("z", 110, "#9fb8ff", 260, 150); break;
  }
};
/** pop-in scale: overshoot in, hold, shrink out (u = seconds since start, dur = seconds shown) */
export const popScale = (u: number, dur: number) => {
  if (u < 0 || u > dur) return 0;
  const a = clamp01(u / 0.22), b = clamp01((dur - u) / 0.18);
  const inS = a < 1 ? 1.15 * Math.sin(a * Math.PI * 0.62) / Math.sin(Math.PI * 0.62) : 1;
  return Math.min(inS, 1.0 + 0.06 * Math.sin(Math.min(1, a) * Math.PI)) * smooth(b);
};
