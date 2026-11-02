// ink.js — a soft, broad orange glow that follows the mouse, like ink seen through frosted glass.
// It looks the same everywhere (over the glass cards and the open background): one smooth, wide,
// blurred trail with no sharp core, no breaks and no splatter.
// Off on touch screens and for people who prefer reduced motion.
(() => {
  if (matchMedia("(pointer: coarse)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const COLOUR = "#EE6A43"; // premortem red-orange, a touch lighter (as seen through frost)
  const LIFE = 1000;        // how long the trail lasts (ms)
  const WIDTH = 30;         // trail width at the cursor (px) — broad
  const FOLLOW = 0.3;       // how quickly the glow catches up with the mouse (0–1)
  const STEP = 3;           // spacing between trail points (px) — small = smooth

  // One canvas, softened by CSS (blur + transparency) so the trail looks frosted everywhere.
  // It sits above the page but below the side panel, and never blocks clicks.
  const canvas = document.createElement("canvas");
  canvas.id = "ink";
  canvas.style.cssText = "position:fixed;inset:0;z-index:9;pointer-events:none;filter:blur(18px);opacity:.42;mix-blend-mode:multiply";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let w = 0, h = 0;
  const resize = () => { w = innerWidth; h = innerHeight; canvas.width = w; canvas.height = h; };
  resize();
  addEventListener("resize", resize);

  const mouse = { x: 0, y: 0 };
  let head = null;   // where the glow currently is
  const trail = [];  // { x, y, t }
  let running = false;

  addEventListener("mousemove", (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (!head) head = { x: mouse.x, y: mouse.y };
    if (!running) { running = true; requestAnimationFrame(frame); }
  }, { passive: true });
  document.addEventListener("mouseleave", () => { head = null; });

  function frame(now) {
    // Glide towards the mouse and lay down evenly spaced points (so there are never gaps).
    if (head) {
      const tx = head.x + (mouse.x - head.x) * FOLLOW;
      const ty = head.y + (mouse.y - head.y) * FOLLOW;
      const last = trail[trail.length - 1] || { x: head.x, y: head.y };
      const n = Math.floor(Math.hypot(tx - last.x, ty - last.y) / STEP);
      for (let i = 1; i <= n; i++) trail.push({ x: last.x + ((tx - last.x) * i) / n, y: last.y + ((ty - last.y) * i) / n, t: now });
      head.x = tx; head.y = ty;
    }
    while (trail.length && now - trail[0].t > LIFE) trail.shift();

    // Draw the trail in solid colour (so overlaps never show joints), tapering at the tail.
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = COLOUR;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      const life = 1 - (now - b.t) / LIFE; // 1 at the cursor, 0 at the tail
      ctx.lineWidth = Math.max(0.1, WIDTH * Math.pow(life, 0.85));
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    const settled = !head || Math.hypot(mouse.x - head.x, mouse.y - head.y) < 0.5;
    if (trail.length || !settled) requestAnimationFrame(frame);
    else running = false;
  }
})();
