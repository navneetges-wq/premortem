// graveyard.js — the 3D "startup graveyard".
// Scroll story: a glossy premortem tombstone on cream (with a heartbeat line) → day turns to night →
// real shut-down companies rise out of the ground as tombstones → you walk through with a lantern.
// Every stone is a real company from our database (GET /graveyard). Nothing is made up.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const API = location.hostname.endsWith("catalystserverless.in")
  ? "/server/api"
  : "https://whotriedit-60093906253.development.catalystserverless.in/server/api";

const TOUCH = matchMedia("(pointer: coarse)").matches;
const STILL = matchMedia("(prefers-reduced-motion: reduce)").matches;
const NARROW = () => innerWidth < 760;
const MAX_STONES = TOUCH ? 40 : 96;   // how many stones we draw (the count shown is always the real total)
const MIN_IDEA = 10;

// ---------- small helpers ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t) => 1 - Math.pow(1 - t, 3);
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const yearsOf = (c) => (c.started && c.closed ? `${c.started} – ${c.closed}` : c.closed ? `Closed ${c.closed}` : c.started ? `Started ${c.started}` : "Year not reported");
let seed = 7; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // same layout every visit

// ---------- the idea forms (hero + end) ----------
let typedIdea = "";
let flatline = false;
document.querySelectorAll("[data-form]").forEach((form) => {
  const input = form.querySelector("input"), msg = form.parentElement.querySelector("[data-msg]");
  input.addEventListener("input", () => { typedIdea = input.value.trim(); pulse.excite(); });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const idea = input.value.trim();
    if (idea.length < MIN_IDEA) { msg.textContent = "Please describe your idea in a few more words."; return; }
    msg.textContent = "";
    const btn = form.querySelector("button");
    btn.disabled = true; btn.textContent = "Starting…";
    flatline = true; // the heartbeat goes flat while we start your premortem
    const started = performance.now();
    try {
      const res = await fetch(API + "/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea }) });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.error || "Something went wrong. Please try again.");
      const q = `?idea=${encodeURIComponent(idea)}`;
      const to = r.state === "done" ? `index.html#/results/${encodeURIComponent(r.niche)}${q}` : `index.html#/search/${r.id}${q}`;
      setTimeout(() => (location.href = to), Math.max(0, 1600 - (performance.now() - started)));
    } catch (err) {
      flatline = false; btn.disabled = false; btn.textContent = "Run premortem"; msg.textContent = err.message;
    }
  });
});

// ======================= the heartbeat line (2D, on top of the 3D world) =======================
const pulse = (() => {
  const cv = document.getElementById("pulse"), ctx = cv.getContext("2d");
  const STEP = 2, SPEED = 280; // px per sample, px per second
  let W = 0, H = 0, dpr = 1, vals = [], head = 0, phase = 0, bpm = 64, amp = 1, onBeat = () => {};
  const g = (x, m, s, a) => a * Math.exp(-((x - m) ** 2) / (2 * s * s));
  const wave = (f) => g(f, .12, .025, .12) + g(f, .215, .008, -.16) + g(f, .24, .011, 1) + g(f, .268, .011, -.34) + g(f, .47, .045, .24);
  function resize() {
    dpr = Math.min(devicePixelRatio, 2); W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vals = new Array(Math.ceil(W / STEP) + 1).fill(null); head = 0;
  }
  resize(); addEventListener("resize", resize);
  return {
    set onBeat(f) { onBeat = f; },
    excite() { bpm = Math.min(150, bpm + 7); },
    rest: 64, flat: false,
    // y = where the line sits; height = how tall the beats are (0 = flat); alpha = visibility
    draw(dt, y, height, alpha, xStart = 0, rgb = "228, 80, 47") {
      bpm += (this.rest - bpm) * Math.min(1, dt * 0.8);
      amp += ((flatline || this.flat ? 0 : 1) - amp) * Math.min(1, dt * 5);
      const n = vals.length, steps = Math.max(1, Math.round((SPEED * dt) / STEP));
      for (let k = 0; k < steps; k++) {
        const before = phase;
        phase += (bpm / 60) * (STEP / SPEED);
        if (Math.floor(before + 0.76) !== Math.floor(phase + 0.76)) onBeat(); // crossed the tall spike
        head = (head + 1) % n;
        vals[head] = wave(phase % 1) * amp;
        for (let gap = 1; gap <= 14; gap++) vals[(head + gap) % n] = null; // the gap ahead of the pen
      }
      ctx.clearRect(0, 0, W, H);
      if (alpha < 0.01) return;
      const px = (i) => i * STEP, py = (v) => y - v * height;
      for (const pass of [{ w: 7, a: 0.12 }, { w: 2.2, a: 1 }]) {
        ctx.lineWidth = pass.w; ctx.lineCap = "round"; ctx.lineJoin = "round";
        for (let i = 1; i < n; i++) {
          const a = vals[i - 1], b = vals[i];
          if (a === null || b === null || i - 1 === head) continue;
          const age = ((head - i + n) % n) / n; // 0 = just drawn, 1 = oldest
          const edge = xStart ? clamp((px(i) - xStart) / 90) : 1;
          if (edge <= 0) continue;
          ctx.strokeStyle = `rgba(${rgb}, ${(1 - age * 0.92) * pass.a * alpha * edge})`;
          ctx.beginPath(); ctx.moveTo(px(i - 1), py(a)); ctx.lineTo(px(i), py(b)); ctx.stroke();
        }
      }
      // the bright pen tip
      const hx = px(head), hy = py(vals[head] || 0);
      alpha *= xStart ? clamp((hx - xStart) / 90) : 1;
      const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 18);
      glow.addColorStop(0, `rgba(255, 240, 220, ${alpha})`); glow.addColorStop(0.3, `rgba(${rgb}, ${0.5 * alpha})`); glow.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(hx, hy, 18, 0, Math.PI * 2); ctx.fill();
    },
  };
})();

// ======================= the 3D world =======================
const canvas = document.getElementById("world");
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
catch { document.body.classList.add("no-3d"); }

if (renderer) start();

function start() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = !TOUCH;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const DAY = new THREE.Color("#F4F1EA"), NIGHT = new THREE.Color("#0a090c");
  const GROUND_DAY = new THREE.Color("#EAE3D6"), GROUND_NIGHT = new THREE.Color("#17141a");
  const DUSK = new THREE.Color("#c98466"), GROUND_DUSK = new THREE.Color("#7a5546"); // the sunset in between
  const SUN_DAY = new THREE.Color("#fff4e6"), SUN_DUSK = new THREE.Color("#ff9a62");
  // day → warm sunset → night, for any colour trio
  const sky = (out, a, b, c, n) => (n < 0.5 ? out.copy(a).lerp(b, n * 2) : out.copy(b).lerp(c, n * 2 - 1));
  const scene = new THREE.Scene();
  scene.background = DAY.clone();
  scene.fog = new THREE.Fog(DAY.clone(), 30, 90);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(NARROW() ? 50 : 35, innerWidth / innerHeight, 0.1, 400);

  // ---------- lights ----------
  const sun = new THREE.DirectionalLight("#fff4e6", 2.2);
  sun.position.set(-6, 8, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -6, near: 1, far: 30 });
  sun.shadow.bias = -0.0008; sun.shadow.radius = 6;
  scene.add(sun);
  const moon = new THREE.DirectionalLight("#8ea4d6", 0);
  moon.position.set(-12, 14, -30);
  scene.add(moon);
  const lantern = new THREE.PointLight("#ffa45c", 0, 0, 2);
  lantern.castShadow = !TOUCH;
  lantern.shadow.mapSize.set(512, 512); lantern.shadow.bias = -0.004; lantern.shadow.radius = 4;
  scene.add(lantern);

  // ---------- textures made in code ----------
  const radial = (inner, outer, size = 128) => {
    const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d");
    const gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer); x.fillStyle = gr; x.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const noise = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"), img = x.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) { const v = 110 + Math.random() * 145; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  const softDot = radial("rgba(255,255,255,1)", "rgba(255,255,255,0)");

  // ---------- ground ----------
  const groundMat = new THREE.MeshStandardMaterial({ color: GROUND_DAY.clone(), roughness: 1, bumpMap: noise, bumpScale: 0.6 });
  groundMat.bumpMap.repeat.set(60, 60);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.z = -40; ground.receiveShadow = true;
  scene.add(ground);

  // ---------- stone shapes ----------
  function stoneShape(kind, w, h) {
    const s = new THREE.Shape(), r = w / 2;
    if (kind === "slab") {
      const c = 0.14;
      s.moveTo(-r, 0); s.lineTo(-r, h - c); s.quadraticCurveTo(-r, h, -r + c, h); s.lineTo(r - c, h); s.quadraticCurveTo(r, h, r, h - c); s.lineTo(r, 0); s.lineTo(-r, 0);
    } else {
      s.moveTo(-r, 0); s.lineTo(-r, h); s.absarc(0, h, r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0);
    }
    return s;
  }
  function stoneGeo(shape, depth, bevel, segs = 14, bevelSegs = 2) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: bevelSegs, curveSegments: segs });
    g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
  }

  // ---------- the hero tombstone (the premortem logo, in glossy black) ----------
  const hero = new THREE.Group();
  const HERO_DEPTH = 0.55, HERO_BEVEL = 0.09, FRONT = HERO_DEPTH / 2 + HERO_BEVEL;
  const heroStone = new THREE.Mesh(stoneGeo(stoneShape("arch", 2.4, 2.2), HERO_DEPTH, HERO_BEVEL, 64, 6),
    new THREE.MeshPhysicalMaterial({ color: "#121212", roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }));
  heroStone.castShadow = true; heroStone.receiveShadow = true;
  hero.add(heroStone);
  const cream = new THREE.MeshStandardMaterial({ color: "#F4F1EA", roughness: 0.45 });
  const orange = new THREE.MeshStandardMaterial({ color: "#E4502F", roughness: 0.35, emissive: "#E4502F", emissiveIntensity: 0.15 });
  [[-0.57, 0.67, cream], [0, 1.13, cream], [0.57, 1.81, orange]].forEach(([x, h, mat]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.34, h, 0.08), mat);
    bar.position.set(x, 0.27 + h / 2, FRONT + 0.02); bar.castShadow = true; hero.add(bar);
  });
  scene.add(hero);
  let beatGlow = 0;
  pulse.onBeat = () => { beatGlow = 1; };

  // ---------- night sky: moon + stars ----------
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial("rgba(255,248,235,1)", "rgba(255,248,235,0)"), fog: false, transparent: true, opacity: 0, depthWrite: false }));
  moonSprite.position.set(-46, 34, -150); moonSprite.scale.set(5.5, 5.5, 1); scene.add(moonSprite);
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial("rgba(170,190,255,.35)", "rgba(170,190,255,0)"), fog: false, transparent: true, opacity: 0, depthWrite: false }));
  moonHalo.position.copy(moonSprite.position); moonHalo.scale.set(30, 30, 1); scene.add(moonHalo);
  const starGeo = new THREE.BufferGeometry(), starPos = [];
  for (let i = 0; i < 500; i++) { const a = rand() * Math.PI - Math.PI, e = 0.08 + rand() * 0.9, r = 180; starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r - 40); }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#dfe6ff", size: 0.7, map: softDot, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(stars);

  // ---------- the lantern you carry ----------
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial("rgba(255,236,200,1)", "rgba(255,140,60,0)"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.scale.set(0.32, 0.32, 1); scene.add(flame);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial("rgba(255,150,80,.55)", "rgba(255,120,50,0)"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(2.2, 2.2, 1); scene.add(halo);

  // ---------- drifting embers near the ground ----------
  const EMBERS = TOUCH ? 70 : 160, emberGeo = new THREE.BufferGeometry(), emberBase = [];
  for (let i = 0; i < EMBERS; i++) emberBase.push({ x: (rand() - 0.5) * 26, y: 0.2 + rand() * 2.4, z: 2 - rand() * 40, s: 0.3 + rand() * 0.8, p: rand() * 6.28 });
  emberGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(EMBERS * 3), 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: "#ffb070", size: 0.07, map: softDot, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(embers);

  // ---------- low mist ----------
  const mistMat = new THREE.SpriteMaterial({ map: radial("rgba(150,160,190,.9)", "rgba(150,160,190,0)"), transparent: true, opacity: 0, depthWrite: false });
  const mists = [];
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Sprite(mistMat); m.scale.set(14 + rand() * 8, 3 + rand() * 1.5, 1);
    m.position.set((rand() - 0.5) * 30, 0.3, -2 - rand() * 36); m.userData.v = (rand() - 0.5) * 0.25; scene.add(m); mists.push(m);
  }

  // ---------- the graveyard: one stone per real shut-down company ----------
  const TYPES = [
    { geo: stoneGeo(stoneShape("arch", 1.15, 0.95), 0.24, 0.04), plane: 0.92, planeY: 0.76 },
    { geo: stoneGeo(stoneShape("slab", 1.05, 1.55), 0.24, 0.04), plane: 0.88, planeY: 0.86 },
    { geo: stoneGeo(stoneShape("arch", 1.35, 0.5), 0.24, 0.04), plane: 0.98, planeY: 0.62 },
  ];
  const STONE_FRONT = 0.12 + 0.04 + 0.006;
  const stoneMats = ["#5f5a54", "#514d49", "#6b655d"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, bumpMap: noise, bumpScale: 1.4 }));
  const stones = [], pickables = [];
  let causes = [];
  const footGlowMat = new THREE.SpriteMaterial({ map: radial("rgba(255,90,54,.9)", "rgba(255,60,30,0)"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

  function engrave(c) {
    const S = 256, cv = document.createElement("canvas"); cv.width = cv.height = S; const x = cv.getContext("2d");
    x.textAlign = "center"; x.textBaseline = "middle";
    const carve = (text, yy, font) => { x.font = font; x.fillStyle = "rgba(0,0,0,.55)"; x.fillText(text, S / 2, yy - 1.5); x.fillStyle = "#e6dfd3"; x.fillText(text, S / 2, yy); };
    let size = 40; const name = c.name.toUpperCase();
    do { x.font = `800 ${size}px Manrope`; size -= 2; } while (x.measureText(name).width > 220 && size > 16);
    carve(name, 70, `800 ${size + 2}px Manrope`);
    carve(yearsOf(c), 110, `500 19px "JetBrains Mono"`);
    x.fillStyle = "rgba(230,223,211,.5)"; x.fillRect(S / 2 - 26, 136, 52, 2);
    // the cause of death, wrapped onto up to two lines
    x.font = "600 22px Manrope";
    const words = cap(c.cause).split(" "), lines = [""];
    for (const w of words) { const t = (lines[lines.length - 1] + " " + w).trim(); if (x.measureText(t).width > 210 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t; }
    lines.slice(0, 2).forEach((l, i) => carve(l, 168 + i * 28, "600 22px Manrope"));
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  async function buildGraveyard() {
    let data;
    try { data = await (await fetch(API + "/graveyard")).json(); } catch { data = null; }
    if (!data || !data.companies || !data.companies.length) {
      document.querySelector(".g-cause").remove(); document.getElementById("g-hint-text").textContent = "Couldn’t load the graveyard right now."; return;
    }
    const tease = document.getElementById("g-tease-n"); if (tease) tease.textContent = data.count;
    // Causes of death, most common first (only reported causes are ranked).
    const tally = new Map();
    for (const c of data.companies) tally.set(c.cause, (tally.get(c.cause) || 0) + 1);
    const unknown = tally.get("reason not reported") || 0;
    tally.delete("reason not reported");
    const known = data.count - unknown;
    causes = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cause, n]) => ({ cause, n, known, unknown }));
    // Best-documented first (known cause and year), mixed across business types.
    const list = data.companies
      .map((c) => ({ c, score: (/not reported/i.test(c.cause) ? 0 : 2) + (c.closed ? 1 : 0) + rand() }))
      .sort((a, b) => b.score - a.score).slice(0, MAX_STONES).map((x) => x.c);
    await Promise.all([document.fonts.load("800 40px Manrope"), document.fonts.load("600 22px Manrope"), document.fonts.load('500 19px "JetBrains Mono"')]).catch(() => {});

    const cols = TOUCH ? [-4.4, -1.9, 1.9, 4.4] : [-11.9, -9.4, -6.9, -4.4, -1.9, 1.9, 4.4, 6.9, 9.4, 11.9];
    list.forEach((c, i) => {
      const row = Math.floor(i / cols.length), col = cols[i % cols.length];
      const type = TYPES[Math.floor(rand() * TYPES.length)];
      const g = new THREE.Group();
      const body = new THREE.Mesh(type.geo, stoneMats[i % stoneMats.length]);
      body.castShadow = true; body.receiveShadow = true; g.add(body);
      const tex = engrave(c);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(type.plane, type.plane),
        new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: "#ff5a36", emissiveIntensity: 0, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      face.position.set(0, type.planeY, STONE_FRONT); g.add(face);
      const glow = new THREE.Sprite(footGlowMat.clone());
      glow.scale.set(2.2, 1.3, 1); glow.position.set(0, 0.35, 0.3); g.add(glow);
      g.position.set(col + (rand() - 0.5) * 0.7, -2.4, -4.5 - row * 3.3 + (rand() - 0.5) * 1.0);
      g.rotation.set((rand() - 0.5) * 0.08, (rand() - 0.5) * 0.4 - Math.sign(col) * 0.12, (rand() - 0.5) * 0.09);
      g.userData = { c, face, glow, lit: 0, delay: row * 0.012 + rand() * 0.03, sink: -0.04 - rand() * 0.08 };
      body.userData.stone = g; face.userData.stone = g;
      scene.add(g); stones.push(g); pickables.push(body, face);
    });
    plantFlowers();
  }
  buildGraveyard();

  // ---------- the ending: YOUR idea's stone cracks and shatters, dawn breaks, growth rises, life spreads ----------
  const END_Z = -31, endGroup = new THREE.Group();
  endGroup.position.set(0, -2.6, END_Z); scene.add(endGroup);
  const ysMat = new THREE.MeshStandardMaterial({ color: "#6d675f", roughness: 0.9, bumpMap: noise, bumpScale: 1.4 });
  const ysBody = new THREE.Mesh(stoneGeo(stoneShape("arch", 2.0, 1.4), 0.34, 0.05, 32, 3), ysMat);
  ysBody.castShadow = ysBody.receiveShadow = true; endGroup.add(ysBody);
  const ysFront = 0.17 + 0.05 + 0.008;
  const canvasTex = (draw, S = 512) => { const c = document.createElement("canvas"); c.width = c.height = S; draw(c.getContext("2d"), S); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const yourTex = canvasTex((x, S) => {
    x.textAlign = "center"; x.textBaseline = "middle";
    const carve = (t, y, f, col = "#e6dfd3") => { x.font = f; x.fillStyle = "rgba(0,0,0,.55)"; x.fillText(t, S / 2, y - 2); x.fillStyle = col; x.fillText(t, S / 2, y); };
    carve("H E R E   L I E S", 120, '600 30px "JetBrains Mono"', "#ffb39a");
    carve("YOUR", 220, "800 100px Manrope"); carve("IDEA", 318, "800 100px Manrope");
    x.fillStyle = "rgba(230,223,211,.5)"; x.fillRect(S / 2 - 40, 382, 80, 3);
    carve(`${new Date().getFullYear()}  –  ?`, 432, '500 40px "JetBrains Mono"');
  });
  const ysFace = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.75), new THREE.MeshStandardMaterial({ map: yourTex, emissiveMap: yourTex, emissive: "#ffffff", emissiveIntensity: 0.25, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  ysFace.position.set(0, 1.3, ysFront); endGroup.add(ysFace);
  // glowing cracks that spread across the stone before it breaks
  const crackTex = canvasTex((x, S) => {
    x.strokeStyle = "#ffd29a"; x.shadowColor = "#ff7a3c"; x.shadowBlur = 18; x.lineCap = "round";
    const branch = (px, py, a, len, w, depth) => {
      if (depth > 4 || len < 12) return;
      x.lineWidth = w; x.beginPath(); x.moveTo(px, py);
      let cx = px, cy = py;
      for (let k = 0; k < 5; k++) { cx += Math.cos(a + (rand() - 0.5) * 0.9) * len / 5; cy += Math.sin(a + (rand() - 0.5) * 0.9) * len / 5; x.lineTo(cx, cy); }
      x.stroke();
      branch(cx, cy, a + (rand() - 0.5) * 1.2, len * 0.62, w * 0.7, depth + 1);
      if (rand() < 0.6) branch(cx, cy, a + (rand() - 0.5) * 2, len * 0.5, w * 0.6, depth + 1);
    };
    for (let k = 0; k < 9; k++) branch(S / 2 + (rand() - 0.5) * 30, S * 0.56 + (rand() - 0.5) * 30, (k / 9) * Math.PI * 2, 150 + rand() * 80, 6, 0);
  });
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  crack.position.set(0, 1.2, ysFront + 0.01); endGroup.add(crack);
  // the pieces it breaks into (hidden until it breaks)
  const shards = [];
  const NSH = TOUCH ? 36 : 64;
  for (let k = 0; k < NSH; k++) {
    let x0, y0; do { x0 = (rand() - 0.5) * 2; y0 = rand() * 2.4; } while (!(y0 < 1.4 || x0 * x0 + (y0 - 1.4) ** 2 < 1));
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), ysMat);
    const sc = [0.1 + rand() * 0.16, 0.08 + rand() * 0.14, 0.08 + rand() * 0.12];
    m.scale.set(...sc); m.position.set(x0, y0, (rand() - 0.5) * 0.3); m.castShadow = true; m.visible = false;
    const out = 1.6 + rand() * 2.4;
    m.userData = { p0: m.position.clone(), v: new THREE.Vector3(x0 * out + (rand() - 0.5), 1.5 + rand() * 3.5, 1.2 + rand() * 3.4), w: new THREE.Vector3(rand() * 9 - 4.5, rand() * 9 - 4.5, rand() * 9 - 4.5), rest: sc[1] * 0.8 };
    const u = m.userData, disc = u.v.y ** 2 + 19.6 * (u.p0.y - u.rest);
    u.land = (u.v.y + Math.sqrt(Math.max(0, disc))) / 9.8;
    endGroup.add(m); shards.push(m);
  }
  const burstLight = new THREE.PointLight("#ffb070", 0, 0, 2); burstLight.position.set(0, 1.4, END_Z + 0.8); scene.add(burstLight);
  // growth: the three bars of the premortem logo rise from the rubble like a chart
  const barMats = [new THREE.MeshStandardMaterial({ color: "#F4F1EA", emissive: "#F4F1EA", emissiveIntensity: 0.15, roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ color: "#F4F1EA", emissive: "#F4F1EA", emissiveIntensity: 0.15, roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ color: "#2fcf7a", emissive: "#2fcf7a", emissiveIntensity: 0.6, roughness: 0.35 })];
  const bars = [-0.62, 0, 0.62].map((x, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1, 0.42), barMats[i]); b.position.set(x, 0, 0); b.castShadow = true; b.visible = false; b.userData.h = [1.0, 1.6, 2.5][i]; endGroup.add(b); return b; });
  // dawn: a sunrise behind the stone, warm light over the whole graveyard
  const DAWN_ROSE = new THREE.Color("#d9876b"), DAWN_GOLD = new THREE.Color("#f4d6b6"), GROUND_DAWN = new THREE.Color("#6e5a4c");
  const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial("rgba(255,250,230,1)", "rgba(255,220,160,0)"), fog: false, transparent: true, opacity: 0, depthWrite: false }));
  sunDisc.scale.set(26, 26, 1); scene.add(sunDisc);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial("rgba(255,170,110,.55)", "rgba(255,140,90,0)"), fog: false, transparent: true, opacity: 0, depthWrite: false }));
  sunGlow.scale.set(150, 90, 1); scene.add(sunGlow);
  const dawnLight = new THREE.DirectionalLight("#ffb98a", 0); dawnLight.position.set(0, 7, -90); dawnLight.target.position.set(0, 0, -20); scene.add(dawnLight); scene.add(dawnLight.target);
  // ---------- the creepy walk to your stone ----------
  // 1) many more old, weathered, crooked stones crowding the path (decoration only — no names, no claims)
  const OLD = new THREE.MeshStandardMaterial({ color: "#4d4842", roughness: 1, bumpMap: noise, bumpScale: 2 });
  const oldStones = [];
  const addOld = (x, z, sc) => {
    const g = new THREE.Mesh(TYPES[Math.floor(rand() * TYPES.length)].geo, OLD);
    g.scale.setScalar(sc); g.position.set(x, -2.6, z);
    g.rotation.set((rand() - 0.5) * 0.5, (rand() - 0.5) * 1.2, (rand() - 0.5) * 0.6);   // leaning, sinking, forgotten
    g.castShadow = true; g.userData = { sink: -0.15 - rand() * 0.35, delay: 0.04 + rand() * 0.05 };
    scene.add(g); oldStones.push(g);
  };
  for (let r = 2; r < 9; r++) for (const side of [-1, 1]) {
    addOld(side * (1.0 + rand() * 0.3), -4.5 - r * 3.3 - 1.65 + (rand() - 0.5) * 0.6, 0.62 + rand() * 0.28);
    if (!TOUCH) addOld(side * (3.0 + rand() * 0.4), -4.5 - r * 3.3 - 1.65 + (rand() - 0.5) * 0.8, 0.55 + rand() * 0.3);
  }
  if (!TOUCH) for (let k = 0; k < 40; k++) { const side = k % 2 ? 1 : -1; addOld(side * (13 + rand() * 6), -6 - rand() * 34, 0.6 + rand() * 0.5); }
  // 2) creatures closing in on your stone: hooded shadow wraiths with glowing eyes,
  //    hands clawing up out of the ground along the path, and eyes blinking in the dark
  const wraithTex = canvasTex((x, S) => {
    const W2 = S / 2, H2 = S;                                   // drawn in the left half-width, full height
    x.save(); x.translate(S / 4, 0);
    const g = x.createLinearGradient(0, 0, 0, H2); g.addColorStop(0, "rgba(6,5,8,.96)"); g.addColorStop(0.6, "rgba(10,8,14,.85)"); g.addColorStop(1, "rgba(10,8,14,0)");
    x.fillStyle = g; x.beginPath();
    x.moveTo(W2 / 2, 30); x.bezierCurveTo(W2 * 0.95, 30, W2 * 0.98, 150, W2 * 0.88, 200);   // hood
    x.bezierCurveTo(W2 * 1.05, 260, W2 * 1.0, 420, W2 * 0.98, H2);                            // robe, right
    for (let k = 0; k < 7; k++) x.lineTo(W2 * (0.98 - (k + 0.5) / 7 * 0.96), H2 - (k % 2 ? 60 : 0)); // ragged hem
    x.bezierCurveTo(W2 * 0.0, 420, W2 * -0.05, 260, W2 * 0.12, 200);
    x.bezierCurveTo(W2 * 0.02, 150, W2 * 0.05, 30, W2 / 2, 30); x.fill();
    x.fillStyle = "#000"; x.beginPath(); x.ellipse(W2 / 2, 120, W2 * 0.26, 50, 0, 0, Math.PI * 2); x.fill();   // the empty face
    x.shadowColor = "#ff3b1f"; x.shadowBlur = 16; x.fillStyle = "#ff6a3d";
    x.beginPath(); x.ellipse(W2 / 2 - 18, 118, 7, 4, 0.2, 0, Math.PI * 2); x.ellipse(W2 / 2 + 18, 118, 7, 4, -0.2, 0, Math.PI * 2); x.fill();
    x.restore();
  }, 512);
  const wraiths = Array.from({ length: TOUCH ? 4 : 8 }, (_, i) => {
    const w = new THREE.Sprite(new THREE.SpriteMaterial({ map: wraithTex, transparent: true, opacity: 0, depthWrite: false }));
    w.center.set(0.5, 0.02);
    const side = i % 2 ? 1 : -1, th = (0.12 + (i / 8) * 0.76) * Math.PI;
    w.userData = { sx: side * (8 + rand() * 5), sz: END_Z - 6 + rand() * 12, ex: Math.cos(th) * 2.9, ez: END_Z - Math.sin(th) * 1.6 + 0.4, h: 2.0 + rand() * 0.7, d: rand() * 0.035, ph: rand() * 6.3 };
    scene.add(w); return w;
  });
  const handTex = canvasTex((x, S) => {
    const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, "#1a1715"); g.addColorStop(0.75, "#211c19"); g.addColorStop(1, "rgba(33,28,25,0)");
    x.fillStyle = g; x.strokeStyle = g; x.lineCap = "round";
    x.beginPath(); x.moveTo(S * 0.42, S); x.lineTo(S * 0.44, S * 0.55); x.lineTo(S * 0.6, S * 0.55); x.lineTo(S * 0.6, S); x.fill();   // forearm
    x.beginPath(); x.ellipse(S * 0.52, S * 0.5, S * 0.12, S * 0.1, 0, 0, Math.PI * 2); x.fill();                                    // palm
    [[-0.13, 0.5, -0.24, 0.22, -0.2, 0.12], [-0.06, 0.42, -0.1, 0.12, -0.04, 0.05], [0.0, 0.41, 0.02, 0.1, 0.07, 0.04], [0.06, 0.43, 0.12, 0.14, 0.17, 0.08], [0.12, 0.52, 0.24, 0.42, 0.27, 0.32]]
      .forEach(([x0, y0, x1, y1, x2, y2], k) => { x.lineWidth = S * (k === 4 ? 0.05 : 0.04); x.beginPath(); x.moveTo(S * (0.52 + x0), S * y0); x.lineTo(S * (0.52 + x1), S * y1); x.lineTo(S * (0.52 + x2), S * y2); x.stroke(); }); // clawed fingers
  }, 256);
  const hands = [];
  for (let k = 0; k < (TOUCH ? 6 : 12); k++) {
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: handTex, transparent: true, opacity: 0, depthWrite: false }));
    h.center.set(0.5, 0); const side = k % 2 ? 1 : -1;
    h.position.set(side * (0.7 + rand() * 0.45), -0.05, -12 - k * 1.45 - rand() * 0.6);
    h.material.rotation = side * (0.15 + rand() * 0.25);
    h.userData = { size: 0.9 + rand() * 0.45, ph: rand() * 6.3 };
    scene.add(h); hands.push(h);
  }
  const eyeTex = radial("rgba(255,90,50,1)", "rgba(255,40,20,0)");
  const eyes = [];
  for (let k = 0; k < (TOUCH ? 10 : 26); k++) {
    const side = k % 2 ? 1 : -1, x0 = side * (3 + rand() * 11), y0 = 0.5 + rand() * 0.9, z0 = -8 - rand() * 30, ph = rand();
    for (const off of [-0.07, 0.07]) {
      const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      e.position.set(x0 + off, y0, z0); e.scale.set(0.11, 0.07, 1); e.userData = { ph, sp: 0.12 + rand() * 0.15 }; scene.add(e); eyes.push(e);
    }
  }
  // 3) crows circling over your stone (they fly away into the sunrise at the end)
  const crowTex = [0, 1].map((up) => canvasTex((x, S) => {
    x.fillStyle = "#0b0a0b"; x.beginPath();
    const y = S / 2, w = up ? -60 : 40;
    x.moveTo(S * 0.08, y + w * 0.4); x.quadraticCurveTo(S * 0.3, y + w, S * 0.47, y + 6);
    x.lineTo(S * 0.5, y - 10); x.lineTo(S * 0.53, y + 6);
    x.quadraticCurveTo(S * 0.7, y + w, S * 0.92, y + w * 0.4); x.quadraticCurveTo(S * 0.66, y + w * 0.25 + 18, S * 0.5, y + 22);
    x.quadraticCurveTo(S * 0.34, y + w * 0.25 + 18, S * 0.08, y + w * 0.4); x.fill();
  }, 256));
  const crows = Array.from({ length: TOUCH ? 4 : 8 }, (_, i) => {
    const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: crowTex[0], transparent: true, opacity: 0, depthWrite: false }));
    c.scale.set(1.4, 1.4, 1); c.userData = { r: 2.5 + rand() * 4, h: 3.6 + rand() * 2.4, sp: 0.35 + rand() * 0.4, ph: rand() * 6.3, flap: 6 + rand() * 4 };
    scene.add(c); return c;
  });
  // bats: a swarm bursts out from behind your stone and streams past the camera; a few flutter overhead
  const batTex = [0, 1].map((up) => canvasTex((x, S) => {
    const cx = S / 2, cy = S / 2, wy = up ? -70 : 30;
    x.fillStyle = "#08070a"; x.beginPath();
    x.moveTo(cx, cy - 8);
    x.quadraticCurveTo(cx + 40, cy + wy * 0.6 - 10, cx + 118, cy + wy);           // right wing top edge
    x.lineTo(cx + 100, cy + wy * 0.5 + 22); x.lineTo(cx + 82, cy + wy * 0.35 + 14);   // scalloped bottom edge
    x.lineTo(cx + 62, cy + wy * 0.3 + 26); x.lineTo(cx + 42, cy + wy * 0.15 + 14); x.lineTo(cx + 14, cy + 20);
    x.lineTo(cx - 14, cy + 20); x.lineTo(cx - 42, cy + wy * 0.15 + 14); x.lineTo(cx - 62, cy + wy * 0.3 + 26);
    x.lineTo(cx - 82, cy + wy * 0.35 + 14); x.lineTo(cx - 100, cy + wy * 0.5 + 22); x.lineTo(cx - 118, cy + wy);
    x.quadraticCurveTo(cx - 40, cy + wy * 0.6 - 10, cx, cy - 8); x.fill();
    x.strokeStyle = "rgba(170,160,230,.7)"; x.lineWidth = 3; x.stroke();                           // moonlit edge
    x.beginPath(); x.ellipse(cx, cy + 6, 13, 22, 0, 0, Math.PI * 2); x.fill();                    // body
    x.beginPath(); x.moveTo(cx - 10, cy - 12); x.lineTo(cx - 8, cy - 30); x.lineTo(cx - 2, cy - 14); x.lineTo(cx + 2, cy - 14); x.lineTo(cx + 8, cy - 30); x.lineTo(cx + 10, cy - 12); x.fill(); // ears
    x.fillStyle = "#ff4a2a"; x.beginPath(); x.arc(cx - 5, cy - 4, 2.2, 0, 7); x.arc(cx + 5, cy - 4, 2.2, 0, 7); x.fill();   // eyes
  }, 256));
  const bats = Array.from({ length: TOUCH ? 16 : 40 }, (_, i) => {
    const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: batTex[0], transparent: true, opacity: 0, depthWrite: false }));
    const side = i % 2 ? 1 : -1;
    b.userData = { s: new THREE.Vector3((rand() - 0.5) * 3, 1 + rand() * 2, END_Z - 1 - rand() * 2), e: new THREE.Vector3(side * (0.8 + rand() * 3), 1.0 + rand() * 2.4, -12 - rand() * 4),
      m: new THREE.Vector3(side * (0.8 + rand() * 2.5), 1.8 + rand() * 1.8, END_Z + 7 + rand() * 4), st: rand() * 0.6, size: 0.7 + rand() * 0.45, fl: 14 + rand() * 8, ph: rand() * 6.3, ambient: i < (TOUCH ? 4 : 8) };
    scene.add(b); return b;
  });

  // 4) lightning light + colder fog
  const lightning = new THREE.DirectionalLight("#b9c8ff", 0); lightning.position.set(-20, 30, -60); scene.add(lightning);
  const COLD = new THREE.Color("#1b2130");   // misty blue-grey, so creatures and crows show as silhouettes
  // ---------- extra beauty at dawn: sun rays ----------
  const rayTex = canvasTex((x, S) => { const g = x.createLinearGradient(0, S, 0, 0); g.addColorStop(0, "rgba(255,230,190,.9)"); g.addColorStop(1, "rgba(255,230,190,0)"); x.fillStyle = g; x.beginPath(); x.moveTo(S / 2 - 6, S); x.lineTo(S / 2 + 6, S); x.lineTo(S, 0); x.lineTo(0, 0); x.fill(); }, 256);
  const rays = Array.from({ length: 7 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 60), new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.userData.a = (i - 3) * 0.32; scene.add(m); return m;
  });

  // life: little glowing flowers that bloom in a wave across the graveyard from where your stone broke
  const flowerTex = [radial("rgba(255,214,130,1)", "rgba(255,190,90,0)"), radial("rgba(140,245,180,1)", "rgba(90,220,140,0)")];
  const flowers = [];
  function plantFlowers() {
    for (const st of stones) {
      for (let k = 0; k < (TOUCH ? 1 : 2); k++) {
        const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flowerTex[(flowers.length) % 2], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        f.position.set(st.position.x + (rand() - 0.5) * 1.4, 0.18, st.position.z + 0.5 + rand() * 0.6);
        f.userData.d = Math.hypot(f.position.x, f.position.z - END_Z); f.userData.ph = rand() * 6.3; f.scale.set(0.01, 0.01, 1);
        scene.add(f); flowers.push(f);
      }
    }
  }
  let stats = null;
  fetch(API + "/stats").then((r) => r.json()).then((d) => { stats = d; }).catch(() => {});

  // ---------- bloom (glow) for the night, desktop only ----------
  let composer = null, bloom = null;
  if (!TOUCH) {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(1); // the glow pass doesn't need full sharpness
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0, 0.6, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  // ---------- camera path (keyed to scroll) ----------
  // Hero: the stone sits right of the words (or above them on phones). Then the camera rises,
  // swings past the stone's left side into the aisle, and walks down the graveyard.
  const heroPos = () => (NARROW() ? [0, 1.6, 14.5] : [-2.8, 2.2, 11.5]);
  const heroLook = () => (NARROW() ? [0, -0.5, 0] : [-2.8, 1.55, 0]);
  const KEYS = () => [
    { p: 0.00, pos: heroPos(), look: heroLook() },
    { p: 0.13, pos: heroPos(), look: heroLook() },
    { p: 0.34, pos: [-0.6, 5.0, 12], look: [0, 0.8, -10] },
    { p: 0.45, pos: [-2.7, 2.7, 2.5], look: [-0.6, 1.0, -12] },
    { p: 0.55, pos: [0, 2.3, -4.5], look: [0, 1.0, -16] },
    { p: 0.82, pos: [0, 2.1, -19.5], look: [0, 1.0, -32] },
    { p: 0.89, pos: [0, 1.85, -25.4], look: [0, 1.45, -31] },
    { p: 0.95, pos: [0, 2.3, -23.0], look: [0, 2.0, -40] },
    { p: 1.00, pos: [0, 2.6, -18.5], look: [0, 2.5, -40] },
  ];
  let keys = KEYS(), posCurve, lookCurve;
  const buildCurves = () => {
    keys = KEYS();
    posCurve = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.pos)), false, "centripetal");
    lookCurve = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.look)), false, "centripetal");
  };
  buildCurves();
  const curveT = (p) => {
    for (let i = 0; i < keys.length - 1; i++) if (p <= keys[i + 1].p) return (i + (p - keys[i].p) / (keys[i + 1].p - keys[i].p)) / (keys.length - 1);
    return 1;
  };

  // ---------- pointer ----------
  const mouse = new THREE.Vector2(0, 0), mouseNDC = new THREE.Vector2(0, -0.2);
  let lastMove = -1e9, mx = 0, my = 0;
  addEventListener("pointermove", (e) => {
    mx = e.clientX; my = e.clientY;
    mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    mouseNDC.copy(mouse); lastMove = performance.now();
  }, { passive: true });
  const ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const lanternPos = new THREE.Vector3(0, 1.2, -6), lanternTarget = new THREE.Vector3();
  const tip = document.getElementById("g-tip");
  let hovered = null;
  canvas.addEventListener("click", () => {
    if (hovered) location.href = `index.html#/results/${encodeURIComponent(hovered.userData.c.niche)}`;
  });

  // ---------- smooth scrolling ----------
  // Test hooks: ?at=0.4 jumps to that point of the story, &mx=..&my=.. places the mouse (used for screenshots).
  const test = new URLSearchParams(location.search);
  if (test.has("mx")) { mouse.set(+test.get("mx"), +test.get("my")); mouseNDC.copy(mouse); mx = (mouse.x + 1) / 2 * innerWidth; my = (1 - mouse.y) / 2 * innerHeight; lastMove = 1e15; }
  if (test.has("at")) setTimeout(() => scrollTo(0, +test.get("at") * (document.documentElement.scrollHeight - innerHeight)), 50);
  let lenis = null;
  if (window.Lenis && !STILL && !test.has("at")) lenis = new window.Lenis({ lerp: 0.075, smoothWheel: true });
  // "Enter the graveyard" glides you down to where the walk begins; the rail dots jump to each stage.
  // A steady walk (about 5 seconds to reach the graveyard) so the sunset still plays out.
  // Scrolling or touching during the walk takes over straight away.
  let walking = false;
  const glideTo = (at) => {
    const H = document.documentElement.scrollHeight - innerHeight, y = at * H;
    const span = Math.abs(y - scrollY) / H;
    const duration = Math.max(1.2, span * 12);
    const easing = (k) => -(Math.cos(Math.PI * k) - 1) / 2; // soft start, soft stop
    if (lenis) { walking = true; lenis.scrollTo(y, { duration, easing, onComplete: () => (walking = false) }); }
    else scrollTo({ top: y, behavior: "smooth" });
  };
  const stopWalk = () => { if (walking && lenis) { walking = false; lenis.scrollTo(scrollY, { immediate: true }); } };
  addEventListener("wheel", stopWalk, { passive: true });
  addEventListener("touchstart", stopWalk, { passive: true });
  document.getElementById("g-enter")?.addEventListener("click", () => glideTo(0.45));
  const railDots = [...document.querySelectorAll(".g-rail a")];
  railDots.forEach((a) => a.addEventListener("click", () => glideTo(+a.dataset.at)));
  const progress = () => clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
  let p = progress();

  // ---------- panels ----------
  const panels = [...document.querySelectorAll(".g-panel")];
  let counted = false, shownCause = -1;
  function updatePanels() {
    for (const el of panels) {
      if (!el.isConnected) continue;
      const a = +el.dataset.in, b = +el.dataset.out, f = 0.035;
      const vIn = a <= 0 ? 1 : smooth(a, a + f, p), vOut = 1 - smooth(b - f, b, p), v = vIn * vOut;
      el.style.opacity = v.toFixed(3);
      el.style.setProperty("--y", `${((1 - v) * (vIn < 1 ? 28 : -28)).toFixed(1)}px`);
      el.classList.toggle("live", v > 0.6);
    }
    if (stats && !counted && p > 0.24) {
      counted = true; const t0 = performance.now();
      const els = [...document.querySelectorAll(".g-count [data-key]")];
      const tick = (now) => {
        const t = clamp((now - t0) / 1800);
        for (const el of els) el.textContent = Math.round((stats[el.dataset.key] || 0) * ease(t)).toLocaleString("en-IN");
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    // which cause of death is lit up right now (#1, #2, #3 as you walk)
    const ci = p < 0.5 || p > 0.83 ? -1 : p < 0.61 ? 0 : p < 0.72 ? 1 : 2;
    if (ci !== shownCause && causes[ci]) {
      shownCause = ci;
      const k = causes[ci], card = document.querySelector(".g-cause");
      card.classList.add("swap");
      setTimeout(() => {
        document.getElementById("g-cause-rank").textContent = `The #${ci + 1} reported killer`;
        document.getElementById("g-cause-name").textContent = cap(k.cause);
        document.getElementById("g-cause-n").textContent = k.n;
        document.getElementById("g-cause-of").textContent = `of ${k.known} businesses with a known cause · the glowing stones`;
        document.getElementById("g-cause-bar").style.width = `${Math.round((100 * k.n) / k.known)}%`;
        document.getElementById("g-cause-note").textContent = `${k.unknown} more never said why — failures are often unreported.`;
        card.classList.remove("swap");
      }, 250);
    } else if (ci === -1) shownCause = -1;
    if (p > 0.86) {
      // (the ending copy now lives in graveyard.html)
    }
    const isDawn = p > 0.935;
    document.body.classList.toggle("night", p > 0.2 && !isDawn);
    document.body.classList.toggle("dawn", isDawn);
    document.body.classList.toggle("cta-ready", p > 0.55);           // the app button appears only after the walk
    document.getElementById("g-cue")?.classList.toggle("gone", p > 0.03);
    let now = 0; railDots.forEach((a, i) => { if (p + 0.03 >= +a.dataset.at) now = i; });
    railDots.forEach((a, i) => { a.classList.toggle("now", i === now); a.classList.toggle("done", i < now); });
  }

  // ---------- lightning bolts that strike in from the sides of the screen ----------
  const boltCv = document.getElementById("g-bolts"), bctx = boltCv ? boltCv.getContext("2d") : null;
  const sizeBolts = () => { if (!boltCv) return; const d = Math.min(devicePixelRatio, 2); boltCv.width = innerWidth * d; boltCv.height = innerHeight * d; bctx.setTransform(d, 0, 0, d, 0, 0); };
  sizeBolts(); addEventListener("resize", sizeBolts);
  let bolts = [], nextStrike = 2, reseed = 0;
  function makeBolt(x0, y0, x1, y1, rough) {
    let pts = [[x0, y0], [x1, y1]];
    for (let lvl = 0; lvl < 7; lvl++) {                          // midpoint displacement → a jagged bolt
      const next = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay);
        next.push([(ax + bx) / 2 + (Math.random() - 0.5) * len * rough, (ay + by) / 2 + (Math.random() - 0.5) * len * rough], [bx, by]);
      }
      pts = next;
    }
    const branches = [];
    for (let k = 0; k < 3; k++) { const i = Math.floor(pts.length * (0.25 + Math.random() * 0.5)), [bx, by] = pts[i];
      const a = Math.atan2(y1 - y0, x1 - x0) + (Math.random() - 0.5) * 1.6, L = 60 + Math.random() * 140;
      branches.push(makeBoltSimple(bx, by, bx + Math.cos(a) * L, by + Math.sin(a) * L)); }
    return { pts, branches };
  }
  function makeBoltSimple(x0, y0, x1, y1) { let pts = [[x0, y0], [x1, y1]]; for (let l = 0; l < 4; l++) { const n = [pts[0]]; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay); n.push([(ax + bx) / 2 + (Math.random() - 0.5) * len * 0.5, (ay + by) / 2 + (Math.random() - 0.5) * len * 0.5], [bx, by]); } pts = n; } return pts; }
  function strokeBolt(pts, w, glow, col, a) {
    bctx.globalAlpha = a; bctx.strokeStyle = col; bctx.lineWidth = w; bctx.shadowColor = glow; bctx.shadowBlur = 24; bctx.lineJoin = "round";
    bctx.beginPath(); pts.forEach(([x, y], i) => (i ? bctx.lineTo(x, y) : bctx.moveTo(x, y))); bctx.stroke();
  }
  function drawBolts(dt, t, creep, cracking, broken) {
    if (!bctx) return;
    bctx.clearRect(0, 0, innerWidth, innerHeight);
    const W = innerWidth, H = innerHeight;
    // while the stone cracks: arcs from both screen edges straight into it
    if (cracking > 0.05 && !broken) {
      reseed -= dt;
      if (reseed <= 0) {
        reseed = 0.06;
        const c = tmpA.set(0, 1.3, END_Z).project(camera), cx = ((c.x + 1) / 2) * W, cy = ((1 - c.y) / 2) * H;
        bolts = [makeBolt(0, H * (0.2 + Math.random() * 0.5), cx, cy, 0.45), makeBolt(W, H * (0.2 + Math.random() * 0.5), cx, cy, 0.45)];
        if (cracking > 0.6) bolts.push(makeBolt(Math.random() < 0.5 ? 0 : W, H * Math.random() * 0.3, cx, cy, 0.5));
        bolts.forEach((b) => (b.col = "#ffe2c4", b.glow = "#ff7a3c", b.life = 1));
      }
    } else if (creep > 0.2) {
      // during the walk: a bolt cracks in from a random side every few seconds
      nextStrike -= dt;
      if (nextStrike <= 0) {
        nextStrike = 2.2 + Math.random() * 3;
        const fromLeft = Math.random() < 0.5;
        const b = makeBolt(fromLeft ? 0 : W, H * Math.random() * 0.35, W * (fromLeft ? 0.35 + Math.random() * 0.25 : 0.4 + Math.random() * 0.25), H * (0.35 + Math.random() * 0.25), 0.55);
        b.col = "#f2f4ff"; b.glow = "#8fa8ff"; b.life = 1; bolts = [b];
        lightningFlash = 1;
      }
      bolts.forEach((b) => (b.life -= dt * 4));
      bolts = bolts.filter((b) => b.life > 0);
    } else bolts = [];
    for (const b of bolts) {
      const a = Math.min(1, b.life) * (0.75 + Math.random() * 0.25) * (cracking > 0.05 && !broken ? cracking : 1);
      strokeBolt(b.pts, 7, b.glow, b.glow, a * 0.35); strokeBolt(b.pts, 2.4, b.glow, b.col, a);
      b.branches.forEach((br) => strokeBolt(br, 1.4, b.glow, b.col, a * 0.7));
    }
    bctx.globalAlpha = 1; bctx.shadowBlur = 0;
    lightningFlash *= Math.pow(0.001, dt);
  }
  let lightningFlash = 0;

  // ---------- quality: if frames are slow for a few seconds, go lighter ----------
  let lowQuality = false, slowTime = 0;
  function watchSpeed(dt) {
    if (lowQuality) return;
    slowTime = dt > 0.028 ? slowTime + dt : Math.max(0, slowTime - dt);
    if (slowTime > 2.5) { lowQuality = true; renderer.setPixelRatio(1); composer = null; }
  }

  // ---------- every frame ----------
  const clock = new THREE.Clock(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let first = true, frameNo = 0;
  function frame(time) {
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    watchSpeed(dt);
    if (lenis) lenis.raf(time);
    const target = progress();
    p += (target - p) * Math.min(1, dt * 7);
    if (first) { p = target; first = false; }

    const night = smooth(0.13, 0.28, p);      // day → night
    const rise = (d) => ease(clamp((p - 0.17 - d) / 0.12)); // stones come up out of the ground
    const lanternOn = smooth(0.33, 0.45, p);

    // world colours
    sky(scene.background, DAY, DUSK, NIGHT, night);
    scene.fog.color.copy(scene.background);
    scene.fog.near = THREE.MathUtils.lerp(30, 5, night); scene.fog.far = THREE.MathUtils.lerp(90, 36, night);
    sky(groundMat.color, GROUND_DAY, GROUND_DUSK, GROUND_NIGHT, night);
    sun.color.copy(SUN_DAY).lerp(SUN_DUSK, smooth(0, 0.5, night));
    scene.environmentIntensity = THREE.MathUtils.lerp(1, 0.05, night);
    sun.intensity = 2.2 * (1 - night);
    moon.intensity = 0.55 * night;
    moonSprite.material.opacity = night; moonHalo.material.opacity = night * 0.5; stars.material.opacity = night * 0.8;
    mistMat.opacity = 0.09 * night;

    // ---- the ending ----
    const dawn = smooth(0.9, 0.985, p);                       // night → sunrise
    const cracking = smooth(0.862, 0.895, p);                 // cracks spread across your stone
    const br = clamp((p - 0.897) / 0.05);                     // it breaks (0 → 1)
    endGroup.position.y = THREE.MathUtils.lerp(-2.6, 0, rise(0.1));
    const broken = br > 0;
    ysBody.visible = ysFace.visible = !broken;
    crack.visible = !broken; crack.material.opacity = cracking * (0.75 + Math.sin(t * 9) * 0.25);
    endGroup.position.x = broken ? 0 : Math.sin(t * 70) * 0.025 * cracking;
    const T = br * 1.7;
    for (const sh of shards) {
      const u = sh.userData; sh.visible = broken;
      if (!broken) continue;
      const tt = Math.min(T, u.land), slide = Math.max(0, T - u.land) * 0.15;
      sh.position.set(u.p0.x + u.v.x * (tt + slide), Math.max(u.rest, u.p0.y + u.v.y * tt - 4.9 * tt * tt), u.p0.z + u.v.z * (tt + slide));
      sh.rotation.set(u.w.x * tt, u.w.y * tt, u.w.z * tt);
    }
    burstLight.intensity = broken ? 70 * Math.exp(-br * 7) : 6 * cracking;
    const flash = document.getElementById("g-flash");
    if (flash) flash.style.opacity = broken ? (Math.exp(-br * 9) * 0.9).toFixed(3) : (cracking * 0.12).toFixed(3);
    bars.forEach((b, i) => {
      const g = ease(clamp((p - 0.93 - i * 0.011) / 0.045));
      b.visible = g > 0.001; b.scale.y = Math.max(0.001, g * b.userData.h); b.position.y = (g * b.userData.h) / 2;
      b.material.emissiveIntensity = (i === 2 ? 0.6 : 0.15) + g * (i === 2 ? 1.2 : 0.35) * (0.85 + Math.sin(t * 2.5) * 0.15);
    });
    if (dawn > 0) {
      sky(scene.background, NIGHT, DAWN_ROSE, DAWN_GOLD, dawn);
      scene.fog.color.copy(scene.background); scene.fog.far = THREE.MathUtils.lerp(36, 80, dawn); scene.fog.near = THREE.MathUtils.lerp(5, 14, dawn);
      groundMat.color.lerp(GROUND_DAWN, dawn);
      scene.environmentIntensity += dawn * 0.55;
    }
    moon.intensity *= 1 - dawn; moonSprite.material.opacity *= 1 - dawn; moonHalo.material.opacity *= 1 - dawn; stars.material.opacity *= 1 - dawn;
    mistMat.opacity *= 1 - dawn * 0.7;
    dawnLight.intensity = 2.6 * dawn;
    sunDisc.material.opacity = dawn; sunGlow.material.opacity = dawn;
    sunDisc.position.set(0, -12 + 30 * ease(dawn), -170); sunGlow.position.set(0, -6 + 18 * ease(dawn), -175);
    // the creepy walk: colder, closer fog, crowding stones, crows, lightning
    const creep = smooth(0.6, 0.8, p) * (1 - smooth(0.895, 0.93, p));
    for (const o of oldStones) o.position.y = THREE.MathUtils.lerp(-2.6, o.userData.sink, rise(o.userData.delay));
    if (creep > 0 && dawn < 0.05) {
      scene.background.lerp(COLD, creep); scene.fog.color.copy(scene.background);
      scene.fog.far = THREE.MathUtils.lerp(scene.fog.far, 22, creep); scene.fog.near = THREE.MathUtils.lerp(scene.fog.near, 2.5, creep);
      mistMat.opacity = 0.09 + 0.16 * creep;
    }
    const strike = (t % 7.3) < 0.09 ? 1 : (t % 7.3) > 0.16 && (t % 7.3) < 0.24 ? 0.6 : 0;
    lightning.intensity = creep * (strike * 3.2 + lightningFlash * 6);
    if (creep * strike > 0) { scene.background.lerp(new THREE.Color("#3a4560"), creep * strike * 0.5); scene.fog.color.copy(scene.background); }
    crows.forEach((c, i) => {
      const u = c.userData, a = t * u.sp + u.ph, away = ease(clamp((p - 0.9) / 0.08));
      c.position.set(Math.cos(a) * u.r + away * (i - 4) * 3, u.h + Math.sin(t * 1.3 + i) * 0.3 + away * 22, END_Z + Math.sin(a) * u.r - away * 70);
      c.material.map = crowTex[Math.sin(t * u.flap + i) > 0 ? 1 : 0];
      c.material.opacity = smooth(0.62, 0.75, p) * (1 - smooth(0.96, 0.99, p));
      const sc = 1.4 * (1 - away * 0.5); c.scale.set(sc, sc * 0.6, 1);
    });
    // creatures: they gather around your stone, then burn away when it breaks and dawn comes
    const gather = smooth(0.66, 0.885, p), gone = clamp(br / 0.25);
    wraiths.forEach((w, i) => {
      const u = w.userData, k = ease(clamp((gather - u.d) / (1 - u.d)));
      const recoil = 1 + cracking * 0.35 + gone * 0.8;
      w.position.set(THREE.MathUtils.lerp(u.sx, u.ex * recoil, k) + Math.sin(t * 0.7 + u.ph) * 0.25,
        0.05 + Math.sin(t * 1.1 + u.ph) * 0.12 + gone * 1.6, THREE.MathUtils.lerp(u.sz, u.ez, k));
      const sc = u.h * (1 + gone * 0.5); w.scale.set(sc * 0.55, sc, 1);
      w.material.opacity = smooth(0.66, 0.72, p) * (1 - gone) * (0.85 + Math.sin(t * 2 + u.ph) * 0.1);
    });
    hands.forEach((h) => {
      const ahead = camera.position.z - h.position.z, up = clamp((6.5 - ahead) / 3.2) * (1 - smooth(0.9, 0.94, p));
      const sz = h.userData.size * ease(up) * (1 + Math.sin(t * 3 + h.userData.ph) * 0.03);
      h.scale.set(Math.max(0.001, sz * 0.75), Math.max(0.001, sz), 1); h.material.opacity = smooth(0.62, 0.7, p) * up;
    });
    eyes.forEach((e) => {
      const blink = ((t * e.userData.sp + e.userData.ph) % 1) < 0.07 ? 0 : 1;
      e.material.opacity = smooth(0.6, 0.7, p) * (1 - smooth(0.895, 0.93, p)) * blink;
    });
    bats.forEach((b, i) => {
      const u = b.userData;
      b.material.map = batTex[Math.sin(t * u.fl + u.ph) > 0 ? 1 : 0];
      if (u.ambient) {   // a few flutter around overhead, all through the walk
        const a = t * 0.9 + u.ph;
        b.position.set(Math.cos(a) * (3 + i * 0.5), 4 + Math.sin(t * 2.3 + i) * 0.8, camera.position.z - 9 + Math.sin(a) * 4);
        b.material.opacity = smooth(0.62, 0.7, p) * (1 - smooth(0.9, 0.93, p)); b.scale.set(u.size, u.size, 1);
        return;
      }
      const k = clamp((p - 0.785 - u.st * 0.03) / 0.04);         // the swarm bursts out and flies past you
      const q = 1 - k;
      b.position.set(q * q * u.s.x + 2 * q * k * u.m.x + k * k * u.e.x, q * q * u.s.y + 2 * q * k * u.m.y + k * k * u.e.y + Math.sin(t * 9 + u.ph) * 0.15, q * q * u.s.z + 2 * q * k * u.m.z + k * k * u.e.z);
      b.material.opacity = k > 0 && k < 1 ? 1 : 0;
      b.scale.set(u.size, u.size, 1);
    });
    drawBolts(dt, t, creep, cracking, broken);
    rays.forEach((r, i) => {
      r.position.set(sunDisc.position.x, sunDisc.position.y + 25, -160); r.rotation.z = r.userData.a + Math.sin(t * 0.15 + i) * 0.04;
      r.material.opacity = dawn * (0.22 + Math.sin(t * 0.7 + i * 1.7) * 0.06);
    });
    const dread = document.getElementById("g-dread");
    if (dread) dread.style.opacity = (creep * 0.9).toFixed(3);

    for (const f of flowers) {
      const k = ease(clamp((p - 0.925 - f.userData.d * 0.0011) / 0.03));
      const s = k * (0.45 + Math.sin(t * 2 + f.userData.ph) * 0.06);
      f.scale.set(s, s, 1); f.material.opacity = k * 0.95;
    }

    // camera along its path (+ a little mouse parallax)
    const ct = curveT(p);
    posCurve.getPoint(ct, camPos); lookCurve.getPoint(ct, camLook);
    const par = STILL ? 0 : 1;
    camPos.x += mouse.x * 0.35 * par; camPos.y += mouse.y * 0.2 * par;
    const shake = smooth(0.6, 0.8, p) * (1 - smooth(0.895, 0.93, p)) * (STILL ? 0 : 1);
    camPos.x += Math.sin(t * 1.7) * 0.05 * shake + Math.sin(t * 4.3) * 0.015 * shake;
    camPos.y += Math.sin(t * 2.3) * 0.04 * shake;
    camera.position.copy(camPos); camera.lookAt(camLook);
    camera.rotateZ(Math.sin(t * 0.9) * 0.012 * shake);

    // hero tombstone: floats and leans towards the mouse in daylight, settles at night
    const day = 1 - night;
    hero.position.y = (STILL ? 0 : Math.sin(t * 1.2) * 0.07 + 0.08) * day;
    hero.rotation.y += ((mouse.x * 0.62) * day - hero.rotation.y) * Math.min(1, dt * 11);
    hero.rotation.x += ((-mouse.y * 0.2) * day - hero.rotation.x) * Math.min(1, dt * 11);
    hero.position.x += ((mouse.x * 0.18) * day - hero.position.x) * Math.min(1, dt * 8);
    beatGlow *= Math.pow(0.02, dt);
    orange.emissiveIntensity = 0.15 + beatGlow * (0.9 + night * 3.5) + night * 0.8;

    // stones rise
    for (const s of stones) {
      const r = rise(s.userData.delay);
      s.visible = r > 0;
      s.position.y = THREE.MathUtils.lerp(-2.4, s.userData.sink, r);
      // only stones close to the lantern cast its shadow (keeps things smooth)
      const want = shownCause >= 0 && causes[shownCause] && s.userData.c.cause === causes[shownCause].cause ? 1 : 0;
      s.userData.lit += (want - s.userData.lit) * Math.min(1, dt * 3);
      const throb = 0.85 + Math.sin(t * 3 + s.position.x) * 0.15;
      s.userData.face.material.emissiveIntensity = s.userData.lit * 1.6 * throb;
      s.userData.glow.material.opacity = s.userData.lit * 0.55 * throb;
      s.children[0].castShadow = Math.abs(s.position.x - lanternPos.x) < 5 && Math.abs(s.position.z - lanternPos.z) < 5;
    }
    sun.castShadow = night < 0.6;
    lantern.castShadow = !TOUCH && !lowQuality && lanternOn > 0.05;

    // lantern: follows the mouse on the ground, or wanders if the mouse is still / on phones
    const wander = TOUCH || performance.now() - lastMove > 4000;
    if (wander) {
      lanternTarget.set(Math.sin(t * 0.45) * (NARROW() ? 2.2 : 3.2), 0, camera.position.z - (NARROW() ? 5 : 7) + Math.sin(t * 0.3) * 1.5);
    } else {
      ray.setFromCamera(mouseNDC, camera);
      if (ray.ray.intersectPlane(groundPlane, hit)) {
        tmpA.copy(hit).sub(camera.position); tmpA.y = 0;
        if (tmpA.length() > 16) tmpA.setLength(16);
        lanternTarget.copy(camera.position).add(tmpA); lanternTarget.y = 0;
      }
    }
    lanternPos.lerp(tmpB.set(lanternTarget.x, 1.15 + Math.sin(t * 2.1) * 0.05, lanternTarget.z), wander ? Math.min(1, dt * 4) : Math.min(1, dt * 18));
    lantern.position.copy(lanternPos);
    lantern.intensity = 13 * lanternOn * (1 - smooth(0.88, 0.92, p)) * (0.92 + Math.sin(t * 13) * 0.04 + Math.sin(t * 7.3) * 0.04); // a gentle flicker
    flame.position.copy(lanternPos); halo.position.copy(lanternPos);
    flame.material.opacity = lanternOn; halo.material.opacity = lanternOn * 0.4;

    // embers drift upward and sway
    const ep = emberGeo.attributes.position;
    emberBase.forEach((e, i) => {
      const y = ((e.y + t * 0.12 * e.s) % 2.8) + 0.1;
      ep.setXYZ(i, e.x + Math.sin(t * 0.6 * e.s + e.p) * 0.4, y, e.z + Math.cos(t * 0.4 + e.p) * 0.3);
    });
    ep.needsUpdate = true;
    embers.material.opacity = 0.85 * night;
    embers.material.color.set(dawn > 0.4 ? "#ffe39a" : "#ffb070");
    for (const m of mists) { m.position.x += m.userData.v * dt; if (m.position.x > 18) m.position.x = -18; if (m.position.x < -18) m.position.x = 18; }

    // which stone is the lantern pointing at?
    const checkNow = (++frameNo & 1) === 0; // look for a stone every other frame; keep the last answer in between
    let found = !checkNow && lanternOn > 0.6 && !wander && p < 0.86 ? hovered : null;
    if (checkNow && lanternOn > 0.6 && !wander && pickables.length && p < 0.86) {
      ray.setFromCamera(mouseNDC, camera);
      const h = ray.intersectObjects(pickables, false)[0];
      if (h && h.distance < 22) found = h.object.userData.stone;
    }
    if (found !== hovered) {
      hovered = found;
      canvas.style.cursor = hovered ? "pointer" : "";
      if (hovered) {
        const c = hovered.userData.c;
        tip.innerHTML = `<b>${esc(c.name)}</b><div class="t-meta">${esc(yearsOf(c))}${c.country ? " · " + esc(c.country) : ""}</div>
          <span class="t-cause">✕ ${esc(cap(c.cause))}</span>${c.line ? `<p>${esc(c.line)}</p>` : ""}<small>${esc(cap(c.niche))} · click to open the report →</small>`;
      }
      tip.classList.toggle("on", !!hovered);
    }
    if (hovered) {
      const x = Math.min(mx + 18, innerWidth - 290), y = Math.min(my + 18, innerHeight - tip.offsetHeight - 12);
      tip.style.transform = `translate(${x}px, ${y}px)`;
    }

    // render (with glow at night on desktop)
    if (composer && night > 0.25) { bloom.strength = 0.55 * night * (1 - dawn * 0.55); composer.render(); }
    else renderer.render(scene, camera);

    // heartbeat line: across the tombstone by day, flattening into the horizon at dusk
    const stoneY = tmpA.set(0, 1.2 + hero.position.y, 0).project(camera);
    const horizon = tmpB.set(camera.position.x, 0, camera.position.z - 300).project(camera);
    const toY = (v) => ((1 - v.y) / 2) * innerHeight;
    const sink = smooth(0.1, 0.28, p);
    const lineY = THREE.MathUtils.lerp(toY(stoneY), toY(horizon), sink);
    pulse.flat = p > 0.884 && p < 0.932;
    pulse.rest = p < 0.6 ? 64 : p < 0.93 ? THREE.MathUtils.lerp(70, 30, smooth(0.65, 0.88, p)) : 72;
    if (p < 0.5) pulse.draw(dt, lineY, 46 * (1 - sink), 1 - smooth(0.18, 0.26, p), NARROW() ? 0 : innerWidth * 0.47);
    else if (p < 0.932) pulse.draw(dt, innerHeight * 0.88, 34, smooth(0.64, 0.7, p) * (1 - smooth(0.915, 0.93, p)) * 0.8, 0, "214, 52, 36");
    else pulse.draw(dt, innerHeight * 0.3, 40, smooth(0.935, 0.945, p) * (1 - smooth(0.952, 0.968, p)), 0, "47, 205, 120");   // back to life, in green — then it makes way for the words

    updatePanels();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight; camera.fov = NARROW() ? 50 : 35; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    if (composer) composer.setSize(innerWidth, innerHeight);
    buildCurves();
  });
}
