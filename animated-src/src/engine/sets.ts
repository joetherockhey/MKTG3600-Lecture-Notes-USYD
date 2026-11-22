// The places the explainer host walks through, all in one three.js scene, side by side along x:
//   plaza (shopping strip + market stall), office (whiteboard, desks, skyline windows), street (shops, billboard, bus stop),
//   home (living room, TV), stage (lecture theatre with a projector screen and an audience).
// Every set has a 16:9 "board" (screen / whiteboard / billboard / TV / projector) that the timeline paints with the
// lecture's key points, named marks where people stand, and a default wide camera. Materials use the skill's two-tone
// shading so the world ink pass and the grade treat it like the bridge town. Painted textures are drawn on canvases.
import * as THREE from "three";
import { staticFile } from "remotion";
import { ctex, rep, rng, facadeHD, stoneHD, cobbleHD, grassHD, planksHD } from "./paint";
import { twoTone } from "./shade";

export type V3 = [number, number, number];
export type SetName = "plaza" | "office" | "street" | "home" | "stage";
export type Mark = [number, number] | [number, number, number]; // local x, z (, floor y)
export type SetDef = {
  name: SetName; ox: number; indoor: boolean;
  marks: Record<string, Mark>;
  board: { c: V3; w: number; h: number; style: "screen" | "white" | "bill" | "tv" | "proj" };
  wide: { pos: V3; look: V3; fov: number };
};

export const SETS: Record<SetName, SetDef> = {
  plaza: {
    name: "plaza", ox: 0, indoor: false,
    marks: { board: [-5.3, -2.4], c: [0, -0.6], l: [-3.6, 0.4], r: [3.6, 0.4], front: [0, 1.8], shelf: [3.6, -1.8], shelf2: [-4.4, -1.8], stall: [6.9, -0.6],
      shop: [2.6, -4.6], shop2: [-2.4, -4.6], far: [0, -3.6], walkL: [-12, 1.2], walkR: [12, 1.2] },
    board: { c: [-8.8, 3.0, -3.6], w: 5.0, h: 2.8125, style: "screen" },
    wide: { pos: [0, 3.0, 11.5], look: [0, 1.7, -3], fov: 44 },
  },
  office: {
    name: "office", ox: 70, indoor: true,
    marks: { board: [-0.6, -4.2], c: [0, -1], l: [-3.4, 0.2], r: [3.4, 0.2], front: [0, 1.8], desk: [3.2, -2.4], desk2: [6.2, -2.4],
      table: [-4.6, -0.4], table2: [-2.6, -0.4], door: [7.6, -4.6], window: [3.5, -4.6], far: [0, -4.5], walkL: [-8, 1], walkR: [8, 1] },
    board: { c: [-3.6, 2.15, -5.88], w: 4.2, h: 2.3625, style: "white" },
    wide: { pos: [0, 2.6, 9.5], look: [0, 1.6, -3], fov: 46 },
  },
  street: {
    name: "street", ox: 140, indoor: false,
    marks: { board: [-1.8, -1.4], c: [0, 0], l: [-4, 0.8], r: [4, 0.8], front: [0, 2.2], bus: [6.4, -1.6], shop: [2.3, -3.4], shop2: [-6.5, -3.4],
      kerb: [0.6, 1.6], far: [0, -2.8], walkL: [-12, 0.8], walkR: [12, 0.8] },
    board: { c: [-5.2, 3.7, -2.6], w: 5.4, h: 3.0375, style: "bill" },
    wide: { pos: [0, 3.2, 12.5], look: [0, 2.2, -3], fov: 44 },
  },
  home: {
    name: "home", ox: 210, indoor: true,
    marks: { board: [0.4, -3.0], c: [0, -0.6], l: [-3, 0.4], r: [3, 0.4], front: [0, 1.8], sofa: [3.6, -2.15, 0.12], sofa2: [4.7, -2.15, 0.12],
      tv: [0.9, -1.6], window: [3.4, -3.6], door: [-5.6, -3.6], far: [0, -3.8], walkL: [-7, 1], walkR: [7, 1] },
    board: { c: [-2.2, 1.85, -4.3], w: 3.2, h: 1.8, style: "tv" },
    wide: { pos: [0, 2.5, 8.6], look: [0, 1.4, -2.6], fov: 46 },
  },
  stage: {
    name: "stage", ox: 280, indoor: true,
    marks: { board: [1.6, -2.4, 0.6], c: [0, -1.2, 0.6], l: [-3.4, -1.2, 0.6], r: [3.4, -1.2, 0.6], lectern: [4.6, -1.6, 0.6], front: [0, -0.4, 0.6],
      aisle: [-1.2, 2.2], aisle2: [1.2, 2.2], far: [0, -3.2, 0.6], walkL: [-7, -1.2, 0.6], walkR: [7, -1.2, 0.6] },
    board: { c: [-1.2, 3.25, -5.7], w: 6.0, h: 3.375, style: "proj" },
    wide: { pos: [0, 3.0, 12.5], look: [0, 2.2, -3], fov: 42 },
  },
};

// ---------------- materials ----------------
const mats = new Map<string, THREE.MeshLambertMaterial>();
/** two-tone lambert, cached by key; colour or painted texture */
export const lam = (key: string, color: string, map?: THREE.Texture | null) => {
  let m = mats.get(key);
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial({ color, map: map ?? null })); mats.set(key, m); }
  return m;
};
const basic = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, toneMapped: false });

// ---------------- painted textures ----------------
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const stripes = (a: string, b: string) => ctex("stripe" + a + b, 256, 128, (g) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 32, 0, 32, 128); }
  g.fillStyle = "rgba(0,0,0,0.25)"; for (let i = 0; i < 8; i++) g.fillRect(i * 32 + 30, 0, 2, 128);
});
/** shopfront: wall colour, sign band with the name, big window with goods, glass door */
const shopTex = (name: string, wall: string, signBg: string, goods: string[], seed: number) => ctex("shop" + name, 720, 600, (g, r) => {
  g.fillStyle = wall; g.fillRect(0, 0, 720, 600);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.03 + 0.04 * r()})`; g.beginPath(); g.arc(r() * 720, r() * 600, 20 + 50 * r(), 0, 7); g.fill(); }
  g.fillStyle = signBg; g.fillRect(40, 70, 640, 110);
  g.strokeStyle = "#1c1620"; g.lineWidth = 6; g.strokeRect(40, 70, 640, 110);
  g.fillStyle = "#fffaf0"; g.font = `800 70px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(name, 360, 128);
  // window
  g.fillStyle = "#bfe2f2"; g.fillRect(60, 250, 380, 290);
  g.fillStyle = "rgba(255,255,255,0.45)"; g.beginPath(); g.moveTo(80, 520); g.lineTo(200, 260); g.lineTo(260, 260); g.lineTo(140, 520); g.fill();
  const rr = rng(seed);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) {
    const x = 85 + i * 70, y = 430 - row * 110, h = 50 + 40 * rr();
    g.fillStyle = goods[(i + row) % goods.length]; g.fillRect(x, y - h + 70, 50, h);
    g.strokeStyle = "#1c1620"; g.lineWidth = 4; g.strokeRect(x, y - h + 70, 50, h);
  }
  g.fillStyle = "#8a6a4a"; g.fillRect(60, 380, 380, 10); g.fillRect(60, 490, 380, 10);
  g.strokeStyle = "#1c1620"; g.lineWidth = 8; g.strokeRect(60, 250, 380, 290);
  // door
  g.fillStyle = "#9fd0e6"; g.fillRect(490, 250, 170, 350);
  g.strokeStyle = "#1c1620"; g.lineWidth = 8; g.strokeRect(490, 250, 170, 350); g.fillStyle = "#1c1620"; g.fillRect(500, 410, 14, 50);
});
const skyline = () => ctex("skyline", 1024, 512, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#7fb3e8"); gr.addColorStop(1, "#d6e8f6");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  for (let layer = 0; layer < 2; layer++) for (let x = 0; x < 1024;) {
    const w = 60 + 90 * r(), h = (layer ? 180 : 120) + 220 * r();
    g.fillStyle = layer ? "#7c8fb3" : "#a9b9d6"; g.fillRect(x, 512 - h, w, h);
    g.fillStyle = layer ? "#c9d8ee" : "#dce6f4";
    for (let wy = 512 - h + 14; wy < 500; wy += 26) for (let wx = x + 10; wx < x + w - 14; wx += 20) if (r() > 0.35) g.fillRect(wx, wy, 9, 13);
    x += w + 8;
  }
});
const carpet = () => ctex("carpet", 512, 512, (g, r) => {
  g.fillStyle = "#8d9db5"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3000; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(30,40,70,0.07)"; g.fillRect(r() * 512, r() * 512, 3, 3); }
  g.strokeStyle = "rgba(40,50,80,0.25)"; g.lineWidth = 3; for (let i = 0; i <= 512; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
});
const tiles = () => ctex("tiles", 512, 512, (g) => {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? "#e8dcc4" : "#d9c6a4"; g.fillRect(x * 128, y * 128, 128, 128); }
  g.strokeStyle = "rgba(90,70,50,0.5)"; g.lineWidth = 3; for (let i = 0; i <= 512; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
});
const wallpaper = (a: string, b: string) => ctex("wp" + a, 256, 256, (g) => {
  g.fillStyle = a; g.fillRect(0, 0, 256, 256);
  g.fillStyle = b; for (let y = 0; y < 256; y += 64) for (let x = (y / 64) % 2 ? 32 : 0; x < 256; x += 64) { g.beginPath(); g.arc(x + 16, y + 16, 7, 0, 7); g.fill(); }
});
const curtain = () => ctex("curtain", 512, 512, (g) => {
  for (let x = 0; x < 512; x++) { const k = 0.5 + 0.5 * Math.cos((x / 512) * Math.PI * 16); g.fillStyle = `rgb(${Math.round(120 + 70 * k)},${Math.round(22 + 18 * k)},${Math.round(40 + 20 * k)})`; g.fillRect(x, 0, 1, 512); }
});
const books = () => ctex("books", 512, 512, (g, r) => {
  g.fillStyle = "#7a4f33"; g.fillRect(0, 0, 512, 512);
  for (let s = 0; s < 4; s++) {
    let x = 14; const y = 20 + s * 125;
    while (x < 490) { const w = 14 + 18 * r(), h = 70 + 30 * r(); g.fillStyle = ["#c0353a", "#3f6fb5", "#e8c45a", "#5d7a3a", "#f0ece0", "#7b5ac9"][Math.floor(r() * 6)]; g.fillRect(x, y + 100 - h, w, h); g.strokeStyle = "#241726"; g.lineWidth = 3; g.strokeRect(x, y + 100 - h, w, h); x += w + 2; }
    g.fillStyle = "#5a3b2a"; g.fillRect(0, y + 100, 512, 22);
  }
});
const shelfGoods = () => ctex("shelfGoods", 512, 512, (g, r) => {
  g.fillStyle = "#e8e2d6"; g.fillRect(0, 0, 512, 512);
  for (let s = 0; s < 4; s++) {
    const y = s * 128;
    for (let x = 8; x < 500;) { const w = 30 + 26 * r(), h = 60 + 45 * r(); g.fillStyle = ["#e2453c", "#f2c230", "#3f9fdc", "#3fbf6a", "#f08a2c", "#a05ac9"][Math.floor(r() * 6)]; g.fillRect(x, y + 112 - h, w, h); g.fillStyle = "#fff6e0"; g.fillRect(x + 4, y + 112 - h * 0.6, w - 8, 12); g.strokeStyle = "#241726"; g.lineWidth = 3; g.strokeRect(x, y + 112 - h, w, h); x += w + 5; }
    g.fillStyle = "#9aa1ad"; g.fillRect(0, y + 112, 512, 16);
  }
});
const fruit = () => ctex("fruit", 512, 256, (g, r) => {
  g.fillStyle = "#8a5a34"; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 70; i++) { const x = r() * 512, y = 40 + r() * 200; g.fillStyle = ["#e2453c", "#f2c230", "#f08a2c", "#7cc04a"][Math.floor(r() * 4)]; g.beginPath(); g.arc(x, y, 18 + 6 * r(), 0, 7); g.fill(); g.strokeStyle = "#241726"; g.lineWidth = 3; g.stroke(); }
});
const road = () => ctex("road", 512, 512, (g, r) => {
  g.fillStyle = "#5e6270"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2500; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 512, r() * 512, 3, 3); }
  g.fillStyle = "#f4efe0"; for (let x = 0; x < 512; x += 128) g.fillRect(x + 20, 248, 70, 14);
});
const lightPanel = () => ctex("lightPanel", 64, 64, (g) => { g.fillStyle = "#fffdf2"; g.fillRect(0, 0, 64, 64); g.strokeStyle = "#c9c4b4"; g.lineWidth = 4; g.strokeRect(2, 2, 60, 60); });

// ---------------- builder ----------------
export type Board = { mesh: THREE.Mesh; cv: HTMLCanvasElement; tex: THREE.CanvasTexture; key: string };
const BW = 1600, BH = 900;

export class SetBuilder {
  root = new THREE.Group();
  boards = {} as Record<SetName, Board>;
  private g!: THREE.Group;
  private ox = 0;

  constructor() {
    for (const s of Object.values(SETS)) {
      this.g = new THREE.Group(); this.ox = s.ox; this.g.position.x = s.ox; this.root.add(this.g);
      ({ plaza: () => this.plaza(), office: () => this.office(), street: () => this.street(), home: () => this.home(), stage: () => this.stage() })[s.name]();
      this.board(s);
    }
  }

  /** box with its base at y (local to the current set) */
  box(w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number, yaw = 0, cast = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y + h / 2, z); mesh.rotation.y = yaw; mesh.castShadow = cast; mesh.receiveShadow = true;
    this.g.add(mesh); return mesh;
  }
  cyl(rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, seg = 16, cast = true) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = cast; mesh.receiveShadow = true; this.g.add(mesh); return mesh;
  }
  ball(r: number, m: THREE.Material, x: number, y: number, z: number, sy = 1) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), m);
    mesh.position.set(x, y, z); mesh.scale.y = sy; mesh.castShadow = true; mesh.receiveShadow = true; this.g.add(mesh); return mesh;
  }
  /** a front-facing textured panel (shopfront face, window view) */
  panel(w: number, h: number, m: THREE.Material, x: number, y: number, z: number, yaw = 0) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.position.set(x, y + h / 2, z); mesh.rotation.y = yaw; mesh.receiveShadow = true; this.g.add(mesh); return mesh;
  }
  floor(w: number, d: number, m: THREE.Material, y = 0, z = 0) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(0, y, z); mesh.receiveShadow = true; this.g.add(mesh); return mesh;
  }
  plant(x: number, z: number, s = 1) {
    this.cyl(0.32 * s, 0.24 * s, 0.5 * s, lam("pot", "#c8693c"), x, 0, z);
    for (const [dx, dy, dz, r] of [[0, 0.95, 0, 0.42], [0.22, 0.8, 0.1, 0.3], [-0.2, 0.82, -0.05, 0.32], [0.05, 1.22, 0, 0.3]] as const)
      this.ball(r * s, lam("leaf" + (dx > 0 ? "a" : "b"), dx > 0 ? "#5fae4f" : "#4e9a45"), x + dx * s, dy * s, z + dz * s);
  }
  tree(x: number, z: number, s = 1) {
    this.cyl(0.16 * s, 0.22 * s, 2.4 * s, lam("bark", "#8a5a3c"), x, 0, z, 8);
    for (const [dx, dy, dz, r] of [[0, 3.1, 0, 1.25], [0.7, 2.7, 0.3, 0.85], [-0.75, 2.75, -0.2, 0.9], [0.1, 3.8, 0.1, 0.8]] as const)
      this.ball(r * s, lam("tleaf" + (dx > 0 ? "a" : "b"), dx > 0 ? "#6ab34f" : "#579f46"), x + dx * s, dy * s, z + dz * s, 0.9);
  }
  chair(x: number, z: number, yaw = 0, col = "#3a4a6a") {
    const c = lam("chair" + col, col);
    const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = yaw; this.g.add(grp);
    const add = (w: number, h: number, d: number, px: number, py: number, pz: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), c); m.position.set(px, py, pz); m.castShadow = m.receiveShadow = true; grp.add(m); };
    add(0.5, 0.08, 0.5, 0, 0.48, 0); add(0.5, 0.55, 0.08, 0, 0.8, -0.22); add(0.06, 0.45, 0.06, 0, 0.23, 0);
  }

  private board(s: SetDef) {
    const cv = document.createElement("canvas"); cv.width = BW; cv.height = BH;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const { c, w, h, style } = s.board;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic(tex));
    mesh.position.set(c[0], c[1], c[2] + 0.03); this.g.add(mesh);
    // frame / bezel behind it
    const frameCol = style === "white" ? "#c9ccd2" : style === "bill" ? "#3a3d47" : style === "proj" ? "#e9e6df" : "#24262d";
    const pad = style === "proj" ? 0.08 : 0.14;
    this.box(w + 2 * pad, h + 2 * pad, 0.12, lam("frame" + style, frameCol), c[0], c[1] - h / 2 - pad, c[2] - 0.04, 0, false);
    if (style === "white") this.box(w * 0.9, 0.06, 0.16, lam("tray", "#9aa1ad"), c[0], c[1] - h / 2 - pad - 0.06, c[2] + 0.06, 0, false);
    this.boards[s.name] = { mesh, cv, tex, key: "" };
  }

  // ---------------- sets ----------------
  private plaza() {
    this.floor(46, 34, lam("paving", "#ffffff", rep(stoneHD("pavHD", ["#d8cdb9", "#cfc2ac", "#e0d6c3", "#c7baa3"], "#a89b86"), 9, 7)), 0, -2);
    const shops: [string, string, string, string[]][] = [
      ["Crumb & Co", "#e9cfa0", "#b5653f", ["#d9a441", "#c98a4a", "#f2d28a"]],
      ["STRIDE", "#bcd3e0", "#2f5f6a", ["#e2453c", "#3f6fb5", "#f4f1ea"]],
      ["Pixel Hut", "#d7c6e8", "#5a3c8a", ["#3a3d47", "#9fd8f2", "#e2453c"]],
      ["Daily Fresh", "#cfe3c0", "#3f7d3a", ["#7cc04a", "#f2c230", "#e2453c"]],
    ];
    shops.forEach(([n, wall, sign, goods], i) => {
      const x = -9 + i * 6;
      this.box(6, 5.2, 1.2, lam("shopbody" + i, wall), x, 0, -7.4);
      this.panel(5.8, 5.0, lam("shopface" + i, "#ffffff", shopTex(n, wall, sign, goods, i + 3)), x, 0, -6.79);
      const aw = this.box(5.4, 0.12, 1.5, lam("awn" + i, "#ffffff", stripes(sign, "#fff4e0")), x, 3.25, -6.1, 0, true);
      aw.rotation.x = 0.28;
      this.box(6.2, 0.4, 1.4, lam("cornice", "#e9e2d2"), x, 5.2, -7.4);
    });
    // supermarket-style shelf units (left), fruit stall (right), planters, bench, lamp posts
    for (const z of [-2.9]) for (const x of [3.6, -4.4]) {
      this.box(2.9, 2.0, 0.7, [lam("shelfSide", "#d8dde4"), lam("shelfSide", "#d8dde4"), lam("shelfSide", "#d8dde4"), lam("shelfSide", "#d8dde4"), lam("shelfGoods", "#ffffff", shelfGoods()), lam("shelfSide", "#d8dde4")], x, 0, z);
    }
    this.box(3.2, 0.9, 1.3, lam("stallBody", "#a8724a"), 7.4, 0, -2.2);
    this.panel(3.0, 0.5, lam("fruitTop", "#ffffff", fruit()), 7.4, 0.9, -1.54);
    for (const dx of [-1.5, 1.5]) this.cyl(0.05, 0.05, 2.6, lam("pole", "#5a3b2a"), 7.4 + dx, 0, -1.6, 8);
    const can = this.box(3.6, 0.12, 2.0, lam("canopy", "#ffffff", stripes("#c0353a", "#fff4e0")), 7.4, 2.6, -2.1); can.rotation.x = -0.12;
    for (const x of [-1.2, 1.4]) this.plant(x, -4.6, 1.2);
    this.plant(-12.8, -3, 1.3);
    for (const x of [-13, 13]) { this.cyl(0.07, 0.09, 4.2, lam("iron", "#3a3d47"), x, 0, 0.5, 8); this.ball(0.25, lam("lampGlass", "#fff3c4"), x, 4.35, 0.5); }
    // board posts
    for (const dx of [-1.6, 1.6]) this.cyl(0.09, 0.09, 1.7, lam("iron", "#3a3d47"), -8.8 + dx, 0, -3.7, 8);
    // distant backdrop: trees over the shops
    for (let i = 0; i < 7; i++) this.tree(-15 + i * 5, -10.5, 1.4);
  }

  private office() {
    this.floor(20, 14, lam("carpet", "#ffffff", rep(carpet(), 5, 4)), 0, -1);
    const wall = lam("offWall", "#ece6da");
    this.box(20, 4.6, 0.3, wall, 0, 0, -6.15, 0, false);
    this.box(0.3, 4.6, 14, wall, -9.6, 0, -1, 0, false); this.box(0.3, 4.6, 14, wall, 9.6, 0, -1, 0, false);
    const ceil = this.box(20, 0.2, 14, lam("ceil", "#f4f1ea"), 0, 4.6, -1, 0, false); ceil.receiveShadow = false;
    for (let x = -6; x <= 6; x += 4) for (const z of [-3.5, 0.5]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), basic(lightPanel())); m.rotation.x = Math.PI / 2; m.position.set(x, 4.59, z); this.g.add(m); }
    // windows with a skyline (right half of the back wall)
    for (const x of [1.6, 4.4, 7.2]) {
      this.panel(2.4, 2.6, new THREE.MeshBasicMaterial({ map: skyline() }), x, 1.0, -5.98);
      this.box(2.6, 0.12, 0.2, lam("winFrame", "#3a3d47"), x, 0.94, -5.92); this.box(2.6, 0.12, 0.2, lam("winFrame", "#3a3d47"), x, 3.6, -5.92);
      this.box(0.1, 2.7, 0.2, lam("winFrame", "#3a3d47"), x, 0.94, -5.92);
    }
    // desks with monitors and chairs
    for (const [x, z] of [[3.2, -3.4], [6.2, -3.4]] as const) {
      this.box(2.2, 0.08, 1.0, lam("desk", "#e8dcc4"), x, 0.74, z);
      for (const dx of [-1, 1]) this.box(0.08, 0.74, 0.9, lam("deskLeg", "#9aa1ad"), x + dx, 0, z);
      this.box(0.9, 0.55, 0.06, lam("monitor", "#2a2633"), x, 0.95, z - 0.3); this.cyl(0.04, 0.04, 0.15, lam("deskLeg", "#9aa1ad"), x, 0.82, z - 0.3, 8);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.45), new THREE.MeshBasicMaterial({ color: "#8fd0ee" })); scr.position.set(x, 1.225, z - 0.265); this.g.add(scr);
      this.chair(x, z + 0.95, Math.PI, "#3a4a6a");
    }
    // meeting table (left), plants, water cooler, filing cabinet
    this.cyl(1.3, 1.3, 0.08, lam("table", "#c8a77a"), -3.6, 0.72, -1.6, 32); this.cyl(0.12, 0.3, 0.72, lam("deskLeg", "#9aa1ad"), -3.6, 0, -1.6, 12);
    for (const a of [0.6, 2.5]) this.chair(-3.6 + 1.7 * Math.cos(a + Math.PI), -1.6 - 1.7 * Math.sin(a + Math.PI), -a - Math.PI / 2, "#c0353a");
    this.plant(-8.6, -5.2, 1.2); this.plant(8.6, -5.2, 1.2); this.plant(-8.6, 2.5, 1.0);
    this.box(0.4, 1.0, 0.4, lam("cooler", "#e9ecf0"), 8.7, 0, -1.5); this.cyl(0.18, 0.18, 0.5, lam("water", "#8fc8ee"), 8.7, 1.0, -1.5);
    this.box(0.6, 1.3, 0.6, lam("cabinet", "#9aa1ad"), -8.9, 0, -3.2);
    this.box(1.2, 2.3, 0.1, lam("door", "#a8724a"), 7.6, 0, -6.0);
  }

  private street() {
    this.floor(52, 10, lam("footpath", "#ffffff", rep(cobbleHD(), 10, 2)), 0.0, -2.5);
    this.floor(52, 9, lam("road", "#ffffff", rep(road(), 10, 1.8)), -0.02, 6.5);
    this.box(52, 0.16, 0.3, lam("kerb", "#c9c4b4"), 0, -0.16, 2.35, 0, false);
    const blds: [number, number, string, boolean][] = [[-19, 10, "#e9cf8f", false], [-12, 8.4, "#cfa58a", true], [-5, 11, "#d8c3a5", false], [2, 9.2, "#b9c9d6", false], [9, 10.4, "#e3b9a0", true], [16, 8.6, "#d6d1b3", false]];
    blds.forEach(([x, h, wall, brick], i) => {
      this.box(7, h, 5, lam("bld" + i, wall), x, 0, -10);
      this.panel(6.9, h, lam("bldf" + i, "#ffffff", facadeHD("st" + i, 6.9, h, { wall, shutter: ["#3f6fb5", "#5d7a3a", "#8c3b4a"][i % 3], door: true, brick })), x, 0, -7.49);
      this.box(7.3, 0.45, 5.3, lam("bldTop", "#8a8f9c"), x, h, -10);
    });
    // two shop awnings at street level
    for (const [x, c] of [[2, "#2f5f6a"], [-12, "#c0353a"]] as const) { const a = this.box(5.6, 0.12, 1.6, lam("sAwn" + c, "#ffffff", stripes(c, "#fff4e0")), x, 3.0, -6.7); a.rotation.x = 0.3; }
    // billboard posts, bus shelter, trees, lamps, a parked car
    for (const dx of [-1.9, 1.9]) this.cyl(0.1, 0.1, 2.2, lam("iron", "#3a3d47"), -5.2 + dx, 0, -2.7, 8);
    this.box(3.4, 0.12, 1.6, lam("shelterRoof", "#3a3d47"), 6.6, 2.5, -2.6); this.box(3.2, 2.4, 0.06, new THREE.MeshLambertMaterial({ color: "#bfe2f2", transparent: true, opacity: 0.35 }), 6.6, 0, -3.35);
    for (const dx of [-1.6, 1.6]) this.box(0.08, 2.5, 0.08, lam("iron", "#3a3d47"), 6.6 + dx, 0, -2.0);
    this.box(2.6, 0.1, 0.45, lam("benchSeat", "#a8724a"), 6.6, 0.45, -3.0);
    for (const x of [-15, -9, 10.5, 16]) this.tree(x, -4.4, 0.9);
    for (const x of [-20, 9.2, 20]) { this.cyl(0.07, 0.09, 4.6, lam("iron", "#3a3d47"), x, 0, 1.6, 8); this.ball(0.25, lam("lampGlass", "#fff3c4"), x, 4.75, 1.6); }
    const car = lam("car", "#e2453c"), glass = lam("carGlass", "#9fd8f2"), tyre = lam("tyre", "#24262d");
    this.box(4.2, 0.9, 1.8, car, 13, 0.3, 4.4); this.box(2.4, 0.7, 1.6, glass, 12.8, 1.2, 4.4);
    for (const dx of [-1.4, 1.4]) for (const dz of [-0.85, 0.85]) { const w = this.cyl(0.36, 0.36, 0.25, tyre, 13 + dx, 0.0, 4.4 + dz, 14); w.rotation.x = Math.PI / 2; w.position.y = 0.36; }
    this.floor(80, 40, lam("grassFar", "#ffffff", rep(grassHD(), 20, 10)), -0.05, -32);
  }

  private home() {
    this.floor(14, 11, lam("planks", "#ffffff", rep(planksHD(), 3, 2.4)), 0, -0.5);
    const wp = lam("wallpaper", "#ffffff", rep(wallpaper("#e9d9c0", "#d9c2a0"), 6, 2.4));
    this.box(14, 3.6, 0.3, wp, 0, 0, -4.65, 0, false);
    this.box(0.3, 3.6, 11, wp, -7, 0, -0.5, 0, false); this.box(0.3, 3.6, 11, wp, 7, 0, -0.5, 0, false);
    const ceil = this.box(14, 0.2, 11, lam("ceil", "#f4f1ea"), 0, 3.6, -0.5, 0, false); ceil.receiveShadow = false;
    this.box(14, 0.18, 0.06, lam("skirting", "#f4f1ea"), 0, 0, -4.48, 0, false);
    // TV on a low cabinet (board), rug, sofa (back to the right wall area), coffee table, lamp, bookshelf, window, plant
    this.box(3.6, 0.55, 0.55, lam("cabinetTV", "#7a4f33"), -2.2, 0, -4.15);
    this.floor(5.4, 3.4, lam("rug", "#c25a7a"), 0.012, -1.2);
    const sofa = lam("sofa", "#3f6fb5");
    this.box(3.0, 0.45, 1.0, sofa, 4.15, 0, -2.75); this.box(3.0, 0.75, 0.3, sofa, 4.15, 0.45, -3.2);
    for (const dx of [-1.6, 1.6]) this.box(0.3, 0.75, 1.0, sofa, 4.15 + dx, 0, -2.75);
    this.box(1.4, 0.08, 0.8, lam("ctable", "#a8724a"), 1.4, 0.42, -1.4); for (const [dx, dz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) this.box(0.06, 0.42, 0.06, lam("ctable", "#a8724a"), 1.4 + dx, 0, -1.4 + dz);
    this.cyl(0.02, 0.02, 1.6, lam("iron", "#3a3d47"), 6.2, 0, -3.8, 8); this.cyl(0.18, 0.32, 0.4, lam("shade", "#f2d28a"), 6.2, 1.6, -3.8, 16);
    this.box(1.6, 2.4, 0.4, [lam("bookWood", "#7a4f33"), lam("bookWood", "#7a4f33"), lam("bookWood", "#7a4f33"), lam("bookWood", "#7a4f33"), lam("books", "#ffffff", books()), lam("bookWood", "#7a4f33")], -5.8, 0, -4.3);
    this.panel(2.0, 1.6, new THREE.MeshBasicMaterial({ map: skyline() }), 3.4, 1.4, -4.48);
    this.box(2.2, 0.1, 0.16, lam("winFrame", "#f4f1ea"), 3.4, 1.35, -4.44); this.box(2.2, 0.1, 0.16, lam("winFrame", "#f4f1ea"), 3.4, 3.0, -4.44); this.box(0.08, 1.7, 0.16, lam("winFrame", "#f4f1ea"), 3.4, 1.35, -4.44);
    this.plant(-6.2, 1.5, 1.0); this.plant(6.3, -1.0, 0.9);
  }

  private stage() {
    this.floor(26, 22, lam("hallFloor", "#8a6a4a"), 0, 2);
    this.box(16, 0.6, 7, lam("stageBoards", "#ffffff", rep(planksHD(), 4, 2)), 0, 0, -3.0);
    this.box(16.2, 0.62, 0.2, lam("stageLip", "#3a2a2a"), 0, 0, 0.5);
    this.box(18, 7, 0.3, lam("curtain", "#ffffff", rep(curtain(), 4, 1)), 0, 0, -6.2, 0, false);
    this.box(0.3, 7, 14, lam("hallWall", "#3a4060"), -9.5, 0, 0, 0, false); this.box(0.3, 7, 14, lam("hallWall", "#3a4060"), 9.5, 0, 0, 0, false);
    const ceil = this.box(20, 0.2, 22, lam("ceilDark", "#2a2d40"), 0, 7, 2, 0, false); ceil.receiveShadow = false;
    // lectern with the uni crest colour, rows of seats facing the stage
    this.box(0.9, 1.15, 0.6, lam("lectern", "#7a2a2a"), 4.6, 0.6, -2.3); this.box(1.0, 0.08, 0.7, lam("lecternTop", "#5a1e1e"), 4.6, 1.75, -2.3);
    for (let row = 0; row < 3; row++) for (let i = -5; i <= 5; i++) {
      if (i === 0) continue;
      const x = i * 1.05 + (i > 0 ? 0.6 : -0.6), z = 4.0 + row * 1.3;
      this.box(0.86, 0.5, 0.6, lam("seat", "#3f5fa0"), x, 0, z); this.box(0.86, 0.6, 0.12, lam("seat", "#3f5fa0"), x, 0.5, z + 0.25);
    }
  }
}

// ---------------- board painting ----------------
export type BoardLine = { text: string; at?: number | null };
export type BoardSpec = {
  title?: string; kicker?: string; lines?: BoardLine[]; at?: number | null;
  big?: string; bigAt?: number | null; caption?: string;
  bars?: { label: string; value: number; display?: string; at?: number | null }[];
  vs?: { left: string; right: string; leftItems?: string[]; rightItems?: string[]; at?: number | null };
  photo?: string; name?: string; org?: string;
  steps?: BoardLine[];
};
const STYLE = {
  screen: { bg: "#13233f", ink: "#ffffff", sub: "#b9cbe8", acc: "#ffcf5a", acc2: "#6fd0ff", font: FONT },
  white: { bg: "#fbfaf6", ink: "#1f2a44", sub: "#4a5570", acc: "#d0342c", acc2: "#1f6fd0", font: '"Segoe Print", "Comic Sans MS", ' + FONT },
  bill: { bg: "#ffcf3a", ink: "#1c1620", sub: "#3a2e20", acc: "#c0262a", acc2: "#1f4fa0", font: FONT },
  tv: { bg: "#1a1c2c", ink: "#ffffff", sub: "#c9cbe0", acc: "#ff7a59", acc2: "#7fd3f0", font: FONT },
  proj: { bg: "#f6f1e7", ink: "#1f2433", sub: "#4f566b", acc: "#b5322a", acc2: "#2a5fa8", font: FONT },
} as const;
const photos = new Map<string, HTMLImageElement>();
/** what a screen shows when the beat has nothing on it: an invented ad, a show, the course name */
const idle = (g: CanvasRenderingContext2D, style: string) => {
  g.textAlign = "center"; g.textBaseline = "middle";
  if (style === "white") return;
  if (style === "bill" || style === "screen") {
    const gr = g.createLinearGradient(0, 0, BW, BH); gr.addColorStop(0, style === "bill" ? "#ff6a3d" : "#2a5fd0"); gr.addColorStop(1, style === "bill" ? "#ffcf3a" : "#6fd0ff");
    g.fillStyle = gr; g.fillRect(0, 0, BW, BH);
    g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.arc(BW * 0.78, BH * 0.5, 330, 0, 7); g.fill();
    g.fillStyle = "#ffffff"; g.font = `900 170px ${FONT}`; g.fillText(style === "bill" ? "FIZZ" : "SALE", BW * 0.36, BH * 0.42);
    g.font = `700 64px ${FONT}`; g.fillText(style === "bill" ? "taste the summer" : "this weekend only", BW * 0.36, BH * 0.64);
    g.fillStyle = "#ffffff"; g.beginPath(); g.roundRect(BW * 0.7, BH * 0.25, 170, 420, 50); g.fill(); g.fillStyle = style === "bill" ? "#ff6a3d" : "#2a5fd0"; g.fillRect(BW * 0.7, BH * 0.45, 170, 90);
    return;
  }
  if (style === "tv") {
    const gr = g.createLinearGradient(0, 0, 0, BH); gr.addColorStop(0, "#7fc8f0"); gr.addColorStop(1, "#c8ecff"); g.fillStyle = gr; g.fillRect(0, 0, BW, BH);
    g.fillStyle = "#6ab34f"; g.beginPath(); g.ellipse(BW * 0.3, BH, 700, 300, 0, 0, 7); g.fill(); g.fillStyle = "#4e9a45"; g.beginPath(); g.ellipse(BW * 0.85, BH, 600, 240, 0, 0, 7); g.fill();
    g.fillStyle = "#ffe066"; g.beginPath(); g.arc(BW * 0.8, BH * 0.25, 90, 0, 7); g.fill();
    return;
  }
  g.fillStyle = "#1f2433"; g.font = `800 120px ${FONT}`; g.fillText("MKTG 3600", BW / 2, BH * 0.45);
  g.fillStyle = "#b5322a"; g.font = `600 54px ${FONT}`; g.fillText("Marketing in practice", BW / 2, BH * 0.6);
};
export const loadPhoto = (src: string) => new Promise<void>((res) => {
  if (photos.has(src)) return res();
  const im = new Image(); im.onload = () => { photos.set(src, im); res(); }; im.onerror = () => res(); im.src = staticFile(src);
});
/** **x** = accent colour */
const rich = (g: CanvasRenderingContext2D, text: string, x: number, y: number, base: string, acc: string, align: "left" | "center" = "left") => {
  const parts = text.split(/\*\*/);
  let w = 0; for (const p of parts) w += g.measureText(p).width;
  let cx = align === "center" ? x - w / 2 : x;
  g.textAlign = "left";
  parts.forEach((p, i) => { g.fillStyle = i % 2 ? acc : base; g.fillText(p, cx, y); cx += g.measureText(p).width; });
};
const wrapW = (g: CanvasRenderingContext2D, text: string, maxW: number) => {
  const out: string[] = []; let line = "";
  for (const w of text.split(" ")) { const t = line ? line + " " + w : w; if (g.measureText(t.replace(/\*\*/g, "")).width > maxW && line) { out.push(line); line = w; } else line = t; }
  out.push(line);
  // keep **...** balanced per line
  let open = false;
  return out.map((l) => { let s = (open ? "**" : "") + l; const n = (l.match(/\*\*/g) || []).length; if (n % 2) open = !open; if (open) s += "**"; return s; });
};
/** paint the board for time t (seconds into the beat); returns a cache key so unchanged boards are not repainted */
export const boardKey = (spec: BoardSpec | null, t: number, style: string) => {
  if (!spec) return `${style}|blank`;
  const shown = (a?: number | null) => (a == null || t >= a ? 1 : 0);
  const anim = (a?: number | null) => (a == null ? 1 : Math.max(0, Math.min(1, (t - a) / 0.5)));
  const vis = [...(spec.lines ?? []).map((l) => shown(l.at)), ...(spec.steps ?? []).map((l) => shown(l.at)), ...(spec.bars ?? []).map((b) => Math.round(anim(b.at) * 12)), shown(spec.bigAt ?? spec.at), shown(spec.vs?.at)];
  return `${style}|${JSON.stringify(spec).length}|${spec.title}|${vis.join("")}`;
};
export const paintBoard = (b: Board, spec: BoardSpec | null, t: number, style: keyof typeof STYLE) => {
  const key = boardKey(spec, t, style);
  if (key === b.key) return;
  b.key = key;
  const g = b.cv.getContext("2d")!, S = STYLE[style];
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = S.bg; g.fillRect(0, 0, BW, BH);
  if (style === "white") { g.fillStyle = "rgba(120,130,160,0.06)"; for (let i = 0; i < 9; i++) g.fillRect(0, 100 * i + 40, BW, 3); }
  if (!spec) { idle(g, style); b.tex.needsUpdate = true; return; }
  const shown = (a?: number | null) => a == null || t >= a;
  const pad = 90;
  let y = 110;
  g.textBaseline = "alphabetic";
  if (spec.kicker) { g.font = `700 40px ${FONT}`; g.fillStyle = S.acc; g.textAlign = "left"; g.fillText(spec.kicker.toUpperCase(), pad, y); y += 70; }
  if (spec.photo) {
    const im = photos.get(spec.photo);
    const ph = 560, pw = 460, px = pad, py = 170;
    g.fillStyle = S.sub; g.fillRect(px - 8, py - 8, pw + 16, ph + 16);
    if (im) { const k = Math.max(pw / im.width, ph / im.height), sw = pw / k, sh = ph / k; g.drawImage(im, (im.width - sw) / 2, Math.max(0, (im.height - sh) * 0.3), sw, sh, px, py, pw, ph); }
    const tx = px + pw + 80, mw = BW - tx - pad;
    g.font = `800 76px ${FONT}`; let ty = 250;
    for (const l of wrapW(g, spec.title ?? "", mw)) { rich(g, l, tx, ty, S.ink, S.acc); ty += 88; }
    ty += 30; g.font = `700 54px ${FONT}`; g.fillStyle = S.acc2; g.textAlign = "left"; g.fillText(spec.name ?? "", tx, ty); ty += 64;
    g.font = `500 40px ${FONT}`; for (const l of wrapW(g, spec.org ?? "", mw)) { g.fillStyle = S.sub; g.fillText(l, tx, ty); ty += 50; }
    b.tex.needsUpdate = true; return;
  }
  if (spec.title) {
    g.font = `800 ${spec.big || spec.bars || spec.vs ? 80 : 92}px ${S.font}`;
    for (const l of wrapW(g, spec.title, BW - 2 * pad)) { rich(g, l, pad, y, S.ink, S.acc); y += 100; }
    y += 40;
  }
  if (spec.big) {
    if (shown(spec.bigAt ?? spec.at)) {
      g.font = `900 300px ${FONT}`; g.textAlign = "center"; g.fillStyle = S.acc; g.fillText(spec.big, BW / 2, y + 290);
      g.font = `600 64px ${FONT}`; let cy = y + 390;
      for (const l of wrapW(g, spec.caption ?? "", BW - 2 * pad)) { rich(g, l, BW / 2, cy, S.sub, S.acc2, "center"); cy += 76; }
    }
  } else if (spec.bars) {
    const max = Math.max(...spec.bars.map((x) => x.value)), n = spec.bars.length, rowH = Math.min(150, (BH - y - 60) / n);
    spec.bars.forEach((bar, i) => {
      const k = bar.at == null ? 1 : Math.max(0, Math.min(1, (t - bar.at) / 0.5)), yy = y + i * rowH;
      g.font = `700 54px ${FONT}`; g.fillStyle = S.ink; g.textAlign = "left"; g.fillText(bar.label, pad, yy + rowH * 0.55);
      const x0 = pad + 420, wmax = BW - x0 - pad - 220, w = (wmax * bar.value * (1 - (1 - k) ** 3)) / max;
      g.fillStyle = i % 2 ? S.acc2 : S.acc; g.fillRect(x0, yy + rowH * 0.2, w, rowH * 0.5);
      if (k > 0.6) { g.font = `800 48px ${FONT}`; g.fillStyle = S.ink; g.fillText(bar.display ?? String(bar.value), x0 + w + 24, yy + rowH * 0.6); }
    });
  } else if (spec.vs) {
    const v = spec.vs, colW = (BW - 2 * pad - 80) / 2;
    [[v.left, v.leftItems, S.acc], [v.right, v.rightItems, S.acc2]].forEach(([head, items, col], i) => {
      if (i === 1 && !shown(v.at)) return;
      const x = pad + i * (colW + 80);
      g.fillStyle = col as string; g.fillRect(x, y, colW, 110);
      g.font = `800 56px ${FONT}`; g.fillStyle = "#ffffff"; g.textAlign = "center"; g.fillText(head as string, x + colW / 2, y + 74);
      let yy = y + 190; g.font = `600 54px ${FONT}`;
      for (const it of (items as string[] | undefined) ?? []) for (const l of wrapW(g, it, colW - 40)) { rich(g, l, x + colW / 2, yy, S.ink, col as string, "center"); yy += 66; }
    });
    if (shown(v.at)) { g.font = `900 64px ${FONT}`; g.fillStyle = S.ink; g.textAlign = "center"; g.fillText("vs", BW / 2, y + 74); }
  } else {
    const list = spec.steps ?? spec.lines ?? [];
    const numbered = !!spec.steps;
    const avail = BH - y - 50, n = list.length;
    let fs = n <= 3 ? 80 : n <= 4 ? 72 : 62;
    g.font = `600 ${fs}px ${S.font}`;
    const wrapped = list.map((l) => wrapW(g, l.text, BW - 2 * pad - 90));
    const need = wrapped.reduce((a, w) => a + w.length * fs * 1.18 + 26, 0);
    if (need > avail) { fs = Math.floor(fs * Math.sqrt(avail / need)); g.font = `600 ${fs}px ${S.font}`; }
    list.forEach((l, i) => {
      if (!shown(l.at)) return;
      const lines = wrapW(g, l.text, BW - 2 * pad - 90);
      if (numbered) { g.fillStyle = S.acc; g.beginPath(); g.arc(pad + 28, y - fs * 0.35, 36, 0, 7); g.fill(); g.font = `800 44px ${FONT}`; g.fillStyle = S.bg; g.textAlign = "center"; g.fillText(String(i + 1), pad + 28, y - fs * 0.35 + 13); }
      else { g.fillStyle = S.acc; g.beginPath(); g.arc(pad + 24, y - fs * 0.33, 11, 0, 7); g.fill(); }
      g.font = `600 ${fs}px ${S.font}`;
      for (const ln of lines) { rich(g, ln, pad + 80, y, S.ink, S.acc); y += fs * 1.18; }
      y += 26;
    });
  }
  b.tex.needsUpdate = true;
};
