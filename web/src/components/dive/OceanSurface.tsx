"use client";

import { useEffect, useRef } from "react";
import type { MotionValue } from "motion/react";
import { useReducedMotion } from "motion/react";
import { ramp } from "@/lib/depth";
import { compileProgramAsync } from "@/lib/gl";

/**
 * Half-submerged ocean rendered in a WebGL fragment shader.
 *
 * A virtual camera sits at the waterline. Per pixel we cast a ray: above the
 * near surface it is ray-marched against a procedural wave heightfield and
 * shaded with Fresnel sky reflection, sun glints and foam; below it we see a
 * caustic-lit sand floor through fog, with light shafts and the mirror-like
 * underside of the surface. The waterline is simply where the near waves cross
 * the camera, so it bobs on its own.
 *
 * `meters` sinks the camera (the line rises off-screen) and fades the layer out
 * so the 2D deep-ocean canvas underneath takes over. `surface` is the screen
 * fraction (from the top) where the horizon should sit — measured from the hero
 * so the water starts right under the buttons.
 */
export function OceanSurface({ meters, surface }: { meters: MotionValue<number>; surface: MotionValue<number> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" });
    if (!gl) return;

    // Nothing is drawn until the program is ready; the CSS backdrop shows meanwhile.
    let raf = 0;
    let teardown = () => {};
    const fitRef = { current: () => {} };
    const onResize = () => fitRef.current();

    const cancelCompile = compileProgramAsync(gl, VERT, FRAG, {
      label: "OceanSurface",
      onFail: () => {},
      onReady: ({ prog, vs, fs }) => {
        gl.useProgram(prog);

        // Fullscreen triangle
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(prog, "a_pos");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const uRes = gl.getUniformLocation(prog, "u_res");
        const uTime = gl.getUniformLocation(prog, "u_time");
        const uCamY = gl.getUniformLocation(prog, "u_camY");
        const uHorizon = gl.getUniformLocation(prog, "u_horizon");

        // Internal resolution is capped by a pixel budget and lowered if frames get slow.
        let budget = 900_000;
        let w = 0;
        let h = 0;
        const fit = () => {
          const cw = window.innerWidth;
          const ch = window.innerHeight;
          const scale = Math.min(1, Math.sqrt(budget / (cw * ch)));
          w = Math.max(2, Math.round(cw * scale));
          h = Math.max(2, Math.round(ch * scale));
          canvas.width = w;
          canvas.height = h;
          canvas.style.width = `${cw}px`;
          canvas.style.height = `${ch}px`;
          gl.viewport(0, 0, w, h);
        };
        fitRef.current = fit;
        fit();
        window.addEventListener("resize", onResize);

        let prev = performance.now();
        const readyAt = prev;
        let simT = 0;
        let avg = 16;
        let frames = 0;

        const frame = (now: number) => {
          const dt = Math.min(0.05, (now - prev) / 1000);
          const interval = now - prev;
          prev = now;

          const m = meters.get();
          // Fade in over the CSS backdrop once ready, and out as the camera sinks.
          const fadeIn = Math.min(1, (now - readyAt) / 450);
          const opacity = (1 - ramp(m, 18, 48)) * fadeIn;
          canvas.style.opacity = opacity.toFixed(3);
          if (opacity <= 0.001 && fadeIn >= 1) {
            raf = requestAnimationFrame(frame);
            return;
          }

          if (!reduced) simT += dt;
          avg = avg * 0.9 + interval * 0.1;
          if (++frames % 90 === 0 && avg > 26 && budget > 320_000) {
            budget *= 0.72;
            fit();
          }

          const bob = reduced ? 0 : Math.sin(simT * 0.6) * 0.03 * (1 - ramp(m, 0, 8));
          gl.uniform2f(uRes, w, h);
          gl.uniform1f(uTime, simT);
          gl.uniform1f(uCamY, -m * 0.1 + bob);
          gl.uniform1f(uHorizon, surface.get());
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);

        teardown = () => {
          gl.deleteProgram(prog);
          gl.deleteShader(vs);
          gl.deleteShader(fs);
          gl.deleteBuffer(buf);
        };
      },
    });

    return () => {
      // Note: never loseContext() here — React StrictMode re-runs this effect on the
      // same canvas, and a lost context can't be re-created.
      cancelCompile();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      teardown();
    };
  }, [meters, surface, reduced]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[-5]" style={{ opacity: 0 }} />;
}

const VERT = /* glsl */ `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_res;
uniform float u_time;
uniform float u_camY;
uniform float u_horizon;

const vec3 SUN = vec3(0.49, 0.31, 0.815);

// ---- noise -------------------------------------------------------------------
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; }
  return v;
}

// ---- waves -------------------------------------------------------------------
// Sharp-crested profile: narrow peaks, wide troughs.
float crest(float x) { float s = 0.5 + 0.5 * sin(x); return s * s; }

// Layered directional waves with a Gerstner-style horizontal drift so crests bunch up.
float waveH(vec2 p, float t, int octs) {
  float h = 0.0, amp = 1.0, freq = 0.9, speed = 1.1, norm = 0.0;
  vec2 dir = vec2(0.94, 0.34);
  for (int i = 0; i < 6; i++) {
    if (i >= octs) break;
    float ph = dot(p, dir) * freq + t * speed;
    p -= dir * (amp * 0.22 / freq) * cos(ph);
    h += amp * (crest(ph) - 0.375);
    norm += amp;
    dir = mat2(0.766, 0.643, -0.643, 0.766) * dir;
    freq *= 1.85; amp *= 0.52; speed *= 1.2;
  }
  return h / norm * 0.3;
}
vec3 waveNormal(vec2 p, float t, float eps) {
  float h = waveH(p, t, 6);
  float hx = waveH(p + vec2(eps, 0.0), t, 6);
  float hz = waveH(p + vec2(0.0, eps), t, 6);
  return normalize(vec3(h - hx, eps, h - hz));
}

// ---- sky ---------------------------------------------------------------------
vec3 skyColor(vec3 rd, float t) {
  float y = clamp(rd.y, 0.0, 1.0);
  vec3 col = mix(vec3(0.80, 0.88, 0.95), vec3(0.30, 0.55, 0.86), pow(y, 0.55));
  float sd = max(dot(rd, SUN), 0.0);
  col += vec3(1.0, 0.96, 0.88) * (pow(sd, 900.0) * 1.4 + pow(sd, 30.0) * 0.18 + pow(sd, 4.0) * 0.05);
  if (rd.y > 0.005) {
    vec2 cuv = rd.xz / (rd.y + 0.15) * 1.4 + vec2(t * 0.015, t * 0.004);
    float cover = smoothstep(0.50, 0.70, fbm(cuv));
    float lit = smoothstep(0.35, 0.85, fbm(cuv * 1.7 + 4.2));
    vec3 cloud = mix(vec3(0.82, 0.86, 0.92), vec3(1.0), lit);
    col = mix(col, cloud, cover * smoothstep(0.0, 0.2, rd.y));
  }
  return col;
}

// ---- caustics (used on the floor and for light shafts) ---------------------------
float caustic(vec2 p, float t) {
  vec2 q = p + 0.35 * vec2(noise(p * 1.3 + t * 0.25), noise(p * 1.3 - t * 0.2 + 3.1));
  float a = 1.0 - abs(sin(q.x * 3.0 + sin(q.y * 2.1 + t * 0.7)));
  float b = 1.0 - abs(sin(q.y * 3.3 - sin(q.x * 2.4 - t * 0.6)));
  return pow(max(a * b, 0.0), 2.2);
}

// ---- ray vs. wave surface -------------------------------------------------------
float traceWater(vec3 ro, vec3 rd, float t, float d0, float tmax) {
  float d = d0;
  for (int i = 0; i < 36; i++) {
    float stp = max(0.06, d * 0.16);
    float nd = d + stp;
    vec3 q = ro + rd * nd;
    if (q.y - waveH(q.xz, t, 4) < 0.0) {
      float lo = d, hi = nd;
      for (int j = 0; j < 5; j++) {
        float mid = 0.5 * (lo + hi);
        vec3 mq = ro + rd * mid;
        if (mq.y - waveH(mq.xz, t, 4) < 0.0) hi = mid; else lo = mid;
      }
      return 0.5 * (lo + hi);
    }
    d = nd;
    if (d > tmax) break;
  }
  return -1.0;
}

// ---- above the surface -----------------------------------------------------------
vec3 shadeWater(vec3 ro, vec3 rd, float d, float t) {
  vec3 p = ro + rd * d;
  vec3 n = waveNormal(p.xz, t, 0.012 + d * 0.006);
  float ndv = max(dot(n, -rd), 0.0);
  float fres = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);
  vec3 refl = skyColor(reflect(rd, n), t);
  float near = exp(-d * 0.07);
  vec3 body = mix(vec3(0.03, 0.30, 0.44), vec3(0.22, 0.70, 0.70), near);
  body = mix(body, vec3(0.45, 0.70, 0.68), near * near * 0.5 * (0.6 + 0.4 * caustic(p.xz * 0.5, t)));
  float ss = pow(max(dot(rd, SUN), 0.0), 3.0) * smoothstep(-0.05, 0.15, p.y) * 0.8;
  body += vec3(0.08, 0.32, 0.28) * ss;
  vec3 col = mix(body, refl, fres);
  float spec = pow(max(dot(reflect(-SUN, n), -rd), 0.0), 220.0);
  col += vec3(1.0, 0.97, 0.9) * spec * 2.0;
  float foam = smoothstep(0.10, 0.17, p.y) * (0.45 + 0.55 * noise(p.xz * 9.0 + t * 0.8));
  col = mix(col, vec3(0.93, 0.97, 1.0), clamp(foam, 0.0, 1.0) * 0.9 * (0.3 + 0.7 * near));
  col = mix(col, skyColor(normalize(vec3(rd.x, 0.02, rd.z)), t), 1.0 - exp(-d * 0.028));
  return col;
}

// ---- below the surface -----------------------------------------------------------
vec3 underwater(vec3 ro, vec3 rd, float t) {
  float sunk = clamp(-ro.y / 4.5, 0.0, 1.0);
  vec3 fog = mix(vec3(0.05, 0.42, 0.52), vec3(0.03, 0.20, 0.36), sunk);
  float floorY = -5.5;
  vec3 col;
  float dist;
  if (rd.y < -0.002) {
    dist = (floorY - ro.y) / rd.y;
    vec3 p = ro + rd * dist;
    float ca = caustic(p.xz * 0.4, t);
    float grain = 0.55 + 0.45 * noise(p.xz * 1.5);
    float rip = 0.9 + 0.1 * sin(p.x * 2.0 + noise(p.xz * 0.6) * 4.0);
    col = vec3(0.60, 0.62, 0.50) * grain * rip * (0.5 + 1.3 * ca) * vec3(0.6, 0.85, 0.88);
  } else {
    float up = rd.y;
    dist = 6.0 / max(up, 0.06);
    float window = smoothstep(0.52, 0.78, up);
    vec3 under = fog * 0.85 + vec3(0.06, 0.12, 0.10) * noise(rd.xz / max(up, 0.1) * 3.0 + t * 0.25);
    vec3 sky = skyColor(vec3(rd.x, max(up, 0.05), rd.z), t);
    col = mix(under, sky * 0.95, window);
  }
  col = mix(col, fog, 1.0 - exp(-dist * 0.10));
  // light shafts: volumetric samples under the bright caustic cells
  float shaft = 0.0;
  float span = min(dist, 12.0);
  for (int i = 0; i < 8; i++) {
    float s = (float(i) + 0.5) / 8.0 * span;
    vec3 q = ro + rd * s;
    shaft += caustic(q.xz * 0.22 + vec2(0.0, q.y * 0.08), t) * exp(q.y * 0.35);
  }
  shaft *= span / 8.0 * 0.12;
  col += vec3(0.30, 0.60, 0.62) * shaft * (0.55 + 0.45 * max(dot(rd, SUN), 0.0)) * (1.0 - sunk * 0.7);
  return col;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv * 2.0 - 1.0;
  float aspect = u_res.x / u_res.y;
  float hp = (1.0 - u_horizon) * 2.0 - 1.0;
  float t = u_time;
  vec3 ro = vec3(0.0, u_camY, 0.0);
  vec3 rd = normalize(vec3(p.x * aspect * 0.9, (p.y - hp) * 0.9, 1.3));

  // Is this pixel's near point above or below the wave surface?
  float dNear = 1.2 / rd.z;
  vec3 pn = ro + rd * dNear;
  float dy = pn.y - waveH(pn.xz, t, 5);

  vec3 col;
  if (dy > 0.0) {
    float d = traceWater(ro, rd, t, dNear, rd.y > 0.0 ? 8.0 : 60.0);
    if (d > 0.0) col = shadeWater(ro, rd, d, t);
    else if (rd.y > 0.0) col = skyColor(rd, t);
    else col = mix(vec3(0.08, 0.38, 0.52), skyColor(normalize(vec3(rd.x, 0.02, rd.z)), t), 0.8);
  } else {
    col = underwater(ro, rd, t);
    // drifting motes: one soft dot per sparse cell
    vec2 sp = uv * vec2(70.0, 40.0) + vec2(t * 0.4, t * 0.9);
    vec2 cell = floor(sp);
    float hsh = hash(cell);
    vec2 off = vec2(hash(cell + 1.3), hash(cell + 7.1)) * 0.6 - 0.3;
    float dmote = length((fract(sp) - 0.5 - off) * vec2(1.0, 1.75));
    col += smoothstep(0.09, 0.0, dmote) * step(0.965, hsh) * 0.22;
  }
  // foam meniscus along the waterline
  float line = exp(-abs(dy) * 45.0);
  col = mix(col, vec3(0.90, 0.96, 1.0), line * 0.8);
  col = pow(max(col, 0.0), vec3(0.92));
  gl_FragColor = vec4(col, 1.0);
}
`;
