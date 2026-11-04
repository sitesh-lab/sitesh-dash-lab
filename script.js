(function () {
  "use strict";

  const NEON = "#39ff14";
  const PURPLE = "#b44dff";
  const CYAN = "#00e5ff";
  const ORANGE = "#ff9f43";

  const MODAL_COLORS = {
    core: NEON,
    about: CYAN,
    research: NEON,
    experience: ORANGE,
    education: "#1D9E75",
    skills: PURPLE,
    ambition: PURPLE,
    achieve: NEON,
    life: ORANGE,
    contact: CYAN
  };

  const B_DNA = { bpPerTurn: 10.5, handedness: 1 };

  const BOND_STYLES = {
    covalent: { stroke: NEON, width: 2, dash: "" },
    double: { stroke: NEON, width: 2.5, dash: "", double: true },
    hydrogen: { stroke: CYAN, width: 1, dash: "5 4" },
    ionic: { stroke: PURPLE, width: 1.8, dash: "2 4" },
    peptide: { stroke: ORANGE, width: 2, dash: "6 3 2 3" },
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Perf: hex parsing is cached — these run hundreds of times per frame.
  const _rgbCache = new Map();
  function hexRgb(hex) {
    let c = _rgbCache.get(hex);
    if (!c) {
      c = parseInt(hex.slice(1, 3), 16) + "," + parseInt(hex.slice(3, 5), 16) + "," + parseInt(hex.slice(5, 7), 16);
      _rgbCache.set(hex, c);
    }
    return c;
  }

  function hexAlpha(hex, a) {
    return "rgba(" + hexRgb(hex) + "," + a + ")";
  }

  // Perf: glows are pre-rendered once per colour and stamped with drawImage.
  // Building a new radial gradient for every glow every frame was the single
  // biggest cost of the background canvas.
  const _glowCache = new Map();
  function glowSprite(color) {
    let s = _glowCache.get(color);
    if (!s) {
      if (_glowCache.size > 96) _glowCache.clear();
      s = document.createElement("canvas");
      s.width = s.height = 64;
      const c = s.getContext("2d");
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, hexAlpha(color, 1));
      g.addColorStop(1, hexAlpha(color, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
      _glowCache.set(color, s);
    }
    return s;
  }

  function drawGlow(ctx, x, y, r, color, alpha) {
    // Quantise blended colours so the sprite cache stays small.
    const q = (n) => Math.min(255, Math.round(parseInt(color.slice(n, n + 2), 16) / 24) * 24).toString(16).padStart(2, "0");
    const key = color.length === 7 ? "#" + q(1) + q(3) + q(5) : color;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(glowSprite(key), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  /* ─── Background biochemistry field ─── */
  const bgCanvas = document.getElementById("dna-bg");
  const bgCtx = bgCanvas ? bgCanvas.getContext("2d", { alpha: true }) : null;
  let bw = 0,
    bh = 0,
    bgT = 0;
  let floaters = [];
  let reactions = [];
  // Mobile: fewer animated elements + pause the background while scrolling (it's
  // a fixed decorative layer, so pausing its repaint removes scroll jank).
  const IS_MOBILE = (window.matchMedia && matchMedia("(max-width: 768px)").matches) || ("ontouchstart" in window);
  let _bgScrollT = 0, _scrollClsT = 0;
  document.addEventListener("scroll", () => {
    _bgScrollT = performance.now();
    // Flag scrolling so CSS pauses animations for a jank-free scroll.
    if (!document.body.classList.contains("is-scrolling")) document.body.classList.add("is-scrolling");
    clearTimeout(_scrollClsT);
    _scrollClsT = setTimeout(() => document.body.classList.remove("is-scrolling"), 120);
  }, { passive: true, capture: true });

  const MAGENTA = "#e040fb";
  const PINK = "#ff3366";
  const GOLD = "#ffd54f";

  const AMINO = ["Gly", "Ala", "Leu", "Ser", "Val", "Phe", "Trp", "His", "Lys", "Asp", "Gln", "Cys"];
  const MOL_TYPES = [
    { kind: "amino", names: AMINO },
    { kind: "hexose", names: ["Glc", "Fru", "Gal", "Man"] },
    { kind: "benzene", names: ["Benzene", "Phe-ring"] },
    { kind: "atp", names: ["ATP", "ADP", "AMP", "GTP"] },
    { kind: "coenzyme", names: ["NAD+", "NADH", "FAD", "CoA", "NADP+"] },
    { kind: "peptide", names: ["Ala-Gly", "Leu-Ser", "Gly-Pro", "Met-Enk"] },
    { kind: "lipid", names: ["Palmitate", "Oleate", "PC"] },
    { kind: "base", names: ["A", "T", "G", "C", "U"] },
  ];

  const RXN_TEMPLATES = [
    { r1: "Glc", r2: "ATP", p: "G6P + ADP", label: "Hexokinase", c1: NEON, c2: ORANGE, flash: CYAN, cp: PURPLE },
    { r1: "Ala", r2: "Gly", p: "Dipeptide", label: "Peptide bond", c1: NEON, c2: CYAN, flash: MAGENTA, cp: PURPLE },
    { r1: "NAD+", r2: "Lactate", p: "NADH + Pyruvate", label: "LDH", c1: PURPLE, c2: PINK, flash: GOLD, cp: NEON },
    { r1: "G6P", r2: "NADP+", p: "6-PG + NADPH", label: "PPP", c1: CYAN, c2: PURPLE, flash: NEON, cp: CYAN },
    { r1: "Pyruvate", r2: "CoA", p: "Acetyl-CoA", label: "PDH", c1: ORANGE, c2: NEON, flash: PINK, cp: GOLD },
    { r1: "O₂", r2: "e⁻", p: "H₂O", label: "ETC", c1: CYAN, c2: NEON, flash: PURPLE, cp: CYAN },
    { r1: "Palmitate", r2: "CoA", p: "Acyl-CoA", label: "β-oxidation", c1: GOLD, c2: ORANGE, flash: NEON, cp: PURPLE },
    { r1: "A + T", r2: "G + C", p: "dsDNA", label: "Base pairing", c1: NEON, c2: PURPLE, flash: CYAN, cp: MAGENTA },
    { r1: "mRNA", r2: "Ribosome", p: "Polypeptide", label: "Translation", c1: CYAN, c2: PURPLE, flash: NEON, cp: ORANGE },
    { r1: "H₂O₂", r2: "GSH", p: "GSSG + H₂O", label: "Antioxidant", c1: PINK, c2: NEON, flash: GOLD, cp: CYAN },
    { r1: "CO₂", r2: "RuBP", p: "3-PGA", label: "Calvin cycle", c1: CYAN, c2: NEON, flash: PURPLE, cp: NEON },
    { r1: "cAMP", r2: "PKA", p: "Phospho-protein", label: "Signalling", c1: MAGENTA, c2: PURPLE, flash: PINK, cp: CYAN },
    { r1: "THP-1", r2: "LV-PETase", p: "Remac-PET", label: "Remac-PET", c1: NEON, c2: PURPLE, flash: CYAN, cp: MAGENTA },
    { r1: "Nanoplastic", r2: "PETase", p: "Monomers", label: "Bioremediation", c1: ORANGE, c2: NEON, flash: PURPLE, cp: CYAN },
    { r1: "DNA template", r2: "dNTPs", p: "Amplicon", label: "PCR", c1: CYAN, c2: NEON, flash: MAGENTA, cp: PURPLE },
    { r1: "mRNA", r2: "RTase", p: "cDNA", label: "RT-PCR", c1: PURPLE, c2: CYAN, flash: NEON, cp: PINK },
    { r1: "Protein", r2: "SDS", p: "Bands", label: "SDS-PAGE", c1: NEON, c2: GOLD, flash: CYAN, cp: PURPLE },
    { r1: "Query", r2: "BLAST", p: "Hit", label: "Bioinformatics", c1: CYAN, c2: PURPLE, flash: NEON, cp: CYAN },
    { r1: "Visitor", r2: "ParSEC", p: "Literacy", label: "Facilitation", c1: MAGENTA, c2: NEON, flash: GOLD, cp: CYAN },
    { r1: "BDNF promoter", r2: "ROS", p: "Hypermethyl", label: "Epigenetics", c1: PINK, c2: PURPLE, flash: NEON, cp: GOLD },
    { r1: "Macrophage", r2: "Plastic", p: "Phagosome", label: "Remac-PET", c1: NEON, c2: ORANGE, flash: CYAN, cp: PURPLE },
  ];

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function initFloaters() {
    floaters = window._bgFloaters = [];
    const count = Math.min(16, Math.floor((bw * bh) / 95000) + 8);
    for (let i = 0; i < count; i++) {
      const t = pick(MOL_TYPES);
      const palette = [NEON, PURPLE, CYAN, ORANGE, MAGENTA, PINK, GOLD];
      floaters.push({
        kind: t.kind,
        name: pick(t.names),
        x: Math.random() * bw,
        y: Math.random() * bh,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.24,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.005,
        size: 16 + Math.random() * 12,
        color: pick(palette),
        alpha: 0.14 + Math.random() * 0.12,
        pulse: Math.random() * Math.PI * 2,
      });
    }
    reactions = [];
    // More reactions, sampled across ALL templates for colour variety, spread
    // over the whole background in a grid.
    if (USE_NETWORK) initNetwork();
    const rc = Math.min(IS_MOBILE ? 6 : USE_NETWORK ? 8 : 12, RXN_TEMPLATES.length);
    const cols = bw > 900 ? 4 : IS_MOBILE ? 2 : 3, rows = Math.ceil(rc / cols);
    for (let i = 0; i < rc; i++) {
      const rxn = RXN_TEMPLATES[Math.floor((i * RXN_TEMPLATES.length) / rc)];
      const col = i % cols, row = Math.floor(i / cols);
      reactions.push({
        x: bw * ((col + 0.5) / cols) + (Math.random() - 0.5) * bw * 0.12,
        y: bh * ((row + 0.5) / rows) + (Math.random() - 0.5) * bh * 0.1,
        phase: (i / rc) + Math.random() * 0.3,
        rxn,
        dur: 4 + (i % 5) + Math.random() * 3,
      });
    }
  }

  let burstReactions = [];

  function spawnBurst(x, y, rxn) {
    if (burstReactions.length > 6) return;
    burstReactions.push({ x, y, rxn: rxn || pick(RXN_TEMPLATES), t0: bgT, dur: 3.5 });
  }

  function drawHexRing(ctx, x, y, r, color, al) {
    ctx.strokeStyle = hexAlpha(color, al);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawAminoBackbone(ctx, x, y, s, color, al, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = hexAlpha(color, al);
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.lineTo(0, 0);
    ctx.lineTo(s * 0.6, -s * 0.35);
    ctx.stroke();
    [[-s, 0], [0, 0], [s * 0.6, -s * 0.35]].forEach(([px, py]) => {
      ctx.fillStyle = hexAlpha(color, al * 0.85);
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawFloater(ctx, f) {
    const al = f.alpha;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    if (f.kind === "amino" || f.kind === "peptide") {
      drawAminoBackbone(ctx, 0, 0, f.size * 0.35, f.color, al, 0);
    } else if (f.kind === "hexose") {
      drawHexRing(ctx, 0, 0, f.size * 0.32, f.color, al);
    } else if (f.kind === "benzene") {
      drawHexRing(ctx, 0, 0, f.size * 0.28, PURPLE, al);
    } else if (f.kind === "atp") {
      drawHexRing(ctx, -f.size * 0.15, 0, f.size * 0.2, CYAN, al * 0.7);
      ctx.fillStyle = hexAlpha(ORANGE, al);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(f.size * 0.1 + i * 5, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (f.kind === "coenzyme") {
      ctx.strokeStyle = hexAlpha(PURPLE, al);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-f.size * 0.3, 0);
      ctx.lineTo(f.size * 0.3, 0);
      ctx.stroke();
      ctx.fillStyle = hexAlpha(NEON, al);
      ctx.beginPath();
      ctx.arc(-f.size * 0.3, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexAlpha(CYAN, al);
      ctx.beginPath();
      ctx.arc(f.size * 0.3, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.kind === "lipid") {
      ctx.strokeStyle = hexAlpha(GOLD, al);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-f.size * 0.35, 0);
      ctx.lineTo(f.size * 0.35, 0);
      for (let i = -2; i <= 2; i++) {
        ctx.moveTo(i * 4, 0);
        ctx.lineTo(i * 4 + 2, -5);
      }
      ctx.stroke();
    } else if (f.kind === "base") {
      ctx.fillStyle = hexAlpha(f.color, al);
      ctx.beginPath();
      ctx.arc(0, 0, f.size * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    const pulseAl = al * (0.85 + Math.sin(f.pulse + bgT * 0.002) * 0.15);
    ctx.font = `600 ${Math.max(8, f.size * 0.4)}px JetBrains Mono`;
    ctx.textAlign = "center";
    ctx.fillStyle = hexAlpha("#eef2ff", pulseAl * 1.5);
    ctx.fillText(f.name, 0, f.size * 0.55);
    ctx.restore();
  }

  function lerpHex(c1, c2, t) {
    const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const a = p(c1);
    const b = p(c2);
    const m = (i) => Math.round(a[i] + (b[i] - a[i]) * t);
    return `#${m(0).toString(16).padStart(2, "0")}${m(1).toString(16).padStart(2, "0")}${m(2).toString(16).padStart(2, "0")}`;
  }

  function drawReaction(ctx, r, fixedP) {
    if (reducedMotion) return;
    const p = fixedP != null ? fixedP : ((bgT * 0.001 + r.phase) % r.dur) / r.dur;
    const al = 0.18;
    const cx = r.x;
    const cy = r.y;
    const { c1, c2, flash, cp } = r.rxn;

    if (p < 0.32) {
      const q = p / 0.32;
      const ax = cx - 32 + q * 16;
      const bx = cx + 32 - q * 16;
      const blend = lerpHex(c1, c2, q * 0.5);
      drawGlow(ctx, ax, cy, 14, c1, al * 1.2);
      drawGlow(ctx, bx, cy, 14, c2, al * 1.2);
      ctx.fillStyle = hexAlpha(c1, al * 1.4);
      ctx.font = "600 9px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText(r.rxn.r1, ax, cy + 3);
      ctx.fillStyle = hexAlpha(c2, al * 1.4);
      ctx.fillText(r.rxn.r2, bx, cy + 3);
      ctx.strokeStyle = hexAlpha(blend, al * 0.6 * q);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(ax, cy);
      ctx.lineTo(bx, cy);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (p < 0.48) {
      const q = (p - 0.32) / 0.16;
      const flashCol = lerpHex(flash, MAGENTA, Math.sin(q * Math.PI));
      drawGlow(ctx, cx, cy, 20 + q * 14, flashCol, al * 2);
      drawGlow(ctx, cx, cy, 10 + q * 6, lerpHex(c1, cp, q), al * 1.5);
      ctx.fillStyle = hexAlpha(flashCol, al * 2);
      ctx.font = "600 10px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText("⚡", cx, cy + 3);
    } else {
      const q = (p - 0.48) / 0.52;
      const prodCol = lerpHex(cp, flash, Math.sin(q * Math.PI * 2) * 0.3 + 0.3);
      drawGlow(ctx, cx, cy, 16, prodCol, al * (1.2 - q * 0.4));
      ctx.fillStyle = hexAlpha(prodCol, al * 1.5 * (1 - q * 0.25));
      ctx.font = "600 9px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText(r.rxn.p, cx, cy + 3);
    }

    ctx.fillStyle = hexAlpha(lerpHex(c1, c2, (Math.sin(bgT * 0.003) + 1) / 2), al * 0.9);
    ctx.font = "500 7px JetBrains Mono";
    ctx.fillText(r.rxn.label, cx, cy - 16);
  }

  function drawFloaterInteractions(ctx) {
    if (reducedMotion) return;
    const threshold = 72;
    for (let i = 0; i < floaters.length; i++) {
      for (let j = i + 1; j < floaters.length; j++) {
        const a = floaters[i];
        const b = floaters[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > threshold || dist < 8) continue;
        const prox = 1 - dist / threshold;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const col = lerpHex(a.color, b.color, 0.5 + Math.sin(bgT * 0.004 + i + j) * 0.5);
        ctx.strokeStyle = hexAlpha(col, prox * 0.22);
        ctx.lineWidth = 1 + prox;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        if (prox > 0.55 && ((i + j + Math.floor(bgT * 0.02)) % 28 === 0)) {
          drawGlow(ctx, mx, my, 10 + prox * 8, col, prox * 0.25);
          ctx.fillStyle = hexAlpha(col, prox * 0.35);
          ctx.font = "500 6px JetBrains Mono";
          ctx.textAlign = "center";
          ctx.fillText("→", mx, my + 2);
          if (prox > 0.72) spawnBurst(mx, my);
        }
      }
    }
  }

  // Adaptive sharpness: the canvases start at the screen's real resolution
  // (capped at 2×; 1.5× on phones; 1.25× on ≤4-core devices) and step down by
  // 0.5× whenever a background frame costs more than ~6ms on average — so on
  // any device smoothness wins over sharpness.
  const DPR_CAP = Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2);
  let canvasDpr = (navigator.hardwareConcurrency || 8) <= 4 ? Math.min(DPR_CAP, 1.25) : DPR_CAP;
  let bgCost = 0, bgSamples = 0;
  function trackBgCost(t0) {
    bgCost = bgCost * 0.9 + (performance.now() - t0) * 0.1;
    if (++bgSamples < 40) return;
    bgSamples = 0;
    if (bgCost > 6 && canvasDpr > 1) {
      canvasDpr = Math.max(1, canvasDpr - 0.5);
      resizeBg(true);
      lastSpineW = 0; // force the spine to re-allocate at the new resolution
      drawSpineHelix();
    }
  }

  function resizeBg(force) {
    if (!bgCanvas || !bgCtx) return;
    const dpr = canvasDpr;
    if (!force && bw === window.innerWidth && bh === window.innerHeight && floaters.length) return;
    // Mobile URL-bar show/hide only changes the height — keep the molecules
    // where they are instead of reshuffling them mid-scroll.
    const reseed = bw !== window.innerWidth || !floaters.length;
    bw = window.innerWidth;
    bh = window.innerHeight;
    bgCanvas.width = bw * dpr;
    bgCanvas.height = bh * dpr;
    bgCanvas.style.width = bw + "px";
    bgCanvas.style.height = bh + "px";
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reseed) initFloaters();
  }

  /* ─── Molecule network (desktop): atoms drift, bond to neighbours and to
     the mouse. Replaces the floaters where there is a mouse; phones keep the
     lighter floaters. Bonds are batched into a few strokes per frame. ─── */
  const USE_NETWORK = !IS_MOBILE && !reducedMotion && window.matchMedia("(pointer: fine)").matches;
  const NET_COLS = [NEON, CYAN, PURPLE, ORANGE, MAGENTA];
  const NET_LINK = 130, NET_MOUSE = 200;
  let netNodes = [];
  let netMx = -9999, netMy = -9999;

  function initNetwork() {
    const n = Math.min(70, Math.round((bw * bh) / 20000));
    netNodes = Array.from({ length: n }, (_, i) => ({
      x: Math.random() * bw,
      y: Math.random() * bh,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: 2 + Math.random() * 1.4,
      color: NET_COLS[i % NET_COLS.length],
      // a few atoms carry a residue name — keeps the biochemistry readable
      name: i % 8 === 0 ? pick(AMINO) : null,
    }));
  }

  if (USE_NETWORK) {
    window.addEventListener("pointermove", (e) => { netMx = e.clientX; netMy = e.clientY; }, { passive: true });
    document.addEventListener("pointerleave", () => { netMx = netMy = -9999; });
  }

  function drawNetwork(ctx, k) {
    const BUCKETS = 4;
    const links = Array.from({ length: BUCKETS }, () => []);
    const mouseLinks = Array.from({ length: BUCKETS }, () => []);

    for (const p of netNodes) {
      p.x += p.vx * k;
      p.y += p.vy * k;
      if (p.x < -20) p.x = bw + 20; else if (p.x > bw + 20) p.x = -20;
      if (p.y < -20) p.y = bh + 20; else if (p.y > bh + 20) p.y = -20;
      const dx = netMx - p.x, dy = netMy - p.y, d = Math.hypot(dx, dy);
      p.near = d < NET_MOUSE ? 1 - d / NET_MOUSE : 0;
      if (p.near) {
        // gentle pull toward the cursor, like a charged probe
        p.x += dx * 0.006 * k;
        p.y += dy * 0.006 * k;
        mouseLinks[Math.min(BUCKETS - 1, (p.near * BUCKETS) | 0)].push(p);
      }
    }

    for (let i = 0; i < netNodes.length; i++) {
      const a = netNodes[i];
      for (let j = i + 1; j < netNodes.length; j++) {
        const b = netNodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        if (dx > NET_LINK || dx < -NET_LINK || dy > NET_LINK || dy < -NET_LINK) continue;
        const d = Math.hypot(dx, dy);
        if (d < NET_LINK) links[Math.min(BUCKETS - 1, ((1 - d / NET_LINK) * BUCKETS) | 0)].push(a, b);
      }
    }

    ctx.lineWidth = 1;
    for (let q = 0; q < BUCKETS; q++) {
      const segs = links[q];
      if (segs.length) {
        ctx.strokeStyle = "rgba(150,190,240," + (0.1 + q * 0.09) + ")";
        ctx.beginPath();
        for (let s = 0; s < segs.length; s += 2) { ctx.moveTo(segs[s].x, segs[s].y); ctx.lineTo(segs[s + 1].x, segs[s + 1].y); }
        ctx.stroke();
      }
      const ms = mouseLinks[q];
      if (ms.length) {
        ctx.strokeStyle = hexAlpha(NEON, 0.22 + q * 0.18);
        ctx.beginPath();
        for (const p of ms) { ctx.moveTo(p.x, p.y); ctx.lineTo(netMx, netMy); }
        ctx.stroke();
      }
    }

    ctx.font = "500 9px JetBrains Mono";
    ctx.textAlign = "center";
    for (const p of netNodes) {
      if (p.near > 0.3) drawGlow(ctx, p.x, p.y, 12 + p.near * 10, p.color, p.near * 0.7);
      ctx.fillStyle = hexAlpha(p.color, 0.75 + p.near * 0.25);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + p.near * 1.2, 0, Math.PI * 2);
      ctx.fill();
      if (p.name) {
        ctx.fillStyle = hexAlpha("#eef2ff", 0.22 + p.near * 0.5);
        ctx.fillText(p.name, p.x, p.y - 7);
      }
    }
  }

  let _bgLast = 0;
  function drawBg(ts) {
    requestAnimationFrame(drawBg);
    // Skip drawing when hidden behind an open panel or when the tab is inactive.
    if (document.hidden || document.body.classList.contains("detail-open")) return;
    // Pause the (fixed) background while scrolling — its repaint fights scroll compositing.
    if (performance.now() - _bgScrollT < (IS_MOBILE ? 260 : 140)) return;
    // ~20fps (every 3rd frame at 60Hz): the molecules drift < 0.5px per frame,
    // so a higher rate costs main-thread time without looking any smoother.
    // The desktop network runs at 30fps so its bonds keep up with the mouse.
    if (ts && ts - _bgLast < (USE_NETWORK ? 30 : 45)) return;
    // Time-based motion: same speed at any frame rate; clamp after a pause.
    const k = _bgLast ? Math.min(ts - _bgLast, 100) / 42 : 1;
    _bgLast = ts || 0;
    if (!bgCtx) return;
    const _t0 = performance.now();
    // Transparent clear: the bioluminescent glow layer sits behind this canvas.
    bgCtx.clearRect(0, 0, bw, bh);

    for (const r of reactions) drawReaction(bgCtx, r);

    burstReactions = burstReactions.filter((b) => bgT - b.t0 < b.dur * 60);
    for (const b of burstReactions) {
      const p = (bgT - b.t0) / (b.dur * 60);
      if (p < 1) drawReaction(bgCtx, { x: b.x, y: b.y, rxn: b.rxn, dur: 1, phase: 0 }, p);
    }

    if (USE_NETWORK) {
      drawNetwork(bgCtx, k);
      if (!reducedMotion) bgT += 42 * k;
      trackBgCost(_t0);
      return;
    }

    drawFloaterInteractions(bgCtx);

    for (const f of floaters) {
      if (!reducedMotion) {
        f.x += f.vx * k;
        f.y += f.vy * k;
        f.rot += f.vr * k;
        f.pulse += 0.018 * k;
        if (f.x < -40) f.x = bw + 40;
        if (f.x > bw + 40) f.x = -40;
        if (f.y < -40) f.y = bh + 40;
        if (f.y > bh + 40) f.y = -40;
      }
      drawFloater(bgCtx, f);
    }

    if (!reducedMotion) bgT += 42 * k;
    trackBgCost(_t0);
  }

  if (bgCanvas && bgCtx) {
    resizeBg();
    drawBg();
    window.addEventListener("resize", resizeBg);
  }

  /* ─── Center beaded DNA (reference-style, theme colours) ─── */
  const spineCanvas = document.getElementById("dna-spine");
  const spineWrap = document.querySelector(".dna-spine");
  const graph = document.querySelector(".mol-graph");
  let spineRot = 0;
  let lastSpineW = 0;
  let lastSpineH = 0;
  const HELIX_ALPHA = 0.52;

  // Perf: each bead (fill + specular) is pre-rendered once per colour and
  // stamped with drawImage — ~600 beads a frame were 1200 path fills.
  const _beadCache = new Map();
  function beadSprite(color) {
    let s = _beadCache.get(color);
    if (!s) {
      s = document.createElement("canvas");
      s.width = s.height = 32;
      const c = s.getContext("2d");
      c.fillStyle = color;
      c.beginPath();
      c.arc(16, 16, 16, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(238,242,255,0.3)";
      c.beginPath();
      c.arc(12, 12, 4.5, 0, Math.PI * 2);
      c.fill();
      _beadCache.set(color, s);
    }
    return s;
  }

  function drawBead(ctx, x, y, r, color, depth) {
    ctx.globalAlpha = (0.55 + depth * 0.35) * HELIX_ALPHA;
    ctx.drawImage(beadSprite(color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  function drawSpineHelix() {
    if (!spineCanvas || !spineWrap || !graph) return;

    const cw = spineWrap.clientWidth || 300;
    const ch = Math.max(graph.clientHeight, graph.offsetHeight, window.innerHeight * 0.72);

    const dpr = canvasDpr; // shares the adaptive resolution with the background
    if (cw !== lastSpineW || ch !== lastSpineH) {
      // Only touch styles when the size really changes: writing height every
      // animation frame invalidated style/layout 25 times a second.
      spineWrap.style.height = ch + "px";
      lastSpineW = cw;
      lastSpineH = ch;
      spineCanvas.width = Math.round(cw * dpr);
      spineCanvas.height = Math.round(ch * dpr);
      spineCanvas.style.width = cw + "px";
      spineCanvas.style.height = ch + "px";
    }

    const ctx = spineCanvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const cx = cw / 2;
    const risePx = Math.max(13, Math.min(17, ch / 62));
    const R = cw * 0.34;
    const bpCount = Math.ceil(ch / risePx) + 8;
    const rot = reducedMotion ? 0.5 : spineRot;
    const beadR = Math.max(3.2, cw * 0.014);

    const glow = ctx.createRadialGradient(cx, ch * 0.45, 0, cx, ch * 0.5, cw * 0.7);
    glow.addColorStop(0, hexAlpha(NEON, 0.06 * HELIX_ALPHA));
    glow.addColorStop(0.5, hexAlpha(PURPLE, 0.04 * HELIX_ALPHA));
    glow.addColorStop(1, hexAlpha(PURPLE, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, cw, ch);

    const strandA = [];
    const strandB = [];
    const rungs = [];

    for (let i = 0; i < bpCount; i++) {
      const y = i * risePx - risePx * 2.5;
      const theta = B_DNA.handedness * i * ((2 * Math.PI) / B_DNA.bpPerTurn) + rot;
      const depth = Math.sin(theta);
      const persp = 0.82 + depth * 0.18;
      const x1 = cx + R * Math.cos(theta) * persp;
      const x2 = cx + R * Math.cos(theta + Math.PI) * persp;
      strandA.push({ x: x1, y, depth, theta });
      strandB.push({ x: x2, y, depth: -depth, theta: theta + Math.PI });
      rungs.push({ a: strandA[i], b: strandB[i], depth });
    }

    const sortedRungs = [...rungs].sort((p, q) => p.depth - q.depth);

    for (const r of sortedRungs) {
      const depth = (r.a.depth + r.b.depth) / 2;
      const al = (0.3 + (depth + 1) * 0.15) * HELIX_ALPHA;
      const len = Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y) || 1;
      const nx = (r.b.x - r.a.x) / len;
      const ny = (r.b.y - r.a.y) / len;
      const inset = beadR * 3.2;
      const ax = r.a.x + nx * inset;
      const ay = r.a.y + ny * inset;
      const bx = r.b.x - nx * inset;
      const by = r.b.y - ny * inset;
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const steps = 2;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const px = ax + (bx - ax) * t;
        const py = ay + (by - ay) * t;
        const col = t < 0.5 ? NEON : PURPLE;
        drawBead(ctx, px, py, beadR * 0.55, col, depth);
      }
      ctx.strokeStyle = hexAlpha(CYAN, al * 0.4);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      drawBead(ctx, mx, my, beadR * 0.45, CYAN, depth);
    }

    function drawBeadedStrand(pts, color) {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        drawBead(ctx, p.x, p.y, beadR + p.depth * 0.8, color, p.depth);
        if (i > 0) {
          const prev = pts[i - 1];
          const depth = (p.depth + prev.depth) / 2;
          const al = (0.25 + (depth + 1) * 0.12) * HELIX_ALPHA;
          ctx.strokeStyle = hexAlpha(color, al);
          ctx.lineWidth = beadR * 0.9;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
      }
    }

    drawBeadedStrand(strandA, NEON);
    drawBeadedStrand(strandB, PURPLE);
  }

  let _spineLast = 0;
  function animateSpine(ts) {
    requestAnimationFrame(animateSpine);
    // Not visible behind an open panel, and paused when the tab is hidden.
    if (document.hidden || document.body.classList.contains("detail-open")) return;
    // Stacked (mobile) layout: the spine canvas spans the whole page (~3500px
    // tall). Re-uploading that 20x a second for a rotation that takes two
    // minutes isn't worth it — it stays as drawn by layout()/resize.
    if (lastSpineH > window.innerHeight * 1.6) return;
    // Hold still while the page scrolls so the compositor only moves pixels.
    if (performance.now() - _bgScrollT < 140) { _spineLast = 0; return; }
    if (ts && ts - _spineLast < 45) return; // ~20fps — the rotation is sub-pixel per frame (see drawBg)
    const k = _spineLast ? Math.min(ts - _spineLast, 100) / 40 : 1;
    _spineLast = ts || 0;
    if (!reducedMotion) spineRot += 0.0022 * k; // k: elapsed time in units of the original 40ms step
    drawSpineHelix();
  }

  if (spineCanvas && spineWrap && graph) {
    drawSpineHelix();
    animateSpine();
    window.addEventListener("resize", drawSpineHelix);
    window.addEventListener("load", () => setTimeout(drawSpineHelix, 150));
  }

  /* ─── Fit molecule outlines ─── */
  function fitOutlines() {
    document.querySelectorAll(".mol-wrap").forEach((wrap) => {
      const inner = wrap.querySelector(".mol-inner");
      const outline = wrap.querySelector(".mol-outline");
      if (!inner || !outline) return;
      const padX = wrap.closest(".mol-contact") ? 34 : wrap.classList.contains("shape-porphyrin") ? 38 : 30;
      const padY = wrap.closest(".mol-contact") ? 30 : wrap.classList.contains("shape-porphyrin") ? 34 : 26;
      outline.style.width = inner.offsetWidth + padX + "px";
      outline.style.height = inner.offsetHeight + padY + "px";
    });
  }

  /* ─── Bond graph ─── */
  const svg = document.querySelector(".mol-bonds");
  const core = document.getElementById("core");
  const contact = document.getElementById("contact");
  const leftNodes = document.querySelectorAll('.mol-node[data-side="left"]');
  const rightNodes = document.querySelectorAll('.mol-node[data-side="right"]');

  function nodeCenter(el, container) {
    const target = el.querySelector(".mol-inner") || el;
    const er = target.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    return {
      x: er.left + er.width / 2 - cr.left,
      y: er.top + er.height / 2 - cr.top,
      hw: er.width / 2,
      hh: er.height / 2,
    };
  }

  // Point where the ray from `from` toward `to` leaves `from`'s card, plus a
  // small gap — bonds meet the card edge instead of running across its text.
  function rectEdge(from, to, gap) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const s = Math.min(dx ? from.hw / Math.abs(dx) : Infinity, dy ? from.hh / Math.abs(dy) : Infinity);
    const d = Math.min(s * len + gap, len / 2);
    return { x: from.x + (dx / len) * d, y: from.y + (dy / len) * d };
  }

  function drawBondLine(x1, y1, x2, y2, type, targetId) {
    const style = BOND_STYLES[type] || BOND_STYLES.covalent;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "bond bond-" + type);
    if (targetId) g.setAttribute("data-target-node", targetId);
    const drawOne = (offset) => {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const ox = (-dy / len) * offset;
      const oy = (dx / len) * offset;
      line.setAttribute("x1", x1 + ox);
      line.setAttribute("y1", y1 + oy);
      line.setAttribute("x2", x2 + ox);
      line.setAttribute("y2", y2 + oy);
      line.setAttribute("stroke", style.stroke);
      line.setAttribute("stroke-width", style.width);
      if (style.dash) line.setAttribute("stroke-dasharray", style.dash);
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("opacity", "0.55");
      g.appendChild(line);
    };
    if (style.double) {
      drawOne(2);
      drawOne(-2);
    } else {
      drawOne(0);
    }
    return g;
  }

  function drawBonds() {
    if (!svg || !graph || !core || window.innerWidth <= 960) {
      if (svg) svg.innerHTML = "";
      return;
    }
    svg.setAttribute("viewBox", `0 0 ${graph.clientWidth} ${graph.clientHeight}`);
    svg.innerHTML = "";
    const c0 = nodeCenter(core, graph);

    leftNodes.forEach((node) => {
      const c1 = nodeCenter(node, graph);
      const type = node.dataset.bond || "covalent";
      const targetId = node.dataset.detail || node.querySelector("[data-detail]")?.dataset.detail;
      const a = rectEdge(c1, c0, 6);
      const b = rectEdge(c0, c1, 6);
      svg.appendChild(drawBondLine(a.x, a.y, b.x, b.y, type, targetId));
    });

    rightNodes.forEach((node) => {
      const c1 = nodeCenter(node, graph);
      const type = node.dataset.bond || "covalent";
      const targetId = node.dataset.detail || node.querySelector("[data-detail]")?.dataset.detail;
      const a = rectEdge(c0, c1, 6);
      const b = rectEdge(c1, c0, 6);
      svg.appendChild(drawBondLine(a.x, a.y, b.x, b.y, type, targetId));
    });

    if (contact) {
      const cc = nodeCenter(contact, graph);
      const targetId = contact.dataset.detail || contact.querySelector("[data-detail]")?.dataset.detail;
      const a = rectEdge(c0, cc, 4);
      const b = rectEdge(cc, c0, 4);
      svg.appendChild(drawBondLine(a.x, a.y, b.x, b.y, contact.dataset.bond || "peptide", targetId));
    }
  }

  function layout() {
    fitOutlines();
    drawBonds();
    drawSpineHelix();
  }

  if (graph) {
    layout();
    const relayout = () => requestAnimationFrame(() => requestAnimationFrame(layout));
    window.addEventListener("resize", relayout);
    window.addEventListener("load", () => setTimeout(relayout, 200));
    // Cards enter with a scale animation — re-measure once it has settled.
    setTimeout(relayout, 1100);
    if (document.fonts?.ready) document.fonts.ready.then(() => setTimeout(relayout, 80));
  }

  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");

  const detailScreen = document.getElementById("detail-screen");
  const detailContent = document.getElementById("detail-content");
  const detailClose = document.querySelector(".detail-close");
  const detailBackdrop = document.querySelector(".detail-backdrop");
  let lastFocusedElement = null;

  let activeAnimation = null;
  let activeCircle = null;
  let clickedNodeRect = null;
  let clickedNodeEl = null;
  let clickAnchor = null;
  let currentModalId = null;

  function molNodeForId(id) {
    return document.querySelector(`.mol-node[data-detail="${id}"]`);
  }

  function anchorFromRect(rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function panelOriginFromScreen(screenX, screenY, panel) {
    const panelRect = panel.getBoundingClientRect();
    return {
      x: screenX - panelRect.left,
      y: screenY - panelRect.top,
    };
  }

  function spawnParticleBurst(screenX, screenY, color = "#39ff14") {
    const count = 8 + Math.floor(Math.random() * 5);
    const burst = document.createElement("div");
    burst.className = "particle-burst";
    burst.style.left = screenX + "px";
    burst.style.top = screenY + "px";
    document.body.appendChild(burst);

    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      p.style.backgroundColor = color;
      p.style.boxShadow = `0 0 10px ${color}, 0 0 18px ${color}`;
      burst.appendChild(p);

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const dist = 22 + Math.random() * 32;
      const px = Math.cos(angle) * dist;
      const py = Math.sin(angle) * dist;

      p.animate(
        [
          { transform: "translate(-50%, -50%) scale(1.6)", opacity: 1 },
          { transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px)) scale(0)`, opacity: 0 },
        ],
        { duration: 250, easing: "ease-out", fill: "forwards" }
      );
    }
    setTimeout(() => burst.remove(), 300);
  }

  // "Cell burst": the panel grows as a circle out of the card that was clicked.
  function animatePanelIn(panel, anchor) {
    panel.style.transition = "none";
    panel.style.transform = "none";
    panel.style.opacity = "1";
    const origin = panelOriginFromScreen(anchor.x, anchor.y, panel);
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const rad = Math.hypot(Math.max(Math.abs(origin.x), Math.abs(w - origin.x)), Math.max(Math.abs(origin.y), Math.abs(h - origin.y)));
    const at = `at ${origin.x.toFixed(0)}px ${origin.y.toFixed(0)}px`;
    // Clip-path only. Scaling the panel at the same time re-rasterised all of
    // its text at a slightly different size every frame, which read as the
    // content "vibrating"; with no transform the text stays pixel-still.
    panel.animate(
      [
        { clipPath: `circle(0px ${at})` },
        { clipPath: `circle(${rad.toFixed(0)}px ${at})` },
      ],
      { duration: 560, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
  }

  // Open without the bond pulse (phones, or no bond line) but keep the burst.
  function openWithBurst(finalizeOpen, node) {
    const panel = detailScreen.querySelector(".detail-panel");
    const anchor = node
      ? anchorFromRect((node.querySelector(".mol-inner") || node).getBoundingClientRect())
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    if (panel) panel.classList.add("custom-anim");
    finalizeOpen();
    if (panel) requestAnimationFrame(() => animatePanelIn(panel, anchor));
  }


  function openDetail(id, fromHistory = false, sourceNode = null) {
    const tpl = document.getElementById("detail-" + id);
    if (!tpl || !detailScreen || !detailContent) return;
    
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lastFocusedElement = document.activeElement;
    currentModalId = id;

    const finalizeOpen = () => {
      detailContent.innerHTML = "";
      detailContent.appendChild(tpl.content.cloneNode(true));
      detailScreen.classList.add("open");
      detailScreen.setAttribute("aria-hidden", "false");
      // Titles stay on one line: shrink just the ones too wide for the panel
      const title = detailContent.querySelector(".detail-title");
      if (title) {
        title.style.fontSize = "";
        const over = title.scrollWidth / (title.clientWidth || 1);
        if (over > 1) title.style.fontSize = (parseFloat(getComputedStyle(title).fontSize) / over) * 0.98 + "px";
      }
      document.body.classList.add("detail-open");
      if (window.innerWidth <= 960) document.body.style.overflow = "hidden";
      document.querySelectorAll(".mol-node.active").forEach((n) => n.classList.remove("active"));
      const node = molNodeForId(id);
      if (node) node.classList.add("active");
      document.querySelectorAll(".nav a[data-detail]").forEach((a) => a.classList.remove("active"));
      const navLink = document.querySelector(`.nav a[data-detail="${id}"]`);
      if (navLink) navLink.classList.add("active");
      if (window._trackPanelOpen) window._trackPanelOpen(id);
      detailClose?.focus();
      if (id === "research") setTimeout(initRemacPathway, 60);

      if (!fromHistory && id !== location.hash.slice(1)) {
        history.pushState({ panel: id }, "", `#${id}`);
      }
    };

    if (reducedMotion) {
      finalizeOpen();
      return;
    }
    if (window.innerWidth <= 960) {
      openWithBurst(finalizeOpen, sourceNode || molNodeForId(id));
      return;
    }

    const node = sourceNode || molNodeForId(id);
    if (node) {
      clickedNodeEl = node;
      clickedNodeRect = node.getBoundingClientRect();
      clickAnchor = anchorFromRect(clickedNodeRect);
    } else {
      clickedNodeEl = null;
      clickedNodeRect = null;
      clickAnchor = null;
    }
    const bondGroup = document.querySelector(`g[data-target-node="${id}"]`);
    const line = bondGroup && bondGroup.querySelector("line");
    if (!node || !line || !svg) {
      openWithBurst(finalizeOpen, node);
      return;
    }

    if (activeAnimation) {
      cancelAnimationFrame(activeAnimation);
      activeAnimation = null;
    }
    if (activeCircle) {
      activeCircle.remove();
      activeCircle = null;
    }

    const x1 = parseFloat(line.getAttribute("x1"));
    const y1 = parseFloat(line.getAttribute("y1"));
    const x2 = parseFloat(line.getAttribute("x2"));
    const y2 = parseFloat(line.getAttribute("y2"));
    const stroke = line.getAttribute("stroke");

    const c0 = nodeCenter(core, graph);
    const d1 = Math.hypot(x1 - c0.x, y1 - c0.y);
    const d2 = Math.hypot(x2 - c0.x, y2 - c0.y);
    const startX = d1 < d2 ? x1 : x2;
    const startY = d1 < d2 ? y1 : y2;
    const endX = d1 < d2 ? x2 : x1;
    const endY = d1 < d2 ? y2 : y1;

    const modalColor = MODAL_COLORS[id] || "#39ff14";

    activeCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    activeCircle.setAttribute("r", "4");
    activeCircle.setAttribute("fill", modalColor);
    activeCircle.style.filter = `drop-shadow(0 0 10px ${modalColor})`;
    activeCircle.setAttribute("class", "laser-pulse");
    svg.appendChild(activeCircle);

    let startTime = null;
    const duration = 350;
    const panel = detailScreen.querySelector(".detail-panel");
    if (panel) panel.classList.add("custom-anim");

    const animatePulse = (time) => {
      if (!startTime) startTime = time;
      let progress = (time - startTime) / duration;
      if (progress > 1) progress = 1;

      const cx = startX + (endX - startX) * progress;
      const cy = startY + (endY - startY) * progress;
      if (activeCircle) {
        activeCircle.setAttribute("cx", cx);
        activeCircle.setAttribute("cy", cy);
      }

      if (progress < 1) {
        activeAnimation = requestAnimationFrame(animatePulse);
      } else {
        if (activeCircle) {
          activeCircle.remove();
          activeCircle = null;
        }

        if (clickAnchor) {
          spawnParticleBurst(clickAnchor.x, clickAnchor.y, modalColor);
        }
        finalizeOpen();

        // Hold the anchor in a local: closing the panel (or opening another)
        // clears clickAnchor, and these two frames land after that happens,
        // which left animatePanelIn reading .x off null.
        const anchor = clickAnchor;
        if (panel && anchor) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              animatePanelIn(panel, anchor);
            });
          });
        }
      }
    };
    activeAnimation = requestAnimationFrame(animatePulse);
  }

  function closeDetail(fromHistory = false) {
    if (!detailScreen) return;
    
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const panel = detailScreen.querySelector(".detail-panel");
    const activeNode = document.querySelector(".mol-node.active");

    const finalizeClose = () => {
      detailScreen.classList.remove("open");
      detailScreen.setAttribute("aria-hidden", "true");
      document.body.classList.remove("detail-open");
      document.body.style.overflow = "";
      document.querySelectorAll(".mol-node.active").forEach((n) => n.classList.remove("active"));
      document.querySelectorAll(".nav a[data-detail]").forEach((a) => a.classList.remove("active"));
      if (lastFocusedElement && lastFocusedElement !== document.body) {
        setTimeout(() => lastFocusedElement?.focus(), 0);
      }
      
      const isEvent = typeof fromHistory === "object" && fromHistory !== null;
      const bypassHistory = isEvent ? false : fromHistory;
      if (!bypassHistory && location.hash) {
        history.pushState(null, "", window.location.pathname);
      }
      if (panel) {
        panel.classList.remove("custom-anim");
        panel.style.transform = "";
        panel.style.opacity = "";
        panel.style.transformOrigin = "";
        panel.style.transition = "";
      }
      clickedNodeRect = null;
      clickedNodeEl = null;
      clickAnchor = null;
    };

    if (reducedMotion || window.innerWidth <= 960 || !panel || !panel.classList.contains("custom-anim")) {
      finalizeClose();
      return;
    }

    finalizeClose();
  }

  document.querySelectorAll(".mol-trigger").forEach((trigger) => {
    const host = trigger.closest("[data-detail]");
    const id = host?.dataset.detail;
    if (!id) return;
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      openDetail(id, false, host);
    });
  });

  document.querySelectorAll(".nav a[data-detail]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openDetail(a.dataset.detail, false, molNodeForId(a.dataset.detail));
      nav?.classList.remove("open");
      toggle?.setAttribute("aria-expanded", "false");
    });
  });

  // Expose for effects.js (plasmid map navigation hub)
  window._openDetail = openDetail;
  window._closeDetail = closeDetail;

  detailClose?.addEventListener("click", closeDetail);
  detailBackdrop?.addEventListener("click", closeDetail);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && detailScreen?.classList.contains("open")) closeDetail();
  });

  // Hover glare follows the pointer; on desktop the card also tilts toward it
  // in 3D. Measured against the (untilted) wrapper and batched to one update
  // per frame; only transform + two custom properties change → no layout.
  const canTilt = !reducedMotion && window.matchMedia("(pointer: fine)").matches;
  document.querySelectorAll(".mol-trigger").forEach((inner) => {
    const wrap = inner.closest(".mol-wrap") || inner;
    const max = inner.closest(".mol-core") ? 4 : 9; // the big hero card tilts less
    let px = 0.5, py = 0.5, raf = 0;
    const apply = () => {
      raf = 0;
      inner.style.setProperty("--mx", px * 100 + "%");
      inner.style.setProperty("--my", py * 100 + "%");
      if (canTilt) {
        inner.style.setProperty("--rx", ((0.5 - py) * max).toFixed(2) + "deg");
        inner.style.setProperty("--ry", ((px - 0.5) * max * 1.2).toFixed(2) + "deg");
      }
    };
    inner.addEventListener("mousemove", (e) => {
      const r = wrap.getBoundingClientRect();
      px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      if (!raf) raf = requestAnimationFrame(apply);
    });
    inner.addEventListener("mouseleave", () => {
      cancelAnimationFrame(raf);
      raf = 0;
      inner.style.setProperty("--rx", "0deg");
      inner.style.setProperty("--ry", "0deg");
    });
  });

  /* ─── Magnetic buttons: pulled gently toward the pointer, spring back ─── */
  if (canTilt) {
    const MAGNET = ".btn-cv, .btn-submit, .social-icon, .detail-close";
    let magEl = null;
    document.addEventListener("pointermove", (e) => {
      const el = e.target.closest?.(MAGNET);
      if (magEl && magEl !== el) magEl.style.translate = "";
      magEl = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.translate = `${(dx * 0.3).toFixed(1)}px ${(dy * 0.35).toFixed(1)}px`;
    }, { passive: true });
  }

  /* ─── Bond electron-flow on node hover/focus + keyboard navigation ─── */
  function setBondActive(id, on) {
    if (!id || id === "core") return;
    const g = document.querySelector(`g[data-target-node="${id}"]`);
    if (g) g.classList.toggle("bond-active", on);
  }

  document.querySelectorAll(".mol-node[data-detail]").forEach((node) => {
    const id = node.dataset.detail;
    if (id === "core") return;
    node.addEventListener("mouseenter", () => setBondActive(id, true));
    node.addEventListener("mouseleave", () => setBondActive(id, false));
    node.addEventListener("focusin", () => setBondActive(id, true));
    node.addEventListener("focusout", () => setBondActive(id, false));
  });

  const NODE_ORDER = ["core", "about", "research", "experience", "education", "skills", "ambition", "achieve", "life", "contact"];
  document.addEventListener("keydown", (e) => {
    if (detailScreen?.classList.contains("open")) return; // let the modal own keys
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) return;
    const curNode = e.target.closest?.(".mol-node[data-detail]");
    if (!curNode) return; // only navigate once focus is already on a node
    const cur = NODE_ORDER.indexOf(curNode.dataset.detail);
    if (cur === -1) return;
    e.preventDefault();
    const fwd = e.key === "ArrowRight" || e.key === "ArrowDown";
    const next = (cur + (fwd ? 1 : -1) + NODE_ORDER.length) % NODE_ORDER.length;
    document.querySelector(`.mol-node[data-detail="${NODE_ORDER[next]}"] .mol-trigger`)?.focus();
  });

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open);
    });
    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ─── Hero: roles type out and cycle (the full list stays in the DOM for
     screen readers; the typed line is aria-hidden) ─── */
  (function typeRoles() {
    const out = document.querySelector(".roles-typed");
    if (!out || reducedMotion) return;
    const roles = ["Biochemist", "Molecular Biologist", "Science Communicator", "Science Programming Associate"];
    let r = 0, i = 0, del = false;
    out.textContent = "";
    (function step() {
      // Idle while a panel covers the hero or the tab is hidden
      if (document.hidden || document.body.classList.contains("detail-open")) return setTimeout(step, 600);
      const word = roles[r];
      i += del ? -1 : 1;
      out.textContent = word.slice(0, i);
      let wait = del ? 32 : 68;
      if (!del && i === word.length) { del = true; wait = 1700; }
      else if (del && i === 0) { del = false; r = (r + 1) % roles.length; wait = 320; }
      setTimeout(step, wait);
    })();
  })();

  /* ─── Phones: cards rise into place as they scroll into view. Only cards
     below the fold are armed, so nothing visible on load is ever hidden. ─── */
  (function riseIn() {
    if (reducedMotion || !("IntersectionObserver" in window) || window.innerWidth > 960) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    document.querySelectorAll(".mol-node .mol-wrap").forEach((w) => {
      if (w.getBoundingClientRect().top < window.innerHeight) return;
      w.classList.add("rise");
      io.observe(w);
    });
  })();

  /* ─── Bio-style circadian clock + partial footer rule ─── */
  const bioClock = document.getElementById("bio-clock");
  const footRule = document.querySelector(".foot-rule");

  function updateBioClock() {
    if (!bioClock) return;

    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    // Zeitgeber Time: hours since lights-on (ZT0), on a 12:12 light:dark cycle
    // with lights-on at 06:00 local. ZT0–12 = light phase, ZT12–24 = dark.
    // φ is circadian phase as a fraction of the cycle, measured from ZT0.
    const ztHours = (h + m / 60 + s / 3600 - LIGHTS_ON + 24) % 24;
    const phi = (ztHours / 24).toFixed(3);
    const zt = ztHours.toFixed(1);
    const pad = (n) => String(n).padStart(2, "0");
    const timeStr = `${pad(h)}:${pad(m)}:${pad(s)}`;
    const phase = ztHours < 12 ? "Light" : "Dark";

    // Perf: build the spans once, then only swap their text each tick (the old
    // innerHTML rebuild + offsetWidth read re-parsed and re-laid-out every second).
    if (!bioParts) {
      bioClock.innerHTML =
        '<span class="bio-phase"></span> · <span class="bio-tau"></span> · ' +
        '<span class="bio-zt"></span> · <span class="bio-phase-label"></span>';
      bioParts = bioClock.querySelectorAll("span");
    }
    bioParts[0].textContent = `φ = ${phi}`;
    // (τ is the free-running period in chronobiology, so it isn't used for clock time)
    bioParts[1].textContent = `local ${timeStr} ${tzLabel}`;
    bioParts[2].textContent = `ZT${zt}`;
    bioParts[3].textContent = phase;
    bioClock.setAttribute("datetime", now.toISOString());
  }

  const LIGHTS_ON = 6; // ZT0 = 06:00 local, close to sunrise in Bengaluru
  let bioParts = null;
  let tzLabel = "IST";
  try {
    const tzPart = new Intl.DateTimeFormat("en", { timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName");
    if (tzPart) tzLabel = tzPart.value;
  } catch (_) {}

  function sizeFootRule() {
    if (!footRule || !bioClock) return;
    const w = Math.min(bioClock.offsetWidth + 56, window.innerWidth * 0.92);
    footRule.style.setProperty("--foot-rule-w", `${w}px`);
  }

  updateBioClock();
  sizeFootRule();
  if (document.fonts?.ready) document.fonts.ready.then(sizeFootRule);
  setInterval(updateBioClock, 1000);
  window.addEventListener("resize", sizeFootRule);

  /* ─── Theme: OLED Black ↔ Lab Paper, switched with a cell-spread reveal ───
     The browser snapshots the old and new page (View Transitions) and we grow
     the new snapshot out of the switch as a rippling membrane, so background,
     canvases and cards all change on the same edge. Browsers without the API
     simply switch instantly. */
  const root = document.documentElement;
  const themeBtn = document.querySelector(".theme-toggle");
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  function labelThemeButton() {
    if (!themeBtn) return;
    const light = root.getAttribute("data-theme") === "light";
    themeBtn.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
  }

  function setTheme(next) {
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (_) {}
    if (themeMeta) themeMeta.setAttribute("content", next === "light" ? "#f3f6fb" : "#000000");
    labelThemeButton();
  }

  // Keyframes for a cell membrane: a ring of points whose radius ripples
  // while it grows, settling smooth as it covers the page.
  function membraneFrames(ox, oy, R) {
    const N = 48, F = 10, frames = [];
    for (let k = 0; k <= F; k++) {
      const p = k / F;
      const rad = R * 1.2 * (1 - Math.pow(1 - p, 3));
      const amp = 0.085 * (1 - p * 0.75), ph = p * 4.2, pts = [];
      for (let i = 0; i < N; i++) {
        const th = (i / N) * Math.PI * 2;
        const rr = rad * (1 + amp * Math.sin(5 * th + ph) + amp * 0.6 * Math.sin(3 * th - ph * 1.4));
        pts.push(`${(ox + Math.cos(th) * rr).toFixed(1)}px ${(oy + Math.sin(th) * rr).toFixed(1)}px`);
      }
      frames.push({ clipPath: `polygon(${pts.join(",")})`, offset: p });
    }
    return frames;
  }

  if (themeBtn) {
    labelThemeButton();
    themeBtn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      if (!document.startViewTransition || reducedMotion) { setTheme(next); return; }
      const r = themeBtn.getBoundingClientRect();
      const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
      const R = Math.hypot(Math.max(ox, innerWidth - ox), Math.max(oy, innerHeight - oy));
      // The new snapshot starts fully clipped (CSS reads these), so it can never
      // flash in whole before the membrane animation takes over.
      root.style.setProperty("--vt-x", ox + "px");
      root.style.setProperty("--vt-y", oy + "px");
      const vt = document.startViewTransition(() => setTheme(next));
      vt.ready.then(() => {
        root.animate(membraneFrames(ox, oy, R), {
          duration: 820,
          easing: "linear",
          fill: "both",
          pseudoElement: "::view-transition-new(root)",
        });
      }).catch(() => {});
    });
  }

  /* ─── Contact Form Handler ─── */
  document.addEventListener("submit", (e) => {
    const contactForm = e.target.closest("#contact-form");
    if (!contactForm) return;

    e.preventDefault();
    const formNote = document.getElementById("form-note");
    const submitBtn = contactForm.querySelector(".btn-submit");
    const originalText = submitBtn.textContent;

    submitBtn.disabled = true;
    submitBtn.textContent = "Preparing...";
    if (formNote) {
      formNote.textContent = "";
      formNote.classList.remove("success", "error");
    }

    const data = new FormData(contactForm);

    // Honeypot — bots fill hidden fields; humans never see it. Fake success, send nothing.
    if ((data.get("_honey") || "").trim()) {
      contactForm.style.display = "none";
      const successScreen = document.getElementById("contact-success");
      if (successScreen) successScreen.style.display = "block";
      return;
    }

    const name    = (data.get("name")    || "").trim();
    const email   = (data.get("email")   || "").trim();
    const subject = (data.get("subject") || "Enquiry from portfolio").trim();
    const message = (data.get("message") || "").trim();

    // Use FormSubmit.co for background email sending without a backend.
    // Form submissions go to the personal gmail (work email stays displayed as a contact).
    // NOTE: FormSubmit requires a one-time activation — the first real submission
    // triggers a confirmation email to this address that must be clicked once.
    const endpoint = "https://formsubmit.co/ajax/dsitesh2003@gmail.com";
    
    fetch(endpoint, {
      method: "POST",
      headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
      },
      body: JSON.stringify({
          name: name,
          email: email,
          _subject: subject,
          message: message
      })
    })
    .then(response => response.json())
    .then(data => {
      contactForm.style.display = "none";
      const successScreen = document.getElementById("contact-success");
      if (successScreen) {
        successScreen.style.display = "block";
      }
      contactForm.reset();
    })
    .catch(error => {
      if (formNote) {
        formNote.textContent = "Error: Pathway blocked. Please email directly at sitesh@paraminnovation.org";
        formNote.classList.add("error");
      }
    })
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    });
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest(".btn-go-back")) {
      const successScreen = document.getElementById("contact-success");
      const contactForm = document.getElementById("contact-form");
      if (successScreen) successScreen.style.display = "none";
      if (contactForm) contactForm.style.display = "block";
    }
  });

  /* ─── Remac-PET Interactive Pathway ─── */
  function initRemacPathway() {
    const container = document.getElementById("remac-pathway");
    if (!container) return;
    container.innerHTML = "";

    // 2×2 grid layout — big boxes so all the phase text is comfortably readable
    const NW = 300, NH = 182, GX = 46, GY = 60, SX = 20, SY = 32;
    const W = SX * 2 + NW * 2 + GX, H = SY * 2 + NH * 2 + GY;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.display = "block";
    svg.style.overflow = "visible";

    /* ── Arrow markers, one per colour ── */
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    [["pa-cyan","#00e5ff"],["pa-orange","#ff9f43"],["pa-purple","#b44dff"],["pa-neon","#39ff14"]].forEach(([id, col]) => {
      const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
      m.setAttribute("id", id);
      m.setAttribute("viewBox", "0 0 10 10");
      m.setAttribute("refX", "8"); m.setAttribute("refY", "5");
      m.setAttribute("markerWidth", "5"); m.setAttribute("markerHeight", "5");
      m.setAttribute("orient", "auto-start-reverse");
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
      p.setAttribute("fill", col);
      m.appendChild(p); defs.appendChild(m);
    });
    svg.appendChild(defs);

    /* ── 4 stages – colours match footer formula exactly ── */
    const stages = [
      {
        color: "#00e5ff", marker: "pa-cyan", badge: "PHASE 1",
        label: "TRANSDUCTION", sub: "LV → THP-1 Monocytes",
        lines: [
          "\u2192 Lentiviral vector delivery",
          "  FAST-PETase (N233K) gene",
          "  Stable host integration",
          "  48\u201372h expression onset",
        ],
      },
      {
        color: "#ff9f43", marker: "pa-orange", badge: "PHASE 2",
        label: "PHAGOCYTOSIS", sub: "Nanoplastic Engulfment",
        lines: [
          "\u2192 Remac-PET macrophages patrol",
          "  Recognise 1 nm\u20131 \u00b5m particles",
          "  Endocytic internalisation",
          "  BBB-penetrant plastics cleared",
        ],
      },
      {
        color: "#b44dff", marker: "pa-purple", badge: "PHASE 3",
        label: "DEGRADATION", sub: "Lysosomal PETase Action",
        lines: [
          "\u2192 pH 4.5 lysosomal activation",
          "  PET \u2192 MHET \u2192 EG + TPA",
          "  Polymer chain hydrolysis",
          "  ROS burden reduced",
        ],
      },
      {
        color: "#39ff14", marker: "pa-neon", badge: "PHASE 4",
        label: "RESCUE \u26a1", sub: "Neural Protection",
        lines: [
          "\u2192 BDNF promoter demethylated",
          "  Neuronal DNA repair begins",
          "  Microglial capacity restored",
          "  Transgenerational repair \u2713",
        ],
      },
    ].map((s, i) => {
      // snake order: top-left → top-right → bottom-right → bottom-left
      const grid = [[0, 0], [1, 0], [1, 1], [0, 1]][i];
      return { ...s, x: SX + grid[0] * (NW + GX), y: SY + grid[1] * (NH + GY) };
    });

    /* ── Outer glow rects (behind everything) ── */
    stages.forEach(s => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      g.setAttribute("x", s.x - 4); g.setAttribute("y", s.y - 4);
      g.setAttribute("width", NW + 8); g.setAttribute("height", NH + 8);
      g.setAttribute("rx", "12"); g.setAttribute("fill", "none");
      g.setAttribute("stroke", s.color); g.setAttribute("stroke-width", "0.8");
      g.setAttribute("opacity", "0.3");
      svg.appendChild(g);
    });

    /* ── Connector arrows (snake: →, ↓, ←) ── */
    const mkArrow = (x1, y1, x2, y2, col, marker) => {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1); line.setAttribute("y1", y1);
      line.setAttribute("x2", x2); line.setAttribute("y2", y2);
      line.setAttribute("stroke", col);
      line.setAttribute("stroke-width", "2.4");
      line.setAttribute("marker-end", `url(#${marker})`);
      line.setAttribute("opacity", "0.9");
      svg.appendChild(line);
    };
    const [a, b, c, d] = stages;
    mkArrow(a.x + NW + 2, a.y + NH / 2, b.x - 6, b.y + NH / 2, b.color, b.marker); // top →
    mkArrow(b.x + NW / 2, b.y + NH + 2, c.x + NW / 2, c.y - 6, c.color, c.marker); // right ↓
    mkArrow(c.x - 2, c.y + NH / 2, d.x + NW + 6, d.y + NH / 2, d.color, d.marker); // bottom ←

    /* ── Stage boxes ── */
    stages.forEach(s => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

      /* box */
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", s.x); rect.setAttribute("y", s.y);
      rect.setAttribute("width", NW); rect.setAttribute("height", NH);
      rect.setAttribute("rx", "8");
      rect.setAttribute("fill", "rgba(4,7,18,0.85)");
      rect.setAttribute("stroke", s.color); rect.setAttribute("stroke-width", "1.5");
      g.appendChild(rect);

      /* badge pill */
      const bw = s.badge.length * 8.2 + 20;
      const bx = s.x + NW / 2 - bw / 2;
      const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bgRect.setAttribute("x", bx); bgRect.setAttribute("y", s.y - 14);
      bgRect.setAttribute("width", bw); bgRect.setAttribute("height", "22");
      bgRect.setAttribute("rx", "11"); bgRect.setAttribute("fill", s.color);
      g.appendChild(bgRect);

      const bTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      bTxt.setAttribute("x", bx + bw / 2); bTxt.setAttribute("y", s.y);
      bTxt.setAttribute("text-anchor", "middle");
      bTxt.setAttribute("fill", "#030a16");
      bTxt.setAttribute("font-size", "10.5"); bTxt.setAttribute("font-weight", "800");
      bTxt.setAttribute("font-family", "JetBrains Mono, monospace");
      bTxt.setAttribute("letter-spacing", "0.07em");
      bTxt.textContent = s.badge;
      g.appendChild(bTxt);

      /* main label */
      const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
      lbl.setAttribute("x", s.x + NW / 2); lbl.setAttribute("y", s.y + 32);
      lbl.setAttribute("text-anchor", "middle");
      lbl.setAttribute("fill", s.color);
      lbl.setAttribute("font-size", "17"); lbl.setAttribute("font-weight", "700");
      lbl.setAttribute("font-family", "Syne, system-ui, sans-serif");
      lbl.setAttribute("letter-spacing", "0.04em");
      lbl.textContent = s.label;
      g.appendChild(lbl);

      /* sublabel */
      const sub = document.createElementNS("http://www.w3.org/2000/svg", "text");
      sub.setAttribute("x", s.x + NW / 2); sub.setAttribute("y", s.y + 50);
      sub.setAttribute("text-anchor", "middle");
      sub.setAttribute("fill", "rgba(220,228,255,0.55)");
      sub.setAttribute("font-size", "11");
      sub.setAttribute("font-family", "JetBrains Mono, monospace");
      sub.textContent = s.sub;
      g.appendChild(sub);

      /* divider */
      const div = document.createElementNS("http://www.w3.org/2000/svg", "line");
      div.setAttribute("x1", s.x + 14); div.setAttribute("y1", s.y + 61);
      div.setAttribute("x2", s.x + NW - 14); div.setAttribute("y2", s.y + 61);
      div.setAttribute("stroke", s.color); div.setAttribute("stroke-width", "0.7");
      div.setAttribute("opacity", "0.35");
      g.appendChild(div);

      /* bullet lines */
      s.lines.forEach((line, idx) => {
        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", s.x + 16); t.setAttribute("y", s.y + 84 + idx * 26);
        t.setAttribute("fill", idx === 0 ? s.color : "rgba(220,228,255,0.82)");
        t.setAttribute("font-size", "12.5");
        t.setAttribute("font-family", "JetBrains Mono, monospace");
        t.setAttribute("opacity", idx === 0 ? "1" : "0.88");
        t.textContent = line;
        g.appendChild(t);
      });

      svg.appendChild(g);
    });

    container.appendChild(svg);
  }

  // Initialize Remac pathway is triggered directly in openDetail("research")
  // Observer below handles edge cases (e.g. back-button re-open)
  if (detailScreen) {
    const observer = new MutationObserver(() => {
      if (detailScreen.getAttribute("aria-hidden") === "false") {
        const researchPanel = detailContent.querySelector("#remac-pathway");
        if (researchPanel && !researchPanel.hasChildNodes()) initRemacPathway();
      }
    });
    observer.observe(detailScreen, { attributes: true, attributeFilter: ["aria-hidden"] });
  }

  // Service worker DISABLED during development — it was caching stale files.
  // Actively unregister any existing worker + clear caches so content is fresh.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((rs) => rs.forEach((r) => r.unregister()))
      .catch(() => {});
    if (window.caches && caches.keys) {
      caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }
  // ─── Hash deep-linking & History back button ───
  function handleHash() {
    const hash = location.hash.slice(1); // remove #
    const validPanels = ['about','research','experience','education','skills','ambition','achieve','life','contact','core'];
    if (hash && validPanels.includes(hash)) {
      setTimeout(() => openDetail(hash, true), 320);
    } else {
      closeDetail(true);
    }
  }
  // Removed handleHash() call on load so panels don't auto-open
  window.addEventListener('popstate', handleHash);

  // ─── Centrifuge intro safety timeout (never gets stuck on slow devices) ───
  // The self-assembly intro (intro3d.js) runs ~4.4s and manages its own dismissal
  // + safety net, so this legacy 8s cutoff must NOT fire for it — otherwise it
  // chops the animation off mid-sequence. Only guards the lightweight 2D fallback.
  if (window.INTRO_MODE !== '3d') {
    setTimeout(() => {
      const overlay = document.getElementById('centrifuge-overlay');
      if (overlay && overlay.style.display !== 'none' && !overlay.classList.contains('centri-dissolved')) {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 600);
      }
    }, 8000);
  }

})();
