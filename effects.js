/* ================================================================
   SITESH KUMAR DASH — BIO-EFFECTS ENGINE  v1.0
   effects.js — loaded after script.js
   No libraries. Vanilla JS only.
================================================================ */
(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
     1. AMINO ACID CURSOR TRAIL
     20 nodes chain-following mouse, collapse on idle 1s,
     spring-physics unravel when cursor moves again.
     Colours cycle: teal (polar), amber (hydrophobic), coral (charged)
  ============================================================ */
  (function aminoTrail() {
    if (REDUCED) return;
    // Touch devices have no pointer to follow — skip (and restore the native cursor)
    if (!window.matchMedia('(pointer: fine)').matches) {
      document.documentElement.style.cursor = 'auto';
      return;
    }
    const canvas = document.getElementById('amino-trail');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let compactMode = false, hot = false;
    
    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let active = false;

    window.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
    }, { passive: true });

    window.addEventListener('mousedown', () => active = true);
    window.addEventListener('mouseup', () => active = false);

    // Cursor "excites" (fans out + glows) over interactive targets
    let overInteractive = false;
    document.addEventListener('mouseover', e => {
      overInteractive = !!(e.target.closest && e.target.closest('a, button, input, textarea, label, .mol-trigger, .plasmid-nav a'));
    }, { passive: true });

    // Central Alpha-Carbon is exactly at mx, my.
    // Atoms orbit/trail elastically.
    // N, C, O, and R-groups
    const atoms = [
      { id: 'N',  c: '#b44dff', r: 3,   restLen: 9,  angle: Math.PI * 0.8, x: mx, y: my, vx: 0, vy: 0 },
      { id: 'C',  c: '#00e5ff', r: 3.4, restLen: 9,  angle: 0,             x: mx, y: my, vx: 0, vy: 0 },
      { id: 'O',  c: '#ff3366', r: 3,   restLen: 16, angle: Math.PI * 0.2, x: mx, y: my, vx: 0, vy: 0 },
      { id: 'R1', c: '#1D9E75', r: 2.8, restLen: 10, angle: -Math.PI * 0.5,x: mx, y: my, vx: 0, vy: 0 },
      { id: 'R2', c: '#EF9F27', r: 2.8, restLen: 16, angle: -Math.PI * 0.7,x: mx, y: my, vx: 0, vy: 0 }
    ];

    function drawAtom(x, y, r, col, isCenter) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = compactMode ? 5 : (hot ? 22 : 12);
      ctx.fill();
      
      // Specular highlight
      ctx.beginPath(); ctx.arc(x - r*0.3, y - r*0.3, r*0.3, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; 
      ctx.shadowBlur = 0; 
      ctx.fill();
    }

    let globalAngle = 0; 
    let lastMx = mx, lastMy = my;

    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const dxMove = mx - lastMx;
      const dyMove = my - lastMy;
      const speed = Math.sqrt(dxMove*dxMove + dyMove*dyMove);
      
      if (speed > 0.5) {
        globalAngle += dxMove * 0.015;
      } else {
        globalAngle += 0.005; // slow idle rotation
      }
      
      lastMx += (mx - lastMx) * 0.3;
      lastMy += (my - lastMy) * 0.3;

      // Compact the cursor while a detail panel is open so it never obscures a chart
      compactMode = document.body.classList.contains('detail-open');
      hot = active || overInteractive;
      const spread = compactMode ? 0.42 : (overInteractive ? 1.32 : 1);
      const bonus = active ? 6 : (overInteractive ? 4 : 0);

      // Update atoms with spring physics
      atoms.forEach(a => {
        let targetX = mx + Math.cos(a.angle + globalAngle) * (a.restLen * spread + bonus);
        let targetY = my + Math.sin(a.angle + globalAngle) * (a.restLen * spread + bonus);
        
        let ax = (targetX - a.x) * 0.25;
        let ay = (targetY - a.y) * 0.25;
        
        a.vx += ax;
        a.vy += ay;
        a.vx *= 0.65; // friction
        a.vy *= 0.65;
        a.x += a.vx;
        a.y += a.vy;
      });

      // Draw Bonds
      ctx.lineWidth = active ? 2.6 : 2;
      ctx.strokeStyle = active ? '#fff' : 'rgba(230,240,255,0.85)';
      ctx.shadowColor = 'rgba(255,255,255,0.5)';
      ctx.shadowBlur = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      // N to CA
      ctx.moveTo(atoms[0].x, atoms[0].y); ctx.lineTo(mx, my);
      // C to CA
      ctx.moveTo(atoms[1].x, atoms[1].y); ctx.lineTo(mx, my);
      // O to C (drawn to CA here for visual simplicity, simulating full connectivity)
      ctx.moveTo(atoms[2].x, atoms[2].y); ctx.lineTo(atoms[1].x, atoms[1].y);
      // R1 to CA
      ctx.moveTo(atoms[3].x, atoms[3].y); ctx.lineTo(mx, my);
      // R2 to R1
      ctx.moveTo(atoms[4].x, atoms[4].y); ctx.lineTo(atoms[3].x, atoms[3].y);
      ctx.stroke();

      // Draw Atoms
      atoms.forEach(a => drawAtom(a.x, a.y, a.r, a.c, false));
      // Draw Central CA atom
      drawAtom(mx, my, active ? 4.5 : 3.8, '#00e5ff', true);

      requestAnimationFrame(loop);
    }
    loop();
  })();

  /* ============================================================
     2. DNA HELIX SCROLL PROGRESS BAR
     Fixed right edge SVG, ≥768px only.
     A-T pairs: teal/amber. G-C pairs: blue/coral.
     Zips from bottom as user scrolls; glow + "COMPLETE" at 100%.
  ============================================================ */
  (function dnaExplorationMeter() {
    const bar = document.getElementById('dna-scroll-bar');
    if (!bar) return;

    function checkWidth() {
      bar.style.display = window.innerWidth >= 768 ? '' : 'none';
    }
    checkWidth();
    window.addEventListener('resize', checkWidth, { passive: true });

    const PANELS = ['about', 'research', 'experience', 'education', 'skills', 'ambition', 'achieve', 'life', 'contact'];
    const explored = new Set();
    const pairs = bar.querySelectorAll('.dna-bp');
    const PAIRS = pairs.length;
    const completeLabel = bar.querySelector('#dna-complete-label');

    let tooltip = bar.querySelector('.dna-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'dna-tooltip';
      tooltip.style.cssText = 'position:absolute; right:40px; top:50%; transform:translateY(-50%); background:rgba(5,10,18,0.9); border:1px solid #1D9E75; padding:10px; color:#1D9E75; font:10px "JetBrains Mono"; pointer-events:none; opacity:0; transition:opacity 0.3s; width:max-content; border-radius:4px; box-shadow:0 0 10px rgba(29,158,117,0.3); z-index:100; text-transform:uppercase;';
      bar.appendChild(tooltip);
    }

    function update() {
      const prog = Math.min(explored.size / PANELS.length, 1);
      const svg = bar.querySelector('svg');
      
      pairs.forEach((pair, i) => {
        const threshold = (PAIRS - 1 - i) / PAIRS;
        const lit = prog > threshold || (prog === 1);
        pair.style.opacity = lit ? '1' : '0.09';
        pair.querySelectorAll('[data-glow]').forEach(el => {
          el.style.filter = lit ? `drop-shadow(0 0 3px ${el.getAttribute('fill')})` : 'none';
        });
      });

      if (prog >= 0.99) {
        if (svg) svg.classList.add('dna-complete');
        if (completeLabel) {
          completeLabel.classList.add('visible');
          clearTimeout(bar._ct);
          bar._ct = setTimeout(() => completeLabel.classList.remove('visible'), 2500);
        }
      } else {
        if (svg) svg.classList.remove('dna-complete');
      }
    }

    window._trackPanelOpen = function(id) {
      if (PANELS.includes(id)) {
        explored.add(id);
        update();
      }
    };

    bar.style.cursor = 'pointer';
    bar.addEventListener('click', () => {
      if (explored.size >= PANELS.length) return;
      const unexplored = PANELS.filter(p => !explored.has(p));
      tooltip.innerHTML = `<strong>Unexplored Vectors:</strong><br><br>` + unexplored.join('<br>');
      tooltip.style.opacity = '1';
      clearTimeout(bar._tt);
      bar._tt = setTimeout(() => tooltip.style.opacity = '0', 3000);
    });
  })();

  /* ============================================================
     4. MAD SCIENTIST BOOT SEQUENCE
  ============================================================ */
  (function centrifugeLoader() {
    const KEY = 'centri_done';
    // The cinematic WebGL intro (intro3d.js) handles the boot sequence when
    // INTRO_MODE === '3d'. This 2D canvas intro is the fallback for no-WebGL /
    // low-memory devices (INTRO_MODE === '2d').
    if (window.INTRO_MODE === '3d') return;
    // Add ?intro (or #intro) to the URL to always replay the loading screen (preview).
    const forceIntro = /[?&#]intro\b/i.test(location.href);
    if (!forceIntro && localStorage.getItem(KEY)) {
      const overlay = document.getElementById('centrifuge-overlay');
      if (overlay) overlay.style.display = 'none';
      return;
    }

    const overlay = document.getElementById('centrifuge-overlay');
    const canvas  = document.getElementById('centrifuge-canvas');
    if (!overlay) return;
    // Accessibility: users who prefer reduced motion skip the boot sequence entirely
    if (REDUCED) {
      overlay.style.display = 'none';
      localStorage.setItem(KEY, '1');
      return;
    }
    if (!canvas) {
      setTimeout(() => { overlay.style.display = 'none'; localStorage.setItem(KEY, '1'); }, 150);
      return;
    }

    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';

    const ctx = canvas.getContext('2d');
    let W, H, cx, cy;
    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      cx = W / 2; cy = H / 2;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    let animId;
    let dismissed = false;

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      cancelAnimationFrame(animId);
      overlay.classList.add('centri-dissolve');
      document.body.style.overflow = '';
      localStorage.setItem(KEY, '1');
      setTimeout(() => { overlay.style.display = 'none'; }, 700);
    }

    const skipBtn = document.getElementById('centri-skip');
    if (skipBtn) skipBtn.addEventListener('click', dismiss);

    // Safety fallback
    const safetyTimer = setTimeout(dismiss, 6800);

    /* ── Intro: black → 3D cell → realistic zoom into nucleus → colour-coded DNA → name ── */
    let startTs = null;
    const NAME = 'SITESH KUMAR DASH';
    const SUB  = 'BIOCHEMIST · MOLECULAR BIOLOGIST';
    // Site theme palette — DNA segments are coloured like the site's sections
    const SECT = ['#00e5ff', '#39ff14', '#ff9f43', '#1D9E75', '#b44dff', '#ff3366', '#ffd54f', '#39ff14', '#00e5ff'];
    const ORG_COLS = ['#00e5ff', '#ff9f43', '#b44dff', '#39ff14', '#ff3366', '#ffd54f', '#1D9E75'];

    const orgs = [];
    for (let i = 0; i < 7; i++) orgs.push({ a: i * 1.7, rr: 0.34 + ((i * 37) % 44) / 100, s: 2 + ((i * 53) % 26) / 10, col: ORG_COLS[i % ORG_COLS.length] });

    const smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    const easeIn3 = (t) => t * t * t;
    const hexA = (hex, a) => 'rgba(' + parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16) + ',' + a + ')';

    function drawCell(scale, alpha) {
      const R = Math.min(W, H) * 0.16 * scale;
      ctx.save();
      ctx.globalAlpha = alpha;
      // 3D cell body (spherical shading)
      let g = ctx.createRadialGradient(cx - R * 0.32, cy - R * 0.34, R * 0.08, cx, cy, R);
      g.addColorStop(0, 'rgba(160,240,220,0.40)'); g.addColorStop(0.55, 'rgba(50,130,120,0.24)'); g.addColorStop(1, 'rgba(14,52,52,0.06)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = Math.max(1, R * 0.02); ctx.strokeStyle = 'rgba(130,235,215,0.6)';
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      // organelles as 3D spheres in theme colours
      orgs.forEach(o => {
        const ox = cx + Math.cos(o.a) * R * o.rr, oy = cy + Math.sin(o.a) * R * o.rr, r = R * 0.11 * (0.7 + o.s / 4);
        const og = ctx.createRadialGradient(ox - r * 0.3, oy - r * 0.3, r * 0.1, ox, oy, r);
        og.addColorStop(0, hexA('#ffffff', alpha * 0.9)); og.addColorStop(0.42, hexA(o.col, alpha * 0.92)); og.addColorStop(1, hexA(o.col, 0));
        ctx.fillStyle = og; ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.fill();
      });
      // nucleus 3D sphere
      const nR = R * 0.4;
      let ng = ctx.createRadialGradient(cx - nR * 0.3, cy - nR * 0.34, nR * 0.08, cx, cy, nR);
      ng.addColorStop(0, 'rgba(170,140,240,0.6)'); ng.addColorStop(0.6, 'rgba(80,65,150,0.42)'); ng.addColorStop(1, 'rgba(30,25,60,0.12)');
      ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(cx, cy, nR, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = Math.max(1, R * 0.012); ctx.strokeStyle = 'rgba(170,150,240,0.5)';
      ctx.beginPath(); ctx.arc(cx, cy, nR, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = hexA('#c8b4ff', alpha * 0.5);
      ctx.beginPath(); ctx.arc(cx + nR * 0.2, cy - nR * 0.15, nR * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    const colAt = (i, N) => SECT[Math.floor((i / N) * SECT.length) % SECT.length];

    // DNA that morphs from "wound around a histone" (u=0) → straight double helix (u=1)
    function drawDNA(u, rot, alpha, histoneAlpha) {
      const N = 64, Rh = Math.min(W, H) * 0.11;
      const mX = W * 0.16, uW = W * 0.68, ampL = Math.min(W, H) * 0.075, turnsL = 3.6, turnsW = 1.8, histSpan = Rh * 1.5;

      // histone (protein spool) — a shaded sphere that fades as the DNA unwinds
      if (histoneAlpha > 0.01) {
        ctx.save(); ctx.globalAlpha = histoneAlpha;
        const hg = ctx.createRadialGradient(cx - Rh * 0.32, cy - Rh * 0.36, Rh * 0.1, cx, cy, Rh);
        hg.addColorStop(0, 'rgba(220,212,244,0.92)'); hg.addColorStop(0.6, 'rgba(126,116,178,0.7)'); hg.addColorStop(1, 'rgba(52,46,92,0.3)');
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, Rh, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      const strand = (o) => {
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const s = i / N;
          const aw = s * turnsW * Math.PI * 2 + o;
          const wx = cx + Math.cos(aw) * Rh * 1.25, wy = cy + Math.sin(aw) * Rh * 0.55 + (s - 0.5) * histSpan, dw = Math.cos(aw);
          const la = s * turnsL * Math.PI * 2 + o + rot;
          const lx = mX + s * uW, ly = cy + Math.sin(la) * ampL, dl = Math.cos(la);
          pts.push([wx + (lx - wx) * u, wy + (ly - wy) * u, dw + (dl - dw) * u]);
        }
        return pts;
      };
      const a = strand(0), b = strand(Math.PI);

      ctx.save(); ctx.globalAlpha = alpha;
      for (let i = 0; i <= N; i++) {   // base-pair rungs, section-coloured
        const d = (a[i][2] + 1) / 2;
        ctx.strokeStyle = hexA(colAt(i, N), alpha * (0.22 + 0.42 * d)); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(a[i][0], a[i][1]); ctx.lineTo(b[i][0], b[i][1]); ctx.stroke();
      }
      [a, b].forEach(pts => {
        ctx.strokeStyle = hexA('#bfeee2', alpha * 0.35); ctx.lineWidth = 1.3;
        ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
        pts.forEach((p, i) => {
          const d = (p[2] + 1) / 2, col = colAt(i, N), r = 1.4 + d * 2;
          const gg = ctx.createRadialGradient(p[0] - r * 0.3, p[1] - r * 0.3, r * 0.1, p[0], p[1], r);
          gg.addColorStop(0, hexA('#ffffff', alpha * 0.9)); gg.addColorStop(0.45, hexA(col, alpha * (0.5 + 0.5 * d))); gg.addColorStop(1, hexA(col, 0));
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill();
        });
      });
      ctx.restore();
    }

    // Writes the name left → right (as if the unwound DNA is spelling it), in green
    function drawName(writeP, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fs = Math.min(W * 0.07, 54);
      ctx.font = '800 ' + fs + 'px "Syne",system-ui,sans-serif';
      const tw = ctx.measureText(NAME).width, left = cx - tw / 2;
      ctx.save();
      ctx.beginPath(); ctx.rect(left - 6, cy - fs, tw * writeP + 12, fs * 2.6); ctx.clip();
      ctx.fillStyle = '#39ff14'; ctx.shadowColor = 'rgba(57,255,20,0.55)'; ctx.shadowBlur = 12;
      ctx.fillText(NAME, cx, cy);
      ctx.restore(); ctx.shadowBlur = 0;
      if (writeP < 1) {   // glowing write-head
        const hx = left + tw * writeP;
        const wg = ctx.createRadialGradient(hx, cy, 0, hx, cy, fs * 0.5);
        wg.addColorStop(0, hexA('#eaffe0', alpha * 0.9)); wg.addColorStop(1, hexA('#39ff14', 0));
        ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(hx, cy, fs * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      if (writeP > 0.9) {
        ctx.globalAlpha = alpha * smooth((writeP - 0.9) / 0.1);
        ctx.font = '600 ' + Math.min(W * 0.019, 14) + 'px "JetBrains Mono",monospace';
        ctx.fillStyle = hexA('#00e5ff', 0.8); ctx.fillText(SUB, cx, cy + fs * 0.72);
      }
      ctx.restore();
    }

    // Chromosome (X-shape) — two crossing chromatids + centromere, theme purple
    function drawChromosome(scale, alpha) {
      const R = Math.min(W, H) * 0.15 * scale, len = R * 1.7, wid = R * 0.4, r = wid / 2;
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy);
      const capsule = () => {
        const x = -wid / 2, y = -len / 2;
        ctx.beginPath();
        ctx.moveTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.lineTo(x + wid - r, y); ctx.arcTo(x + wid, y, x + wid, y + r, r);
        ctx.lineTo(x + wid, y + len - r); ctx.arcTo(x + wid, y + len, x + wid - r, y + len, r); ctx.lineTo(x + r, y + len); ctx.arcTo(x, y + len, x, y + len - r, r);
        ctx.closePath();
      };
      [-0.34, 0.34].forEach(rr => {
        ctx.save(); ctx.rotate(rr);
        const g = ctx.createLinearGradient(-wid, 0, wid, 0);
        g.addColorStop(0, 'rgba(212,162,246,0.92)'); g.addColorStop(0.5, 'rgba(150,85,225,0.9)'); g.addColorStop(1, 'rgba(92,48,152,0.8)');
        ctx.fillStyle = g; capsule(); ctx.fill();
        ctx.restore();
      });
      ctx.fillStyle = hexA('#e6ccff', alpha * 0.55);   // centromere
      ctx.beginPath(); ctx.arc(0, 0, wid * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Educational stage label (like the reference video)
    function drawLabel(text, alpha) {
      if (alpha <= 0.01) return;
      ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 ' + Math.min(W * 0.015, 13) + 'px "JetBrains Mono",monospace';
      ctx.fillStyle = 'rgba(224,240,250,0.9)'; ctx.shadowColor = 'rgba(0,229,255,0.5)'; ctx.shadowBlur = 6;
      ctx.fillText(text.toUpperCase(), cx, H * 0.8);
      ctx.restore();
    }

    const T_CELL = 750, T_ZOOM = 1900, T_CHROMO = 2900, T_HIST = 3650, T_UNWIND = 4700, T_WRITE = 6000, T_END = 6700;

    function drawIntro(ts) {
      if (dismissed) return;
      if (!startTs) startTs = ts;
      const t = ts - startTs;
      ctx.fillStyle = 'rgba(4,6,10,' + (t < T_UNWIND ? 0.5 : 0.6) + ')';
      ctx.fillRect(0, 0, W, H);
      const rot = t * 0.0016;

      if (t < T_ZOOM) {                                   // cell → zoom into nucleus
        const fade = smooth(t / T_CELL);
        const zt = Math.max(0, (t - T_CELL * 0.6) / (T_ZOOM - T_CELL * 0.6));
        const scale = 1 + easeIn3(zt) * 6.5;
        const out = zt > 0.85 ? Math.max(0, 1 - (zt - 0.85) / 0.15) : 1;
        drawCell(scale, fade * out);
        drawLabel(zt > 0.5 ? 'Nucleus' : 'Cell', fade * out);
      } else if (t < T_CHROMO) {                          // chromosome (X)
        const inn = smooth((t - T_ZOOM) / 320), out = t > T_CHROMO - 260 ? smooth((T_CHROMO - t) / 260) : 1;
        drawChromosome(1, inn * out);
        drawLabel('Chromosome', inn * out);
      } else if (t < T_HIST) {                            // chromosome → nucleosome (histone + wound DNA)
        const p = smooth((t - T_CHROMO) / (T_HIST - T_CHROMO));
        if (p < 1) drawChromosome(1 + p * 0.5, 1 - p);
        drawDNA(0, rot, p, p);
        drawLabel('Histone · DNA', smooth(p * 1.6));
      } else if (t < T_UNWIND) {                          // DNA opens off the histone
        const u = smooth((t - T_HIST) / (T_UNWIND - T_HIST));
        drawDNA(u, rot, 1, 1 - u);
        drawLabel('DNA', 1 - smooth(u) * 0.6);
      } else if (t < T_WRITE) {                           // the strand writes the name
        const p = smooth((t - T_UNWIND) / (T_WRITE - T_UNWIND));
        drawDNA(1, rot, Math.max(0, 1 - p * 0.85), 0);
        drawName(p, 1);
      } else if (t < T_END) {
        drawName(1, 1);
      } else { clearTimeout(safetyTimer); dismiss(); return; }

      animId = requestAnimationFrame(drawIntro);
    }
    animId = requestAnimationFrame(drawIntro);

    function frame() { return; /* legacy boot animation — replaced by drawIntro above */
      const t = 0;

      // Clear with trail
      ctx.fillStyle = 'rgba(5, 10, 18, 0.22)';
      ctx.fillRect(0, 0, W, H);

      if (t < PHASE1_END) {
        /* ── Phase 1: DNA Helix + orbiting words ── */
        const prog = t / PHASE1_END;
        const helixH = H * 0.55;
        const helixTop = cy - helixH / 2;
        const helixR = Math.min(W * 0.12, 80);
        const spin = t * 0.003;

        // Strand A
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
          const f = i / 60;
          const x = cx + Math.cos(f * Math.PI * 4 + spin) * helixR * prog;
          const y = helixTop + f * helixH;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 15;
        ctx.globalAlpha = prog;
        ctx.stroke();

        // Strand B
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
          const f = i / 60;
          const x = cx + Math.cos(f * Math.PI * 4 + spin + Math.PI) * helixR * prog;
          const y = helixTop + f * helixH;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#b44dff';
        ctx.shadowColor = '#b44dff';
        ctx.stroke();

        // Base pairs
        for (let i = 0; i <= 12; i++) {
          const f = i / 12;
          const y = helixTop + f * helixH;
          const xA = cx + Math.cos(f * Math.PI * 4 * (60/12) + spin) * helixR * prog;
          const xB = cx + Math.cos(f * Math.PI * 4 * (60/12) + spin + Math.PI) * helixR * prog;
          ctx.beginPath();
          ctx.moveTo(xA, y); ctx.lineTo(xB, y);
          ctx.strokeStyle = '#00e5ff';
          ctx.shadowColor = '#00e5ff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Orbiting words
        const wordR = Math.min(W, H) * 0.38;
        ctx.font = `bold ${Math.max(10, 14 * prog)}px "JetBrains Mono"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const WCOLS = ['#39ff14','#00e5ff','#b44dff','#ff9f43','#39ff14','#00e5ff','#b44dff','#ff9f43'];
        WORDS.forEach((word, i) => {
          const angle = spin * 0.6 + (Math.PI * 2 / WORDS.length) * i;
          const x = cx + Math.cos(angle) * wordR;
          const y = cy + Math.sin(angle) * wordR;
          ctx.fillStyle = WCOLS[i];
          ctx.shadowColor = WCOLS[i];
          ctx.shadowBlur = 10;
          ctx.globalAlpha = prog * 0.85;
          ctx.fillText(word, x, y);
        });
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;

      } else if (t < PHASE2_END) {
        /* ── Phase 2: Centrifuge Spin-up + Collapse ── */
        const prog = (t - PHASE1_END) / (PHASE2_END - PHASE1_END);
        const easedProg = Math.pow(prog, 4); // exponential acceleration
        const wordR = Math.min(W, H) * 0.38 * (1 - easedProg);
        const spin = t * (0.004 + easedProg * 0.15);
        const WCOLS = ['#39ff14','#00e5ff','#b44dff','#ff9f43','#39ff14','#00e5ff','#b44dff','#ff9f43'];

        // Words spiral inward at high speed
        WORDS.forEach((word, i) => {
          const angle = spin + (Math.PI * 2 / WORDS.length) * i;
          const x = cx + Math.cos(angle) * wordR;
          const y = cy + Math.sin(angle) * wordR;
          const fs = Math.max(8, 16 * (1 - easedProg));
          ctx.font = `bold ${fs}px "JetBrains Mono"`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = WCOLS[i];
          ctx.shadowColor = WCOLS[i];
          ctx.shadowBlur = 15 * easedProg;
          ctx.globalAlpha = 1 - easedProg * 0.6;
          ctx.fillText(word, x, y);
        });

        // Central core forms
        const coreR = 8 + easedProg * 40;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
        ctx.fillStyle = '#39ff14';
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 30 * easedProg;
        ctx.globalAlpha = easedProg;
        ctx.fill();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;

      } else if (t < PHASE3_END) {
        /* ── Phase 3: Burst + Name Reveal ── */
        const prog = (t - PHASE2_END) / (PHASE3_END - PHASE2_END);

        // Spawn burst once
        if (!burstSpawned) { spawnBurst(); burstSpawned = true; }

        // Flash white at start
        if (prog < 0.12) {
          ctx.fillStyle = `rgba(255,255,255,${1 - prog / 0.12})`;
          ctx.fillRect(0, 0, W, H);
        }

        // Animate burst particles
        for (let i = burst.length - 1; i >= 0; i--) {
          const p = burst[i];
          p.x += p.vx; p.y += p.vy;
          p.vx *= 0.94; p.vy *= 0.94;
          p.life -= 0.015;
          if (p.life <= 0) { burst.splice(i, 1); continue; }
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
          ctx.fillStyle = p.col;
          ctx.shadowColor = p.col;
          ctx.shadowBlur = 8;
          ctx.globalAlpha = p.life;
          ctx.fill();
        }
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;

        // Type the name letter by letter
        if (t - lastNameType > 55 && nameTyped < NAME.length) {
          nameTyped++;
          lastNameType = t;
        }
        const nameSize = Math.min(W * 0.085, 72);
        ctx.font = `900 ${nameSize}px "Syne"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Main text
        ctx.fillStyle = '#39ff14';
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 25;
        ctx.globalAlpha = 1;
        ctx.fillText(NAME.slice(0, nameTyped), cx, cy);

        // Blinking cursor
        if (nameTyped < NAME.length || Math.floor(t / 400) % 2 === 0) {
          ctx.fillStyle = '#39ff14';
          ctx.fillText('█', cx + ctx.measureText(NAME.slice(0, nameTyped)).width / 2 + 6, cy);
        }

        // Sub text types slower
        if (nameTyped === NAME.length && t - lastSubType > 35 && subTyped < SUB.length) {
          subTyped++;
          lastSubType = t;
        }
        if (subTyped > 0) {
          ctx.font = `600 ${Math.min(W * 0.022, 18)}px "JetBrains Mono"`;
          ctx.fillStyle = '#00e5ff';
          ctx.shadowColor = '#00e5ff';
          ctx.shadowBlur = 12;
          ctx.fillText(SUB.slice(0, subTyped), cx, cy + nameSize * 0.85);
        }

        // Progress bar at bottom
        ctx.fillStyle = 'rgba(57,255,20,0.15)';
        ctx.fillRect(W * 0.1, H - 40, W * 0.8, 3);
        ctx.fillStyle = '#39ff14';
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 8;
        ctx.fillRect(W * 0.1, H - 40, W * 0.8 * prog, 3);

      } else if (t < PHASE4_END) {
        /* ── Phase 4: Hold ── */
        const prog = (t - PHASE3_END) / (PHASE4_END - PHASE3_END);

        // Remaining burst particles
        for (let i = burst.length - 1; i >= 0; i--) {
          const p = burst[i];
          p.x += p.vx; p.y += p.vy;
          p.life -= 0.02;
          if (p.life <= 0) { burst.splice(i, 1); continue; }
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
          ctx.fillStyle = p.col;
          ctx.globalAlpha = p.life * 0.5;
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        const nameSize = Math.min(W * 0.085, 72);
        ctx.font = `900 ${nameSize}px "Syne"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#39ff14';
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 18;
        ctx.globalAlpha = 1 - prog;
        ctx.fillText(NAME, cx, cy);
        ctx.font = `600 ${Math.min(W * 0.022, 18)}px "JetBrains Mono"`;
        ctx.fillStyle = '#00e5ff';
        ctx.fillText(SUB, cx, cy + nameSize * 0.85);
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;

      } else {
        clearTimeout(safetyTimer);
        dismiss();
        return;
      }

      animId = requestAnimationFrame(frame);
    }
  })();

  /* ============================================================
     PANEL-OPEN OBSERVER
     Watches aria-hidden="false" on detail-screen (same as script.js).
     Fires panel-specific effect initializers.
  ============================================================ */
  const detailScreen  = document.getElementById('detail-screen');
  const detailContent = document.getElementById('detail-content');

  if (detailScreen && detailContent) {
    // Watch childList of detail-content (fired AFTER script.js cloneNodes)
    const co = new MutationObserver(() => {
      setTimeout(() => {
        if (detailScreen.getAttribute('aria-hidden') !== 'false') return;

        const panelInner = detailContent.querySelector('[id^="detail-"]');
        if (panelInner && window._trackPanelOpen) {
          const id = panelInner.id.replace('detail-', '');
          window._trackPanelOpen(id);
        }

        tryInitPlasmid();
        tryInitKinetics();
        tryInitGrowthCurve();
        tryInitSystems();
        tryInitRamachandran();
        tryInit2DGel();
        tryInitPCR();
        tryInitSDS();
        tryInitChromatogram();
        tryInitPetri();
        tryInitMicroscope();
        tryInitSynapse();
        tryInitCells();
      }, 90);
    });
    co.observe(detailContent, { childList: true });
  }

  /* ============================================================
     0. CORE PLASMID / GENOME MAP — navigation hub (Core panel)
     A circular plasmid: each feature arc = a site section.
     Hover → tooltip; click → opens that section. A rotating
     read-head sweeps the ring. Pairs with the .plasmid-nav links.
  ============================================================ */
  function tryInitPlasmid() {
    const canvas = document.getElementById('plasmid-canvas');
    if (!canvas || canvas._plasmidInit) return;
    canvas._plasmidInit = true;

    const ctx = canvas.getContext('2d');
    const tip = document.getElementById('plasmid-tip');

    const FEATURES = [
      { id: 'research',   label: 'Remac-PET',    sub: 'Bioremediation · PETase N233K',  color: '#39ff14' },
      { id: 'about',      label: 'Profile',      sub: 'GDP/ALCOA++ · facilitation',     color: '#00e5ff' },
      { id: 'experience', label: 'Experience',   sub: 'ParSEC · PU graduate research',  color: '#ff9f43' },
      { id: 'education',  label: 'Education',     sub: 'M.Sc. Biochem · B.Sc.',          color: '#1D9E75' },
      { id: 'skills',     label: 'Skills',       sub: 'PCR · PyMOL · BLAST · GDP',       color: '#b44dff' },
      { id: 'achieve',    label: 'Awards',       sub: 'CSIR JRF · AIR 153',             color: '#ff3366' },
      { id: 'ambition',   label: 'Ambition',     sub: 'Ashram-hospitals · living labs', color: '#b44dff' },
      { id: 'life',       label: 'Beyond Bench', sub: 'Athletics · narrative science',  color: '#ff9f43' },
      { id: 'contact',    label: 'Contact',      sub: 'Catalyze synergy',               color: '#00e5ff' },
    ];

    let W, H, cx, cy, R, ringW, raf = null, rot = -Math.PI / 2, hoverIdx = -1;
    let arcs = [];
    const GAP = 0.05;

    function computeArcs() {
      const n = FEATURES.length;
      const seg = (Math.PI * 2) / n;
      arcs = FEATURES.map((f, i) => {
        const start = -Math.PI / 2 + i * seg + GAP / 2;
        const end   = -Math.PI / 2 + (i + 1) * seg - GAP / 2;
        return Object.assign({}, f, { start, end, mid: (start + end) / 2 });
      });
    }

    function resize() {
      const wrap = canvas.parentElement;
      W = (wrap ? wrap.clientWidth : 480) || 480;
      H = Math.min(W, 340);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2; cy = H / 2;
      R = Math.min(W, H) * 0.30;
      ringW = Math.max(9, R * 0.17);
      computeArcs();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Backbone double-ring
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(150,170,230,0.12)';
      ctx.beginPath(); ctx.arc(cx, cy, R + ringW * 0.5 + 3, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R - ringW * 0.5 - 3, 0, Math.PI * 2); ctx.stroke();

      // Restriction-site ticks
      ctx.strokeStyle = 'rgba(180,200,255,0.12)';
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const r1 = R + ringW * 0.5 + 3, r2 = r1 + (i % 5 === 0 ? 6 : 3);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.stroke();
      }

      // Feature arcs + labels
      arcs.forEach((arc, i) => {
        const hov = i === hoverIdx;
        ctx.lineCap = 'butt';
        ctx.lineWidth = hov ? ringW * 1.3 : ringW;
        ctx.strokeStyle = arc.color;
        ctx.globalAlpha = hov ? 1 : 0.82;
        ctx.shadowColor = arc.color;
        ctx.shadowBlur = hov ? 18 : 6;
        ctx.beginPath();
        ctx.arc(cx, cy, R, arc.start, arc.end);
        ctx.stroke();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;

        // Tick + label outward
        const baseR = R + ringW * 0.5;
        const lr = baseR + (hov ? 15 : 11);
        const lx = cx + Math.cos(arc.mid) * lr;
        const ly = cy + Math.sin(arc.mid) * lr;
        ctx.strokeStyle = arc.color; ctx.globalAlpha = hov ? 0.9 : 0.45; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(arc.mid) * baseR, cy + Math.sin(arc.mid) * baseR);
        ctx.lineTo(lx, ly); ctx.stroke();
        ctx.globalAlpha = 1;

        const right = Math.cos(arc.mid) >= -0.01;
        ctx.font = (hov ? 700 : 600) + ' ' + Math.max(8.5, W * 0.02) + 'px "JetBrains Mono",monospace';
        ctx.textAlign = right ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = arc.color;
        ctx.shadowColor = arc.color; ctx.shadowBlur = hov ? 10 : 0;
        ctx.fillText(arc.label, lx + (right ? 4 : -4), ly);
        ctx.shadowBlur = 0;
      });

      // Center hub glow
      const hubR = Math.max(8, R - ringW * 0.5 - 8);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, hubR);
      g.addColorStop(0, 'rgba(57,255,20,0.16)');
      g.addColorStop(1, 'rgba(57,255,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, hubR, 0, Math.PI * 2); ctx.fill();

      // Read-head sweep
      ctx.save();
      ctx.strokeStyle = 'rgba(0,229,255,0.45)';
      ctx.lineWidth = 1.5; ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(rot) * (R + ringW * 0.5), cy + Math.sin(rot) * (R + ringW * 0.5));
      ctx.stroke();
      ctx.restore();

      // Hub labels
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#39ff14'; ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 12;
      ctx.font = '800 ' + Math.max(13, W * 0.045) + 'px "Syne",system-ui,sans-serif';
      ctx.fillText('SKD', cx, cy - 5);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(220,228,255,0.55)';
      ctx.font = '600 ' + Math.max(7, W * 0.016) + 'px "JetBrains Mono",monospace';
      ctx.fillText('ori · AIR 153', cx, cy + 11);
    }

    function hit(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      const mx = (clientX - r.left), my = (clientY - r.top);
      const dx = mx - cx, dy = my - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < R - ringW * 0.9 || dist > R + ringW + 22) return -1;
      const a = Math.atan2(dy, dx);
      for (let i = 0; i < arcs.length; i++) {
        let aa = a;
        while (aa < arcs[i].start) aa += Math.PI * 2;
        while (aa > arcs[i].start + Math.PI * 2) aa -= Math.PI * 2;
        if (aa >= arcs[i].start && aa <= arcs[i].end) return i;
      }
      return -1;
    }

    function navTo(id) {
      const node = document.querySelector('.mol-node[data-detail="' + id + '"]');
      if (window._openDetail) window._openDetail(id, false, node);
    }

    canvas.addEventListener('mousemove', (e) => {
      const idx = hit(e.clientX, e.clientY);
      if (idx !== hoverIdx) { hoverIdx = idx; if (REDUCED) draw(); }
      if (idx >= 0 && tip) {
        const r = canvas.getBoundingClientRect();
        tip.textContent = arcs[idx].label + ' — ' + arcs[idx].sub;
        tip.style.left = (e.clientX - r.left) + 'px';
        tip.style.top  = (e.clientY - r.top - 34) + 'px';
        tip.style.borderColor = arcs[idx].color;
        tip.style.color = arcs[idx].color;
        tip.classList.add('visible');
        canvas.style.cursor = 'pointer';
      } else if (tip) {
        tip.classList.remove('visible');
        canvas.style.cursor = 'default';
      }
    });
    canvas.addEventListener('mouseleave', () => {
      hoverIdx = -1; if (tip) tip.classList.remove('visible'); if (REDUCED) draw();
    });
    canvas.addEventListener('click', (e) => {
      const idx = hit(e.clientX, e.clientY);
      if (idx >= 0) navTo(arcs[idx].id);
    });

    // Wire the visible/accessible section links (also keyboard-navigable)
    const nav = canvas.closest('.detail-content, .detail-panel') || document;
    nav.querySelectorAll('.plasmid-nav a[data-detail]').forEach((a) => {
      if (a._wired) return; a._wired = true;
      a.addEventListener('click', (e) => { e.preventDefault(); navTo(a.dataset.detail); });
    });

    function frame() {
      // Leak guard: stop when the panel (and this canvas) leaves the DOM
      if (!document.body.contains(canvas)) { canvas._plasmidInit = false; return; }
      rot += 0.012;
      draw();
      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', () => {
      if (!document.body.contains(canvas)) return; // stale canvas from a closed panel
      resize();
      if (REDUCED) draw();
    });
    if (REDUCED) draw();
    else frame();
  }

  /* ============================================================
     0B. DEGRADATION KINETICS — Research panel
     Substrate (nanoplastic) decays exponentially while product
     (monomers) accumulates. Animates in, then hover reads [S]/[P].
  ============================================================ */
  function tryInitKinetics() {
    const canvas = document.getElementById('kinetics-canvas');
    if (!canvas || canvas._kinInit) return;
    canvas._kinInit = true;

    const ctx = canvas.getContext('2d');
    const tip = document.getElementById('kinetics-tip');
    const PAD = { l: 38, r: 14, t: 26, b: 26 };
    const DUR = 2600, k = 3.3, N0 = 1000;
    let W, H, raf = null, startTs = null, hoverX = null, done = false;

    const S = (t) => Math.exp(-k * t);
    const P = (t) => 1 - Math.exp(-k * t);
    const GW = () => W - PAD.l - PAD.r;
    const GH = () => H - PAD.t - PAD.b;
    const X = (t) => PAD.l + t * GW();
    const Y = (v) => PAD.t + (1 - v) * GH();

    function resize() {
      const wrap = canvas.parentElement;
      W = (wrap ? wrap.clientWidth : 480) || 480;
      H = Math.min(Math.max(W * 0.5, 160), 210);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function grid() {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(180,190,255,0.4)';
      ctx.font = '8px "JetBrains Mono",monospace';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
        const y = Y(v);
        ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + GW(), y); ctx.stroke();
        ctx.fillText(Math.round(v * 100) + '', PAD.l - 5, y);
      });
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, PAD.t + GH());
      ctx.lineTo(PAD.l + GW(), PAD.t + GH()); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(180,190,255,0.4)';
      ctx.fillText('reaction time →', PAD.l + GW() / 2, H - 6);
    }

    function curve(fn, col, prog) {
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.shadowColor = col;
      ctx.shadowBlur = 8; ctx.lineJoin = 'round';
      ctx.beginPath();
      const steps = 90;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * prog;
        const x = X(t), y = Y(fn(t));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(X(prog), Y(fn(prog)), 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    function draw(prog) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(5,10,18,0.55)'; ctx.fillRect(0, 0, W, H);
      grid();
      curve(S, '#ff9f43', prog);
      curve(P, '#39ff14', prog);

      ctx.font = '600 9px "JetBrains Mono",monospace'; ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ff9f43';
      ctx.fillText('▼ nanoplastic ' + Math.round(N0 * S(prog)), PAD.l + 2, 5);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#39ff14';
      ctx.fillText('monomers ' + Math.round(N0 * P(prog)) + ' ▲', PAD.l + GW(), 5);

      if (hoverX != null && done) {
        const t = Math.max(0, Math.min(1, (hoverX - PAD.l) / GW()));
        const x = X(t);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + GH()); ctx.stroke();
        ctx.setLineDash([]);
        [['#ff9f43', S], ['#39ff14', P]].forEach(([c, fn]) => {
          ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, Y(fn(t)), 3, 0, Math.PI * 2); ctx.fill();
        });
        if (tip) {
          tip.innerHTML = 'plastic ' + Math.round(S(t) * 100) + '% · monomers ' + Math.round(P(t) * 100) + '%';
          tip.style.left = x + 'px'; tip.style.top = (PAD.t - 4) + 'px';
          tip.style.borderColor = '#39ff14'; tip.style.color = '#eef2ff';
          tip.classList.add('visible');
        }
      }
    }

    function frame(ts) {
      if (!document.body.contains(canvas)) { canvas._kinInit = false; return; }
      if (!startTs) startTs = ts;
      const p = Math.min((ts - startTs) / DUR, 1);
      draw(1 - Math.pow(1 - p, 2));
      if (p < 1) raf = requestAnimationFrame(frame);
      else done = true;
    }

    canvas.addEventListener('mousemove', (e) => {
      if (!done) return;
      hoverX = e.clientX - canvas.getBoundingClientRect().left;
      draw(1);
    });
    canvas.addEventListener('mouseleave', () => {
      hoverX = null; if (tip) tip.classList.remove('visible'); if (done) draw(1);
    });

    resize();
    window.addEventListener('resize', () => {
      if (!document.body.contains(canvas)) return; resize(); draw(1);
    });
    // Static (no reveal animation) so Research opens instantly and never repaints while scrolling.
    done = true; draw(1);
  }

  /* ============================================================
     0C. CAREER GROWTH CURVE — Experience panel
     Logistic OD600 growth (lag → log → stationary) with role
     milestones plotted on the curve. Hover a point for the role.
  ============================================================ */
  function tryInitGrowthCurve() {
    const canvas = document.getElementById('growth-canvas');
    if (!canvas || canvas._growthInit) return;
    canvas._growthInit = true;

    const ctx = canvas.getContext('2d');
    const tip = document.getElementById('growth-tip');
    const PAD = { l: 34, r: 16, t: 24, b: 30 };
    const DUR = 2200, B = 9;
    let W, H, raf = null, startTs = null, hoverIdx = -1, done = false;

    const yOf = (t) => 1 / (1 + Math.exp(-B * (t - 0.5)));
    const y0 = yOf(0), y1 = yOf(1);
    const norm = (t) => (yOf(t) - y0) / (y1 - y0);

    const POINTS = [
      { t: 0.12, label: '2023', title: 'M.Sc. Researcher · PU', sub: 'Remac-PET System conceptualised', color: '#00e5ff' },
      { t: 0.45, label: "Jun '25", title: 'CSIR NET JRF', sub: 'AIR 153 · Life Sciences', color: '#ff3366' },
      { t: 0.72, label: "Apr '26", title: 'Science Communicator', sub: 'Curves of Thought · N ≈ 1,568', color: '#39ff14' },
      { t: 0.92, label: "Jun '26", title: 'Programming Associate', sub: 'Promoted · quality & pedagogy lead', color: '#ff9f43' },
    ];
    const PHASES = [
      { t: 0.10, name: 'LAG' }, { t: 0.50, name: 'LOG' }, { t: 0.86, name: 'STATIONARY' },
    ];

    const GW = () => W - PAD.l - PAD.r;
    const GH = () => H - PAD.t - PAD.b;
    const X = (t) => PAD.l + t * GW();
    const Y = (v) => PAD.t + (1 - v) * GH();

    function resize() {
      const wrap = canvas.parentElement;
      W = (wrap ? wrap.clientWidth : 480) || 480;
      H = Math.min(Math.max(W * 0.52, 170), 230);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      POINTS.forEach((p) => { p._x = X(p.t); p._y = Y(norm(p.t)); });
    }

    function draw(prog) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(5,10,18,0.55)'; ctx.fillRect(0, 0, W, H);

      // axes
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, PAD.t + GH());
      ctx.lineTo(PAD.l + GW(), PAD.t + GH()); ctx.stroke();
      ctx.fillStyle = 'rgba(180,190,255,0.4)';
      ctx.font = '8px "JetBrains Mono",monospace';
      ctx.save(); ctx.translate(11, PAD.t + GH() / 2); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center'; ctx.fillText('OD₆₀₀ (impact)', 0, 0); ctx.restore();
      ctx.textAlign = 'center'; ctx.fillText('time →', PAD.l + GW() / 2, H - 7);

      // phase bands
      PHASES.forEach((ph) => {
        ctx.fillStyle = 'rgba(255,159,67,0.32)';
        ctx.font = '7.5px "JetBrains Mono",monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ph.name, X(ph.t), PAD.t + 8);
      });

      // growth curve
      ctx.strokeStyle = '#ff9f43'; ctx.lineWidth = 2.2; ctx.shadowColor = '#ff9f43';
      ctx.shadowBlur = 9; ctx.lineJoin = 'round'; ctx.beginPath();
      const steps = 90;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * prog;
        const x = X(t), y = Y(norm(t));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.shadowBlur = 0;

      // milestone dots (revealed as the curve passes them)
      POINTS.forEach((p, i) => {
        if (p.t > prog + 0.001) return;
        const hov = i === hoverIdx;
        ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = hov ? 18 : 10;
        ctx.beginPath(); ctx.arc(p._x, p._y, hov ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = p.color; ctx.globalAlpha = hov ? 1 : 0.8;
        ctx.font = (hov ? 700 : 600) + ' 8.5px "JetBrains Mono",monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.label, p._x, p._y - (hov ? 13 : 11));
        ctx.globalAlpha = 1;
      });
    }

    function hit(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      const mx = clientX - r.left, my = clientY - r.top;
      for (let i = 0; i < POINTS.length; i++) {
        if (Math.hypot(POINTS[i]._x - mx, POINTS[i]._y - my) < 16) return i;
      }
      return -1;
    }

    canvas.addEventListener('mousemove', (e) => {
      if (!done) return;
      const idx = hit(e.clientX, e.clientY);
      if (idx !== hoverIdx) { hoverIdx = idx; draw(1); }
      if (idx >= 0 && tip) {
        const r = canvas.getBoundingClientRect();
        tip.innerHTML = '<strong>' + POINTS[idx].title + '</strong><br>' + POINTS[idx].sub;
        tip.style.left = (e.clientX - r.left) + 'px';
        tip.style.top = (e.clientY - r.top - 12) + 'px';
        tip.style.whiteSpace = 'normal'; tip.style.maxWidth = '180px';
        tip.style.borderColor = POINTS[idx].color; tip.style.color = '#eef2ff';
        tip.classList.add('visible');
        canvas.style.cursor = 'pointer';
      } else if (tip) {
        tip.classList.remove('visible'); canvas.style.cursor = 'default';
      }
    });
    canvas.addEventListener('mouseleave', () => {
      hoverIdx = -1; if (tip) tip.classList.remove('visible'); if (done) draw(1);
    });

    function frame(ts) {
      if (!document.body.contains(canvas)) { canvas._growthInit = false; return; }
      if (!startTs) startTs = ts;
      const p = Math.min((ts - startTs) / DUR, 1);
      draw(1 - Math.pow(1 - p, 2));
      if (p < 1) raf = requestAnimationFrame(frame);
      else done = true;
    }

    resize();
    window.addEventListener('resize', () => {
      if (!document.body.contains(canvas)) return; resize(); draw(done ? 1 : 0);
    });
    if (REDUCED) { done = true; draw(1); } else { raf = requestAnimationFrame(frame); }
  }

  /* ============================================================
     0D. SYSTEMS NETWORK GRAPH — Ambition panel
     Nodes = ambition components; edges = flows between them,
     with pulses travelling along each edge. Hover a node.
  ============================================================ */
  function tryInitSystems() {
    const canvas = document.getElementById('systems-canvas');
    if (!canvas || canvas._sysInit) return;
    canvas._sysInit = true;

    const ctx = canvas.getContext('2d');
    const tip = document.getElementById('systems-tip');

    const NODES = [
      { id: 'ashram', label: 'Ashram Network', sub: 'Self-sustaining cooperative core',  color: '#b44dff', x: 0.5,  y: 0.46, r: 19 },
      { id: 'hosp',   label: 'Hospitals',      sub: 'Integrated care, dignity-first',     color: '#00e5ff', x: 0.5,  y: 0.14, r: 13 },
      { id: 'labs',   label: 'Living Labs',    sub: 'Hands-on life-science exhibits',      color: '#39ff14', x: 0.86, y: 0.36, r: 13 },
      { id: 'edu',    label: 'Education',      sub: 'Empower the most vulnerable',         color: '#ff9f43', x: 0.80, y: 0.82, r: 13 },
      { id: 'thesis', label: 'Remac-PET',      sub: 'Independent bioremediation thesis',   color: '#ff3366', x: 0.20, y: 0.82, r: 13 },
      { id: 'sweat',  label: 'Sweat-equity',   sub: 'Agriculture · cottage industry',      color: '#ffd54f', x: 0.14, y: 0.36, r: 13 },
    ];
    const EDGES = [
      ['sweat', 'ashram'], ['ashram', 'hosp'], ['ashram', 'labs'], ['ashram', 'edu'],
      ['ashram', 'thesis'], ['labs', 'edu'], ['edu', 'thesis'], ['hosp', 'labs'], ['sweat', 'edu'],
    ];
    const byId = (id) => NODES.find((n) => n.id === id);

    let W, H, raf = null, t = 0, hoverId = null;
    const hexA = (h, a) => 'rgba(' + parseInt(h.slice(1, 3), 16) + ',' + parseInt(h.slice(3, 5), 16) + ',' + parseInt(h.slice(5, 7), 16) + ',' + a + ')';

    function resize() {
      const wrap = canvas.parentElement;
      W = (wrap ? wrap.clientWidth : 480) || 480;
      H = Math.min(Math.max(W * 0.5, 190), 232);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      NODES.forEach((n) => { n._x = n.x * W; n._y = n.y * H; });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.0024);
      EDGES.forEach((e, i) => {
        const a = byId(e[0]), b = byId(e[1]);
        const hl = hoverId && (e[0] === hoverId || e[1] === hoverId);
        const g = ctx.createLinearGradient(a._x, a._y, b._x, b._y);
        g.addColorStop(0, hexA(a.color, hl ? 0.75 : 0.28));
        g.addColorStop(1, hexA(b.color, hl ? 0.75 : 0.28));
        ctx.strokeStyle = g; ctx.lineWidth = hl ? 2.2 : 1.2;
        ctx.beginPath(); ctx.moveTo(a._x, a._y); ctx.lineTo(b._x, b._y); ctx.stroke();
        // flowing signal particles along the edge
        for (let k = 0; k < 2; k++) {
          const phase = ((t * 0.0009) + i * 0.13 + k * 0.5) % 1;
          const px = a._x + (b._x - a._x) * phase, py = a._y + (b._y - a._y) * phase;
          ctx.fillStyle = hl ? '#ffffff' : hexA(b.color, 0.85);
          ctx.shadowColor = b.color; ctx.shadowBlur = hl ? 12 : 7;
          ctx.beginPath(); ctx.arc(px, py, hl ? 2.8 : 2, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        }
      });
      NODES.forEach((n) => {
        const hov = n.id === hoverId;
        const central = n.id === 'ashram';
        const br = n.r * (1 + (central ? 0.06 : 0.03) * Math.sin(t * 0.003 + n._x)); // breathing
        if (central) { // pulsing halo ring on the core
          ctx.strokeStyle = hexA(n.color, 0.28 * (1 - pulse)); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(n._x, n._y, br + 6 + pulse * 11, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(5,10,18,0.92)';
        ctx.strokeStyle = n.color; ctx.lineWidth = hov ? 2.6 : 1.8;
        ctx.shadowColor = n.color; ctx.shadowBlur = hov ? 22 : (central ? 16 : 10);
        ctx.beginPath(); ctx.arc(n._x, n._y, br, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = hexA(n.color, 0.45 + 0.35 * pulse); // glowing core dot
        ctx.beginPath(); ctx.arc(n._x, n._y, br * 0.34, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = n.color; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.font = (hov ? 700 : 600) + ' ' + Math.max(7.5, W * 0.0155) + 'px "JetBrains Mono",monospace';
        ctx.fillText(n.label, n._x, n._y + br + 4);
      });
    }

    function hit(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      const mx = clientX - r.left, my = clientY - r.top;
      for (const n of NODES) if (Math.hypot(n._x - mx, n._y - my) < n.r + 4) return n;
      return null;
    }

    canvas.addEventListener('mousemove', (e) => {
      const n = hit(e.clientX, e.clientY);
      hoverId = n ? n.id : null;
      if (n && tip) {
        const r = canvas.getBoundingClientRect();
        tip.innerHTML = '<strong>' + n.label + '</strong><br>' + n.sub;
        tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top - 12) + 'px';
        tip.style.whiteSpace = 'normal'; tip.style.maxWidth = '180px';
        tip.style.borderColor = n.color; tip.style.color = '#eef2ff';
        tip.classList.add('visible'); canvas.style.cursor = 'pointer';
      } else if (tip) { tip.classList.remove('visible'); canvas.style.cursor = 'default'; }
      if (REDUCED) draw();
    });
    canvas.addEventListener('mouseleave', () => { hoverId = null; if (tip) tip.classList.remove('visible'); if (REDUCED) draw(); });

    function frame(ts) {
      if (!document.body.contains(canvas)) { canvas._sysInit = false; return; }
      t = ts; draw(); raf = requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener('resize', () => { if (!document.body.contains(canvas)) return; resize(); draw(); });
    if (REDUCED) draw(); else raf = requestAnimationFrame(frame);
  }

  /* ============================================================
     0E. RAMACHANDRAN PLOT — About panel
     φ/ψ scatter; each residue is a working trait sitting in its
     favoured region. Dots fade in, then hover for the trait.
  ============================================================ */
  function tryInitRamachandran() {
    const canvas = document.getElementById('rama-canvas');
    if (!canvas || canvas._ramaInit) return;
    canvas._ramaInit = true;

    const ctx = canvas.getContext('2d');
    const tip = document.getElementById('rama-tip');
    const PAD = { l: 32, r: 14, t: 14, b: 26 };
    let W, H, raf = null, startTs = null, hoverIdx = -1, done = false;

    const REGIONS = [
      { cx: -63,  cy: -43, rx: 48, ry: 38, label: 'α-helix', color: 'rgba(0,229,255,0.10)' },
      { cx: -115, cy: 130, rx: 55, ry: 42, label: 'β-sheet', color: 'rgba(57,255,20,0.09)' },
      { cx: 60,   cy: 45,  rx: 36, ry: 30, label: 'L-α',     color: 'rgba(180,77,255,0.10)' },
    ];
    const TRAITS = [
      { phi: -60,  psi: -45, label: 'Reproducible workflows',     color: '#00e5ff' },
      { phi: -72,  psi: -30, label: 'GDP / ALCOA++ discipline',   color: '#00e5ff' },
      { phi: -52,  psi: -58, label: 'Scientific integrity',       color: '#00e5ff' },
      { phi: -120, psi: 132, label: 'Independent problem-solving',color: '#39ff14' },
      { phi: -100, psi: 118, label: 'Computational logic',        color: '#39ff14' },
      { phi: -132, psi: 145, label: 'Fearless experimentation',   color: '#39ff14' },
      { phi: 60,   psi: 45,  label: 'Science facilitation',       color: '#b44dff' },
    ];

    const GW = () => W - PAD.l - PAD.r, GH = () => H - PAD.t - PAD.b;
    const X = (phi) => PAD.l + ((phi + 180) / 360) * GW();
    const Y = (psi) => PAD.t + (1 - (psi + 180) / 360) * GH();

    function resize() {
      const wrap = canvas.parentElement;
      W = (wrap ? wrap.clientWidth : 480) || 480;
      H = Math.min(Math.max(W * 0.62, 200), 260);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      TRAITS.forEach((p) => { p._x = X(p.phi); p._y = Y(p.psi); });
    }

    function draw(prog) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(5,10,18,0.55)'; ctx.fillRect(0, 0, W, H);

      // frame + zero axes
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1;
      ctx.strokeRect(PAD.l, PAD.t, GW(), GH());
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(X(0), PAD.t); ctx.lineTo(X(0), PAD.t + GH());
      ctx.moveTo(PAD.l, Y(0)); ctx.lineTo(PAD.l + GW(), Y(0)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(180,190,255,0.4)'; ctx.font = '8px "JetBrains Mono",monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('φ →', PAD.l + GW() / 2, H - 6);
      ctx.save(); ctx.translate(10, PAD.t + GH() / 2); ctx.rotate(-Math.PI / 2);
      ctx.fillText('ψ →', 0, 0); ctx.restore();

      // regions
      REGIONS.forEach((rg) => {
        ctx.save();
        ctx.translate(X(rg.cx), Y(rg.cy));
        ctx.scale(rg.rx / 360 * GW() / 1, rg.ry / 360 * GH() / 1);
        ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fillStyle = rg.color; ctx.fill();
        ctx.restore();
        ctx.fillStyle = rg.color.replace(/0\.\d+\)/, '0.7)');
        ctx.font = '8px "JetBrains Mono",monospace'; ctx.textAlign = 'center';
        ctx.fillText(rg.label, X(rg.cx), Y(rg.cy));
      });

      // trait dots (fade-in staggered)
      TRAITS.forEach((p, i) => {
        const a = Math.max(0, Math.min(1, prog * TRAITS.length - i));
        if (a <= 0) return;
        const hov = i === hoverIdx;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = hov ? 16 : 8;
        ctx.beginPath(); ctx.arc(p._x, p._y, hov ? 6 : 4.2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      });
    }

    function hit(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      const mx = clientX - r.left, my = clientY - r.top;
      for (let i = 0; i < TRAITS.length; i++)
        if (Math.hypot(TRAITS[i]._x - mx, TRAITS[i]._y - my) < 13) return i;
      return -1;
    }

    canvas.addEventListener('mousemove', (e) => {
      if (!done) return;
      const idx = hit(e.clientX, e.clientY);
      if (idx !== hoverIdx) { hoverIdx = idx; draw(1); }
      if (idx >= 0 && tip) {
        const r = canvas.getBoundingClientRect();
        tip.textContent = TRAITS[idx].label;
        tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top - 12) + 'px';
        tip.style.whiteSpace = 'normal'; tip.style.maxWidth = '160px';
        tip.style.borderColor = TRAITS[idx].color; tip.style.color = TRAITS[idx].color;
        tip.classList.add('visible'); canvas.style.cursor = 'pointer';
      } else if (tip) { tip.classList.remove('visible'); canvas.style.cursor = 'default'; }
    });
    canvas.addEventListener('mouseleave', () => { hoverIdx = -1; if (tip) tip.classList.remove('visible'); if (done) draw(1); });

    function frame(ts) {
      if (!document.body.contains(canvas)) { canvas._ramaInit = false; return; }
      if (!startTs) startTs = ts;
      const p = Math.min((ts - startTs) / 1300, 1);
      draw(p);
      if (p < 1) raf = requestAnimationFrame(frame); else done = true;
    }
    resize();
    window.addEventListener('resize', () => { if (!document.body.contains(canvas)) return; resize(); draw(done ? 1 : 0); });
    if (REDUCED) { done = true; draw(1); } else raf = requestAnimationFrame(frame);
  }

  /* ============================================================
     0F. 2-D GEL (PROTEOME SPOT MAP) — Life panel
     pI × MW plane; each spot is an interest, size = intensity.
  ============================================================ */
  function tryInit2DGel() {
    const canvas = document.getElementById('gel2d-canvas');
    if (!canvas || canvas._gel2dInit) return;
    canvas._gel2dInit = true;

    const ctx = canvas.getContext('2d');
    const tip = document.getElementById('gel2d-tip');
    const PAD = { l: 34, r: 14, t: 14, b: 26 };
    let W, H, raf = null, startTs = null, hoverIdx = -1, done = false;

    // pi: 3..10 (x), mw: 0..1 fraction (1 = high MW, top), size = spot radius px
    const SPOTS = [
      { label: 'Badminton · OIBT2025', pi: 4.4, mw: 0.74, size: 17, color: '#39ff14', lvl: 'Strongly expressed' },
      { label: 'Narrative science',     pi: 7.1, mw: 0.82, size: 16, color: '#ff9f43', lvl: 'Strongly expressed' },
      { label: 'Competitive BGMI',      pi: 6.0, mw: 0.46, size: 14, color: '#00e5ff', lvl: 'Highly expressed' },
      { label: 'Dermatological biochem',pi: 5.1, mw: 0.30, size: 13, color: '#b44dff', lvl: 'Expressed' },
      { label: 'PC hardware',           pi: 8.4, mw: 0.56, size: 12, color: '#00e5ff', lvl: 'Expressed' },
      { label: 'Languages · En/Hi/Od',  pi: 3.7, mw: 0.52, size: 13, color: '#ffd54f', lvl: 'Constitutive' },
      { label: 'Anime · Naruto, JJK',   pi: 6.7, mw: 0.20, size: 11, color: '#ff3366', lvl: 'Expressed' },
    ];

    const GW = () => W - PAD.l - PAD.r, GH = () => H - PAD.t - PAD.b;
    const X = (pi) => PAD.l + ((pi - 3) / 7) * GW();
    const Y = (mw) => PAD.t + (1 - mw) * GH();

    function resize() {
      const wrap = canvas.parentElement;
      W = (wrap ? wrap.clientWidth : 480) || 480;
      H = Math.min(Math.max(W * 0.6, 200), 260);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      SPOTS.forEach((s) => { s._x = X(s.pi); s._y = Y(s.mw); });
    }

    function draw(prog) {
      ctx.clearRect(0, 0, W, H);
      // gel background gradient
      const bg = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + GH());
      bg.addColorStop(0, 'rgba(14,20,34,0.9)'); bg.addColorStop(1, 'rgba(6,10,20,0.9)');
      ctx.fillStyle = bg; ctx.fillRect(PAD.l, PAD.t, GW(), GH());
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1;
      ctx.strokeRect(PAD.l, PAD.t, GW(), GH());

      // axis labels
      ctx.fillStyle = 'rgba(180,190,255,0.4)'; ctx.font = '8px "JetBrains Mono",monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('pI  (acidic → basic)', PAD.l + GW() / 2, H - 6);
      ctx.save(); ctx.translate(10, PAD.t + GH() / 2); ctx.rotate(-Math.PI / 2);
      ctx.fillText('MW (high → low)', 0, 0); ctx.restore();

      // spots
      SPOTS.forEach((s, i) => {
        const a = Math.max(0, Math.min(1, prog * SPOTS.length - i));
        if (a <= 0) return;
        const hov = i === hoverIdx;
        const r = s.size * (hov ? 1.18 : 1);
        const g = ctx.createRadialGradient(s._x, s._y, 0, s._x, s._y, r);
        g.addColorStop(0, s.color);
        g.addColorStop(0.55, s.color.length === 7 ? s.color + '88' : s.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = a * (hov ? 0.95 : 0.72);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(s._x, s._y, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });
    }

    function hit(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      const mx = clientX - r.left, my = clientY - r.top;
      let best = -1, bestD = 1e9;
      SPOTS.forEach((s, i) => {
        const d = Math.hypot(s._x - mx, s._y - my);
        if (d < s.size + 4 && d < bestD) { best = i; bestD = d; }
      });
      return best;
    }

    canvas.addEventListener('mousemove', (e) => {
      if (!done) return;
      const idx = hit(e.clientX, e.clientY);
      if (idx !== hoverIdx) { hoverIdx = idx; draw(1); }
      if (idx >= 0 && tip) {
        const r = canvas.getBoundingClientRect();
        tip.innerHTML = '<strong>' + SPOTS[idx].label + '</strong><br>' + SPOTS[idx].lvl;
        tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top - 12) + 'px';
        tip.style.whiteSpace = 'normal'; tip.style.maxWidth = '180px';
        tip.style.borderColor = SPOTS[idx].color; tip.style.color = '#eef2ff';
        tip.classList.add('visible'); canvas.style.cursor = 'pointer';
      } else if (tip) { tip.classList.remove('visible'); canvas.style.cursor = 'default'; }
    });
    canvas.addEventListener('mouseleave', () => { hoverIdx = -1; if (tip) tip.classList.remove('visible'); if (done) draw(1); });

    function frame(ts) {
      if (!document.body.contains(canvas)) { canvas._gel2dInit = false; return; }
      if (!startTs) startTs = ts;
      const p = Math.min((ts - startTs) / 1400, 1);
      draw(p);
      if (p < 1) raf = requestAnimationFrame(frame); else done = true;
    }
    resize();
    window.addEventListener('resize', () => { if (!document.body.contains(canvas)) return; resize(); draw(done ? 1 : 0); });
    if (REDUCED) { done = true; draw(1); } else raf = requestAnimationFrame(frame);
  }

  /* ============================================================
     0G. PCR THERMOCYCLER — Contact form send feedback
     On submit, overlays 3 thermal cycles (denature/anneal/extend)
     with doubling amplicons, then "✓ AMPLIFIED" and fades out.
  ============================================================ */
  function tryInitPCR() {
    const canvas = document.getElementById('pcr-canvas');
    if (!canvas || canvas._pcrInit) return;
    canvas._pcrInit = true;

    const ctx = canvas.getContext('2d');
    const form = document.getElementById('contact-form');
    if (!form) return;
    let W, H, raf = null;

    const CYCLES = 3;
    const STEPS = [
      { n: 'DENATURE', temp: 95, col: '#ff3366' },
      { n: 'ANNEAL',   temp: 55, col: '#00e5ff' },
      { n: 'EXTEND',   temp: 72, col: '#39ff14' },
    ];
    const STEP_MS = 430;
    const RUN_MS = CYCLES * STEPS.length * STEP_MS;
    const TOTAL = RUN_MS + 800;

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Size the drawing buffer to the overlay's OWN rendered box. The overlay is
      // position:absolute inset:0, so this is exactly the form area — keeping the
      // PCR animation perfectly aligned (don't override the CSS width/height:100%).
      W = canvas.clientWidth || (canvas.parentElement ? canvas.parentElement.clientWidth : 320);
      H = canvas.clientHeight || (canvas.parentElement ? canvas.parentElement.clientHeight : 240);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function run() {
      if (REDUCED) return;
      size();
      canvas.classList.add('active');
      let start = null;
      function frame(ts) {
        if (!start) start = ts;
        const el = ts - start;
        const totalSteps = CYCLES * STEPS.length;
        const stepIdx = Math.min(Math.floor(el / STEP_MS), totalSteps - 1);
        const cycle = Math.floor(stepIdx / STEPS.length) + 1;
        const step = STEPS[stepIdx % STEPS.length];
        const amplicons = Math.min(Math.pow(2, Math.min(Math.floor(el / (STEPS.length * STEP_MS)), CYCLES)), 64);
        const finished = el >= RUN_MS;

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(4,8,18,0.94)'; ctx.fillRect(0, 0, W, H);

        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = finished ? '#39ff14' : step.col;
        ctx.shadowColor = finished ? '#39ff14' : step.col; ctx.shadowBlur = 18;
        ctx.font = '800 ' + Math.max(22, W * 0.085) + 'px "Syne",system-ui,sans-serif';
        ctx.fillText(finished ? '✓ AMPLIFIED' : (step.temp + '°C'), W / 2, H / 2 - 12);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(220,228,255,0.82)';
        ctx.font = '600 ' + Math.max(9, W * 0.026) + 'px "JetBrains Mono",monospace';
        ctx.fillText(finished ? 'transmission sent' : ('CYCLE ' + cycle + '/' + CYCLES + ' · ' + step.n), W / 2, H / 2 + 14);

        // doubling amplicons row
        const dots = Math.round(amplicons);
        const shown = Math.min(dots, 32);
        const gapX = Math.min(14, (W * 0.7) / Math.max(shown, 1));
        const startX = W / 2 - (shown - 1) * gapX / 2;
        const by = H / 2 + 42;
        for (let i = 0; i < shown; i++) {
          ctx.fillStyle = finished ? '#39ff14' : '#00e5ff';
          ctx.globalAlpha = 0.85;
          ctx.beginPath(); ctx.arc(startX + i * gapX, by, 2.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (el < TOTAL) raf = requestAnimationFrame(frame);
        else { canvas.classList.remove('active'); ctx.clearRect(0, 0, W, H); }
      }
      raf = requestAnimationFrame(frame);
    }

    form.addEventListener('submit', () => run());
  }

  /* ============================================================
     3. SDS-PAGE GEL  — Skills panel
  ============================================================ */
  function tryInitSDS() {
    const canvas = document.getElementById('sds-canvas');
    if (!canvas || canvas._sdsInit) return;
    canvas._sdsInit = true;

    const wrap = canvas.parentElement;
    const W = wrap ? wrap.clientWidth : 480;
    const H = 340;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const LANE_W = W / 5;   // col 0 = ladder, cols 1-4 = lanes
    const PAD_T = 42, GH = H - PAD_T - 36;

    const LANES = [
      { label: ['Molecular', 'Techniques'],  col: '#00e5ff',
        bands: [
          { name:'PCR · qPCR',     lv:0.10, lbl:'expert' },
          { name:'Cloning',        lv:0.24, lbl:'advanced' },
          { name:'Western · ELISA', lv:0.38, lbl:'advanced' },
          { name:'SDS-PAGE · HPLC', lv:0.52, lbl:'advanced' },
        ] },
      { label: ['Bioinfor-', 'matics'],      col: '#39ff14',
        bands: [
          { name:'BLAST · PDB',    lv:0.10, lbl:'advanced' },
          { name:'PyMOL',          lv:0.24, lbl:'advanced' },
          { name:'Cytoscape',      lv:0.38, lbl:'advanced' },
          { name:'Prism · R · ImageJ', lv:0.52, lbl:'advanced' },
        ] },
      { label: ['Science', 'Comm.'],         col: '#EF9F27',
        bands: [
          { name:'Live exhibits',  lv:0.10, lbl:'expert' },
          { name:'Facilitation',   lv:0.24, lbl:'expert' },
          { name:'LN₂ · cobot',    lv:0.38, lbl:'advanced' },
          { name:'Canva · Design', lv:0.52, lbl:'advanced' },
        ] },
      { label: ['Research'],                 col: '#b44dff',
        bands: [
          { name:'Remac-PET',      lv:0.14, lbl:'advanced' },
          { name:'FAST-PETase',    lv:0.30, lbl:'advanced' },
          { name:'Epigenetics',    lv:0.44, lbl:'advanced' },
          { name:'Macrophage Eng.', lv:0.58, lbl:'developing' },
        ] },
    ];
    const LV_LABEL = { 0.08:'expert', 0.16:'expert', 0.25:'advanced', 0.28:'advanced', 0.30:'advanced', 0.50:'intermediate' };

    const MW = [250, 150, 100, 75, 50];

    // Tooltip element (in DOM, not canvas)
    const tip = document.getElementById('sds-tip');

    function redraw(progress) {
      ctx.fillStyle = '#0a0e1a';
      ctx.fillRect(0, 0, W, H);

      // Column separator lines
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(LANE_W * i, PAD_T - 10);
        ctx.lineTo(LANE_W * i, H - 30);
        ctx.stroke();
      }
      ctx.restore();

      // MW Ladder (col 0)
      MW.forEach((mw, i) => {
        const y = PAD_T + (i / (MW.length - 1)) * GH;
        ctx.save();
        ctx.font = '9px "JetBrains Mono",monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(180,190,255,0.55)';
        ctx.fillText(mw + ' kDa', LANE_W - 5, y + 3);
        // Ladder band
        ctx.fillStyle = 'rgba(160,170,255,0.4)';
        ctx.shadowColor = '#6060ff'; ctx.shadowBlur = 6;
        ctx.fillRect(4, y - 2.5, LANE_W * 0.72, 4.5);
        // Guide line across
        ctx.setLineDash([2, 6]);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(LANE_W, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      });

      // Lane headers
      ctx.textAlign = 'center';
      LANES.forEach((lane, li) => {
        const cx = LANE_W * (li + 1) + LANE_W / 2;
        ctx.save();
        ctx.fillStyle = lane.col;
        ctx.globalAlpha = 0.72;
        ctx.font = 'bold 8.5px "JetBrains Mono",monospace';
        lane.label.forEach((ln, idx) => ctx.fillText(ln, cx, 13 + idx * 13));
        ctx.restore();
      });

      // Bands — animate with stagger
      LANES.forEach((lane, li) => {
        const lx = LANE_W * (li + 1);
        lane.bands.forEach((band, bi) => {
          const delay = (li * 0.2 + bi * 0.15);
          const p = Math.max(0, Math.min((progress - delay) / 0.5, 1));
          if (p <= 0) return;
          const y = PAD_T + band.lv * GH;

          ctx.save();
          ctx.globalAlpha = p * 0.92;
          ctx.fillStyle   = lane.col;
          ctx.shadowColor = lane.col;
          ctx.shadowBlur  = 14 * p;
          ctx.fillRect(lx + 5, y - 3, LANE_W - 10, 5.5);
          ctx.restore();

          if (p > 0.65) {
            const ta = (p - 0.65) / 0.35;
            ctx.save();
            ctx.globalAlpha = ta;
            ctx.fillStyle   = '#ffffff';
            ctx.shadowColor = lane.col;
            ctx.shadowBlur  = 5;
            ctx.font = `7.5px "JetBrains Mono",monospace`;
            ctx.textAlign   = 'center';
            ctx.fillText(band.name, lx + LANE_W / 2, y + 1.5);
            ctx.restore();
          }
        });
      });

      // "Expert / Advanced / Intermediate" scale axis at right
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.font = '7px "JetBrains Mono",monospace';
      ctx.textAlign = 'left';
      ctx.fillText('▲ Expert', W - LANE_W * 0.92, PAD_T + 6);
      ctx.fillText('▼ Beginner', W - LANE_W * 0.92, H - 36);
      ctx.restore();
    }

    // Animation
    const start = performance.now();
    const DUR = 1600;
    function anim(ts) {
      const p = Math.min((ts - start) / DUR, 1);
      redraw(p);
      if (p < 1) requestAnimationFrame(anim);
    }
    requestAnimationFrame(anim);

    // Hover tooltip
    if (tip) {
      canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (W / rect.width);
        const my = (e.clientY - rect.top)  * (H / rect.height);
        let found = null;
        LANES.forEach((lane, li) => {
          const lx = LANE_W * (li + 1);
          if (mx < lx || mx > lx + LANE_W) return;
          lane.bands.forEach(band => {
            const y = PAD_T + band.lv * GH;
            if (Math.abs(my - y) < 9) found = { band, lane };
          });
        });
        if (found) {
          const lv = found.band.lbl || LV_LABEL[found.band.lv] || 'skilled';
          tip.textContent  = `${found.band.name}  ·  ${lv.toUpperCase()}`;
          tip.style.left   = e.clientX + 'px';
          tip.style.top    = (e.clientY - 38) + 'px';
          tip.style.color  = found.lane.col;
          tip.style.borderColor = found.lane.col;
          tip.classList.add('visible');
        } else {
          tip.classList.remove('visible');
        }
      });
      canvas.addEventListener('mouseleave', () => tip.classList.remove('visible'));
    }
  }

  /* ============================================================
     5. CSIR AIR 153 BELL CURVE — Achievements panel
     Gaussian, marker travels from right to far-left tail over 2s.
     Counter animates 0% → 99.9%.
  ============================================================ */
  /* ============================================================
     5. ACHIEVEMENT BELL CURVE (ACHIEVEMENT PANEL)
  ============================================================ */
  /* Sanger DNA chromatogram — achievements are highlighted point-mutations.
     (Replaces the older CSIR bell curve; panel is titled "Landmark Mutations".) */
  function tryInitChromatogram() {
    const canvas = document.getElementById('achieve-canvas');
    if (!canvas || canvas._achInit) return;
    canvas._achInit = true;

    const ctx = canvas.getContext('2d');
    const counter = document.getElementById('bell-counter');
    if (counter) counter.textContent = '';

    let tip = document.getElementById('achieve-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'achieve-tip';
      tip.className = 'plasmid-tip';
      (canvas.parentElement || document.body).appendChild(tip);
    }

    const COL = { A: '#39ff14', C: '#00e5ff', G: '#b44dff', T: '#ff3366' };
    const SEQ = 'ATGCGTACGTTGCAAGCTAGGCATCGTAACGGATCTGCAAT'.split('');
    const MARKS = [
      { i: 8,  label: 'MicCon24',     detail: 'International conference · Microbiology',   color: '#39ff14' },
      { i: 20, label: 'NISER PhD',    detail: 'Advanced to final selection round',         color: '#b44dff' },
      { i: 33, label: 'CSIR NET JRF', detail: 'AIR 153 · JRF + Asst. Prof. qualified',   color: '#ff3366' },
    ];
    const markAt = (i) => MARKS.find((m) => m.i === i);

    function hexA(hex, a) {
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }

    const PAD = { l: 18, r: 18, t: 34, b: 26 };
    let W, H, step, baseY, peakH, raf = null, startTs = null, done = false, hoverI = -1;

    function resize() {
      const p = canvas.parentElement;
      W = Math.max(p ? p.clientWidth : 460, 300);
      H = 190;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = '100%'; canvas.style.height = '100%';
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      step = (W - PAD.l - PAD.r) / (SEQ.length - 1);
      baseY = H - PAD.b; peakH = H - PAD.t - PAD.b;
    }
    const xOf = (i) => PAD.l + i * step;
    const peakHeight = (i) => markAt(i) ? peakH * 0.98 : peakH * (0.42 + 0.34 * Math.abs(Math.sin(i * 1.73 + 1)));

    function draw(prog) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#050a12'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.l, baseY); ctx.lineTo(W - PAD.r, baseY); ctx.stroke();

      const revealX = PAD.l + (W - PAD.l - PAD.r) * prog;

      for (let i = 0; i < SEQ.length; i++) {
        const x = xOf(i);
        if (x > revealX + step * 0.5) break;
        const base = SEQ[i], col = COL[base], m = markAt(i), h = peakHeight(i);
        const w = step * 0.85, sig = w * 0.34;

        ctx.strokeStyle = col; ctx.lineWidth = m ? 2.4 : 1.5; ctx.globalAlpha = m ? 1 : 0.8;
        ctx.shadowColor = col; ctx.shadowBlur = m ? 12 : 4;
        ctx.beginPath();
        let first = true;
        for (let dx = -w; dx <= w; dx += 1.4) {
          const yy = baseY - h * Math.exp(-(dx * dx) / (2 * sig * sig));
          if (first) { ctx.moveTo(x + dx, yy); first = false; } else ctx.lineTo(x + dx, yy);
        }
        ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;

        ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.globalAlpha = m ? 1 : 0.75;
        ctx.font = (m ? 'bold ' : '') + Math.max(7.5, W * 0.011) + 'px "JetBrains Mono",monospace';
        ctx.fillText(base, x, baseY - h - 4);
        ctx.globalAlpha = 1;

        if (m) {
          const hov = hoverI === i;
          ctx.strokeStyle = col; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.globalAlpha = hov ? 0.95 : 0.55;
          ctx.strokeRect(x - step * 0.7, PAD.t - 8, step * 1.4, baseY - (PAD.t - 8));
          ctx.setLineDash([]); ctx.globalAlpha = 1;
          const lx = Math.max(34, Math.min(W - 34, x));
          ctx.fillStyle = col; ctx.font = 'bold ' + Math.max(8, W * 0.0125) + 'px "JetBrains Mono",monospace';
          ctx.textAlign = 'center'; ctx.shadowColor = col; ctx.shadowBlur = hov ? 10 : 0;
          ctx.fillText(m.label, lx, 16);
          ctx.shadowBlur = 0;
          ctx.strokeStyle = hexA(col, 0.4); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(lx, 20); ctx.lineTo(x, baseY - h - 10); ctx.stroke();
        }
      }

      if (prog < 1) {
        ctx.strokeStyle = 'rgba(0,229,255,0.55)'; ctx.lineWidth = 1.5; ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(revealX, PAD.t - 8); ctx.lineTo(revealX, baseY); ctx.stroke(); ctx.shadowBlur = 0;
      }

      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.font = '8px "JetBrains Mono",monospace'; ctx.textAlign = 'center';
      ctx.fillText('DNA chromatogram · landmark mutations = achievements · hover a peak', W / 2, H - 8);
    }

    function hit(clientX) {
      const r = canvas.getBoundingClientRect();
      const mx = (clientX - r.left) * (W / r.width);
      for (const m of MARKS) if (Math.abs(xOf(m.i) - mx) < step * 0.8) return m.i;
      return -1;
    }

    canvas.addEventListener('mousemove', (e) => {
      const i = hit(e.clientX);
      if (i !== hoverI) { hoverI = i; if (done) draw(1); }
      const m = i >= 0 ? markAt(i) : null;
      if (m && tip) {
        const r = canvas.getBoundingClientRect();
        tip.innerHTML = '<strong>' + m.label + '</strong><br>' + m.detail;
        tip.style.left = (xOf(m.i) * (r.width / W)) + 'px';
        tip.style.top = '52px';
        tip.style.transform = 'translate(-50%, 0)';
        tip.style.whiteSpace = 'normal'; tip.style.maxWidth = '190px';
        tip.style.borderColor = m.color; tip.style.color = '#eef2ff';
        tip.classList.add('visible'); canvas.style.cursor = 'pointer';
      } else if (tip) { tip.classList.remove('visible'); canvas.style.cursor = 'default'; }
    });
    canvas.addEventListener('mouseleave', () => { hoverI = -1; if (tip) tip.classList.remove('visible'); if (done) draw(1); });

    function frame(ts) {
      if (!document.body.contains(canvas)) { canvas._achInit = false; return; }
      if (!startTs) startTs = ts;
      const p = Math.min((ts - startTs) / 2200, 1);
      draw(1 - Math.pow(1 - p, 2));
      if (p < 1) raf = requestAnimationFrame(frame); else done = true;
    }
    resize();
    window.addEventListener('resize', () => { if (!document.body.contains(canvas)) return; resize(); draw(done ? 1 : 0); });
    if (REDUCED) { done = true; draw(1); } else raf = requestAnimationFrame(frame);
  }

  /* ============================================================
     6. MICROSCOPE FOCUS REVEAL
     .microscope-reveal elements blur-in from grayscale.
     Vignette overlay on About/Research/Experience panels.
  ============================================================ */
  function tryInitMicroscope() {
    document.querySelectorAll('.microscope-reveal').forEach(el => {
      if (el._obsSet) return;
      el._obsSet = true;

      if (REDUCED) { el.style.opacity = '1'; return; }

      el.style.transition = 'opacity 0.8s ease-out, filter 0.8s ease-out';
      el.style.opacity    = '0.35';
      el.style.filter     = 'blur(7px) grayscale(55%)';

      const obs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          el.style.opacity = '1';
          el.style.filter  = 'blur(0) grayscale(0)';
          // Drop the filter entirely after the transition — a lingering filter keeps
          // the element on its own layer and makes scrolling repaint expensive.
          setTimeout(() => { el.style.filter = 'none'; }, 900);
          obs.unobserve(el);
        }
      }, { threshold: 0.12 });
      obs.observe(el);
    });
  }

  /* ============================================================
  /* ============================================================
     7B. BLUE-GREEN SCANNER (RESEARCH PANEL)
  ============================================================ */
  function tryInitCells() {
    // Ambient MOLECULAR NETWORK — floating theme-coloured molecules (hexagons,
    // rings, nucleotides) drifting with faint bonds. Pauses while scrolling, ~25fps.
    const canvas = document.getElementById('research-cells-canvas');
    if (!canvas || canvas._cellsInit) return;
    canvas._cellsInit = true;

    const wrap = canvas.parentElement;
    let W = canvas.width = wrap.clientWidth || 480;
    let H = canvas.height = wrap.clientHeight || 400;
    const ctx = canvas.getContext('2d');

    let _last = 0, _scrollT = 0;
    const scroller = canvas.closest('.detail-panel');
    if (scroller) scroller.addEventListener('scroll', () => { _scrollT = performance.now(); }, { passive: true });

    const COLS = ['#00e5ff', '#39ff14', '#b44dff', '#ff9f43', '#ff3366', '#ffd54f'];
    const N = 15;
    const mol = Array.from({ length: N }, (_, i) => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.24,
      r: 7 + Math.random() * 10, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.01,
      col: COLS[i % COLS.length], kind: i % 3, ph: Math.random() * 6.28,
    }));

    function frame(ts) {
      if (!document.body.contains(canvas)) { canvas._cellsInit = false; return; }
      requestAnimationFrame(frame);
      if (performance.now() - _scrollT < 160) return;   // pause during/just after scroll
      if (ts && ts - _last < 40) return;                 // ~25fps
      _last = ts || 0;
      ctx.clearRect(0, 0, W, H);
      const t = (ts || 0) * 0.001;

      // faint bonds between nearby molecules
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = mol[i], b = mol[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
          if (d < 125) { ctx.strokeStyle = 'rgba(130,200,255,' + (0.13 * (1 - d / 125)) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
      }
      // molecules
      for (const m of mol) {
        m.x += m.vx; m.y += m.vy; m.rot += m.vr;
        if (m.x < -24) m.x = W + 24; else if (m.x > W + 24) m.x = -24;
        if (m.y < -24) m.y = H + 24; else if (m.y > H + 24) m.y = -24;
        const pulse = 0.72 + 0.28 * Math.sin(t * 1.5 + m.ph);
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.rot);
        ctx.strokeStyle = m.col; ctx.fillStyle = m.col; ctx.globalAlpha = 0.62 * pulse;
        ctx.lineWidth = 1.6; ctx.shadowColor = m.col; ctx.shadowBlur = 8;
        if (m.kind === 0) {          // hexagon ring
          ctx.beginPath(); for (let k = 0; k < 6; k++) { const an = k / 6 * 6.283; k ? ctx.lineTo(Math.cos(an) * m.r, Math.sin(an) * m.r) : ctx.moveTo(Math.cos(an) * m.r, Math.sin(an) * m.r); } ctx.closePath(); ctx.stroke();
        } else if (m.kind === 1) {   // ring + orbiting atom
          ctx.beginPath(); ctx.arc(0, 0, m.r * 0.8, 0, 6.283); ctx.stroke();
          ctx.beginPath(); ctx.arc(m.r * 0.8, 0, 2.2, 0, 6.283); ctx.fill();
        } else {                     // nucleotide dumbbell
          ctx.beginPath(); ctx.moveTo(-m.r, 0); ctx.lineTo(m.r, 0); ctx.stroke();
          ctx.beginPath(); ctx.arc(-m.r, 0, 2.4, 0, 6.283); ctx.fill();
          ctx.beginPath(); ctx.arc(m.r, 0, 2.4, 0, 6.283); ctx.fill();
        }
        ctx.restore(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
    }
    window.addEventListener('resize', () => {
      if (!document.body.contains(canvas)) return;
      W = canvas.width = wrap.clientWidth || W; H = canvas.height = wrap.clientHeight || H;
    });
    frame();
  }

  /* ============================================================
     7C. EXPERIENCE DNA HELIX
  ============================================================ */
  function tryInitExperience() {
    const canvas = document.getElementById('experience-canvas');
    if (!canvas || canvas._expInit) return;
    canvas._expInit = true;
    
    const wrap = canvas.parentElement;
    const W = canvas.width = wrap.clientWidth;
    const H = canvas.height = wrap.clientHeight;
    const ctx = canvas.getContext('2d');
    
    let time = 0;

    function frame() {
      ctx.clearRect(0, 0, W, H);
      
      const centerY = H / 2 + 20;
      const amplitude = 40;
      const frequency = 0.035;
      const speed = 0.04;
      
      for(let x = -20; x < W + 20; x += 18) {
        const y1 = centerY + Math.sin(x * frequency + time) * amplitude;
        const y2 = centerY + Math.sin(x * frequency + time + Math.PI) * amplitude;
        
        const z1 = Math.cos(x * frequency + time);
        const z2 = Math.cos(x * frequency + time + Math.PI);
        
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.strokeStyle = 'rgba(255, 159, 67, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(x, y1, z1 > 0 ? 3.5 : 1.5, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255, 159, 67, ${z1 > 0 ? 0.9 : 0.3})`;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y2, z2 > 0 ? 3.5 : 1.5, 0, Math.PI*2);
        ctx.fillStyle = `rgba(180, 77, 255, ${z2 > 0 ? 0.9 : 0.3})`;
        ctx.fill();
      }
      
      time -= speed;
      requestAnimationFrame(frame);
    }
    frame();
  }

  /* ============================================================
     7D. FLOATING PHENOTYPES (LIFE PANEL)
  ============================================================ */
  function tryInitLife() {
    const canvas = document.getElementById('life-canvas');
    if (!canvas || canvas._lifeInit) return;
    canvas._lifeInit = true;
    const wrap = canvas.parentElement;
    const W = canvas.width = wrap.clientWidth;
    const H = canvas.height = wrap.clientHeight;
    const ctx = canvas.getContext('2d');
    const particles = Array.from({length: 40}, () => ({
      x: Math.random()*W, y: Math.random()*H, 
      s: 1 + Math.random()*3, 
      a: Math.random()
    }));
    function frame() {
      ctx.clearRect(0,0,W,H);
      particles.forEach(p => {
        p.y -= p.s * 0.5;
        p.a += 0.05;
        p.x += Math.sin(p.a) * 0.5;
        if(p.y < 0) { p.y = H; p.x = Math.random()*W; }
        ctx.beginPath(); 
        ctx.arc(p.x, p.y, p.s, 0, Math.PI*2); 
        ctx.fillStyle = 'rgba(180, 77, 255, 0.5)';
        ctx.fill();
      });
      requestAnimationFrame(frame);
    }
    frame();
  }

  /* ============================================================
     7. PETRI DISH COLONY HOVER  (PetriCard class)
     Attach to any [data-petri="color"] element.
     Bacterial colonies grow from entry point on hover.
     UV-flash + fade on leave.
  ============================================================ */
  class PetriCard {
    constructor(el, color) {
      this.el     = el;
      this.color  = color;
      this.cv     = null;
      this.ctx2   = null;
      this.cols   = [];
      this.active = false;
      this.fade   = false;
      this.flash  = 0;
      this.raf    = null;
      this.W      = 0;
      this.H      = 0;

      el.style.position = 'relative';
      el.style.overflow = 'hidden';
      el.addEventListener('mouseenter', e => this._start(e));
      el.addEventListener('mouseleave', () => this._stop());
    }

    _start(e) {
      if (!this.cv) {
        this.cv = document.createElement('canvas');
        Object.assign(this.cv.style, {
          position:'absolute', inset:0,
          width:'100%', height:'100%',
          pointerEvents:'none', zIndex:1
        });
        this.el.insertBefore(this.cv, this.el.firstChild);
        this.ctx2 = this.cv.getContext('2d');
      }
      const r   = this.el.getBoundingClientRect();
      this.W    = this.cv.width  = r.width;
      this.H    = this.cv.height = r.height;
      const ox  = e.clientX - r.left;
      const oy  = e.clientY - r.top;

      this.cols  = [{ x:ox, y:oy, r:0, max:20, op:1 }];
      this.active = true;
      this.fade   = false;
      this.flash  = 0;
      if (this.raf) cancelAnimationFrame(this.raf);
      this._loop();
    }

    _stop() {
      this.flash = 1;
      this.fade  = true;
    }

    _loop() {
      this.ctx2.clearRect(0, 0, this.W, this.H);

      // UV flash
      if (this.flash > 0) {
        this.ctx2.fillStyle = `rgba(255,255,255,${this.flash * 0.55})`;
        this.ctx2.fillRect(0, 0, this.W, this.H);
        this.flash = Math.max(0, this.flash - 0.07);
      }

      // Spawn child colonies
      if (!this.fade && this.cols.length < 45 && Math.random() < 0.28) {
        const p  = this.cols[Math.floor(Math.random() * Math.min(this.cols.length, 10))];
        const a  = Math.random() * Math.PI * 2;
        const d  = 12 + Math.random() * 28;
        this.cols.push({
          x: Math.max(4, Math.min(this.W - 4, p.x + Math.cos(a) * d)),
          y: Math.max(4, Math.min(this.H - 4, p.y + Math.sin(a) * d)),
          r: 0, max: 7 + Math.random() * 16, op: 1
        });
      }

      let alive = false;
      const [rr, rg, rb] = this._parseHex(this.color);

      this.cols.forEach(c => {
        if (!this.fade && c.r < c.max) { c.r += 0.55; alive = true; }
        if (this.fade) { c.op = Math.max(0, c.op - 0.032); }
        else alive = true;

        if (c.op <= 0) return;
        this.ctx2.beginPath();
        this.ctx2.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        this.ctx2.fillStyle = `rgba(${rr},${rg},${rb},${c.op * 0.38})`;
        this.ctx2.fill();
        if (c.op > 0) alive = true;
      });

      if (!alive && this.fade) {
        this.active = false;
        this.ctx2.clearRect(0, 0, this.W, this.H);
        return;
      }
      this.raf = requestAnimationFrame(() => this._loop());
    }

    _parseHex(hex) {
      return [
        parseInt(hex.slice(1,3),16),
        parseInt(hex.slice(3,5),16),
        parseInt(hex.slice(5,7),16)
      ];
    }
  }

  function tryInitPetri() {
    document.querySelectorAll('[data-petri]').forEach(el => {
      if (el._petriInit) return;
      el._petriInit = true;
      new PetriCard(el, el.dataset.petri || '#1D9E75');
    });
  }

  /* ============================================================
     9. ELECTROPHORESIS NAME REVEAL — Core panel
     "SITESH KUMAR DASH" smears as blur on canvas then resolves
     downward into crisp positions; staggered by name part.
     Canvas fades out after, revealing the normal h1 below.
  ============================================================ */
  function tryInitElectro() {
    const canvas = document.getElementById('electro-canvas');
    if (!canvas || canvas._electroInit) return;
    canvas._electroInit = true;

    canvas.style.zIndex = '0'; 
    canvas.style.opacity = '0.4';
    
    const h1 = canvas.parentElement.querySelector('h1.glitch-name');
    if (h1) {
      h1.style.position = 'relative';
      h1.style.zIndex = '1';
    }

    const W = canvas.width  = canvas.offsetWidth  || 400;
    const H = canvas.height = canvas.offsetHeight || 72;
    const ctx = canvas.getContext('2d');

    let time = 0;

    function frame() {
      ctx.clearRect(0, 0, W, H);
      
      const centerY = H / 2;
      const amplitude = H * 0.35;
      const frequency = 0.05;
      const speed = 0.02;
      
      for(let x = 0; x < W; x += 15) {
        const y1 = centerY + Math.sin(x * frequency + time) * amplitude;
        const y2 = centerY + Math.sin(x * frequency + time + Math.PI) * amplitude;
        
        const z1 = Math.cos(x * frequency + time);
        const z2 = Math.cos(x * frequency + time + Math.PI);
        
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(x, y1, z1 > 0 ? 2 : 1, 0, Math.PI*2);
        ctx.fillStyle = `rgba(0, 229, 255, ${z1 > 0 ? 0.8 : 0.3})`;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y2, z2 > 0 ? 2 : 1, 0, Math.PI*2);
        ctx.fillStyle = `rgba(57, 255, 20, ${z2 > 0 ? 0.8 : 0.3})`;
        ctx.fill();
      }
      
      time -= speed;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ============================================================
     10. SCROLL BACKGROUND CONNECTIONS
     Scroll wheel creates glowing bonds between floaters
  ============================================================ */
  (function bgScrollBonds() {
    if (REDUCED) return;
    const bgCanvas = document.getElementById('dna-bg');
    if (!bgCanvas) return;
    const ctx = bgCanvas.getContext('2d');
    
    let flashT = 0;
    
    window.addEventListener('wheel', () => {
      if (!window._bgFloaters || window._bgFloaters.length === 0) return;
      flashT = 1.0;
    }, { passive: true });

    function renderBonds() {
      if (flashT > 0 && window._bgFloaters) {
        ctx.save();
        const f = window._bgFloaters;
        for (let i = 0; i < f.length; i++) {
          for (let j = i + 1; j < f.length; j++) {
            const dx = f[i].x - f[j].x;
            const dy = f[i].y - f[j].y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 280) {
              ctx.beginPath();
              ctx.moveTo(f[i].x, f[i].y);
              ctx.lineTo(f[j].x, f[j].y);
              ctx.strokeStyle = '#00e5ff';
              ctx.globalAlpha = flashT * (1 - dist/280) * 0.5;
              ctx.lineWidth = 1.5;
              ctx.setLineDash([4, 6]);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
        flashT -= 0.02;
      }
      requestAnimationFrame(renderBonds);
    }
    renderBonds();
  })();

  /* ============================================================
     11. AMBITION PANEL — MYCORRHIZAL NETWORK
  ============================================================ */
  function tryInitPhylo() {
    const canvas = document.getElementById('phylo-canvas');
    if (!canvas || canvas._phyloInit) return;
    canvas._phyloInit = true;

    const wrap = canvas.parentElement;
    const W = canvas.width = wrap ? wrap.clientWidth : 500;
    const H = canvas.height = wrap ? wrap.clientHeight : 400;
    const ctx = canvas.getContext('2d');
    let startTs = null;

    function drawBranch(x, y, angle, len, branchW, depth, maxDepth, t) {
      if (depth === maxDepth) return;
      if (t <= 0) return;

      const endX = x + Math.cos(angle) * len * Math.min(t, 1);
      const endY = y + Math.sin(angle) * len * Math.min(t, 1);

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = `rgba(29, 158, 117, ${0.4 - depth*0.05})`;
      ctx.lineWidth = branchW;
      ctx.lineCap = 'round';
      ctx.stroke();

      if (t > 1) {
        const nextT = t - 1;
        drawBranch(endX, endY, angle - 0.4 + Math.random()*0.1, len * (0.65 + Math.random()*0.2), branchW * 0.7, depth + 1, maxDepth, nextT);
        drawBranch(endX, endY, angle + 0.4 - Math.random()*0.1, len * (0.65 + Math.random()*0.2), branchW * 0.7, depth + 1, maxDepth, nextT);
      }
    }

    function frame(ts) {
      if (!startTs) startTs = ts;
      const t = (ts - startTs) / 300; 
      ctx.clearRect(0, 0, W, H);
      // Start from center and branch in 5 directions
      for (let i = 0; i < 5; i++) {
        drawBranch(W/2, H/2, (Math.PI*2/5)*i, 60, 4, 0, 6, t);
      }
      if (t < 8) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ============================================================
     12. LIFE PANEL — PROTEIN FOLDING
  ============================================================ */
  function tryInitProteinFolding() {
    const canvas = document.getElementById('protein-canvas');
    if (!canvas || canvas._protInit) return;
    canvas._protInit = true;

    const wrap = canvas.parentElement;
    const W = canvas.width = wrap ? wrap.clientWidth : 400;
    const H = canvas.height = wrap ? wrap.clientHeight : 300;
    const ctx = canvas.getContext('2d');
    
    // Create floating chemical structures
    const molecules = Array.from({length: 15}, () => ({
      x: Math.random() * W,
      y: Math.random() * H + H/2,
      size: Math.random() * 18 + 10,
      vy: -(Math.random() * 0.8 + 0.2), // Float upwards
      vx: (Math.random() - 0.5) * 0.4,  // Drift horizontally
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.03, // Spin slowly
      opacity: Math.random() * 0.3 + 0.1,
      edges: Math.random() > 0.4 ? 6 : 5 // Hexagons and pentagons
    }));

    function drawPolygon(x, y, radius, sides, rot) {
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const angle = rot + (i * 2 * Math.PI) / sides;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      
      // Draw atoms at vertices
      for (let i = 0; i < sides; i++) {
        const angle = rot + (i * 2 * Math.PI) / sides;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.arc(px, py, radius > 15 ? 2.5 : 1.5, 0, Math.PI*2);
        ctx.fill();
      }
    }

    function frame() {
      ctx.clearRect(0, 0, W, H);
      
      for(let i = 0; i < molecules.length; i++) {
        let m = molecules[i];
        m.y += m.vy;
        m.x += m.vx;
        m.rot += m.vrot;
        
        // Wrap around smoothly when they float off the top
        if (m.y < -m.size * 2) {
          m.y = H + m.size * 2;
          m.x = Math.random() * W;
        }
        
        // Use cyan for the bonds and neon green for the atoms
        ctx.strokeStyle = `rgba(0, 229, 255, ${m.opacity})`; 
        ctx.fillStyle = `rgba(57, 255, 20, ${m.opacity + 0.2})`; 
        ctx.lineWidth = 1.5;
        
        drawPolygon(m.x, m.y, m.size, m.edges, m.rot);
      }
      
      requestAnimationFrame(frame);
    }
    frame();
  }

  /* ============================================================
     13. CONTACT PANEL — SYNAPTIC TRANSMISSION
  ============================================================ */
  function tryInitSynapse() {
    const canvas = document.getElementById('synapse-canvas');
    if (!canvas || canvas._synInit) return;
    canvas._synInit = true;

    const wrap = canvas.parentElement;
    const W = canvas.width = wrap ? wrap.clientWidth : 400;
    const H = canvas.height = wrap ? wrap.clientHeight : 250;
    const ctx = canvas.getContext('2d');

    const form = document.getElementById('contact-form');
    let activity = 0;

    if (form) {
      form.addEventListener('input', () => activity = Math.min(activity + 0.6, 1));
      const btn = form.querySelector('.btn-submit');
      if (btn) {
        btn.addEventListener('mouseenter', () => activity = 1);
        btn.addEventListener('mouseleave', () => activity = Math.max(0, activity - 0.5));
      }
    }

    const particles = [];
    function spawn() {
      if (Math.random() < activity * 0.4) {
        particles.push({ 
          x: Math.random() * W, 
          y: Math.random() * H, 
          vx: (Math.random()-0.5)*2.5, 
          vy: -1 - Math.random()*2, 
          life: 1 
        });
      }
    }

    function frame() {
      if (!document.body.contains(canvas)) { canvas._synInit = false; return; }
      ctx.clearRect(0, 0, W, H);
      activity = Math.max(0, activity - 0.008);
      spawn();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.012;

        if (p.life <= 0) { particles.splice(i, 1); continue; }

        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI*2);
        ctx.fillStyle = `rgba(180, 77, 255, ${p.life})`;
        ctx.shadowColor = '#b44dff';
        ctx.shadowBlur = 10 * p.life;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ============================================================
     14. TAP-HINT DECODE — scramble → resolve on node hover
     The hints literally say "Decode …", so they decode.
  ============================================================ */
  (function tapHintDecode() {
    if (REDUCED) return;
    const POOL = 'ACGTURY◇◆⬡⬢·×+/><=';
    document.querySelectorAll('.mol-node').forEach(node => {
      const hint = node.querySelector('.tap-hint');
      if (!hint) return;
      const full = hint.textContent;
      let raf = null, running = false;
      function decode() {
        if (running) return;
        running = true;
        const start = performance.now();
        const dur = 460;
        (function tick(t) {
          const p = Math.min((t - start) / dur, 1);
          const reveal = p * full.length;
          let out = '';
          for (let i = 0; i < full.length; i++) {
            const ch = full[i];
            if (i < reveal || ch === ' ' || ch === '→') out += ch;
            else out += POOL[Math.floor(Math.random() * POOL.length)];
          }
          hint.textContent = out;
          if (p < 1) raf = requestAnimationFrame(tick);
          else { hint.textContent = full; running = false; }
        })(start);
      }
      node.addEventListener('mouseenter', decode);
      node.addEventListener('focusin', decode);
    });
  })();

  /* ============================================================
     15. CLICK ELECTRON BURST — spark ring on every click
  ============================================================ */
  (function clickBurst() {
    if (REDUCED) return;
    const COLORS = ['#39ff14', '#00e5ff', '#b44dff', '#ff9f43'];
    window.addEventListener('pointerdown', e => {
      const n = 7 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const s = document.createElement('div');
        s.className = 'click-spark';
        const col = COLORS[Math.floor(Math.random() * COLORS.length)];
        s.style.left = e.clientX + 'px';
        s.style.top = e.clientY + 'px';
        s.style.background = col;
        s.style.boxShadow = '0 0 8px ' + col;
        document.body.appendChild(s);
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
        const dist = 14 + Math.random() * 24;
        s.animate([
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: 'translate(calc(-50% + ' + (Math.cos(ang) * dist) + 'px), calc(-50% + ' + (Math.sin(ang) * dist) + 'px)) scale(0)', opacity: 0 }
        ], { duration: 420, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' });
        setTimeout(() => s.remove(), 440);
      }
    }, { passive: true });
  })();

  /* ============================================================
     16. ATOM CURSOR — moves the CSS/GPU atom to follow the pointer.
     Near-zero JS cost (one transform per move); orbits run on the compositor.
  ============================================================ */
  (function bioCursor() {
    if (REDUCED) return;
    if (!window.matchMedia('(pointer: fine)').matches) {
      document.documentElement.style.cursor = 'auto';
      return;
    }
    const canvas = document.getElementById('bio-cursor');
    if (!canvas) return;
    const S = 46, C = S / 2;              // smaller cursor
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
    canvas.style.width = S + 'px'; canvas.style.height = S + 'px';
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);

    let x = window.innerWidth / 2, y = window.innerHeight / 2, hot = false, spin = 0;
    const place = () => { canvas.style.transform = 'translate(' + (x - C) + 'px,' + (y - C) + 'px)'; };
    window.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; place(); }, { passive: true });
    document.addEventListener('mouseover', (e) => {
      hot = !!(e.target.closest && e.target.closest('a, button, input, textarea, label, .mol-trigger, .plasmid-nav a'));
    }, { passive: true });
    place();

    // website theme palette — electrons cycle through these colours
    const PAL = [[57, 255, 20], [0, 229, 255], [180, 77, 255], [255, 159, 67], [255, 51, 102], [255, 213, 79]];
    function themeCol(u) {
      u = ((u % 1) + 1) % 1; const n = PAL.length, f = u * n, i = Math.floor(f) % n, j = (i + 1) % n, k = f - Math.floor(f);
      const a = PAL[i], b = PAL[j];
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }

    const ORB = [
      { ang: -0.35,       sp: 0.09,   ph: 0,   co: 0 },
      { ang: Math.PI / 3, sp: -0.078, ph: 2.1, co: 0.34 },
      { ang: 2.094,       sp: 0.066,  ph: 4.2, co: 0.68 },
    ];
    const A0 = 13.5, B0 = 5;

    function ball(px, py, r, rgb, glow) {
      const g = ctx.createRadialGradient(px - r * 0.36, py - r * 0.4, r * 0.1, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,' + glow + ')');
      g.addColorStop(0.32, 'rgba(' + (rgb[0] | 0) + ',' + (rgb[1] | 0) + ',' + (rgb[2] | 0) + ',' + glow + ')');
      g.addColorStop(1, 'rgba(' + (rgb[0] * 0.22 | 0) + ',' + (rgb[1] * 0.22 | 0) + ',' + (rgb[2] * 0.22 | 0) + ',' + glow + ')');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }

    function frame() {
      ctx.clearRect(0, 0, S, S);
      // SLOW idle spin; springs faster (reacts) only while hovering an interactive node
      spin += hot ? 2.6 : 0.4;
      const colT = spin * 0.0016;          // colours drift with the spin (also reacts on hover)
      const A = hot ? A0 * 1.2 : A0, B = hot ? B0 * 1.2 : B0;
      // elliptical orbit paths (theme-cycling colour)
      ORB.forEach(o => {
        const c = themeCol(colT + o.co);
        ctx.save(); ctx.translate(C, C); ctx.rotate(o.ang);
        ctx.strokeStyle = 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',0.24)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, A, B, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      });
      // electrons with front/back depth
      const els = ORB.map(o => {
        const f = o.ph + spin * o.sp;
        const ex = A * Math.cos(f), ey = B * Math.sin(f);
        const front = (Math.sin(f) + 1) / 2; // 0 back → 1 front
        return {
          x: C + ex * Math.cos(o.ang) - ey * Math.sin(o.ang),
          y: C + ex * Math.sin(o.ang) + ey * Math.cos(o.ang),
          r: 1.1 + 1.7 * front, col: themeCol(colT + o.co), glow: 0.5 + 0.45 * front, front
        };
      });
      els.filter(e => e.front < 0.5).forEach(e => ball(e.x, e.y, e.r, e.col, e.glow));
      ball(C, C, hot ? 5.6 : 4.8, [150, 235, 245], 0.98);   // nucleus — clearly bigger than the electrons
      els.filter(e => e.front >= 0.5).forEach(e => ball(e.x, e.y, e.r, e.col, e.glow));
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

})(); // end effects.js IIFE
