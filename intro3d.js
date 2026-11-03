/* ============================================================================
   intro3d.js — "Molecular Self-Assembly" intro (2D canvas, ~4.4s)
   1. Coloured molecules drift in Brownian motion.
   2. They self-assemble into the name, sweeping left → right.
   3. A light sweep passes over it; the roles fade in.
   4. Hand-off: the molecules fly into the hero card's real <h1> while the
      overlay fades, so the intro lands exactly where the page begins.
   Time-based (same speed on any device). Plays once ('centri_done');
   ?intro replays. Reduced-motion users skip it (see INTRO_MODE in index.html).
   ========================================================================== */

(function introAssembly() {
  if (window.INTRO_MODE !== "3d") return;

  const KEY = "centri_done";
  const overlay = document.getElementById("centrifuge-overlay");
  if (!overlay) return;
  const skipBtn = document.getElementById("centri-skip");
  const oldLog = document.getElementById("centri-log");
  if (oldLog) oldLog.style.display = "none";

  overlay.style.display = "block";
  // Follows the site theme (set in <head> before this runs): OLED Black or Lab Paper.
  const LIGHT = document.documentElement.getAttribute("data-theme") === "light";
  const BG = LIGHT ? [[236, 241, 249], [243, 246, 251]] : [[10, 12, 18], [0, 0, 0]]; // centre, edge
  overlay.style.background = "rgb(" + BG[1] + ")"; // solid until the first frame; then the canvas paints (and fades) it
  document.body.style.overflow = "hidden";

  const canvas = document.getElementById("centrifuge-canvas") || overlay.appendChild(document.createElement("canvas"));
  canvas.id = "intro3d-canvas";
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
  const ctx = canvas.getContext("2d");

  const NAME = "SITESH KUMAR DASH";
  const ROLES = "BIOCHEMIST · MOLECULAR BIOLOGIST · SCIENCE COMMUNICATOR";
  const COLS = LIGHT ? ["#0f9d4a", "#0088a8", "#7a3ee0", "#c4610a", "#d12a5c"] : ["#39ff14", "#00e5ff", "#b44dff", "#ff9f43", "#ff3366"];
  const SETTLED = LIGHT ? "#1d2b45" : "#dfe8f5", HOT = LIGHT ? "#0f9d4a" : "#8dffa8";
  const ROLES_COL = LIGHT ? "#66738c" : "#8a909c";
  const NAME_FONT = '800 100px Syne, "Arial Black", sans-serif';

  // Timeline (seconds)
  const T_ASSEMBLE = 0.5, T_SWEEP = 2.5, T_ROLES = 2.8, T_HAND = 3.35, T_END = 4.4;

  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  const ease = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const lerp = (a, b, k) => a + (b - a) * k;

  let W = 0, H = 0, DPR = 1, gap = 4;
  let parts = [];
  let startTs = 0, rafId = 0, done = false;

  function size() {
    W = innerWidth; H = innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // Rasterise text offscreen and return every `gap`-th filled pixel.
  function sample(drawText) {
    const off = document.createElement("canvas");
    off.width = Math.ceil(W); off.height = Math.ceil(H);
    const o = off.getContext("2d");
    o.fillStyle = "#fff"; o.textBaseline = "middle";
    drawText(o);
    const img = o.getImageData(0, 0, off.width, off.height).data;
    const pts = [];
    for (let y = 0; y < off.height; y += gap)
      for (let x = 0; x < off.width; x += gap)
        if (img[(y * off.width + x) * 4 + 3] > 130) pts.push([x, y]);
    return pts;
  }

  // Intro layout: one line on wide screens, stacked words on phones.
  function introTargets() {
    const lines = W < 700 ? NAME.split(" ") : [NAME];
    const m = document.createElement("canvas").getContext("2d");
    m.font = NAME_FONT;
    const widest = Math.max(...lines.map((l) => m.measureText(l).width));
    const s = Math.min(W < 700 ? 110 : 76, (100 * W * (W < 700 ? 0.8 : 0.84)) / widest);
    const lh = s * 1.02, top = H * 0.45 - ((lines.length - 1) * lh) / 2;
    const pts = sample((o) => {
      o.font = NAME_FONT.replace("100px", s.toFixed(1) + "px");
      o.textAlign = "center";
      lines.forEach((l, i) => o.fillText(l, W / 2, top + i * lh));
    });
    return { pts, rolesY: top + (lines.length - 1) * lh + s * 0.95 };
  }

  // Hand-off layout: the real hero <h1>, word by word at its on-screen spot.
  function heroTargets() {
    const h1 = document.querySelector(".mol-core .glitch-name");
    const node = h1 && h1.firstChild;
    if (!node || node.nodeType !== 3) return null;
    const cs = getComputedStyle(h1);
    const words = [];
    const re = /\S+/g; let mt;
    while ((mt = re.exec(node.data))) {
      const r = document.createRange();
      r.setStart(node, mt.index); r.setEnd(node, mt.index + mt[0].length);
      const b = r.getBoundingClientRect();
      if (b.width) words.push({ w: mt[0], x: b.left + b.width / 2, y: b.top + b.height / 2 });
    }
    if (!words.length || words[0].y < 0 || words[words.length - 1].y > H) return null;
    return sample((o) => {
      o.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      if ("letterSpacing" in o) o.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
      o.textAlign = "center";
      words.forEach((wd) => o.fillText(wd.w, wd.x, wd.y));
    });
  }

  let rolesY = 0, heroPts = null, heroTried = false;

  function build() {
    gap = Math.max(3, Math.round(Math.min(W, 1600) / 300));
    const t = introTargets();
    rolesY = t.rolesY;
    parts = t.pts.map(([tx, ty]) => ({
      tx, ty, hx: tx, hy: ty,
      sx: Math.random() * W, sy: Math.random() * H, ph: Math.random() * 6.283,
      delay: Math.random() * 0.35 + (tx / W) * 0.55,
      hd: Math.random() * 0.15,                    // stagger for the hand-off flight
      c: (Math.random() * COLS.length) | 0,
    }));
    heroPts = null; heroTried = false;
  }

  function assignHero() {
    heroTried = true;
    heroPts = heroTargets();
    if (!heroPts || !heroPts.length) return;
    // left-to-right order on both sides keeps the flight paths short
    const src = parts.slice().sort((a, b) => a.tx - b.tx);
    const dst = heroPts.slice().sort((a, b) => a[0] - b[0]);
    src.forEach((p, i) => { const d = dst[Math.floor((i * dst.length) / src.length)]; p.hx = d[0]; p.hy = d[1]; });
  }

  function render(t) {
    // Backdrop: fades out a beat after the flight starts, so the molecules are
    // already converging on the hero when the page appears behind them.
    const bgA = 1 - ease((t - T_HAND - 0.2) / 0.7);
    ctx.clearRect(0, 0, W, H);
    if (bgA > 0) {
      const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(" + BG[0] + "," + bgA + ")");
      g.addColorStop(1, "rgba(" + BG[1] + "," + bgA + ")");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    if (t >= T_HAND - 0.05 && !heroTried) assignHero();
    const hand = heroPts ? ease((t - T_HAND) / 0.7) : 0;
    // Molecules land (~4.05s) then dissolve into the real <h1> beneath them
    const fadeOut = 1 - clamp01((t - (T_END - 0.4)) / 0.4);
    const sz = Math.max(1.5, gap * 0.72) * lerp(1, 0.8, hand);
    const sweep = ((t - T_SWEEP) / 1.0) * (W + 200) - 100;

    const groups = COLS.map(() => []), settled = [], hot = [];
    for (const p of parts) {
      const k = ease((t - T_ASSEMBLE - p.delay) / 1.25);
      const wob = (1 - k) * 7;
      let x = lerp(p.sx + Math.sin(t * 1.7 + p.ph) * wob, p.tx, k);
      let y = lerp(p.sy + Math.cos(t * 1.3 + p.ph) * wob, p.ty, k);
      if (hand > 0) {
        const hk = ease((t - T_HAND - p.hd) / 0.55);
        x = lerp(x, p.hx, hk); y = lerp(y, p.hy, hk);
      }
      p.x = x; p.y = y;
      if (k < 0.97) groups[p.c].push(p);
      else if (Math.abs(x - sweep) < 55 && hand === 0) hot.push(p);
      else settled.push(p);
    }

    ctx.globalAlpha = Math.min(1, t / 0.35) * fadeOut;
    groups.forEach((g, i) => {
      ctx.fillStyle = COLS[i];
      ctx.globalAlpha = 0.8 * Math.min(1, t / 0.35) * fadeOut;
      for (const p of g) ctx.fillRect(p.x, p.y, sz, sz);
    });
    ctx.globalAlpha = fadeOut;
    ctx.fillStyle = SETTLED; for (const p of settled) ctx.fillRect(p.x, p.y, sz, sz);
    ctx.fillStyle = HOT; for (const p of hot) ctx.fillRect(p.x - 0.5, p.y - 0.5, sz + 1, sz + 1);

    // Roles line under the name; leaves before the hand-off flight
    const ra = ease((t - T_ROLES) / 0.7) * (1 - ease((t - T_HAND) / 0.35));
    if (ra > 0) {
      const fs = Math.max(9, Math.min(W * 0.012, 13));
      ctx.globalAlpha = ra;
      ctx.font = "500 " + fs + 'px "JetBrains Mono", monospace';
      if ("letterSpacing" in ctx) ctx.letterSpacing = (fs * 0.16).toFixed(1) + "px";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = ROLES_COL;
      if (W < 700) ROLES.split(" · ").forEach((r, i) => ctx.fillText(r, W / 2, rolesY + i * fs * 1.7));
      else ctx.fillText(ROLES, W / 2, rolesY);
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    if (done) return;
    if (!startTs) { startTs = now; overlay.style.background = "transparent"; }
    const t = (now - startTs) / 1000;
    render(Math.min(t, T_END));
    if (t >= T_END) { finish(); return; }
    rafId = requestAnimationFrame(frame);
  }

  function onResize() {
    // Rebuild layout; a resize mid-intro restarts the assembly cleanly.
    size(); build();
  }

  function finishNow() {
    try { localStorage.setItem(KEY, "1"); } catch (e) {}
    document.body.style.overflow = "";
  }
  function cleanup() {
    window.removeEventListener("resize", onResize);
    overlay.style.display = "none";
    overlay.style.opacity = ""; overlay.style.transition = ""; overlay.style.background = "";
    ctx.clearRect(0, 0, W, H);
  }
  // Natural end: the backdrop has already faded, so just remove the overlay.
  function finish() {
    if (done) return; done = true;
    cancelAnimationFrame(rafId);
    finishNow();
    cleanup();
  }
  // Skip: quick crossfade from wherever the intro is.
  function dismiss() {
    if (done) return; done = true;
    cancelAnimationFrame(rafId);
    finishNow();
    overlay.style.transition = "opacity 0.35s ease";
    overlay.style.opacity = "0";
    setTimeout(cleanup, 380);
  }

  if (skipBtn) skipBtn.addEventListener("click", dismiss);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") dismiss(); });
  window.addEventListener("resize", onResize, { passive: true });
  setTimeout(() => { if (!done) dismiss(); }, 9000); // safety net

  size();
  // Wait for the display font (max 1.2s) so the name is sampled in Syne.
  const fontReady = document.fonts && document.fonts.load
    ? Promise.race([document.fonts.load(NAME_FONT), new Promise((r) => setTimeout(r, 1200))])
    : Promise.resolve();
  fontReady.then(() => {
    if (done) return;
    build();
    rafId = requestAnimationFrame(frame);
  });
})();
