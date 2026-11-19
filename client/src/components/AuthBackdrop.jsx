import React, { useEffect, useRef } from 'react';
import './AuthBackdrop.css';

/* ─────────────────────────────────────────────────────────────
   Animated background behind the Sign in / Register card:
   "Colleges to MSIRC". The 18 MSU colleges sit around the edges,
   linked to an MSIRC hub above the card. A college lights up and
   sends a pulse to MSIRC; some pulses go on to VCRED below the card,
   like a proposal moving through AYON.
   Drawn on one <canvas> in the space around the card. It pauses
   when the tab is hidden and stays still for "reduce motion".
   ───────────────────────────────────────────────────────────── */

const GOLD = '243, 217, 138';
const rand = (a, b) => a + Math.random() * (b - a);

/* where is the card, and where is there room around it? */
const cardBox = (canvas) => {
  const card = document.querySelector('.reg-card.as-card');
  if (!card) return null;
  const c = canvas.getBoundingClientRect(), r = card.getBoundingClientRect();
  return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height };
};
const hitsCard = (b, x, y, fw, fh, pad = 14) => !!b && x < b.x + b.w + pad && x + fw > b.x - pad && y < b.y + b.h + pad && y + fh > b.y - pad;
const bands = (w, h, b) => {                                       // the free strips above and below the card
  if (!b) return { top: [0, h * 0.18], bottom: [h * 0.82, h] };
  return { top: [0, Math.max(0, b.y)], bottom: [Math.min(h, b.y + b.h), h] };
};

/* the colleges, the MSIRC hub and VCRED, and the pulses between them */
const COLLEGE_SHORT = ['COA', 'CBAA', 'CED', 'COE', 'CFAS', 'CFES', 'CHS', 'CHTM', 'CICS', 'COL', 'COM', 'CNSM', 'CPA', 'CSSH', 'CSPEAR', 'DET', 'ISED', 'KFCIAAS'];
const makeColleges = (w, h, b) => {
  const bd = bands(w, h, b);
  /* phones: the strip above the card is too thin, so MSIRC sits below the card, beside VCRED */
  const tight = bd.top[1] - bd.top[0] < 90;
  const lowY = Math.min(h - 40, bd.bottom[0] + Math.min(120, (h - bd.bottom[0]) / 2));
  const hub = tight ? { x: w * 0.3, y: lowY, label: 'MSIRC' } : { x: w / 2, y: Math.max(26, bd.top[1] / 2), label: 'MSIRC' };
  const vc  = tight ? { x: w * 0.7, y: lowY, label: 'VCRED' } : { x: w / 2, y: Math.min(h - 26, (bd.bottom[0] + h) / 2), label: 'VCRED' };
  const n = COLLEGE_SHORT.length;
  const nodes = COLLEGE_SHORT.map((label, i) => {                  // around the edge of the screen, clear of the card
    const a = -Math.PI / 2 + ((i + 0.5) / n) * Math.PI * 2;
    let x = w / 2 + Math.cos(a) * w * 0.47, y = h / 2 + Math.sin(a) * h * 0.45;
    if (hitsCard(b, x - 30, y - 12, 60, 24)) {
      if (b && (x < b.x || x > b.x + b.w)) x = x < w / 2 ? Math.max(30, b.x / 2) : Math.min(w - 30, b.x + b.w + (w - b.x - b.w) / 2);
      else y = y < h / 2 ? Math.max(20, bd.top[1] * 0.7) : Math.min(h - 20, bd.bottom[0] + (h - bd.bottom[0]) * 0.3);
    }
    /* no label where there is no room: in a thin strip above the card, or over "Back to home" */
    const quiet = (tight && b && y < b.y) || (x < 200 && y < 48);
    return { x, y, label, flash: 0, quiet };
  });
  const curve = (a2, c2, bend) => {
    const mx = (a2.x + c2.x) / 2 + (c2.y - a2.y) * bend, my = (a2.y + c2.y) / 2 - (c2.x - a2.x) * bend;
    return Array.from({ length: 61 }, (_, i) => { const t = i / 60, u = 1 - t; return [u * u * a2.x + 2 * u * t * mx + t * t * c2.x, u * u * a2.y + 2 * u * t * my + t * t * c2.y]; });
  };
  const links = nodes.map(nd => curve(nd, hub, 0.15));
  const side = b ? Math.min(w - 20, b.x + b.w + Math.max(20, (w - b.x - b.w) / 2)) : w * 0.92;
  const toVc = tight ? curve(hub, vc, 0.25)
    : curve(hub, { x: side, y: h / 2 }, -0.2).concat(curve({ x: side, y: h / 2 }, vc, -0.2).slice(1));
  return { hub, vc, nodes, links, toVc, pulses: [], next: 0.3, hubFlash: 0, vcFlash: 0 };
};
const drawColleges = (ctx, s, w, h, dt) => {
  const C = s.col;
  C.links.forEach((pts) => {
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = `rgba(${GOLD}, 0.10)`; ctx.lineWidth = 1; ctx.stroke();
  });
  ctx.beginPath(); C.toVc.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.setLineDash([3, 6]); ctx.strokeStyle = `rgba(${GOLD}, 0.16)`; ctx.stroke(); ctx.setLineDash([]);
  C.next -= dt;
  if (C.next <= 0) { const i = Math.floor(rand(0, C.nodes.length)); C.nodes[i].flash = 1; C.pulses.push({ pts: C.links[i], t: 0, v: rand(0.28, 0.4), stage: 0 }); C.next = rand(0.6, 1.4); }
  C.pulses = C.pulses.filter((p) => {
    p.t += p.v * dt;
    if (p.t >= 1) {
      if (p.stage === 0) { C.hubFlash = 1; if (Math.random() < 0.45) { p.pts = C.toVc; p.t = 0; p.v = 0.22; p.stage = 1; return true; } return false; }
      C.vcFlash = 1; return false;
    }
    const i = Math.round(p.t * (p.pts.length - 1)); const [x, y] = p.pts[i];
    const g = ctx.createRadialGradient(x, y, 0, x, y, 12); g.addColorStop(0, `rgba(${GOLD}, 0.8)`); g.addColorStop(1, `rgba(${GOLD}, 0)`);
    ctx.fillStyle = g; ctx.fillRect(x - 12, y - 12, 24, 24);
    return true;
  });
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  C.nodes.forEach((nd) => {
    nd.flash = Math.max(0, nd.flash - dt * 1.2);
    ctx.beginPath(); ctx.arc(nd.x, nd.y, 3.5 + nd.flash * 3, 0, Math.PI * 2); ctx.fillStyle = `rgba(${GOLD}, ${0.45 + nd.flash * 0.5})`; ctx.fill();
    if (!nd.quiet) {
      ctx.font = "700 10px 'Segoe UI', system-ui, sans-serif"; ctx.fillStyle = `rgba(${GOLD}, ${0.38 + nd.flash * 0.5})`;
      ctx.fillText(nd.label, nd.x, nd.y + 14);
    }
  });
  [[C.hub, 'hubFlash'], [C.vc, 'vcFlash']].forEach(([nd, key]) => {
    C[key] = Math.max(0, C[key] - dt * 1.4);
    const f = C[key];
    ctx.beginPath(); ctx.arc(nd.x, nd.y, 14 + f * 6, 0, Math.PI * 2); ctx.fillStyle = `rgba(${GOLD}, ${0.12 + f * 0.25})`; ctx.fill();
    ctx.beginPath(); ctx.arc(nd.x, nd.y, 14, 0, Math.PI * 2); ctx.strokeStyle = `rgba(${GOLD}, 0.6)`; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = "800 11px 'Segoe UI', system-ui, sans-serif"; ctx.fillStyle = `rgba(255, 244, 214, ${0.75 + f * 0.25})`;
    ctx.fillText(nd.label, nd.x, nd.y + (nd.y < h / 2 ? 26 : -26));
  });
};

const AuthBackdrop = () => {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const s = {};
    let w = 0, h = 0, raf = 0, last = performance.now();

    const build = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.col = makeColleges(w, h, cardBox(canvas));
    };

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, w, h);
      drawColleges(ctx, s, w, h, dt);
      if (!still) raf = requestAnimationFrame(frame);
    };

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !still) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };

    build();
    const settle = setTimeout(build, 1000);        // measure again once the card has finished rising in
    if (still) frame(performance.now()); else raf = requestAnimationFrame(frame);
    window.addEventListener('resize', build);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(settle);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', build);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={ref} className="as-backdrop" aria-hidden="true" />;
};

export default AuthBackdrop;