// newsroom.js — the live loading screen, set in the same night graveyard as graveyard.html.
// While your premortem runs:
//   1. the REAL headlines we're reading drift out of the fog towards you and light up as they're read,
//   2. every company we find drops in as a blank stone,
//   3. once checked, the ones that shut down are engraved and glow red; survivors glow green;
//      names we couldn't confirm sink back into the ground.
// A heartbeat line runs along the horizon and beats faster each time something new arrives.
// Everything shown comes from the research itself (GET /status → feed). Nothing is made up.

import * as THREE from "three";

const TOUCH = matchMedia("(pointer: coarse)").matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => 1 - Math.pow(1 - t, 3);
const key = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const same = (a, b) => { const x = key(a), y = key(b); return x && y && (x === y || (x.length > 3 && y.length > 3 && (x.includes(y) || y.includes(x)))); };
let seed = 11; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export function startNewsroom({ idea = "" } = {}) {
  // ---------- stage ----------
  const host = document.createElement("div");
  host.className = "night-stage";
  host.innerHTML = `<canvas class="night-3d"></canvas><canvas class="night-pulse"></canvas><div class="night-fade"></div>`;
  document.body.appendChild(host);
  const [cv3d, cvPulse] = host.querySelectorAll("canvas");

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv3d, antialias: true }); } catch { host.remove(); return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;

  const NIGHT = new THREE.Color("#0a090c");
  const scene = new THREE.Scene();
  scene.background = NIGHT;
  scene.fog = new THREE.Fog(NIGHT, 6, 46);
  const camera = new THREE.PerspectiveCamera(innerWidth < 760 ? 58 : 42, innerWidth / innerHeight, 0.1, 300);

  scene.add(new THREE.HemisphereLight("#7f8fc0", "#1a1214", 0.55));
  const moon = new THREE.DirectionalLight("#9fb2e6", 0.7); moon.position.set(-10, 12, -20); scene.add(moon);
  const lamp = new THREE.PointLight("#ffa45c", 9, 0, 2); lamp.position.set(0, 2.4, -5); scene.add(lamp);

  // ---------- textures made in code ----------
  const radial = (inner, outer, size = 128) => {
    const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d");
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const softDot = radial("rgba(255,255,255,1)", "rgba(255,255,255,0)");

  // ---------- ground, sky, embers ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: "#17141a", roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -40; scene.add(ground);
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial("rgba(255,248,235,1)", "rgba(255,248,235,0)"), fog: false, depthWrite: false }));
  moonSprite.position.set(-40, 30, -130); moonSprite.scale.set(5, 5, 1); scene.add(moonSprite);
  const starPos = [];
  for (let i = 0; i < 400; i++) { const a = rand() * Math.PI - Math.PI, e = 0.1 + rand() * 0.9, r = 150; starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r - 30); }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#dfe6ff", size: 0.6, map: softDot, transparent: true, opacity: 0.8, fog: false, depthWrite: false })));
  const EMB = TOUCH ? 50 : 110, embGeo = new THREE.BufferGeometry(), embBase = [];
  for (let i = 0; i < EMB; i++) embBase.push({ x: (rand() - 0.5) * 22, y: rand() * 4, z: 4 - rand() * 30, s: 0.3 + rand() * 0.8, p: rand() * 6.3 });
  embGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(EMB * 3), 3));
  scene.add(new THREE.Points(embGeo, new THREE.PointsMaterial({ color: "#ffb070", size: 0.07, map: softDot, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })));

  // ---------- your idea, glowing in the middle until the first headlines arrive ----------
  let ideaSlip = makeIdea(idea);
  ideaSlip.position.set(0, 3.3, -6); scene.add(ideaSlip);
  // canvas text needs the web font: redraw the idea once Manrope has loaded
  document.fonts.load("700 40px Manrope").then(() => {
    const fresh = makeIdea(idea);
    ideaSlip.material.map = fresh.userData.tex; ideaSlip.material.needsUpdate = true;
  }).catch(() => {});

  // ---------- headline slips (real article titles) ----------
  // Each headline is a dark glass card that flies straight at you along its own line of sight,
  // spreading outward as it comes (like light streaking past). Lanes are spread evenly
  // left · centre · right, so the whole sky is used. Cards flash brighter as they're "read".
  const SLIPS = TOUCH ? 7 : 12, slips = [];
  const LANES = [-0.92, 0.55, -0.4, 0.92, 0, -0.68, 0.32, 0.72, -0.15, 0.15, -0.85, 0.85];
  let titles = [], titleAt = 0, laneAt = 0;
  function makeSlip(text) {
    const W = 1024, H = 210, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    const glass = x.createLinearGradient(0, 0, 0, H);
    glass.addColorStop(0, "rgba(38, 30, 30, 0.94)"); glass.addColorStop(1, "rgba(18, 15, 17, 0.94)");
    x.fillStyle = glass; roundRect(x, 4, 4, W - 8, H - 8, 30); x.fill();
    x.strokeStyle = "rgba(255, 150, 100, 0.45)"; x.lineWidth = 3; roundRect(x, 4, 4, W - 8, H - 8, 30); x.stroke();
    const bar = x.createLinearGradient(0, 0, 0, H); bar.addColorStop(0, "#F7A86E"); bar.addColorStop(1, "#E4502F");
    x.fillStyle = bar; roundRect(x, 26, 34, 8, H - 68, 4); x.fill();
    x.fillStyle = "#FF9A6E"; x.font = '600 24px "JetBrains Mono"'; x.textBaseline = "alphabetic"; x.fillText("IN THE NEWS", 62, 58);
    x.fillStyle = "#F4F1EA"; x.textBaseline = "middle";
    let size = 46; x.font = `700 ${size}px Manrope`;
    let lines = wrap(x, text, W - 110);
    while (lines.length > 2 && size > 32) { size -= 3; x.font = `700 ${size}px Manrope`; lines = wrap(x, text, W - 110); }
    const shown = lines.slice(0, 2); if (lines.length > 2) shown[1] = shown[1].replace(/\s*\S*$/, "") + "…";
    shown.forEach((l, i) => x.fillText(l, 62, 128 + (i - (shown.length - 1) / 2) * size * 1.15));
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2 * (H / W)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(6.2, 2.4, 1); halo.position.z = -0.05; m.add(halo);
    m.userData = { tex, halo };
    return m;
  }
  const haloTex = radial("rgba(255,120,60,.55)", "rgba(255,90,40,0)");
  function wrap(x, text, max) {
    const out = [""];
    for (const w of String(text).split(/\s+/)) { const t = (out[out.length - 1] + " " + w).trim(); if (x.measureText(t).width > max && out[out.length - 1]) out.push(w); else out[out.length - 1] = t; }
    return out;
  }
  function roundRect(x, l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }
  function nextTitle() { const t = titles[titleAt % titles.length]; titleAt++; return t; }
  const FAR = 46;
  function launchSlip(slip, spread) {
    if (slip) { scene.remove(slip); slip.geometry.dispose(); slip.material.dispose(); slip.userData.tex.dispose(); slip.userData.halo.material.dispose(); } // recycle
    const s = makeSlip(nextTitle());
    const lane = LANES[laneAt++ % LANES.length];
    Object.assign(s.userData, {
      u: clamp(lane + (rand() - 0.5) * 0.14, -0.95, 0.95),   // left ↔ right across the view
      v: -0.32 + rand() * 0.82,                                // how high (below and above the horizon)
      d: spread ? 12 + rand() * (FAR - 12) : FAR,              // distance from the camera
      speed: 5.5 + rand() * 3, tilt: (rand() - 0.5) * 0.16, ph: rand() * 6.3,
    });
    scene.add(s); return s;
  }

  // your idea glows in the sky (just words, no box) until the first headlines arrive
  function makeIdea(text) {
    const W = 1400, H = 260, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = "#FF9A6E"; x.font = '600 28px "JetBrains Mono"'; x.fillText("Y O U R   I D E A", W / 2, 46);
    let size = 76; x.font = `800 ${size}px Manrope`;
    const t = `“${text.length > 64 ? text.slice(0, 62).trim() + "…" : text}”`;
    while (x.measureText(t).width > W - 80 && size > 40) { size -= 4; x.font = `800 ${size}px Manrope`; }
    x.shadowColor = "rgba(255,140,90,.6)"; x.shadowBlur = 30; x.fillStyle = "#F4F1EA"; x.fillText(t, W / 2, 150);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(11, 11 * (H / W)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    m.userData = { tex };
    return m;
  }

  // ---------- stones (one per company found) ----------
  const archShape = (w, h) => { const s = new THREE.Shape(), r = w / 2; s.moveTo(-r, 0); s.lineTo(-r, h); s.absarc(0, h, r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0); return s; };
  const stoneGeo = new THREE.ExtrudeGeometry(archShape(1.0, 0.75), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 2, curveSegments: 14 });
  stoneGeo.translate(0, 0, -0.1);
  const stoneMat = new THREE.MeshStandardMaterial({ color: "#5d5852", roughness: 0.92 });
  const glowRed = radial("rgba(255,90,54,.9)", "rgba(255,60,30,0)"), glowGreen = radial("rgba(90,230,150,.85)", "rgba(40,200,120,0)");
  const stones = [];
  function engrave(name, verdict) {
    const S = 256, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
    x.textAlign = "center"; x.textBaseline = "middle";
    const carve = (t, y, font, col = "#e6dfd3") => { x.font = font; x.fillStyle = "rgba(0,0,0,.55)"; x.fillText(t, S / 2, y - 1.5); x.fillStyle = col; x.fillText(t, S / 2, y); };
    let size = 40; const n = name.toUpperCase();
    do { x.font = `800 ${size}px Manrope`; size -= 2; } while (x.measureText(n).width > 210 && size > 16);
    carve(n, verdict ? 96 : 120, `800 ${size + 2}px Manrope`);
    if (verdict === "dead") carve("✕  SHUT DOWN", 150, '600 20px "JetBrains Mono"', "#ffb39a");
    if (verdict === "alive") carve("●  STILL RUNNING", 150, '600 20px "JetBrains Mono"', "#a8f0c6");
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function addStone(name) {
    const i = stones.length, perRow = TOUCH ? 4 : 8, row = Math.floor(i / perRow), col = i % perRow;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(stoneGeo, stoneMat));
    const tex = engrave(name);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86),
      new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: "#ffffff", emissiveIntensity: 0, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    face.position.set(0, 0.62, 0.14); g.add(face);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowRed, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(2, 1.2, 1); glow.position.set(0, 0.35, 0.3); g.add(glow);
    const spread = TOUCH ? 1.7 : 1.75;
    g.position.set((col - (perRow - 1) / 2) * spread + (row % 2) * 0.5 + (rand() - 0.5) * 0.3, -1.6, -6 - row * 2.2 + (rand() - 0.5) * 0.4);
    g.rotation.set((rand() - 0.5) * 0.06, (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.08);
    g.scale.setScalar(1.2);
    g.userData = { name, face, glow, born: clock.elapsedTime + i * 0.12, verdict: null, judgedAt: 0, lit: 0 };
    scene.add(g); stones.push(g);
  }

  // ---------- heartbeat along the horizon ----------
  const pctx = cvPulse.getContext("2d");
  let PW = 0, PH = 0, vals = [], head = 0, phase = 0, bpm = 66, flat = 0;
  const STEP = 2, SPEED = 300;
  const gs = (x, m, s, a) => a * Math.exp(-((x - m) ** 2) / (2 * s * s));
  const wave = (f) => gs(f, .12, .025, .12) + gs(f, .215, .008, -.16) + gs(f, .24, .011, 1) + gs(f, .268, .011, -.34) + gs(f, .47, .045, .24);
  const sizePulse = () => { const d = Math.min(devicePixelRatio, 2); PW = innerWidth; PH = innerHeight; cvPulse.width = PW * d; cvPulse.height = PH * d; pctx.setTransform(d, 0, 0, d, 0, 0); vals = new Array(Math.ceil(PW / STEP) + 1).fill(null); head = 0; };
  sizePulse();
  function drawPulse(dt, y) {
    bpm += (66 - bpm) * Math.min(1, dt * 0.35);
    const n = vals.length, steps = Math.max(1, Math.round((SPEED * dt) / STEP));
    for (let k = 0; k < steps; k++) {
      phase += (bpm / 60) * (STEP / SPEED); head = (head + 1) % n;
      vals[head] = wave(phase % 1) * (1 - flat);
      for (let g = 1; g <= 14; g++) vals[(head + g) % n] = null;
    }
    pctx.clearRect(0, 0, PW, PH);
    for (const pass of [{ w: 7, a: 0.12 }, { w: 2, a: 0.9 }]) {
      pctx.lineWidth = pass.w; pctx.lineCap = "round";
      for (let i = 1; i < n; i++) {
        const a = vals[i - 1], b = vals[i]; if (a === null || b === null || i - 1 === head) continue;
        const age = ((head - i + n) % n) / n;
        pctx.strokeStyle = `rgba(228, 80, 47, ${(1 - age * 0.92) * pass.a})`;
        pctx.beginPath(); pctx.moveTo((i - 1) * STEP, y - a * 34); pctx.lineTo(i * STEP, y - b * 34); pctx.stroke();
      }
    }
    const hx = head * STEP, hy = y - (vals[head] || 0) * 34, glow = pctx.createRadialGradient(hx, hy, 0, hx, hy, 16);
    glow.addColorStop(0, "rgba(255,190,150,1)"); glow.addColorStop(0.3, "rgba(228,80,47,.5)"); glow.addColorStop(1, "rgba(228,80,47,0)");
    pctx.fillStyle = glow; pctx.beginPath(); pctx.arc(hx, hy, 16, 0, Math.PI * 2); pctx.fill();
  }
  const quicken = () => { bpm = Math.min(150, bpm + 12); };

  // ---------- feed from the server ----------
  let finished = 0, gotNames = false, gotVerdicts = false;
  function feed(f) {
    if (!f) return;
    if (f.titles && f.titles.length && !titles.length) {
      titles = f.titles.slice();
      for (let i = 0; i < SLIPS; i++) slips.push(launchSlip(null, true));
      quicken();
    }
    if (f.names && !gotNames) { gotNames = true; f.names.slice(0, TOUCH ? 16 : 40).forEach(addStone); quicken(); }
    if ((f.dead || f.alive) && !gotVerdicts) {
      gotVerdicts = true; quicken();
      stones.forEach((s, i) => {
        const v = (f.dead || []).some((n) => same(n, s.userData.name)) ? "dead" : (f.alive || []).some((n) => same(n, s.userData.name)) ? "alive" : "gone";
        s.userData.verdict = v; s.userData.judgedAt = clock.elapsedTime + i * 0.09;
      });
    }
  }

  // ---------- every frame ----------
  const clock = new THREE.Clock(), tmp = new THREE.Vector3();
  let running = true, mouseX = 0;
  const onMove = (e) => { mouseX = (e.clientX / innerWidth) * 2 - 1; };
  addEventListener("pointermove", onMove, { passive: true });
  function frame() {
    if (!running) return;
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;

    // camera: a slow drift forward and a gentle sway; pushes in when we're done
    const push = finished ? ease(clamp((t - finished) / 1.3)) : 0;
    camera.position.set(Math.sin(t * 0.15) * 0.6 + mouseX * 0.4, 3.6 - push * 1.2, 9 - push * 6);
    camera.lookAt(0, 0.7, -10);

    // the idea slip glows until headlines arrive, then floats away
    const ideaOut = titles.length ? clamp(ideaSlip.userData.out = (ideaSlip.userData.out || 0) + dt * 0.5) : 0;
    ideaSlip.material.opacity = clamp(t / 1.2) * (1 - ideaOut);
    ideaSlip.position.y = 3.3 + Math.sin(t * 1.3) * 0.08 + ideaOut * 2.5;
    ideaSlip.scale.setScalar(1 + ideaOut * 0.4);

    // headlines fly at you along their own line of sight, spreading outward, flashing as they're read
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    for (let i = 0; i < slips.length; i++) {
      const sl = slips[i], u = sl.userData;
      u.d -= u.speed * dt * (0.55 + 0.45 * (u.d / FAR)); // a touch faster far away, slowing as it nears
      const near = 1 - u.d / FAR, halfH = u.d * halfTan, halfW = halfH * camera.aspect;
      const spreadOut = 1 + near * near * 0.55;          // drifts outward as it comes closer
      sl.position.set(camera.position.x + u.u * halfW * 0.86 * spreadOut, camera.position.y - halfH * 0.12 + u.v * halfH * 0.8 * (1 + near * near * 0.25), camera.position.z - u.d);
      sl.quaternion.copy(camera.quaternion);
      sl.rotateZ(u.tilt + Math.sin(t * 0.7 + u.ph) * 0.03);
      const fadeIn = clamp((FAR - u.d) / 7), fadeOut = clamp((u.d - 3.2) / 3.5);
      const read = Math.exp(-((u.d - 11) ** 2) / 10);    // brightest when it passes the reading point
      sl.material.opacity = (0.55 + 0.45 * read) * fadeIn * fadeOut * (gotVerdicts ? 0.55 : 1);
      u.halo.material.opacity = (0.1 + 0.6 * read) * fadeIn * fadeOut * (gotVerdicts ? 0.4 : 1);
      if (u.d < 3.2) slips[i] = launchSlip(sl, false);
    }

    // stones rise in, then show their verdict
    for (const s of stones) {
      const u = s.userData, born = ease(clamp((t - u.born) / 0.7));
      let y = THREE.MathUtils.lerp(-1.6, -0.03, born);
      if (u.verdict && t > u.judgedAt) {
        const k = clamp((t - u.judgedAt) / 0.6);
        if (u.verdict === "gone") y = THREE.MathUtils.lerp(-0.03, -1.7, ease(k));          // not confirmed: sinks away
        else if (!u.engraved) {                                                            // engrave the verdict once
          u.engraved = true;
          const tex = engrave(u.name, u.verdict);
          u.face.material.map = tex; u.face.material.emissiveMap = tex; u.face.material.needsUpdate = true;
          u.face.material.emissive.set(u.verdict === "dead" ? "#ff5a36" : "#4fe39a");
          u.glow.material.map = u.verdict === "dead" ? glowRed : glowGreen; u.glow.material.needsUpdate = true;
        }
        if (u.verdict !== "gone") u.lit = Math.min(1, u.lit + dt * 1.6);
      }
      s.position.y = y;
      const throb = 0.85 + Math.sin(t * 3 + s.position.x) * 0.15;
      u.face.material.emissiveIntensity = u.lit * (u.verdict === "dead" ? 1.5 : 1.1) * throb;
      u.glow.material.opacity = u.lit * 0.5 * throb;
    }

    // embers
    const ep = embGeo.attributes.position;
    embBase.forEach((e, i) => ep.setXYZ(i, e.x + Math.sin(t * 0.6 * e.s + e.p) * 0.4, ((e.y + t * 0.15 * e.s) % 4.5) + 0.1, e.z));
    ep.needsUpdate = true;
    lamp.position.x = Math.sin(t * 0.5) * 2.5;
    lamp.intensity = 9 * (0.93 + Math.sin(t * 11) * 0.04 + Math.sin(t * 6.7) * 0.03);

    renderer.render(scene, camera);
    const horizon = tmp.set(camera.position.x, 0, camera.position.z - 250).project(camera);
    flat = finished ? clamp((t - finished) / 0.8) : 0;
    drawPulse(dt, ((1 - horizon.y) / 2) * innerHeight - 6);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight; camera.fov = innerWidth < 760 ? 58 : 42; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); sizePulse();
  };
  addEventListener("resize", onResize);

  return {
    feed,
    beat: quicken,
    // the research is done: one last push forward and a fade to cream, then the results take over
    finish() { if (!finished) { finished = clock.elapsedTime; quicken(); host.classList.add("done"); } },
    stop() {
      running = false; removeEventListener("pointermove", onMove); removeEventListener("resize", onResize);
      renderer.dispose(); host.remove();
    },
  };
}
