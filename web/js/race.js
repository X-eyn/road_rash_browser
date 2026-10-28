// The race: original RPTH course mesh, atlas props, rider/car sprites, combat, police, HUD.
import * as THREE from "three";
import { DATA, trackInfo, trackName } from "./data.js";
import { getTexture, loadImage, loadTrackBundle } from "./assets.js";
import { audio } from "./audio.js";
import { RaceInput } from "./input.js";

const STEP = 4.85;
const HALF = 6.0;
const SHOULDER = 2.0;
const RIDER_PX = 0.022;
const CAR_PX = 0.07;
const PROP_PX = 0.055;
const MPH = 0.44704;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function integrate(steps) {
  let x = 0, y = 0, z = 0, h = 0;
  const pts = [{ x, y, z, h }];
  for (const [a, b] of steps) {
    h += Math.atan(a / 256) / 2;
    y += (b * STEP) / 256;
    x += Math.sin(h) * STEP;
    z -= Math.cos(h) * STEP;
    pts.push({ x, y, z, h });
  }
  return pts;
}

const clockText = (sec) => {
  if (!Number.isFinite(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
};
const suffix = (n) => (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");

function makeAsphalt(course) {
  const base = {
    city: [43, 43, 47], hiway: [54, 51, 46], medly: [50, 48, 45], napa: [59, 55, 47], canyn: [57, 52, 43],
  }[course] || [48, 48, 48];
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  g.fillRect(0, 0, 128, 256);
  const img = g.getImageData(0, 0, 128, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() * 26) | 0;
    img.data[i] = clamp(img.data[i] + n - 13, 0, 255);
    img.data[i + 1] = clamp(img.data[i + 1] + n - 13, 0, 255);
    img.data[i + 2] = clamp(img.data[i + 2] + n - 13, 0, 255);
  }
  g.putImageData(img, 0, 0);
  // cracks and patches
  g.strokeStyle = "rgba(22,22,24,.5)";
  g.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    let x = Math.random() * 128, y = Math.random() * 256;
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (Math.random() * 14 - 7); y += 10 + Math.random() * 16; g.lineTo(x, y); }
    g.stroke();
  }
  // edge lines
  g.fillStyle = "rgba(230,230,220,.78)";
  g.fillRect(3, 0, 3, 256);
  g.fillRect(122, 0, 3, 256);
  // dashed centre line
  g.fillStyle = "rgba(228,190,54,.9)";
  for (let y = 0; y < 256; y += 64) g.fillRect(62, y, 4, 30);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function makeGroundTexture(hex) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  const col = new THREE.Color(hex);
  const base = `rgb(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)})`;
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1900; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    const d = (Math.random() - 0.5) * 0.16;
    g.fillStyle = `rgba(${d > 0 ? 255 : 0},${d > 0 ? 255 : 0},${d > 0 ? 255 : 0},${Math.abs(d)})`;
    g.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

function makeShadow() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 32;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 16, 1, 32, 16, 30);
  grad.addColorStop(0, "rgba(0,0,0,.75)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeBanner(text, color = "#d8261c") {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(0,0,0,.65)";
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.strokeRect(3, 3, 250, 58);
  g.fillStyle = "#fff";
  g.font = "bold 38px Arial Narrow, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function startRace(opts) {
  return new Promise((resolve) => {
    const race = new Race(opts, resolve);
    window.__race = race;
    race.init().catch((err) => {
      console.error("race init failed", err);
      race.destroy();
      resolve({ status: "quit", error: String(err?.message || err) });
    });
  });
}

class Race {
  constructor(opts, resolve) {
    this.opts = opts;
    this.resolve = resolve;
    this.resolved = false;
    this.running = false;
    this.paused = false;
    this.ended = false;
    this.finishing = false;
    this.endTimer = 0;
    this.raceTime = 0;
    this.countdown = 3.4;
    this.damage = 0;
    this.nitro = 0.75;
    this.shake = 0;
    this.bustT = 0;
    this.msgT = 0;
    this.frameNo = 0;
    this.cameraMode = opts.camera || "chase";
    this.assist = clamp(opts.assist ?? 0.45, 0, 1);
    this.level = opts.level || 1;
    this.units = opts.units || "mph";
    this.canvas = document.getElementById("race-canvas");
    this.hud = document.getElementById("hud");
    this.raceEl = document.getElementById("race");
    this._pauseKey = (e) => {
      if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        e.preventDefault();
        this.togglePause();
      }
    };
    this._resize = () => {};
  }

  async init() {
    this.raceEl.hidden = false;
    this.raceEl.classList.add("on");
    this.hud.innerHTML = `<div class="race-load"><strong>LOADING ${trackName(this.opts.track).toUpperCase()}</strong><p>Warming up the bike…</p><div class="loadbar"><i></i></div></div>`;
    this.course = DATA.courses[this.opts.track];
    this.info = trackInfo(this.opts.track);
    this.pts = integrate(this.course.steps);
    this.start = this.course.start ?? 52;
    this.finish = this.course.finish[this.level - 1] ?? this.course.finish[0];
    this.field = 8;
    this.setState = "loading";
    this.player = null;
    this.riders = [];
    this.cars = [];
    this.parked = [];
    this.cop = null;
    this.props = [];
    this.scenery = [];
    this.propPool = [];
    this.scenePool = [];
    this.carPool = [];
    this.riderTex = new Map();
    this.carTex = new Map();
    this.propMats = new Map();
    this.sceneryMats = new Map();
    this.bundle = await loadTrackBundle(this.opts.track, [0, 1, 2, 3, 4, 5, 6, 7], (p) => {
      const bar = this.hud.querySelector(".loadbar i");
      if (bar) bar.style.width = `${Math.round(p * 100)}%`;
    });
    this.buildRenderer();
    await this.loadTextures();
    this.buildWorld();
    this.buildHUD();
    this.input = new RaceInput(this.hud);
    this._mouseDown = (e) => {
      if (e.button === 0) this.input.pressed.add("punch");
      else if (e.button === 2) this.input.pressed.add("kick");
    };
    this._noCtx = (e) => e.preventDefault();
    this.canvas.addEventListener("mousedown", this._mouseDown);
    this.canvas.addEventListener("contextmenu", this._noCtx);
    window.addEventListener("keydown", this._pauseKey);
    this.resetPositions();
    this.showCountdown();
    this.running = true;
    this.setState = "countdown";
    audio.startEngine(this.opts.bike.cls);
    audio.playMusic("race");
    const q = new URLSearchParams(location.search);
    if (q.has("skipcount")) {
      this.countdown = 0;
      this.setState = "ride";
      this.hudCount.classList.remove("on");
      for (const r of this.riders) r.state = "ride";
    }
    if (q.has("sim")) {
      this.autoThrottle = 1;
      this.autoSteer = true;
      const seconds = Math.max(0, Math.min(20, parseFloat(q.get("sim")) || 3));
      for (let i = 0; i < seconds * 60; i++) { this.update(1 / 60); this.updateCamera(1 / 60); }
      this.updateHUD();
      this.updateCamera(1 / 30);
    }
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    document.body.classList.add("racing");
    this.bindPauseButtons();
  }

  buildRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(640, 480, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(new THREE.Color(this.info.sky[0] / 255, this.info.sky[1] / 255, this.info.sky[2] / 255), 1);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.info.sky[0] / 255, this.info.sky[1] / 255, this.info.sky[2] / 255);
    this.camera = new THREE.PerspectiveCamera(62, 640 / 480, 0.35, 1600);
    const fogCols = {
      city: [91, 105, 93], hiway: [107, 124, 114], medly: [90, 101, 87],
      napa: [91, 107, 72], canyn: [122, 107, 82],
    };
    const fc = fogCols[this.opts.track] || this.info.fog;
    this.scene.fog = new THREE.Fog(new THREE.Color(fc[0] / 255, fc[1] / 255, fc[2] / 255), 100, 700);
  }

  async loadTextures() {
    const tx = (u, o) => getTexture(u, o);
    this.asphalt = makeAsphalt(this.opts.track);
    this.shadowTex = makeShadow();
    const rural = ["hiway", "napa", "canyn"].includes(this.opts.track);
    const city = ["city", "medly"].includes(this.opts.track);
    this.shoulderTex = await tx(`./assets/tex/${city ? "sctsidwk" : "sand"}.png`, { wrap: THREE.RepeatWrapping });
    this.groundColor = city ? 0x566252 : this.opts.track === "canyn" ? 0x9b8a62 : this.opts.track === "hiway" ? 0x6b7850 : 0x5f7846;
    this.groundTex = makeGroundTexture(this.groundColor);
    this.startTex = await tx("./assets/tex/start160.png");
    this.finishTex = await tx("./assets/tex/finish.png");
    this.atlasTex = await tx(`./assets/track/${this.opts.track}/atlas.png`);
    const hkey = this.opts.track === "city" ? "hiway" : this.opts.track;
    this.horizonTex = await tx(`./assets/track/${hkey}/horizon-sky.png`, { wrap: THREE.ClampToEdgeWrapping });
    this.riderMeta = DATA.rider;
    for (const s of [0, 1, 2, 3, 4, 5, 6, 7]) {
      this.riderTex.set(s, await tx(`./assets/sprites/rider${s}.png`));
    }
    this.cloudTex = {
      big: await tx("./assets/sprites/cloud-big.png"),
      small: await tx("./assets/sprites/cloud-small.png"),
    };
    this.dashSrc = `./assets/sprites/dash-${this.opts.bike.cls}.png`;
    await loadImage(this.dashSrc).catch(() => {});
    const cars = DATA.cars?.[this.opts.track] || {};
    const all = [...(cars.moving || []), ...(cars.parked || [])];
    for (const c of all) {
      if (!this.carTex.has(c.name)) {
        try { this.carTex.set(c.name, await tx(`./assets/sprites/cars/${c.name}.png`)); } catch (e) { console.warn("car sprite missing", c.name); }
      }
    }
  }

  // ---------------------------------------------------------------- world
  posAt(s, lat = 0, up = 0) {
    s = clamp(s, 0, this.pts.length - 1.0001);
    const i = Math.floor(s);
    const f = s - i;
    const a = this.pts[i], b = this.pts[Math.min(i + 1, this.pts.length - 1)];
    const h = angleLerp(a.h, b.h, f);
    const x = lerp(a.x, b.x, f);
    const y = lerp(a.y, b.y, f);
    const z = lerp(a.z, b.z, f);
    return { x: x + Math.cos(h) * lat, y: y + up, z: z + Math.sin(h) * lat, h };
  }

  fwdAt(s) {
    const p = this.posAt(s, 0);
    return { x: Math.sin(p.h), z: -Math.cos(p.h), h: p.h };
  }

  buildWorld() {
    const max = Math.min(this.pts.length - 1, this.finish + 170);
    this.maxStep = max;
    this.buildRoad(max);
    this.buildSky();
    this.buildProps();
    this.buildScenery();
    this.buildRiders();
    this.buildTraffic();
    this.buildGates();
  }

  buildRoad(max) {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= max; i++) {
      const p = this.pts[i];
      const rx = Math.cos(p.h), rz = Math.sin(p.h);
      const v = (i * STEP) / 8;
      pos.push(p.x - rx * HALF, p.y + 0.02, p.z - rz * HALF);
      pos.push(p.x + rx * HALF, p.y + 0.02, p.z + rz * HALF);
      uv.push(0, v, 1, v);
      if (i < max) {
        const n = i * 2;
        idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const road = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.asphalt, side: THREE.FrontSide, fog: true }));
    this.scene.add(road);

    for (const side of [-1, 1]) {
      const sp = [], su = [], si = [];
      for (let i = 0; i <= max; i++) {
        const p = this.pts[i];
        const rx = Math.cos(p.h), rz = Math.sin(p.h);
        const a = side * HALF, b = side * (HALF + SHOULDER);
        sp.push(p.x + rx * a, p.y + 0.01, p.z + rz * a);
        sp.push(p.x + rx * b, p.y - 0.02, p.z + rz * b);
        su.push(0, i * 0.45, 1, i * 0.45);
        if (i < max) {
          const n = i * 2;
          if (side < 0) si.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
          else si.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
        }
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
      sg.setAttribute("uv", new THREE.Float32BufferAttribute(su, 2));
      sg.setIndex(si);
      sg.computeBoundingSphere();
      this.scene.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: this.shoulderTex, side: THREE.FrontSide, fog: true })));
    }

    {
      const gp = [], gu = [], gi = [];
      for (let i = 0; i <= max; i++) {
        const p = this.pts[i];
        const rx = Math.cos(p.h), rz = Math.sin(p.h);
        gp.push(p.x - rx * 120, p.y - 0.55, p.z - rz * 120);
        gp.push(p.x + rx * 120, p.y - 0.55, p.z + rz * 120);
        gu.push(0, i * 0.06, 4, i * 0.06);
        if (i < max) {
          const n = i * 2;
          gi.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
        }
      }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute("position", new THREE.Float32BufferAttribute(gp, 3));
      gg.setAttribute("uv", new THREE.Float32BufferAttribute(gu, 2));
      gg.setIndex(gi);
      gg.computeBoundingSphere();
      this.scene.add(new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ map: this.groundTex, side: THREE.FrontSide, fog: true })));
    }
  }

  buildSky() {
    this.horizonW = 2400;
    const ih = this.horizonTex.image?.height || 200;
    const iw = this.horizonTex.image?.width || 720;
    this.horizonH = this.horizonW * ih / iw;
    const geo = new THREE.PlaneGeometry(this.horizonW, this.horizonH);
    const mat = new THREE.MeshBasicMaterial({
      map: this.horizonTex,
      fog: false,
      transparent: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.horizon = new THREE.Mesh(geo, mat);
    this.horizon.renderOrder = -100;
    this.scene.add(this.horizon);
    this.clouds = [];
    const defs = [
      [-420, 150, -520, 1.0], [220, 180, -700, 1.2], [760, 165, -420, 0.9],
      [-800, 210, 100, 1.1], [460, 230, 380, 1.0], [-180, 250, 660, 0.8],
      [980, 190, -120, 0.7], [-980, 230, -240, 0.65],
    ];
    for (const [x, y, z, sc] of defs) {
      const tex = this.cloudTex.big.clone();
      tex.needsUpdate = false;
      const col = (this.clouds.length % 4);
      const row = (Math.floor(this.clouds.length / 4) % 3);
      tex.offset.set(col * 0.25, 1 - (row + 1) * 0.25);
      tex.repeat.set(0.25, 0.25);
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7, fog: false, depthWrite: false });
      const sp = new THREE.Sprite(m);
      sp.center.set(0.5, 0.5);
      sp.scale.set(230 * sc, 115 * sc, 1);
      sp.userData.base = [x, y, z];
      sp.renderOrder = -50;
      this.scene.add(sp);
      this.clouds.push(sp);
    }
  }

  makePropMaterial(name, mirror, poolMap) {
    const rect = this.bundle.atlas?.rects?.[name];
    if (!rect) return null;
    const key = name + (mirror ? "~" : "");
    if (poolMap.has(key)) return poolMap.get(key);
    const [page, x, y, w, h] = rect;
    const S = this.bundle.atlas.size || 2048;
    const tex = this.atlasTex.clone();
    tex.needsUpdate = false;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    if (mirror) {
      tex.offset.set((x + w) / S, 1 - (y + h) / S);
      tex.repeat.set(-w / S, h / S);
    } else {
      tex.offset.set(x / S, 1 - (y + h) / S);
      tex.repeat.set(w / S, h / S);
    }
    const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, fog: true });
    poolMap.set(key, mat);
    return mat;
  }

  buildProps() {
    const props = (this.bundle.props || [])
      .filter((p) => p && p[0] >= 0 && p[0] < this.maxStep - 2 && p[3] > 0 && p[4] > 0)
      .map((p) => ({
        step: p[0],
        // p[6] < 0 => left, p[1] is outward metres from the tarmac edge
        lat: p[6] < 0 ? -(HALF + p[1]) : HALF + p[1],
        name: p[2], w: p[3], h: p[4], mirror: !!p[5],
      }))
      .filter((p) => this.bundle.atlas?.rects?.[p.name])
      .filter((p) => !/(GAS|HWY|CARWASH|BUSSTOP|BIGFN|SIGN|SPEED|BIG|BILL|MUNI|BUS|BACK|TOWER|PHONE|BILLBOARD)/.test(p.name))
      .sort((a, b) => a.step - b.step);
    this.props = props;
    for (let i = 0; i < 130; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: null, alphaTest: 0.5, fog: true }));
      sp.visible = false;
      sp.center.set(0.5, 0);
      this.scene.add(sp);
      this.propPool.push(sp);
    }
  }

  buildScenery() {
    const rects = this.bundle.atlas?.rects || {};
    const names = Object.keys(rects);
    const city = this.opts.track === "city" || this.opts.track === "medly";
    let pick;
    if (city) {
      const pre = ["OFFC", "WRHS", "VICT", "BUSS", "WHSE", "CHURCH", "SHOPE", "MUNI", "BARN"];
      pick = names.filter((n) => pre.some((p) => n.startsWith(p)) && (rects[n]?.[4] || 0) >= 150);
    } else {
      const pre = ["TREE", "BARN", "WINNERY", "HAYSHED", "TOWER", "CHURCH", "SHOPE", "WATRTNK", "RUSTICA", "BUSSTOP"];
      pick = names.filter((n) => pre.some((p) => n.startsWith(p)) && (rects[n]?.[4] || 0) >= 100);
    }
    if (!pick.length) pick = names.slice(0, 20);
    this.scenery = [];
    if (city) return;
    const start = this.start + 40;
    const end = this.maxStep - 40;
    const stepGap = city ? 21 : 26;
    for (let s = start; s < end; s += stepGap) {
      for (const side of [-1, 1]) {
        if ((s + (side > 0 ? 7 : 0)) % 3 === 0) continue;
        const n = pick[(Math.floor(s * 3 + side * 11) >>> 0) % pick.length];
        const r = rects[n];
        if (!r) continue;
        const w = r[3], h = r[4];
        const lat = side * (HALF + (city ? 50 + ((s * 13) % 45) : 30 + ((s * 9) % 35)));
        this.scenery.push({ step: s, lat, name: n, w, h, mirror: side > 0, city });
      }
    }
    for (let i = 0; i < 70; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: null, alphaTest: 0.5, fog: true }));
      sp.visible = false;
      sp.center.set(0.5, 0);
      this.scene.add(sp);
      this.scenePool.push(sp);
    }
  }

  buildGates() {
    for (const [s, tex] of [[this.start + 2, this.startTex], [this.finish, this.finishTex]]) {
      const p = this.posAt(s);
      const geo = new THREE.PlaneGeometry(HALF * 2, 4.2);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, fog: true });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.y = -p.h;
      m.position.set(p.x, p.y + 0.05, p.z);
      this.scene.add(m);
      if (s === this.finish) {
        const banner = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeBanner("FINISH"), fog: false }));
        banner.scale.set(7, 1.8, 1);
        banner.center.set(0.5, 1);
        banner.position.set(p.x, p.y + 4.6, p.z);
        this.scene.add(banner);
      }
    }
  }

  // --------------------------------------------------------------- riders
  makeRiderSprite(r) {
    const tex = this.riderTex.get(r.scheme)?.clone();
    if (tex) tex.needsUpdate = false;
    const mat = new THREE.SpriteMaterial({ map: tex || null, alphaTest: 0.5, fog: true });
    const sp = new THREE.Sprite(mat);
    sp.center.set(0.5, 0);
    sp.scale.set(1.5, 2, 1);
    this.scene.add(sp);
    r.sprite = sp;
    const sh = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.shadowTex, transparent: true, opacity: 0.42, depthWrite: false, fog: true }));
    sh.center.set(0.5, 0.5);
    sh.scale.set(1.25, 0.4, 1);
    this.scene.add(sh);
    r.shadow = sh;
    this.setRiderFrame(r, 3, false);
  }

  setRiderFrame(r, idx, mirror) {
    const rect = this.riderMeta.rects?.[idx] || this.riderMeta.rects?.[3];
    if (!rect) return;
    const [x, y, w, h] = rect;
    const W = this.riderMeta.w, H = this.riderMeta.h;
    const map = r.sprite.material.map;
    if (!map) return;
    if (mirror) {
      map.offset.set((x + w) / W, 1 - (y + h) / H);
      map.repeat.set(-w / W, h / H);
    } else {
      map.offset.set(x / W, 1 - (y + h) / H);
      map.repeat.set(w / W, h / H);
    }
    const a = this.riderMeta.anchors?.[idx] ?? 0.5;
    r.sprite.center.x = mirror ? 1 - a : a;
    r.sprite.scale.set(w * RIDER_PX, h * RIDER_PX, 1);
    r.frame = idx;
    r.mirror = mirror;
  }

  buildRiders() {
    const bike = this.opts.bike;
    const scheme = this.opts.scheme ?? 0;
    const player = {
      id: 0, isPlayer: true, name: "You", scheme,
      bike,
      stats: this.opts.char?.rider || { weight: 180, strength: 6, stamina: 2500, weapon: 0 },
      s: this.start, lat: 0, speed: 0, lean: 0,
      state: "countdown", crashT: 0, attack: null, atkCd: 0, invuln: 0,
      stamina: 100, health: 100, finished: false, finishTime: Infinity, hitT: 0,
    };
    this.player = player;
    this.riders.push(player);
    const lanes = [-4.2, 3.9, -1.6, 1.4, -4.8, 4.9, 0.2];
    const schemes = [1, 2, 3, 4, 5, 6, 7];
    const names = DATA.rivalNames.length ? DATA.rivalNames : ["Buzz", "Slash", "Hog", "Spike", "Kelly", "Dex", "Sid"];
    const playerTop = bike.spec.top;
    let pool = DATA.shopBikes.filter((b) => b.spec.top <= playerTop + 8 && b.spec.top >= playerTop - 28);
    if (pool.length < 4) pool = DATA.shopBikes.filter((b) => b.spec.top <= playerTop + 18);
    if (!pool.length) pool = DATA.shopBikes;
    for (let i = 0; i < 7; i++) {
      const shop = pool[(i * 3 + this.level) % pool.length];
      const stats = DATA.bikes.riders[(i * 2 + this.level) % DATA.bikes.riders.length];
      this.riders.push({
        id: i + 1, isPlayer: false, name: names[(i * 3 + this.level) % names.length],
        scheme: schemes[i % schemes.length],
        bike: shop, stats,
        s: this.start + 4 + i * 3,
        lat: lanes[i % lanes.length],
        lane: lanes[i % lanes.length],
        speed: 0, lean: 0,
        state: "countdown", crashT: 0, attack: null, atkCd: 0, invuln: 0,
        stamina: 100, health: 100, finished: false, finishTime: Infinity, hitT: 0,
        phase: Math.random() * 9,
        skill: 0.55 + ((i * 7 + this.level * 3) % 30) / 100,
      });
    }
    for (const r of this.riders) this.makeRiderSprite(r);
  }

  // -------------------------------------------------------------- traffic
  carMat(name) {
    const tex = this.carTex.get(name);
    if (!tex) return null;
    if (!this._carMats) this._carMats = new Map();
    if (!this._carMats.has(name)) {
      this._carMats.set(name, new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, fog: true }));
    }
    return this._carMats.get(name);
  }

  buildTraffic() {
    const meta = DATA.cars?.[this.opts.track] || {};
    const moving = meta.moving || [];
    const parked = meta.parked || [];
    const count = 6 + this.level * 2 - Math.round(this.assist * 4);
    for (let i = 0; i < Math.max(6, count); i++) {
      const type = moving[i % moving.length] || { name: "GOLFG00", w: 32, h: 28 };
      const mat = this.carMat(type.name);
      if (!mat) continue;
      const sp = new THREE.Sprite(mat);
      sp.center.set(0.5, 0);
      sp.scale.set(type.w * CAR_PX, type.h * CAR_PX, 1);
      this.scene.add(sp);
      this.cars.push({
        s: this.start + 65 + i * 28,
        lat: [-4.4, 0, 4.4][i % 3],
        speed: 7 + Math.random() * 8,
        type, sprite: sp, w: type.w, h: type.h,
      });
    }
    // parked cars on the shoulders
    if (parked.length) {
      let i = 0;
      for (let s = this.start + 80; s < this.maxStep - 40; s += 105) {
        const type = parked[(i * 3 + this.level) % parked.length];
        const mat = this.carMat(type.name);
        const side = i % 2 ? 1 : -1;
        i++;
        if (!mat) continue;
        const sp = new THREE.Sprite(mat);
        sp.center.set(0.5, 0);
        sp.scale.set(type.w * CAR_PX, type.h * CAR_PX, 1);
        this.scene.add(sp);
        this.parked.push({ s, lat: side * (HALF + 1.7), w: type.w, h: type.h, sprite: sp });
      }
    }
  }

  // ------------------------------------------------------------------ HUD
  buildHUD() {
    const units = this.units === "km" ? "km/h" : "mph";
    const weapon = ["FISTS", "CLUB", "CHAIN"][this.player.stats.weapon] || "FISTS";
    this.hud.innerHTML = `
      <div class="hud-top">
        <div class="hud-pos"><span id="hud-place">1st</span><small id="hud-field">/8</small></div>
        <div class="hud-mid"><div class="hud-track">${trackName(this.opts.track).toUpperCase()}</div><div class="hud-level">LEVEL ${this.level} · ${this.raceDistMi()} MI</div></div>
        <div class="hud-time" id="hud-time">0:00.00</div>
      </div>
      <div class="hud-progress"><i id="hud-prog"></i></div>
      <div class="hud-warn" id="hud-warn">TRAFFIC!</div>
      <div class="hud-dash">
        <img src="${this.dashSrc}" alt="">
        <div class="needle rpm" id="needle-rpm"></div>
        <div class="needle speed" id="needle-speed"></div>
      </div>
      <div class="hud-speed"><b id="hud-speed">0</b><span>${units}</span></div>
      <div class="hud-gear" id="hud-gear">1</div>
      <div class="hud-damage"><div class="lbl">CONDITION</div><div class="leds" id="hud-leds">${Array.from({ length: 10 }, () => "<i></i>").join("")}</div></div>
      <div class="hud-stamina"><i id="hud-sta"></i></div>
      <div class="hud-weapon" id="hud-weapon">${weapon}</div>
      <div class="hud-nitro"><div class="lbl">NITRO</div><div class="bar"><i id="hud-nitro"></i></div></div>
      <div class="hud-combat" id="hud-combat">PUNCH · KICK</div>
      <div class="hud-msg" id="hud-msg"></div>
      <div class="hud-count" id="hud-count"></div>
      <div class="hud-flash" id="hud-flash"></div>
      <button class="pausebtn" id="pausebtn" type="button">II</button>
      <div class="touchpad touch-only">
        <button data-action="left" type="button">◀</button>
        <button data-action="right" type="button">▶</button>
      </div>
      <div class="touchfight touch-only">
        <button data-action="gas" type="button">GAS</button>
        <button data-action="brake" class="brake" type="button">BRK</button>
        <button data-action="punch" class="kick" type="button">PUNCH</button>
        <button data-action="kick" type="button">KICK</button>
        <button data-action="nitro" class="nitro" type="button" style="grid-column:span 2">NITRO</button>
      </div>
      <div class="paused" id="paused"><div class="box panel">
        <h2>PAUSED</h2>
        <button class="primary" data-p="resume" type="button">Resume</button>
        <button data-p="restart" type="button">Restart Race</button>
        <button data-p="quit" type="button">Quit Race</button>
      </div></div>`;
    this.hudPlace = this.hud.querySelector("#hud-place");
    this.hudField = this.hud.querySelector("#hud-field");
    this.hudTime = this.hud.querySelector("#hud-time");
    this.hudProg = this.hud.querySelector("#hud-prog");
    this.hudWarn = this.hud.querySelector("#hud-warn");
    this.hudSpeed = this.hud.querySelector("#hud-speed");
    this.hudGear = this.hud.querySelector("#hud-gear");
    this.hudLeds = [...this.hud.querySelectorAll("#hud-leds i")];
    this.hudSta = this.hud.querySelector("#hud-sta");
    this.hudWeapon = this.hud.querySelector("#hud-weapon");
    this.hudNitro = this.hud.querySelector("#hud-nitro");
    this.hudCombat = this.hud.querySelector("#hud-combat");
    this.hudMsg = this.hud.querySelector("#hud-msg");
    this.hudCount = this.hud.querySelector("#hud-count");
    this.hudFlash = this.hud.querySelector("#hud-flash");
    this.needleRpm = this.hud.querySelector("#needle-rpm");
    this.needleSpeed = this.hud.querySelector("#needle-speed");
    this.pausedEl = this.hud.querySelector("#paused");
    this.dashEl = this.hud.querySelector(".hud-dash img");
    this.hud.querySelector("#pausebtn").addEventListener("click", () => this.togglePause());
    if (location.search.includes("debug")) {
      this.dbg = document.createElement("div");
      this.dbg.style.cssText = "position:absolute;left:8px;top:64px;font:11px monospace;color:#8bff9b;text-shadow:1px 1px 0 #000;z-index:8";
      this.hud.appendChild(this.dbg);
    }
  }

  raceDistMi() {
    return ((this.finish - this.start) * STEP / 1609.34).toFixed(1);
  }

  bindPauseButtons() {
    this.pausedEl.querySelectorAll("[data-p]").forEach((b) => {
      b.addEventListener("click", () => {
        const a = b.dataset.p;
        if (a === "resume") this.togglePause(false);
        else if (a === "restart") { clearTimeout(this._finishTimer); this.togglePause(false); this.resetPositions(); this.raceTime = 0; this.countdown = 3.4; this.setState = "countdown"; this.finishing = false; this.ended = false; this.result = null; this.showCountdown(); }
        else if (a === "quit") this.quit();
      });
    });
  }

  // --------------------------------------------------------------- positions
  resetPositions() {
    this.raceTime = 0;
    this.countdown = 3.4;
    this.damage = 0;
    this.nitro = 0.75;
    this.bustT = 0;
    this.shake = 0;
    this.cop = null;
    this.finishing = false;
    this.ended = false;
    audio.stopSiren();
    if (this.player) {
      this.player.s = this.start;
      this.player.lat = 0;
      this.player.speed = 0;
      this.player.lean = 0;
      this.player.state = "countdown";
      this.player.crashT = 0;
      this.player.attack = null;
      this.player.stamina = 100;
      this.player.health = 100;
      this.player.invuln = 0;
      this.player.finished = false;
      this.player.finishTime = Infinity;
      const w = this.posAt(this.start, 0, 0.05);
      this.player.world = w;
      if (this.camera) this.camera.position.set(w.x - Math.sin(w.h) * 7, w.y + 3.5, w.z + Math.cos(w.h) * 7);
    }
    const lanes = [-4.2, 3.9, -1.6, 1.4, -4.8, 4.9, 0.2];
    this.riders.forEach((r, i) => {
      if (r.isPlayer) return;
      r.s = this.start + 4 + (i - 1) * 3;
      r.lat = lanes[(i - 1) % lanes.length];
      r.lane = r.lat;
      r.speed = 0;
      r.state = "countdown";
      r.crashT = 0;
      r.attack = null;
      r.stamina = 100;
      r.health = 100;
      r.finished = false;
      r.finishTime = Infinity;
      r.invuln = 0;
    });
    this.cars.forEach((c, i) => {
      c.s = this.start + 65 + i * 28;
      c.lat = [-4.4, 0, 4.4][i % 3];
      c.speed = 7 + (i % 5) * 1.4;
    });
    if (this.cop) { this.scene.remove(this.cop.sprite); this.scene.remove(this.cop.shadow); this.cop = null; }
    this.showCountdown();
  }

  showCountdown() {
    this.hudCount.classList.add("on");
    this.hudCount.textContent = "3";
  }

  // ------------------------------------------------------------------ loop
  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.frameNo++;
    this.input?.update();
    if (!this.paused) this.update(dt);
    this.updateCamera(dt);
    this.render();
    this.input?.endFrame();
    if (this.dbg) {
      const p = this.player;
      const cam = this.camera.position;
      const w = p?.world || { x: 0, y: 0, z: 0 };
      const d = Math.hypot(cam.x - w.x, cam.y - w.y, cam.z - w.z);
      this.dbg.textContent =
        `${(1 / Math.max(dt, 0.001)).toFixed(0)}fps s=${p?.s.toFixed(1)} lat=${p?.lat.toFixed(1)} y=${w.y.toFixed(1)} camY=${cam.y.toFixed(1)} d=${d.toFixed(1)} st=${p?.state} ${this.playersPlace()}${suffix(this.playersPlace())}`;
    }
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    if (this.paused) return;
    if (this.ended) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.finalize();
      return;
    }
    if (this.setState === "countdown") {
      this.countdown -= dt;
      if (this.countdown > 0) {
        const n = Math.ceil(this.countdown);
        this.hudCount.textContent = n > 3 ? "3" : String(n);
        if (this.countdown < 0.9) {
          this.hudCount.textContent = "GO!";
          this.setState = "go";
          this.setState = "ride";
          audio.sfx("engother", { volume: 0.8, rate: 1.3 });
          this.hudCount.classList.remove("on");
          for (const r of this.riders) r.state = "ride";
          this.raceTime = 0;
          this.showMsg("GO!", "good", 0.8);
        }
      }
      this.updateRidersVisual(dt);
      this.updateProps();
      this.updateTrafficVisual();
      return;
    }
    this.raceTime += dt;
    this.updatePlayer(dt);
    this.riders.forEach((r) => { if (!r.isPlayer) this.updateRival(r, dt); });
    this.updateTraffic(dt);
    this.updatePolice(dt);
    this.updateRidersVisual(dt);
    this.updateProps();
    this.updateTrafficVisual();
    this.updateHUD();
    if (this.finishing && !this.ended) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.finalize();
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    if (!p) return;
    if (p.state === "crash" || p.state === "remount") {
      p.crashT += dt;
      p.speed = 0;
      p.attack = null;
      if (p.state === "crash" && p.crashT > 2.0) {
        p.state = "remount";
        p.crashT = 0;
      } else if (p.state === "remount" && p.crashT > 0.9) {
        p.state = "ride";
        p.crashT = 0;
        p.invuln = 1.5;
        p.speed = 5;
        p.lat = clamp(p.lat, -(HALF + SHOULDER - 0.5), HALF + SHOULDER - 0.5);
      }
      p.world = this.posAt(p.s, p.lat, 0.05);
      return;
    }
    if (p.finished) {
      p.speed = Math.max(0, p.speed - 8 * dt);
      p.s += (p.speed * dt) / STEP;
      p.world = this.posAt(p.s, p.lat, 0.05);
      return;
    }
    const throttle = this.autoThrottle ? 1 : this.input.throttle;
    const brake = this.input.brake;
    let steer = this.input.steer;
    if (this.autoSteer) steer = clamp(-p.lat * 0.2 - (p.vlat || 0) * 0.14, -1, 1);
    const top = p.bike.spec.top * MPH;
    const maxSpeed = top * (1 - this.damage * 0.28);
    let accel = (p.bike.spec.power * 0.14 + 4.2) * (1 - p.speed / Math.max(1, maxSpeed)) * (throttle ? 1 : 0);
    if (brake) accel -= 20;
    else if (!throttle) accel -= 2.2;
    if (this.input.nitro && this.nitro > 0.01) {
      accel *= 1.7;
      this.nitro = Math.max(0, this.nitro - dt * 0.28);
    } else this.nitro = Math.min(1, this.nitro + dt * 0.045);
    p.speed += accel * dt;
    const off = Math.abs(p.lat) > HALF - 0.2;
    if (off) {
      p.speed -= (5 + Math.abs(p.lat) * 0.7) * dt;
      if (Math.abs(p.lat) > HALF + SHOULDER) p.speed -= 8 * dt;
    }
    p.speed = clamp(p.speed, 0, off ? maxSpeed * 0.72 : maxSpeed);
    audio.setEngine(clamp(p.speed / Math.max(1, p.bike.spec.top * MPH), 0, 1.2), throttle ? 1 : 0, off);
    const sf = clamp(p.speed / Math.max(1, maxSpeed), 0, 1);
    p.lean += (steer * (0.55 + 0.45 * sf) - p.lean) * Math.min(1, dt * 9);
    p.vlat = (p.vlat || 0) + steer * (3.2 + 8.2 * sf) * dt;
    p.vlat *= Math.pow(0.06, dt);
    const i = clamp(Math.floor(p.s), 0, this.course.steps.length - 1);
    const curve = this.course.steps[i][0] / 256;
    p.vlat -= curve * (2.2 + p.speed * 0.045) * dt;
    p.lat += p.vlat * dt;
    const edge = HALF + SHOULDER + 2.5;
    if (Math.abs(p.lat) > edge) {
      p.lat = Math.sign(p.lat) * edge;
      p.vlat *= -0.25;
      p.speed *= 0.82;
    }
    p.s += (p.speed * dt) / STEP;
    p.s = clamp(p.s, 0, this.pts.length - 2);
    p.world = this.posAt(p.s, p.lat, 0.05);
    p.attackT = (p.attackT || 0) - dt;
    p.atkCd = Math.max(0, (p.atkCd || 0) - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hitT = Math.max(0, p.hitT - dt);
    if (this.input.punch) this.tryAttack("punch");
    if (this.input.kick) this.tryAttack("kick");
    if (this.input.camera) this.cameraMode = this.cameraMode === "chase" ? "close" : "chase";
    this.checkCollisions(dt);
    if (p.s >= this.finish) this.finishRace("finished");
    if (this.damage >= 1) this.finishRace("wrecked");
  }

  tryAttack(kind) {
    const p = this.player;
    if (p.atkCd > 0 || p.state !== "ride" || p.finished) return;
    p.atkCd = 0.58;
    p.stamina = Math.max(0, p.stamina - 5);
    const near = this.riders
      .filter((r) => !r.isPlayer && !r.finished && Math.abs((r.s - p.s) * STEP) < 8.5 && Math.abs(r.lat - p.lat) < 3.5)
      .sort((a, b) => Math.abs(a.lat - p.lat) - Math.abs(b.lat - p.lat))[0];
    const side = near ? Math.sign(near.lat - p.lat) || 1 : Math.sign(p.lean) || 1;
    p.attack = { kind, t: 0.48, side, hit: false };
    audio.sfx(kind === "kick" ? "swishgen" : "swishcha", { volume: 0.55, rate: 1.1 });
    if (near) {
      setTimeout(() => {
        if (!this.running || !p.attack || p.attack.kind !== kind || p.state !== "ride") return;
        p.attack.hit = true;
        const chance = clamp(0.62 + (p.stats.strength - 5) * 0.06 - (near.stats.strength - 5) * 0.04, 0.25, 0.92);
        if (Math.random() < chance) this.hitRider(near, p);
      }, 220);
    }
  }

  hitRider(target, attacker) {
    if (!target || target.state !== "ride" || target.invuln > 0) return;
    target.hitT = 0.18;
    if (target.sprite) target.sprite.material.color.setRGB(1.7, 1.7, 1.7);
    target.stamina = Math.max(0, (target.stamina || 100) - 18);
    target.speed *= 0.86;
    target.vlat = (target.vlat || 0) + (Math.sign(target.lat - attacker.lat) || 1) * 2.2;
    audio.sfx("punchhea", { volume: 0.7, rate: 0.95 + Math.random() * 0.15 });
    this.shake = Math.max(this.shake, 0.18);
    const ko = Math.random() < (attacker.isPlayer ? 0.22 : 0.14);
    if (ko || target.stamina <= 0) {
      target.state = "crash";
      target.crashT = 0;
      target.speed = 0;
      this.showMsg(attacker.isPlayer ? "KNOCKED DOWN!" : "YOU'RE DOWN!", attacker.isPlayer ? "good" : "warn", 1.0);
    } else if (attacker.isPlayer) {
      this.showMsg("HIT", "good", 0.4);
    }
  }

  checkCollisions(dt) {
    const p = this.player;
    if (!p || p.state !== "ride" || p.invuln > 0) return;
    for (const c of this.cars) {
      if (Math.abs((c.s - p.s) * STEP) < 2.8 && Math.abs(c.lat - p.lat) < 1.35) {
        this.crashPlayer("traffic");
        return;
      }
    }
    for (const r of this.riders) {
      if (r.isPlayer || r.state !== "ride") continue;
      if (Math.abs((r.s - p.s) * STEP) < 1.6 && Math.abs(r.lat - p.lat) < 1.0) {
        // rubbing: push apart, no automatic crash
        const d = Math.sign(p.lat - r.lat) || 1;
        p.vlat += d * 1.2 * dt * 30;
        r.vlat = (r.vlat || 0) - d * 1.2;
        p.speed *= 0.995;
      }
    }
  }

  crashPlayer(why = "traffic") {
    const p = this.player;
    if (!p || p.state !== "ride" || p.invuln > 0) return;
    p.state = "crash";
    p.crashT = 0;
    p.speed = 0;
    p.attack = null;
    this.damage = Math.min(1.05, this.damage + (why === "traffic" ? 0.12 : 0.08));
    this.shake = 0.7;
    audio.sfx("crashhar", { volume: 0.8, rate: 0.95 + Math.random() * 0.1 });
    this.showMsg(why === "traffic" ? "TRAFFIC!" : "WRECKED!", "warn", 1.2);
    this.flash();
  }

  flash() {
    if (!this.hudFlash) return;
    this.hudFlash.style.transition = "none";
    this.hudFlash.style.opacity = "0.55";
    requestAnimationFrame(() => {
      this.hudFlash.style.transition = "opacity .35s";
      this.hudFlash.style.opacity = "0";
    });
  }

  updateRival(r, dt) {
    if (!r || r.finished) return;
    if (r.state === "crash" || r.state === "remount") {
      r.crashT += dt;
      r.speed = 0;
      if (r.state === "crash" && r.crashT > 1.8) { r.state = "remount"; r.crashT = 0; }
      else if (r.state === "remount" && r.crashT > 0.8) { r.state = "ride"; r.crashT = 0; r.speed = 12; }
      r.world = this.posAt(r.s, r.lat, 0.05);
      return;
    }
    const top = r.bike.spec.top * MPH;
    const base = top * (0.64 + this.level * 0.028 + r.skill * 0.05) * (1 - this.assist * 0.045);
    const gap = this.player.s - r.s;
    const rb = clamp(1 + gap * 0.0009, 0.9, 1.13);
    const target = base * rb * (1 - this.damage * 0.0);
    r.speed += (target - r.speed) * dt * 0.9;
    r.s += (r.speed * dt) / STEP;
    r.laneT = (r.laneT || 0) - dt;
    if (r.laneT <= 0) {
      r.laneT = 3 + Math.random() * 5;
      r.lane = [-4.2, -1.6, 1.4, 4.2][(Math.random() * 4) | 0];
    }
    if (r.hitT > 0) r.hitT -= dt;
    r.lat += (r.lane - r.lat) * dt * 1.2;
    r.lean = clamp((r.lane - r.lat) * 0.35 + (this.course.steps[Math.floor(r.s)]?.[0] || 0) * 0.004, -1, 1);
    r.atkCd = Math.max(0, (r.atkCd || 0) - dt);
    const dp = Math.abs((this.player.s - r.s) * STEP);
    if (dp < 7 && Math.abs(this.player.lat - r.lat) < 3 && r.atkCd <= 0 && this.player.state === "ride" && Math.random() < dt * 0.7) {
      r.atkCd = 1.2;
      r.attack = { kind: "punch", t: 0.4, side: Math.sign(this.player.lat - r.lat) || 1 };
      setTimeout(() => {
        if (this.player.state === "ride" && this.player.invuln <= 0 && Math.random() < 0.55) {
          this.player.stamina = Math.max(0, this.player.stamina - 12);
          this.player.speed *= 0.94;
          this.player.hitT = 0.18;
          if (this.player.sprite) this.player.sprite.material.color.setRGB(1.7, 1.0, 1.0);
          this.flash();
          this.shake = Math.max(this.shake, 0.25);
          audio.sfx("punchlig", { volume: 0.6 });
          this.showMsg("HIT!", "warn", 0.5);
          if (Math.random() < 0.08) this.crashPlayer("rival");
        }
      }, 180);
    }
    if (r.s >= this.finish) {
      r.finished = true;
      r.finishTime = this.raceTime;
      r.speed = 0;
      r.state = "finished";
    }
    r.world = this.posAt(r.s, r.lat, 0.05);
  }

  updateTraffic(dt) {
    for (const c of this.cars) {
      c.s += (c.speed * dt) / STEP;
      const p = this.player;
      if (Math.abs((c.s - p.s) * STEP) < 55 && Math.abs(c.lat - p.lat) < 1.5) {
        const dir = p.lat > 0 ? -1 : 1;
        c.lat = clamp(c.lat + dir * dt * 2.0, -4.8, 4.8);
      }
      if (c.s > this.player.s + 130 || c.s < this.player.s - 45) {
        c.s = this.player.s + 85 + Math.random() * 80;
        c.lat = [-4.4, 0, 4.4][(Math.random() * 3) | 0];
        c.speed = 7 + Math.random() * 9;
        const meta = (DATA.cars?.[this.opts.track]?.moving || []);
        if (meta.length) {
          const t = meta[(Math.random() * meta.length) | 0];
          const mat = this.carMat(t.name);
          if (mat) {
            c.type = t;
            c.w = t.w; c.h = t.h;
            c.sprite.material = mat;
            c.sprite.scale.set(t.w * CAR_PX, t.h * CAR_PX, 1);
          }
        }
      }
    }
  }

  updatePolice(dt) {
    if (this.level < 3) return;
    if (!this.cop && this.raceTime > 14 - this.level * 1.5 && this.player.s < this.finish - 100) this.spawnCop();
    if (!this.cop) return;
    const c = this.cop;
    const target = this.player.speed * 1.04 + 2;
    c.speed += (target - c.speed) * dt * 1.1;
    c.s += (c.speed * dt) / STEP;
    c.lat += (this.player.lat - c.lat) * dt * 1.3;
    c.lean = clamp((this.player.lat - c.lat) * 0.3, -1, 1);
    c.world = this.posAt(c.s, c.lat, 0.05);
    const ds = (this.player.s - c.s) * STEP;
    if (Math.abs(ds) < 8 && Math.abs(this.player.lat - c.lat) < 2.5) {
      this.bustT += dt * (this.player.state === "ride" ? 1 : 1.7);
      if (this.bustT > 1) {
        this.hudFlash.style.transition = "none";
        this.hudFlash.style.background = "#3355ff";
        this.hudFlash.style.opacity = "0.18";
        setTimeout(() => { this.hudFlash.style.opacity = "0"; this.hudFlash.style.background = "#fff"; }, 90);
      }
      if (this.bustT > 3.2) this.finishRace("busted");
    } else {
      this.bustT = Math.max(0, this.bustT - dt * 0.6);
    }
    if (ds > 70) this.despawnCop();
    this.cop.sprite.position.set(c.world.x, c.world.y, c.world.z);
    this.cop.shadow.position.set(c.world.x, c.world.y + 0.03, c.world.z);
    this.cop.lean = c.lean;
    this.cop.state = this.player.state === "crash" ? "crash" : "ride";
    this.cop.frame = 3 - Math.round(Math.abs(c.lean) * 3);
  }

  spawnCop() {
    const c = {
      scheme: 1, s: this.player.s - 8, lat: this.player.lat, speed: this.player.speed + 3,
      lean: 0, state: "ride", crashT: 0, frame: 3, world: null,
    };
    const tex = this.riderTex.get(1).clone();
    c.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, fog: true }));
    c.sprite.center.set(0.5, 0);
    this.scene.add(c.sprite);
    c.shadow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.shadowTex, transparent: true, opacity: 0.4, depthWrite: false, fog: true }));
    c.shadow.center.set(0.5, 0.5);
    c.shadow.scale.set(1.25, 0.4, 1);
    this.scene.add(c.shadow);
    c.world = this.posAt(c.s, c.lat, 0.05);
    this.cop = c;
    audio.startSiren();
    this.showMsg("COP!", "warn", 1.2);
  }

  despawnCop() {
    if (!this.cop) return;
    this.scene.remove(this.cop.sprite);
    this.scene.remove(this.cop.shadow);
    this.cop = null;
    audio.stopSiren();
  }

  updateRidersVisual(dt) {
    for (const r of this.riders) {
      if (!r.world) r.world = this.posAt(r.s, r.lat, 0.05);
      const near = r.isPlayer || Math.abs(r.s - this.player.s) < 110;
      r.sprite.visible = near;
      r.shadow.visible = near && r.state !== "crash";
      if (!near) continue;
      let frame = 3, mirror = false;
      if (r.state === "crash") {
        const t = Math.min(1, r.crashT / 1.1);
        frame = 241 + Math.min(6, Math.floor(t * 7));
        mirror = r.mirror || false;
      } else if (r.state === "remount") {
        frame = 283 + Math.min(5, Math.floor((r.crashT / 0.9) * 6));
      } else if (r.state === "finished") {
        frame = 3;
      } else if (r.attack) {
        r.attack.t -= dt;
        const prog = clamp(1 - r.attack.t / 0.48, 0, 1);
        if (r.attack.kind === "kick") {
          const frames = r.attack.side < 0 ? [225, 226, 225] : [227, 228, 227];
          frame = frames[Math.min(2, Math.floor(prog * 3))];
          mirror = false;
        } else if (r.stats?.weapon === 1) {
          frame = [105, 106, 107][Math.min(2, Math.floor(prog * 3))];
          mirror = true;
        } else if (r.stats?.weapon === 2) {
          frame = [82, 83, 84][Math.min(2, Math.floor(prog * 3))];
          mirror = true;
        } else {
          frame = [41, 42, 43, 44, 45, 44, 43, 42][Math.min(7, Math.floor(prog * 8))];
          mirror = r.attack.side < 0;
        }
        if (r.attack.t <= 0) r.attack = null;
      } else {
        const lev = clamp(Math.abs(r.lean), 0, 1);
        frame = 3 - Math.round(lev * 3);
        mirror = r.lean > 0.05;
      }
      if (r.hitT > 0) {
        frame = 3 - Math.round(Math.abs(r.lean) * 3);
      } else if (r.sprite.material.color.r !== 1) {
        r.sprite.material.color.setRGB(1, 1, 1);
      }
      this.setRiderFrame(r, frame, mirror);
      r.sprite.position.set(r.world.x, r.world.y, r.world.z);
      r.shadow.position.set(r.world.x, r.world.y + 0.03, r.world.z);
      r.shadow.scale.set(r.isPlayer ? 1.25 : 1.2, 0.4, 1);
    }
    if (this.cop) {
      const c = this.cop;
      const rect = this.riderMeta.rects[c.frame] || this.riderMeta.rects[3];
      if (rect) {
        const [x, y, w, h] = rect;
        const map = c.sprite.material.map;
        map.offset.set(x / this.riderMeta.w, 1 - (y + h) / this.riderMeta.h);
        map.repeat.set(w / this.riderMeta.w, h / this.riderMeta.h);
        c.sprite.center.x = 0.5;
        c.sprite.scale.set(w * RIDER_PX, h * RIDER_PX, 1);
      }
      if (c.world) {
        c.sprite.position.set(c.world.x, c.world.y, c.world.z);
        c.shadow.position.set(c.world.x, c.world.y + 0.03, c.world.z);
        c.shadow.scale.set(1.25, 0.4, 1);
      }
    }
  }

  updateProps() {
    if (this.frameNo % 3 !== 0) return;
    const lo = this.player.s - 25;
    const hi = this.player.s + 90;
    let k = 0;
    for (const p of this.props) {
      if (p.step < lo) continue;
      if (p.step > hi) break;
      if (k >= this.propPool.length) break;
      const sp = this.propPool[k++];
      const mat = this.makePropMaterial(p.name, p.mirror, this.propMats);
      if (!mat) { sp.visible = false; continue; }
      const q = this.posAt(p.step, p.lat);
      sp.material = mat;
      sp.userData.propName = p.name;
      sp.position.set(q.x, q.y, q.z);
      const small = /^(BUS|PHONE|BIN|TRSH|BENCH|HYDR|MAIL|NEWS|CONE|MARKER|PICNT|SIGN|SPEED|NOPRK|MUNI)/.test(p.name);
      const scl = small ? 0.032 : PROP_PX;
      sp.scale.set(p.w * scl, p.h * scl, 1);
      sp.visible = true;
    }
    for (; k < this.propPool.length; k++) this.propPool[k].visible = false;
    // scenery
    let j = 0;
    for (const p of this.scenery) {
      if (p.step < lo - 60) continue;
      if (p.step > hi + 120) break;
      if (j >= this.scenePool.length) break;
      const sp = this.scenePool[j++];
      const mat = this.makePropMaterial(p.name, p.mirror, this.sceneryMats);
      if (!mat) { sp.visible = false; continue; }
      const q = this.posAt(p.step, p.lat);
      sp.material = mat;
      sp.position.set(q.x, q.y - 0.04, q.z);
      sp.scale.set(p.w * (p.city ? 0.12 : 0.085), p.h * (p.city ? 0.12 : 0.085), 1);
      sp.visible = true;
    }
    for (; j < this.scenePool.length; j++) this.scenePool[j].visible = false;
  }

  updateTrafficVisual() {
    for (const c of this.cars) {
      const q = this.posAt(c.s, c.lat);
      c.sprite.position.set(q.x, q.y + 0.02, q.z);
      c.sprite.visible = Math.abs(c.s - this.player.s) < 130;
    }
    for (const p of this.parked) {
      if (Math.abs(p.s - this.player.s) > 100) { p.sprite.visible = false; continue; }
      const q = this.posAt(p.s, p.lat);
      p.sprite.position.set(q.x, q.y + 0.02, q.z);
      p.sprite.visible = true;
    }
  }

  playersPlace() {
    if (!this.player) return 1;
    let place = 1;
    for (const r of this.riders) {
      if (r.isPlayer) continue;
      if (r.finished ? r.finishTime < this.raceTime : r.s > this.player.s) place++;
    }
    return place;
  }

  updateHUD() {
    const p = this.player;
    if (!p) return;
    const place = this.playersPlace();
    this.hudPlace.textContent = `${place}${suffix(place)}`;
    this.hudField.textContent = `/${this.field}`;
    this.hudTime.textContent = clockText(this.raceTime);
    const prog = clamp((p.s - this.start) / (this.finish - this.start), 0, 1);
    this.hudProg.style.width = `${(prog * 100).toFixed(1)}%`;
    const kmh = p.speed * 3.6;
    const mph = p.speed * 2.23694;
    this.hudSpeed.textContent = String(Math.round(this.units === "km" ? kmh : mph));
    const max = p.bike.spec.top;
    const ratio = clamp((this.units === "km" ? kmh : mph) / (this.units === "km" ? 320 : 200), 0, 1);
    this.needleSpeed.style.transform = `rotate(${-120 + ratio * 240}deg)`;
    const gear = clamp(1 + Math.floor(clamp(p.speed / (max * MPH), 0, 1) * 4.999), 1, 5);
    this.hudGear.textContent = String(gear);
    const within = clamp(clamp(p.speed / (max * MPH), 0, 1) * 5 - (gear - 1), 0, 1);
    this.needleRpm.style.transform = `rotate(${-120 + (0.22 + within * 0.78) * 240}deg)`;
    const lit = clamp(10 - Math.round(this.damage * 10), 0, 10);
    this.hudLeds.forEach((el, i) => {
      el.className = i < lit ? (lit <= 3 ? "on hot" : "on") : "";
    });
    this.hudSta.style.width = `${clamp(p.stamina, 0, 100)}%`;
    if (this.hudNitro) this.hudNitro.style.width = `${clamp(this.nitro * 100, 0, 100)}%`;
    if (this.hudCombat) {
      let near = false;
      for (const r of this.riders) {
        if (r.isPlayer || r.finished) continue;
        if (Math.abs((r.s - p.s) * STEP) < 10 && Math.abs(r.lat - p.lat) < 4) { near = true; break; }
      }
      this.hudCombat.classList.toggle("on", near && p.state === "ride" && !this.finishing);
    }
    if (this.hudWarn) {
      let warn = false;
      for (const c of this.cars) {
        if (Math.abs((c.s - p.s) * STEP) < 30 && Math.abs(c.lat - p.lat) < 2.6) { warn = true; break; }
      }
      this.hudWarn.classList.toggle("on", warn && p.state === "ride" && !this.finishing);
    }
    if (this.msgT > 0) this.msgT -= 1 / 60;
    if (this.msgT <= 0) this.hudMsg.classList.remove("on");
  }

  showMsg(text, cls = "", dur = 1) {
    this.hudMsg.textContent = text;
    this.hudMsg.className = `hud-msg on ${cls}`;
    this.msgT = dur;
  }

  updateCamera(dt) {
    const p = this.player;
    if (!p) return;
    if (!p.world) p.world = this.posAt(p.s, p.lat, 0.05);
    const fwd = this.fwdAt(p.s);
    const right = { x: Math.cos(p.world.h), z: Math.sin(p.world.h) };
    const close = this.cameraMode === "close";
    const dist = close ? 5.0 : 7.0;
    const height = close ? 2.9 : 3.5;
    const speedRatio = clamp(p.speed / (p.bike.spec.top * MPH), 0, 1);
    const bob = Math.sin(this.raceTime * 12) * 0.012 * speedRatio;
    const shake = this.shake * (Math.random() * 0.18);
    const camS = p.s - dist / STEP;
    const camBase = this.posAt(camS, p.lat + 1.2, height);
    const camRight = { x: Math.cos(camBase.h), z: Math.sin(camBase.h) };
    const target = new THREE.Vector3(
      camBase.x + camRight.x * p.lean * 0.55 + shake,
      camBase.y + bob + shake,
      camBase.z + camRight.z * p.lean * 0.55
    );
    const k = 1 - Math.pow(0.00002, dt);
    this.camera.position.lerp(target, k);
    const look = this.posAt(p.s + (close ? 6.8 : 9.0), p.lat + 0.2, 1.15);
    this.camera.lookAt(look.x, look.y, look.z);
    const fov = (close ? 66 : 61) + speedRatio * 5;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.shake = Math.max(0, this.shake - dt * 1.8);
    if (this.horizon) {
      const hw = this.horizonW || 1800, hh = this.horizonH || 650;
      this.horizon.position.set(this.camera.position.x + fwd.x * 900, this.camera.position.y + hh * 0.5 - 180, this.camera.position.z + fwd.z * 900);
      this.horizon.lookAt(this.camera.position.x, this.horizon.position.y, this.camera.position.z);
    }
    if (this.clouds) {
      for (const c of this.clouds) {
        const [x, y, z] = c.userData.base;
        c.position.set(this.camera.position.x + x, this.camera.position.y + y, this.camera.position.z + z);
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  // --------------------------------------------------------------- finish
  finishRace(status) {
    if (this.ended || this.finishing) return;
    this.finishing = true;
    this.endTimer = status === "finished" ? 2.2 : 1.8;
    if (status === "finished") {
      const p = this.player;
      p.state = "finished";
      p.finished = true;
      const place = this.playersPlace();
      this.result = { status, place, time: this.raceTime, field: this.field, condition: clamp(1 - this.damage, 0, 1) };
      this.showMsg("FINISH!", "good", 2);
      audio.sfx("f_yeah", { volume: 0.8 });
      audio.stopEngine();
    } else if (status === "busted") {
      this.result = { status, place: 8, time: this.raceTime, field: this.field, condition: clamp(1 - this.damage, 0, 1) };
      this.showMsg("BUSTED!", "warn", 2);
      audio.stopSiren();
      audio.stopEngine();
    } else if (status === "wrecked") {
      this.result = { status, place: 8, time: this.raceTime, field: this.field, condition: 0 };
      this.showMsg("WRECKED!", "warn", 2);
      audio.stopEngine();
    }
    this.player.speed = 0;
    clearTimeout(this._finishTimer);
    this._finishTimer = setTimeout(() => this.finalize(), status === "finished" ? 2250 : 1850);
  }

  finalize() {
    if (this.resolved || !this.result) return;
    clearTimeout(this._finishTimer);
    this.resolved = true;
    const r = { ...this.result, track: this.opts.track, level: this.level, mode: this.opts.mode };
    this.destroy();
    this.resolve(r);
  }

  quit() {
    if (this.resolved) return;
    clearTimeout(this._finishTimer);
    this.resolved = true;
    this.destroy();
    this.resolve({ status: "quit" });
  }

  togglePause(force) {
    if (this.ended) return;
    this.paused = force === undefined ? !this.paused : force;
    this.pausedEl.classList.toggle("on", this.paused);
    if (this.paused) {
      audio.setEngine(0, 0);
      audio.stopMusic();
    } else {
      audio.playMusic("race");
      this.last = performance.now();
    }
  }

  destroy() {
    this.running = false;
    this.ended = true;
    clearTimeout(this._finishTimer);
    window.removeEventListener("keydown", this._pauseKey);
    if (this._mouseDown) this.canvas.removeEventListener("mousedown", this._mouseDown);
    if (this._noCtx) this.canvas.removeEventListener("contextmenu", this._noCtx);
    try { this.input?.destroy(); } catch {}
    audio.stopEngine();
    audio.stopSiren();
    audio.stopMusic();
    if (this.renderer) {
      this.scene?.traverse((o) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
          else o.material.dispose?.();
        }
      });
      this.renderer.dispose();
    }
    this.hud.innerHTML = "";
    this.scene = null;
    this.renderer = null;
    document.body.classList.remove("racing");
    this.raceEl.classList.remove("on");
    this.raceEl.hidden = true;
  }
}
