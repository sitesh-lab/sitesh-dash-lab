/* ============================================================================
   intro3d.js — "Assemble → Twist → Replication-fork open" DNA intro (2D canvas)
   1. Two long open strands (an unzipped ladder) appear.
   2. Sitesh's sections fly in from the sides and INTEGRATE at different regions.
   3. The two strands TWIST into a double helix.
   4. A helicase opens it at a replication FORK (top-down), revealing the portfolio.
   Theme-coloured throughout. Auto-plays once ('centri_done'); ?intro replays.
   ========================================================================== */

(function introDNA() {
  if (window.INTRO_MODE !== "3d") return;

  const KEY = "centri_done";
  const overlay = document.getElementById("centrifuge-overlay");
  if (!overlay) return;
  const skipBtn = document.getElementById("centri-skip");
  const oldCanvas = document.getElementById("centrifuge-canvas");
  const oldLog = document.getElementById("centri-log");
  if (oldLog) oldLog.style.display = "none";

  overlay.style.display = "block";
  overlay.style.background = "radial-gradient(ellipse at 50% 45%, #0e0a24 0%, #08061a 52%, #03020c 100%)";
  document.body.style.overflow = "hidden";

  let W = innerWidth, H = innerHeight;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const PAIRS = [
    ["#00e5ff", "#ff9f43"], ["#39ff14", "#b44dff"], ["#ff3366", "#ffd54f"],
    ["#00e5ff", "#39ff14"], ["#b44dff", "#ff9f43"], ["#ffd54f", "#00e5ff"],
  ];
  const POINTS = [
    "MOLECULAR BIOLOGIST", "BIOCHEMIST", "SCIENCE COMMUNICATOR",
    "SCIENCE PROGRAMMING ASSOCIATE", "CSIR NET JRF · AIR 153", "REMAC-PET",
    "FAST-PETase N233K", "GENOMICS · WET-LAB", "BIOREMEDIATION",
    "EPIGENETICS · BDNF", "VISITOR COGNITION", "PROGRAMMING PoC",
  ];
  const NSEC = POINTS.length;
  // Released-molecule palette — matches the site's background reaction colours
  // (NEON, PURPLE, CYAN, ORANGE, MAGENTA, PINK, GOLD) for a seamless hand-off.
  const MOL_COLS = ["#39ff14", "#b44dff", "#00e5ff", "#ff9f43", "#e040fb", "#ff3366", "#ffd54f"];

  const canvas = (oldCanvas && oldCanvas.getContext) ? oldCanvas : document.createElement("canvas");
  if (canvas !== oldCanvas) overlay.insertBefore(canvas, overlay.firstChild);
  canvas.id = "intro3d-canvas";
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
  const ctx = canvas.getContext("2d");
  function size() {
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  size();

  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const hexA = (h, a) => "rgba(" + parseInt(h.slice(1, 3), 16) + "," + parseInt(h.slice(3, 5), 16) + "," + parseInt(h.slice(5, 7), 16) + "," + a + ")";
  // shade between a dark (back) and light (front) hex by f, at alpha
  const shade = (cb, cf, f, al) => {
    const A = parseInt(cb.slice(1), 16), B = parseInt(cf.slice(1), 16);
    const r = (A >> 16) + (((B >> 16) - (A >> 16)) * f);
    const g = ((A >> 8) & 255) + ((((B >> 8) & 255) - ((A >> 8) & 255)) * f);
    const b = (A & 255) + (((B & 255) - (A & 255)) * f);
    return "rgba(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + "," + al + ")";
  };

  const DUST = [];
  for (let i = 0; i < 60; i++) DUST.push({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.5, sp: 0.15 + Math.random() * 0.4, ph: Math.random() * 6.28, col: PAIRS[i % PAIRS.length][i % 2] });

  const PROD = [];
  const MOLS = []; // molecules/reactions released when the DNA tears, drifting into the background

  /* ── flash ─────────────────────────────────────────────────────────────── */
  const flash = document.createElement("div");
  flash.id = "intro-flash";
  overlay.appendChild(flash);

  const DURATION = 8000;
  let startTs = null, rafId = 0, done = false, holdTimer = null;

  function render(p, tSec) {
    ctx.clearRect(0, 0, W, H);
    const assemble = smooth(clamp01(p / 0.1));
    const twist = smooth(clamp01((p - 0.48) / 0.18));      // ladder → double helix
    const unzip = clamp01((p - 0.66) / 0.26);              // replication fork, top→bottom
    const gA = assemble;                                    // scene fades via overlay crossfade

    // geometry — long DNA (more turns), antiparallel two-tone strands
    const cx = W / 2, yTop = H * 0.08, yBot = H * 0.92;
    const A = Math.min(W * 0.16, 222);
    const TURNS = 5;
    const OFF = 2.3;                                        // strand phase offset → unequal (major/minor) grooves
    const rot = twist * (tSec * 1.15);                     // starts spinning once twisted

    function posAt(t) {
      const y = yTop + t * (yBot - yTop);
      const a = t * TURNS * Math.PI * 2 + rot;
      const sA = (1 - twist) + twist * Math.sin(a);
      const sB = -(1 - twist) + twist * Math.sin(a + OFF); // offset strand → grooves
      let peel = 0;
      if (unzip > 0) { const d = unzip - t; peel = d > 0 ? smooth(d / 0.12) : 0; }
      const spread = peel * A * (1.2 + Math.max(0, unzip - t) * 5.5);
      return {
        y, a, peel,
        xA: cx + sA * A + spread, xB: cx + sB * A - spread,
        dA: twist * Math.cos(a), dB: twist * Math.cos(a + OFF),
      };
    }

    // ── drifting motes ──
    for (const d of DUST) {
      let yy = (d.y - tSec * d.sp * 0.02) % 1; if (yy < 0) yy += 1;
      const a = (0.1 + 0.14 * Math.sin(tSec * 1.6 + d.ph)) * gA;
      if (a > 0.01) { ctx.fillStyle = hexA(d.col, a); ctx.beginPath(); ctx.arc(d.x * W, yy * H, d.r, 0, 6.2832); ctx.fill(); }
    }

    // ── released molecules drifting in the background (from the DNA tear) ──
    function drawMol(m) {
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.rot);
      const a = m.life * 0.44 * gA; // fades slowly (slow decay) → gently transparent
      ctx.strokeStyle = hexA(m.col, a); ctx.fillStyle = hexA(m.col, a * 0.6);
      ctx.lineWidth = 1.6; ctx.shadowColor = m.col; ctx.shadowBlur = 6 * m.life;
      if (m.kind === 0) { // hexagon (ring compound)
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const an = i / 6 * 6.283, r = m.sz; i ? ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r) : ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.stroke();
      } else if (m.kind === 1) { // nucleotide dumbbell
        ctx.beginPath(); ctx.moveTo(-m.sz, 0); ctx.lineTo(m.sz, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(-m.sz, 0, 2.4, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.arc(m.sz, 0, 2.4, 0, 6.283); ctx.fill();
      } else { // enzyme ring + active dot
        ctx.beginPath(); ctx.arc(0, 0, m.sz * 0.7, 0, 6.283); ctx.stroke();
        ctx.beginPath(); ctx.arc(m.sz * 0.7, 0, 2, 0, 6.283); ctx.fill();
      }
      ctx.shadowBlur = 0; ctx.restore();
    }
    for (let i = MOLS.length - 1; i >= 0; i--) {
      const m = MOLS[i];
      m.x += m.vx * 0.016; m.y += m.vy * 0.016; m.rot += m.vr * 0.016; m.life -= m.decay;
      if (m.life <= 0) { MOLS.splice(i, 1); continue; }
      drawMol(m);
    }

    // sample backbone
    const SAMP = 84;
    const pts = [];
    for (let j = 0; j <= SAMP; j++) pts.push(posAt(j / SAMP));

    // per-sample ribbon normals + width (width pinches where the ribbon turns edge-on)
    const RW = Math.min(W * 0.011, 12);
    function normalsFor(getX) {
      const arr = [];
      for (let j = 0; j <= SAMP; j++) {
        const jp = Math.max(0, j - 1), jn = Math.min(SAMP, j + 1);
        const dx = getX(jn) - getX(jp), dy = pts[jn].y - pts[jp].y;
        const L = Math.hypot(dx, dy) || 1;
        const tw = (1 - twist) + twist * Math.abs(Math.cos(pts[j].a));
        arr.push({ nx: -dy / L, ny: dx / L, hw: RW * (0.22 + 0.78 * tw) });
      }
      return arr;
    }
    const NA = normalsFor((j) => pts[j].xA), NB = normalsFor((j) => pts[j].xB);
    // antiparallel two-tone strands (like the textbook figure): green + gold
    const CY = ["#0c451a", "#84ff8c"], GR = ["#5a3a08", "#ffce6b"]; // [back, front] ribbon shades
    function ribbonSeg(j, getX, N, depth, cb, cf) {
      const f = (depth + 1) / 2;
      const x0 = getX(j), y0 = pts[j].y, x1 = getX(j + 1), y1 = pts[j + 1].y;
      const n0 = N[j], n1 = N[j + 1];
      const ax0 = x0 + n0.nx * n0.hw, ay0 = y0 + n0.ny * n0.hw, bx0 = x0 - n0.nx * n0.hw, by0 = y0 - n0.ny * n0.hw;
      const ax1 = x1 + n1.nx * n1.hw, ay1 = y1 + n1.ny * n1.hw, bx1 = x1 - n1.nx * n1.hw, by1 = y1 - n1.ny * n1.hw;
      ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.lineTo(ax1, ay1); ctx.lineTo(bx1, by1); ctx.lineTo(bx0, by0); ctx.closePath();
      ctx.fillStyle = shade(cb, cf, f, gA); ctx.fill();
      ctx.strokeStyle = hexA("#071018", 0.5 * gA); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.lineTo(ax1, ay1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(bx1, by1); ctx.stroke();
    }
    // back ribbon halves (depth < 0)
    for (let j = 0; j < SAMP; j++) {
      const dA = (pts[j].dA + pts[j + 1].dA) / 2, dB = (pts[j].dB + pts[j + 1].dB) / 2;
      if (dA < 0) ribbonSeg(j, (x) => pts[x].xA, NA, dA, CY[0], CY[1]);
      if (dB < 0) ribbonSeg(j, (x) => pts[x].xB, NB, dB, GR[0], GR[1]);
    }

    // ── base pairs: dense ladder (like the textbook). 1 in every `secEvery` is
    //    a SECTION (labelled + flies in from the side); the rest are filler bp. ──
    const NBP = 42, secEvery = 3;
    const fontPx = Math.max(11, Math.min(19, W * 0.013));
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let k = 0; k < NBP; k++) {
      const isSec = (k % secEvery === 1);
      const secIdx = (k - 1) / secEvery;
      if (isSec && secIdx >= NSEC) continue; // only NSEC labelled sections
      const t = (k + 0.5) / NBP, P = posAt(t);
      if (P.peel > 0.45) continue; // base pairs broken open past the fork
      const integStart = 0.05 + (k / NBP) * 0.36;
      const integ = smooth(clamp01((p - integStart) / 0.08));
      if (integ <= 0.001) continue;
      const pair = isSec ? PAIRS[secIdx % PAIRS.length] : PAIRS[k % PAIRS.length];
      const face = (1 - twist) + twist * Math.abs(Math.sin(P.a));
      const side = (k % 2 ? 1 : -1);
      const slideX = isSec ? (1 - integ) * side * W * 0.5 : 0; // sections fly in; filler fades in place
      const ia = integ, thick = isSec ? 1 : 0.5;
      const xA = P.xA + slideX, xB = P.xB + slideX, mx = (xA + xB) / 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = hexA("#0b1226", (0.4 + 0.5 * face) * gA * ia);
      ctx.lineWidth = 9 * thick * (0.5 + 0.7 * face);
      ctx.beginPath(); ctx.moveTo(xA, P.y); ctx.lineTo(xB, P.y); ctx.stroke();
      ctx.lineWidth = 6 * thick * (0.5 + 0.7 * face);
      ctx.shadowBlur = (isSec ? 9 : 3) * face; ctx.shadowColor = pair[0];
      ctx.strokeStyle = hexA(pair[0], (0.4 + 0.6 * face) * gA * ia);
      ctx.beginPath(); ctx.moveTo(xA, P.y); ctx.lineTo(mx, P.y); ctx.stroke();
      ctx.shadowColor = pair[1]; ctx.strokeStyle = hexA(pair[1], (0.4 + 0.6 * face) * gA * ia);
      ctx.beginPath(); ctx.moveTo(mx, P.y); ctx.lineTo(xB, P.y); ctx.stroke();
      ctx.shadowBlur = 0;
      // label (sections only)
      if (isSec) {
        // labels read during integration, then fade out as the helix folds → clean folded DNA
        const labelFade = 1 - smooth(clamp01((twist - 0.05) / 0.3));
        const la = ia * labelFade * gA;
        if (la > 0.04) {
          const lbl = POINTS[secIdx];
          ctx.font = `600 ${fontPx}px "JetBrains Mono", ui-monospace, monospace`;
          const tw = ctx.measureText(lbl).width;
          ctx.fillStyle = hexA("#04030c", 0.6 * la);
          ctx.fillRect(mx - tw / 2 - 8, P.y - fontPx * 0.95, tw + 16, fontPx * 1.9);
          ctx.fillStyle = hexA(pair[0], la); ctx.shadowColor = pair[0]; ctx.shadowBlur = 12 * la;
          ctx.fillText(lbl, mx, P.y); ctx.shadowBlur = 0;
        }
      }
    }

    // front ribbon halves (depth >= 0)
    for (let j = 0; j < SAMP; j++) {
      const dA = (pts[j].dA + pts[j + 1].dA) / 2, dB = (pts[j].dB + pts[j + 1].dB) / 2;
      if (dA >= 0) ribbonSeg(j, (x) => pts[x].xA, NA, dA, CY[0], CY[1]);
      if (dB >= 0) ribbonSeg(j, (x) => pts[x].xB, NB, dB, GR[0], GR[1]);
    }

    // ── helicase enzyme opening the replication fork ──
    if (unzip > 0.01 && unzip < 0.999) {
      const F = posAt(unzip);
      const fx = cx, fy = F.y, R = A * 0.32, pulse = 0.5 + 0.5 * Math.sin(tSec * 6);
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, R * 1.7);
      g.addColorStop(0, hexA("#eafffb", 0.85 * gA)); g.addColorStop(0.4, hexA("#39ff14", 0.45 * gA)); g.addColorStop(1, hexA("#39ff14", 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, R * 1.7, 0, 6.2832); ctx.fill();
      [[-1, "#00e5ff"], [1, "#b44dff"]].forEach(([s, col]) => {
        ctx.fillStyle = hexA(col, 0.85 * gA); ctx.shadowColor = col; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(fx + R * 0.5 * s, fy, R * (0.62 + 0.08 * pulse), 0, 6.2832); ctx.fill();
      });
      ctx.shadowBlur = 0;
      ctx.fillStyle = hexA("#ffffff", 0.95 * gA); ctx.beginPath(); ctx.arc(fx, fy, R * 0.3, 0, 6.2832); ctx.fill();
      if (PROD.length < 90) for (let m = 0; m < 2; m++) PROD.push({ x: fx, y: fy, vx: (Math.random() - 0.5) * 50, vy: 20 + Math.random() * 40, life: 1, col: PAIRS[(Math.random() * PAIRS.length) | 0][0] });
      // release molecules/reactions that drift WIDE into the background, matching
      // the site's reaction colours, fading slowly → seamless hand-off to the portfolio bg
      if (MOLS.length < 64) for (let s = 0; s < 2; s++) {
        const ang = Math.random() * 6.283, spd = 45 + Math.random() * 120;
        MOLS.push({ x: fx, y: fy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, rot: Math.random() * 6.283, vr: (Math.random() - 0.5) * 2.2, life: 1, decay: 0.0022 + Math.random() * 0.003, kind: (Math.random() * 3) | 0, col: MOL_COLS[(Math.random() * MOL_COLS.length) | 0], sz: 6 + Math.random() * 10 });
      }
    }
    // products
    for (let i = PROD.length - 1; i >= 0; i--) {
      const q = PROD[i];
      q.x += q.vx * 0.016; q.y += q.vy * 0.016; q.vy += 6 * 0.016; q.life -= 0.02;
      if (q.life <= 0) { PROD.splice(i, 1); continue; }
      ctx.fillStyle = hexA(q.col, q.life * 0.8 * gA);
      ctx.beginPath(); ctx.arc(q.x, q.y, 1.6 + q.life * 1.3, 0, 6.2832); ctx.fill();
    }

    // slow crossfade: as the fork opens (top→down) the whole scene fades,
    // revealing the portfolio behind — no hard flash.
    overlay.style.opacity = String(1 - smooth(clamp01((p - 0.8) / 0.2)));
  }

  function frame(now) {
    if (done) return;
    if (startTs === null) startTs = now;
    const tSec = (now - startTs) / 1000;
    const p = clamp01((now - startTs) / DURATION);
    render(p, tSec);
    if (p >= 1 && !holdTimer) holdTimer = setTimeout(dismiss, 120);
    rafId = requestAnimationFrame(frame);
  }

  function onResize() { size(); }
  window.addEventListener("resize", onResize, { passive: true });
  function cleanup() { try { if (canvas !== oldCanvas) canvas.remove(); flash.remove(); } catch (e) {} }
  function finishNow() { localStorage.setItem(KEY, "1"); document.body.style.overflow = ""; }
  function dismiss() {
    if (done) return; done = true;
    cancelAnimationFrame(rafId); if (holdTimer) clearTimeout(holdTimer);
    window.removeEventListener("resize", onResize);
    finishNow();
    overlay.style.transition = "opacity 0.6s ease";
    overlay.style.opacity = "0";
    if (skipBtn) skipBtn.style.opacity = "0";
    setTimeout(() => { overlay.style.display = "none"; overlay.style.opacity = ""; overlay.style.transition = ""; cleanup(); }, 650);
  }
  if (skipBtn) skipBtn.addEventListener("click", dismiss);
  setTimeout(() => { if (!done) dismiss(); }, DURATION + 5000);
  rafId = requestAnimationFrame(frame);
})();
