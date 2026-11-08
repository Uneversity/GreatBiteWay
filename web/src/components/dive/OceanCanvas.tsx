"use client";

import { useEffect, useRef } from "react";
import type { MotionValue } from "motion/react";
import { useReducedMotion } from "motion/react";
import { MAX_METERS, clamp, colorAt, lerp, ramp, rgb } from "@/lib/depth";

/**
 * Full-screen ocean, painted every frame from the current depth (in metres).
 *
 * Layers, by depth band:
 *   0–400 m    god-rays + caustic ripples (drawn low-res and upscaled for softness)
 *   all        faint depth grid that streams past during a descent
 *   all        marine snow / bubbles, parallaxed by the descent speed
 *   100–1500 m schools of fish silhouettes
 *   1800 m+    bioluminescent flecks
 *   1900 m+    jellyfish drifting through the abyss
 *   3100 m+    seafloor: back ridge, shipwreck, corals, anemones, kelp, rocks, dunes
 *
 * Reads `meters.get()` directly so animating depth never re-renders React.
 */
export function OceanCanvas({ meters }: { meters: MotionValue<number> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const light = document.createElement("canvas");
    const lctx = light.getContext("2d");
    if (!lctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      light.width = Math.max(40, Math.round(w / 8));
      light.height = Math.max(24, Math.round(h / 8));
    };
    resize();
    window.addEventListener("resize", resize);

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    // ---- particles: marine snow (sink) and bubbles (rise) ----------------
    const particles = Array.from({ length: 170 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: rnd(0.6, 2.4),
      v: rnd(0.02, 0.08),
      drift: rnd(-0.01, 0.01),
      phase: rnd(0, Math.PI * 2),
    }));

    // ---- fish schools ------------------------------------------------------
    const makeSchool = (band: [number, number], dir: 1 | -1, y: number) => ({
      x: dir === 1 ? -0.3 : 1.3,
      y,
      dir,
      speed: rnd(0.018, 0.028),
      band,
      fish: Array.from({ length: 14 }, () => ({ ox: rnd(-110, 110), oy: rnd(-45, 45), phase: rnd(0, 6.3), size: rnd(5, 10) })),
    });
    const schools = [makeSchool([80, 900], 1, 0.3), makeSchool([300, 1500], -1, 0.62), makeSchool([150, 1200], 1, 0.78)];

    // ---- bioluminescence + jellyfish ------------------------------------------
    const glows = Array.from({ length: 60 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: rnd(1, 3.2),
      phase: rnd(0, 6.3),
      speed: rnd(0.4, 1.2),
      hue: Math.random() < 0.7 ? "94,234,212" : "125,211,252",
    }));
    const jellies = Array.from({ length: 4 }, (_, i) => ({
      x: 0.1 + i * 0.24 + rnd(0, 0.1),
      y: rnd(0.15, 0.8),
      r: rnd(14, 30),
      phase: rnd(0, 6.3),
      vx: rnd(-0.004, 0.004),
      tentacles: Array.from({ length: 6 }, () => ({ len: rnd(2.2, 4.2), phase: rnd(0, 6.3) })),
    }));

    // ---- seafloor set dressing (precomputed, drawn with the floor) ---------------
    type Seg = [number, number, number, number, number];
    const makeCoral = (): Seg[] => {
      const segs: Seg[] = [];
      const grow = (x: number, y: number, a: number, len: number, d: number) => {
        if (d === 0 || len < 3) return;
        const nx = x + Math.cos(a) * len;
        const ny = y + Math.sin(a) * len;
        segs.push([x, y, nx, ny, d]);
        const n = d > 3 ? 2 : Math.random() < 0.6 ? 2 : 1;
        for (let i = 0; i < n; i++) grow(nx, ny, a + rnd(-0.6, 0.6), len * rnd(0.62, 0.8), d - 1);
      };
      grow(0, 0, -Math.PI / 2, 30, 6);
      return segs;
    };
    const corals = Array.from({ length: 5 }, (_, i) => ({ x: 0.06 + i * 0.2 + rnd(0, 0.1), segs: makeCoral(), scale: rnd(0.8, 1.5) }));
    const anemones = Array.from({ length: 7 }, () => ({
      x: Math.random(),
      n: 7 + Math.floor(rnd(0, 4)),
      len: rnd(22, 44),
      phase: rnd(0, 6.3),
    }));
    const kelp = Array.from({ length: 16 }, (_, i) => ({ x: (i + rnd(0, 0.8)) / 16, height: rnd(80, 190), phase: rnd(0, 6.3), width: rnd(5, 11) }));
    const rocks = Array.from({ length: 14 }, () => ({ x: Math.random(), rx: rnd(16, 60), ry: rnd(9, 24) }));
    const ripples = Array.from({ length: 34 }, () => ({ x: Math.random(), w: rnd(18, 48), dy: rnd(8, 60) }));
    const wreckX = rnd(0.55, 0.72);

    let raf = 0;
    let last = performance.now();
    let lastMeters = meters.get();
    const start = last;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      const m = clamp(meters.get(), 0, MAX_METERS);
      const dm = m - lastMeters; // metres travelled since last frame → parallax
      lastMeters = m;
      const motion = reduced ? 0 : 1;
      const shift = (dm / MAX_METERS) * 3.2; // screen-fraction the world streams by per frame

      // Background: looking down into the water, so the bottom is always deeper.
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, rgb(colorAt(m - 120)));
      g.addColorStop(1, rgb(colorAt(m + 350)));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Soft light in the shallows: rays + caustics at 1/8 res, upscaled.
      const rayAlpha = 1 - ramp(m, 0, 420);
      const causticAlpha = 1 - ramp(m, 0, 260);
      if (rayAlpha > 0.01) {
        const lw = light.width;
        const lh = light.height;
        lctx.clearRect(0, 0, lw, lh);
        lctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 6; i++) {
          const cx = lw * (0.12 + i * 0.16) + Math.sin(t * 0.15 * motion + i) * 6;
          const spread = (14 + i * 4) * (lw / 160);
          const rg = lctx.createLinearGradient(0, 0, 0, lh);
          rg.addColorStop(0, `rgba(255,255,255,${0.22 * rayAlpha})`);
          rg.addColorStop(1, "rgba(255,255,255,0)");
          lctx.fillStyle = rg;
          lctx.beginPath();
          lctx.moveTo(cx - 3, -4);
          lctx.lineTo(cx + 3, -4);
          lctx.lineTo(cx + spread + 8, lh);
          lctx.lineTo(cx - spread + 8, lh);
          lctx.closePath();
          lctx.fill();
        }
        if (causticAlpha > 0.01) {
          lctx.strokeStyle = `rgba(220,245,255,${0.16 * causticAlpha})`;
          lctx.lineWidth = 5;
          lctx.lineCap = "round";
          for (let k = 0; k < 7; k++) {
            lctx.beginPath();
            const baseY = (k / 7) * lh * 0.9 + 4;
            for (let x = -8; x <= lw + 8; x += 4) {
              const y = baseY + Math.sin(x * 0.07 + t * 0.7 * motion + k * 1.7) * 4.5 + Math.cos(x * 0.17 - t * 0.45 * motion + k) * 2;
              if (x === -8) lctx.moveTo(x, y);
              else lctx.lineTo(x, y);
            }
            lctx.stroke();
          }
        }
        ctx.save();
        ctx.globalCompositeOperation = "soft-light";
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(light, 0, 0, w, h);
        ctx.restore();
      }

      // Depth grid: a faint instrument scale that streams past as you descend.
      {
        const pxPerM = h / 700;
        const dark = 1 - ramp(m, 60, 260); // dark lines in the bright shallows, light lines below
        ctx.font = "10px ui-monospace, monospace";
        ctx.textBaseline = "middle";
        const first = Math.floor((m - 360) / 50) * 50;
        for (let d = first; d <= m + 360; d += 50) {
          if (d < 0 || d > MAX_METERS) continue;
          const y = h * 0.5 + (d - m) * pxPerM;
          const edge = 1 - Math.min(1, Math.abs(y - h / 2) / (h / 2));
          const major = d % 250 === 0;
          const a = (major ? 0.16 : 0.07) * edge;
          ctx.strokeStyle = `rgba(${lerp(255, 3, dark)},${lerp(255, 20, dark)},${lerp(255, 40, dark)},${a})`;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(major ? 46 : 22, y);
          ctx.stroke();
          if (major) {
            ctx.fillStyle = `rgba(${lerp(255, 3, dark)},${lerp(255, 20, dark)},${lerp(255, 40, dark)},${a * 1.6})`;
            ctx.fillText(`${d}`, 52, y);
          }
        }
      }

      // Particles. Bubbles rise near the surface; snow sinks everywhere else.
      const bubbleMix = 1 - ramp(m, 60, 500);
      const snowAlpha = lerp(0.35, 0.8, ramp(m, 300, 2500));
      for (const p of particles) {
        const rising = p.phase < Math.PI * 2 * bubbleMix;
        p.y += (rising ? -2.2 : 0.6) * p.v * dt * motion;
        p.y -= shift;
        p.x += p.drift * dt * motion + Math.sin(t * 0.8 + p.phase) * 0.00018 * motion;
        if (p.y < -0.05) p.y = 1.05;
        if (p.y > 1.05) p.y = -0.05;
        if (p.x < -0.02) p.x = 1.02;
        if (p.x > 1.02) p.x = -0.02;
        const px = p.x * w;
        const py = p.y * h;
        if (rising) {
          ctx.strokeStyle = `rgba(255,255,255,${0.35 * bubbleMix})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(px, py, p.r + 1.2, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(220,236,250,${snowAlpha * (0.3 + 0.7 * (p.r / 2.4))})`;
          ctx.beginPath();
          ctx.arc(px, py, p.r * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Fish schools: silhouettes in their depth band.
      for (const s of schools) {
        const inBand = ramp(m, s.band[0] - 60, s.band[0] + 60) * (1 - ramp(m, s.band[1] - 150, s.band[1] + 150));
        if (inBand < 0.02) continue;
        s.x += s.dir * s.speed * dt * motion;
        if (s.dir === 1 && s.x > 1.35) s.x = -0.35;
        if (s.dir === -1 && s.x < -0.35) s.x = 1.35;
        s.y = clamp(s.y - shift * 0.6, 0.1, 0.9);
        ctx.fillStyle = rgb(colorAt(m + 900), 0.75 * inBand);
        for (const f of s.fish) {
          const fx = s.x * w + f.ox + Math.sin(t * 1.3 + f.phase) * 6;
          const fy = s.y * h + f.oy + Math.cos(t * 0.9 + f.phase) * 5;
          const tail = Math.sin(t * 9 + f.phase) * 0.35;
          ctx.save();
          ctx.translate(fx, fy);
          ctx.scale(s.dir, 1);
          ctx.beginPath();
          ctx.ellipse(0, 0, f.size, f.size * 0.42, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-f.size * 0.8, 0);
          ctx.lineTo(-f.size * 1.5, -f.size * (0.45 + tail));
          ctx.lineTo(-f.size * 1.5, f.size * (0.45 - tail));
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // Bioluminescence: ramps in after 1800 m.
      const bio = ramp(m, 1800, 3200);
      if (bio > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const count = Math.floor(glows.length * bio);
        for (let i = 0; i < count; i++) {
          const gl = glows[i];
          gl.y -= shift * 0.6;
          if (gl.y < -0.05) gl.y = 1.05;
          if (gl.y > 1.05) gl.y = -0.05;
          const pulse = 0.5 + 0.5 * Math.sin(t * gl.speed * motion + gl.phase);
          const a = (0.25 + 0.6 * pulse) * bio;
          const gx = gl.x * w;
          const gy = gl.y * h;
          const rad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gl.r * 7);
          rad.addColorStop(0, `rgba(${gl.hue},${a})`);
          rad.addColorStop(0.35, `rgba(${gl.hue},${a * 0.25})`);
          rad.addColorStop(1, `rgba(${gl.hue},0)`);
          ctx.fillStyle = rad;
          ctx.beginPath();
          ctx.arc(gx, gy, gl.r * 7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Jellyfish: translucent bells pulsing through the abyss.
      const jf = ramp(m, 1900, 2600) * (1 - ramp(m, 3850, MAX_METERS));
      if (jf > 0.02) {
        for (const j of jellies) {
          const pulse = Math.sin(t * 1.4 * motion + j.phase);
          j.y -= (0.012 + 0.01 * Math.max(0, pulse)) * dt * motion + shift * 0.5;
          j.x += j.vx * dt * motion;
          if (j.y < -0.15) j.y = 1.15;
          if (j.y > 1.15) j.y = -0.15;
          if (j.x < -0.1) j.x = 1.1;
          if (j.x > 1.1) j.x = -0.1;
          const jx = j.x * w;
          const jy = j.y * h;
          const r = j.r * (1 + 0.1 * pulse);
          ctx.save();
          ctx.translate(jx, jy);
          // faint halo
          const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
          halo.addColorStop(0, `rgba(150,225,245,${0.14 * jf})`);
          halo.addColorStop(1, "rgba(150,225,245,0)");
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2);
          ctx.fill();
          // bell
          ctx.beginPath();
          ctx.arc(0, 0, r, Math.PI, 0);
          for (let k = 0; k <= 6; k++) {
            const x = r - (k / 6) * 2 * r;
            ctx.lineTo(x, (k % 2 ? r * 0.28 : r * 0.12) * (1 - 0.3 * pulse));
          }
          ctx.closePath();
          ctx.fillStyle = `rgba(160,228,246,${0.16 * jf})`;
          ctx.strokeStyle = `rgba(190,236,250,${0.5 * jf})`;
          ctx.lineWidth = 1;
          ctx.fill();
          ctx.stroke();
          // tentacles
          ctx.strokeStyle = `rgba(190,236,250,${0.32 * jf})`;
          for (let k = 0; k < j.tentacles.length; k++) {
            const tn = j.tentacles[k];
            const x0 = -r * 0.7 + (k / (j.tentacles.length - 1)) * r * 1.4;
            const sway = Math.sin(t * 1.1 * motion + tn.phase) * r * 0.5;
            ctx.beginPath();
            ctx.moveTo(x0, r * 0.2);
            ctx.bezierCurveTo(x0 + sway * 0.3, r * tn.len * 0.4, x0 - sway * 0.6, r * tn.len * 0.7, x0 + sway, r * tn.len);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // Seafloor: rises into view over the last stretch.
      const floor = ramp(m, 3100, MAX_METERS);
      if (floor > 0.01) {
        const rise = (1 - floor) * 320;
        const backY = h - 170 + rise;
        const frontY = h - 84 + rise;
        const ridgeAt = (x: number) => backY + Math.sin(x * 0.004 + 0.6) * 22 + Math.sin(x * 0.011) * 9;
        const duneAt = (x: number) => frontY + Math.sin(x * 0.006 + 1.2) * 18 + Math.sin(x * 0.017) * 8;

        // back ridge
        ctx.fillStyle = "rgba(5,14,27,0.94)";
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 30) ctx.lineTo(x, ridgeAt(x));
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // shipwreck, settled on the ridge and listing to one side
        {
          const wx = wreckX * w;
          const wy = ridgeAt(wx) + 8;
          const s = Math.min(1.3, w / 1200);
          ctx.save();
          ctx.translate(wx, wy);
          ctx.rotate(-0.12);
          ctx.scale(s, s);
          ctx.fillStyle = "rgba(2,7,14,0.98)";
          ctx.beginPath(); // hull
          ctx.moveTo(-150, -10);
          ctx.quadraticCurveTo(-170, 30, -120, 40);
          ctx.lineTo(120, 40);
          ctx.quadraticCurveTo(190, 20, 175, -30);
          ctx.lineTo(150, -8);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "rgba(2,7,14,0.98)";
          ctx.lineWidth = 5;
          ctx.beginPath(); // mast + yard
          ctx.moveTo(10, -8);
          ctx.lineTo(28, -150);
          ctx.moveTo(-30, -96);
          ctx.lineTo(80, -118);
          ctx.stroke();
          ctx.fillStyle = "rgba(4,12,22,0.8)";
          ctx.beginPath(); // tattered sail
          ctx.moveTo(-26, -94);
          ctx.lineTo(-2, -30);
          ctx.lineTo(60, -112);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // corals on the ridge
        for (const c of corals) {
          const cx = c.x * w;
          ctx.save();
          ctx.translate(cx, ridgeAt(cx) + 4);
          ctx.scale(c.scale, c.scale);
          ctx.strokeStyle = "rgba(7,20,36,0.96)";
          ctx.lineCap = "round";
          for (const [x1, y1, x2, y2, d] of c.segs) {
            ctx.lineWidth = d * 1.2;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
          ctx.restore();
        }

        // anemones with faintly luminous tips
        for (const a of anemones) {
          const ax = a.x * w;
          const ay = ridgeAt(ax) + 6;
          ctx.strokeStyle = "rgba(8,24,40,0.95)";
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          for (let k = 0; k < a.n; k++) {
            const ang = -Math.PI / 2 + (k / (a.n - 1) - 0.5) * 1.6;
            const sway = Math.sin(t * 0.9 * motion + a.phase + k * 0.5) * 7;
            const tx = ax + Math.cos(ang) * a.len + sway;
            const ty = ay + Math.sin(ang) * a.len;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.quadraticCurveTo(ax + Math.cos(ang) * a.len * 0.5 - sway * 0.4, ay + Math.sin(ang) * a.len * 0.6, tx, ty);
            ctx.stroke();
            ctx.fillStyle = `rgba(94,234,212,${0.45 * floor})`;
            ctx.beginPath();
            ctx.arc(tx, ty, 1.6, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = "rgba(6,18,32,0.98)";
          ctx.beginPath();
          ctx.ellipse(ax, ay + 2, 9, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // kelp
        ctx.strokeStyle = "rgba(6,20,30,0.95)";
        ctx.lineCap = "round";
        for (const k of kelp) {
          const kx = k.x * w;
          const ky = ridgeAt(kx) + 10;
          const sway = Math.sin(t * 0.6 * motion + k.phase) * 18;
          ctx.lineWidth = k.width;
          ctx.beginPath();
          ctx.moveTo(kx, ky);
          ctx.bezierCurveTo(kx + sway * 0.4, ky - k.height * 0.4, kx + sway, ky - k.height * 0.75, kx + sway * 1.4, ky - k.height);
          ctx.stroke();
        }

        // rocks in front of the ridge
        ctx.fillStyle = "rgba(3,10,19,0.98)";
        for (const r of rocks) {
          const rx = r.x * w;
          ctx.beginPath();
          ctx.ellipse(rx, duneAt(rx) - r.ry * 0.3, r.rx, r.ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // front dune + sand ripples
        ctx.fillStyle = "rgba(3,8,16,0.98)";
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 30) ctx.lineTo(x, duneAt(x));
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;
        for (const rp of ripples) {
          const x = rp.x * w;
          const y = duneAt(x) + rp.dy;
          if (y > h) continue;
          ctx.beginPath();
          ctx.moveTo(x - rp.w / 2, y);
          ctx.quadraticCurveTo(x, y - 4, x + rp.w / 2, y);
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [meters, reduced]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />;
}
