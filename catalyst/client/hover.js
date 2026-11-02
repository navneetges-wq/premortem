// hover.js — buttons swell, lean towards the cursor (magnetic) and carry a light spot that follows the mouse;
// cards tilt slightly towards the cursor and lift, with a soft coloured light under the mouse.
// Off on touch screens and for people who prefer reduced motion.
(() => {
  if (matchMedia("(pointer: coarse)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const BUTTONS = ".btn, .nav-cta, .filters button, .q-buttons button, .chip, .open-btn";
  const CARDS = ".card-co, .feature, .tile";
  const PANELS = ".engine"; // the dark "How a premortem works" panel: a light that follows the cursor across it
  let active = null, frame = 0, lastEvent = null;

  const reset = (el) => {
    el.classList.remove("is-hot");
    for (const v of ["--tx", "--ty", "--rx", "--ry"]) el.style.removeProperty(v);
  };

  const update = () => {
    frame = 0;
    const e = lastEvent;
    // the panel light follows the cursor anywhere inside the panel
    const panel = e && e.target instanceof Element ? e.target.closest(PANELS) : null;
    document.querySelectorAll(`${PANELS}.is-lit`).forEach((p) => { if (p !== panel) p.classList.remove("is-lit"); });
    if (panel) {
      const pr = panel.getBoundingClientRect();
      panel.style.setProperty("--px", `${e.clientX - pr.left}px`);
      panel.style.setProperty("--py", `${e.clientY - pr.top}px`);
      panel.classList.add("is-lit");
    }

    const el = e && e.target instanceof Element ? e.target.closest(`${BUTTONS}, ${CARDS}`) : null;
    if (active && active !== el) { reset(active); active = null; }
    if (!el || el.disabled) return;
    active = el;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;          // cursor inside the element
    const dx = x / r.width - 0.5, dy = y / r.height - 0.5;        // -0.5 … 0.5 from the centre
    el.style.setProperty("--mx", `${x}px`);
    el.style.setProperty("--my", `${y}px`);
    if (el.matches(BUTTONS)) {                                    // magnetic lean towards the cursor
      el.style.setProperty("--tx", `${dx * 10}px`);
      el.style.setProperty("--ty", `${dy * 8}px`);
    } else {                                                      // cards: gentle tilt + a subtle drift towards the cursor
      el.style.setProperty("--rx", `${(-dy * 5).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(dx * 6).toFixed(2)}deg`);
      el.style.setProperty("--tx", `${(dx * 8).toFixed(1)}px`);
      el.style.setProperty("--ty", `${(dy * 6).toFixed(1)}px`);
    }
    el.classList.add("is-hot");
  };

  addEventListener("pointermove", (e) => { lastEvent = e; if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
  document.addEventListener("pointerleave", () => { if (active) reset(active); active = null; document.querySelectorAll(".is-lit").forEach((p) => p.classList.remove("is-lit")); });
  addEventListener("scroll", () => { if (active) { reset(active); active = null; } }, { passive: true });
})();
