"use client";

import { useEffect, useRef } from "react";
import type { MotionValue } from "motion/react";
import { useReducedMotion } from "motion/react";
import { ramp } from "@/lib/depth";

/**
 * The water column and the seafloor, rendered in a WebGL fragment shader from a
 * camera that descends with `meters`.
 *
 *  - Marine snow on four depth planes: near layers stream past faster than far
 *    ones and stretch into streaks with your descent speed.
 *  - Volumetric light shafts near the surface, fading with depth.
 *  - Fish schools and jellyfish on parallax layers in their depth bands.
 *  - Bioluminescence as soft, pulsing glows at several distances.
 *  - From ~3,000 m, a ray-marched seafloor: dunes, lumpy rocks, swaying kelp,
 *    a listing wreck and glowing anemones, lit and fogged as real solids.
 *
 * Takes over as the surface shader fades out; pauses entirely on the surface.
 */
export function OceanDeep({ meters, onSupport }: { meters: MotionValue<number>; onSupport?: (ok: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" });
    if (!gl) {
      onSupport?.(false);
      return;
    }

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error("[OceanDeep] shader error:", gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) {
      onSupport?.(false);
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("[OceanDeep] link error:", gl.getProgramInfoLog(prog));
      onSupport?.(false);
      return;
    }
    gl.useProgram(prog);
    onSupport?.(true);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uM = gl.getUniformLocation(prog, "u_m");
    const uSpeed = gl.getUniformLocation(prog, "u_speed");

    let budget = 800_000;
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
    fit();
    window.addEventListener("resize", fit);

    let raf = 0;
    let prev = performance.now();
    let simT = 0;
    let avg = 16;
    let frames = 0;
    let lastM = meters.get();
    let speed = 0; // metres per second, smoothed

    const frame = (now: number) => {
      const dt = Math.max(0.001, Math.min(0.05, (now - prev) / 1000));
      const interval = now - prev;
      prev = now;

      const m = meters.get();
      speed = speed * 0.85 + ((m - lastM) / dt) * 0.15;
      lastM = m;

      const opacity = ramp(m, 14, 40);
      canvas.style.opacity = opacity.toFixed(3);
      if (opacity <= 0.001) {
        raf = requestAnimationFrame(frame);
        return;
      }

      if (!reduced) simT += dt;
      avg = avg * 0.9 + interval * 0.1;
      if (++frames % 90 === 0 && avg > 26 && budget > 300_000) {
        budget *= 0.72;
        fit();
      }

      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTime, simT);
      gl.uniform1f(uM, m);
      gl.uniform1f(uSpeed, reduced ? 0 : speed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [meters, reduced, onSupport]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[-8]" />;
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
uniform float u_m;      // depth in metres
uniform float u_speed;  // descent speed, metres per second (negative when ascending)

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
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; }
  return v;
}
float caustic(vec2 p, float t) {
  vec2 q = p + 0.35 * vec2(noise(p * 1.3 + t * 0.25), noise(p * 1.3 - t * 0.2 + 3.1));
  float a = 1.0 - abs(sin(q.x * 3.0 + sin(q.y * 2.1 + t * 0.7)));
  float b = 1.0 - abs(sin(q.y * 3.3 - sin(q.x * 2.4 - t * 0.6)));
  return pow(max(a * b, 0.0), 2.2);
}

// ---- water colour by depth -------------------------------------------------------
vec3 depthColor(float m) {
  m = clamp(m, 0.0, 4000.0);
  vec3 c0 = vec3(0.06, 0.40, 0.52), c1 = vec3(0.03, 0.22, 0.38), c2 = vec3(0.015, 0.08, 0.19);
  vec3 c3 = vec3(0.008, 0.03, 0.085), c4 = vec3(0.004, 0.010, 0.028);
  if (m < 300.0) return mix(c0, c1, m / 300.0);
  if (m < 1000.0) return mix(c1, c2, (m - 300.0) / 700.0);
  if (m < 2500.0) return mix(c2, c3, (m - 1000.0) / 1500.0);
  return mix(c3, c4, (m - 2500.0) / 1500.0);
}

// ---- camera ------------------------------------------------------------------
mat3 cameraBasis(float yaw, float pitch) {
  vec3 f = normalize(vec3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)));
  vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0)));
  vec3 u = cross(r, f);
  return mat3(r, u, f);
}

// ---- layered sprites: snow, fish, jellyfish, bioluminescence ---------------------
// Each is a jittered grid on a plane at distance d in front of the camera. The
// camera's descent scrolls the plane, so near planes move faster: real parallax.

vec3 snow(vec3 rd, float t, float scroll, float speedUnits, float light) {
  vec3 acc = vec3(0.0);
  if (rd.z < 0.05) return acc;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float d = 3.2 + fk * fk * 2.5 + fk * 2.0;             // 3.2, 7.7, 17.2, 31.7
    vec2 uv = rd.xy / rd.z * d;
    uv.y -= scroll;
    uv.x += sin(t * 0.13 + fk) * 0.3;
    float cs = 0.9 + fk * 0.35;
    vec2 cell = floor(uv / cs);
    vec2 f = fract(uv / cs) - 0.5;
    float h = hash(cell + fk * 17.0);
    if (h < 0.5) continue;
    vec2 off = vec2(hash(cell + 3.1), hash(cell + 9.7)) * 0.7 - 0.35;
    vec2 q = (f - off) * cs;                                // units
    float ru = 0.012 + 0.02 * hash(cell + 5.5);
    float streak = abs(speedUnits) * 0.05;
    float stretch = 1.0 + streak / ru;
    float len = length(vec2(q.x, q.y / stretch));
    float a = smoothstep(ru, ru * 0.35, len) / sqrt(stretch);
    acc += vec3(0.72, 0.84, 0.92) * a * exp(-d * 0.05) * (0.35 + 0.65 * light);
  }
  return acc;
}

float fishLayer(vec3 rd, float t, float scroll, float d, float seed) {
  if (rd.z < 0.05) return 0.0;
  float dir = seed > 0.5 ? 1.0 : -1.0;
  vec2 uv = rd.xy / rd.z * d;
  uv.y -= scroll * 0.9;
  uv.x += t * 0.4 * dir;
  float cs = 1.7;
  vec2 cell = floor(uv / cs);
  vec2 f = fract(uv / cs) - 0.5;
  float school = noise(cell * 0.16 + seed * 10.0);
  float h = hash(cell + seed * 31.0);
  if (school < 0.56 || h < 0.3) return 0.0;
  vec2 off = (vec2(hash(cell + 1.7), hash(cell + 4.3)) - 0.5) * 0.6;
  vec2 q = (f - off) * cs;
  q.x *= dir;
  float size = 0.14 + 0.1 * hash(cell + 8.8);
  float body = length(q / vec2(size, size * 0.4)) - 1.0;
  float wag = sin(t * 9.0 + h * 6.3) * 0.3;
  vec2 tq = q - vec2(-size * 0.9, 0.0);
  float tail = max(abs(tq.y) + tq.x * (0.55 + wag), tq.x);
  tail = max(tail, -tq.x - size * 0.55);
  float shape = min(body * size, tail);
  return smoothstep(0.015, -0.015, shape) * exp(-d * 0.06);
}

vec3 bio(vec3 rd, float t, float scroll) {
  vec3 acc = vec3(0.0);
  if (rd.z < 0.05) return acc;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float d = 3.0 + fk * fk * 4.0 + fk * 3.0;              // 3, 10, 23
    vec2 uv = rd.xy / rd.z * d;
    uv.y -= scroll * 0.98;
    float cs = 2.2 + fk * 0.8;
    vec2 cell = floor(uv / cs);
    vec2 f = fract(uv / cs) - 0.5;
    float h = hash(cell + fk * 41.0);
    if (h < 0.68) continue;
    vec2 off = (vec2(hash(cell + 2.3), hash(cell + 7.9)) - 0.5) * 0.7;
    vec2 q = (f - off) * cs;
    float pulse = 0.5 + 0.5 * sin(t * (0.6 + h) + h * 20.0);
    float r = 0.05 + 0.07 * hash(cell + 2.2);
    float glow = min(r * r / (dot(q, q) + r * r * 0.15), 3.0);
    vec3 hue = mix(vec3(0.36, 0.92, 0.83), vec3(0.49, 0.83, 0.99), hash(cell + 6.6));
    acc += hue * glow * (0.3 + 0.7 * pulse) * exp(-d * 0.05) * 0.5;
  }
  return acc;
}

vec3 jelly(vec3 rd, float t, float scroll) {
  vec3 acc = vec3(0.0);
  if (rd.z < 0.05) return acc;
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float d = 7.5 + fk * 9.0;
    vec2 uv = rd.xy / rd.z * d;
    uv.y -= scroll * 0.97 + t * 0.08;
    float cs = 7.0;
    vec2 cell = floor(uv / cs);
    vec2 f = fract(uv / cs) - 0.5;
    float h = hash(cell + fk * 23.0);
    if (h < 0.68) continue;
    vec2 off = (vec2(hash(cell + 1.3), hash(cell + 2.9)) - 0.5) * 0.5;
    vec2 q = (f - off) * cs;
    float pulse = sin(t * 1.5 + h * 6.3);
    float R = 0.42 + 0.1 * pulse;
    float bell = length(vec2(q.x / R, max(q.y, 0.0) / (R * 0.8))) - 1.0;
    float bellA = smoothstep(0.06, -0.06, bell) * step(-0.15 * R, q.y);
    float tent = 0.0;
    for (int j = 0; j < 4; j++) {
      float x0 = (float(j) - 1.5) * R * 0.45;
      float yy = -q.y;
      float wav = sin(yy * 3.0 - t * 2.0 + float(j)) * 0.12 * min(yy, 1.0);
      float dx = abs(q.x - x0 - wav);
      tent += smoothstep(0.035, 0.0, dx) * step(0.0, yy) * smoothstep(2.6, 0.5, yy);
    }
    float glow = 0.12 / (length(vec2(q.x, max(q.y, 0.0))) + 0.2);
    vec3 hue = vec3(0.55, 0.85, 0.95);
    acc += (hue * (bellA * 0.5 + tent * 0.3) + hue * glow * 0.25) * exp(-d * 0.05);
  }
  return acc;
}

// ---- light shafts near the surface ---------------------------------------------
float shafts(vec3 ro, vec3 rd, float t) {
  float s = 0.0;
  for (int i = 0; i < 10; i++) {
    float d = 0.8 + float(i) * 1.6;
    vec3 p = ro + rd * d;
    vec2 q = p.xz + p.y * vec2(0.3, 0.1);
    s += caustic(q * 0.35, t) * exp(-d * 0.08);
  }
  return s / 10.0;
}

// ---- seafloor scene (signed distance field) ----------------------------------------
float terrainH(vec2 p) { return fbm(p * 0.06) * 4.0 + noise(p * 0.45) * 0.35 - 2.0; }
float sdEllipsoid(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }

// Materials: 0 sand, 1 rock, 2 kelp, 3 wreck, 4 anemone (emissive)
float mapScene(vec3 p, float t, out float mid) {
  float ground = terrainH(p.xz);
  float d = (p.y - ground) * 0.8;
  mid = 0.0;
  // rocks on a 9 m grid (never in the camera's own cell)
  {
    vec2 c = floor((p.xz + 4.5) / 9.0);
    vec2 q = p.xz - c * 9.0;
    float h = hash(c + 0.5);
    if (h > 0.35 && !(c.x == 0.0 && c.y == 0.0)) {
      vec2 off = (vec2(hash(c + 1.1), hash(c + 2.2)) - 0.5) * 5.0;
      float s = 0.5 + 1.4 * hash(c + 3.3);
      float gy = terrainH(c * 9.0 + off);
      float dr = sdEllipsoid(vec3(q.x - off.x, p.y - gy + s * 0.3, q.y - off.y), vec3(s * 1.3, s * 0.8, s));
      dr -= 0.08 * noise(p.xz * 2.0 + p.y);
      if (dr < d) { d = dr; mid = 1.0; }
    }
  }
  // kelp on a 5 m grid
  {
    vec2 c = floor((p.xz + 2.5) / 5.0);
    vec2 q = p.xz - c * 5.0;
    float h = hash(c + 7.7);
    if (h > 0.45 && !(c.x == 0.0 && c.y == 0.0)) {
      vec2 off = (vec2(hash(c + 8.8), hash(c + 9.9)) - 0.5) * 3.0;
      float hgt = 2.5 + 4.5 * hash(c + 4.4);
      float gy = terrainH(c * 5.0 + off);
      // two segments with different sway so the stalk bends in an S, not a tilt
      float sway = sin(t * 0.7 + h * 6.3) * 0.45;
      float sway2 = sin(t * 0.9 + h * 6.3 + 1.7) * 0.7;
      vec3 a = vec3(off.x, gy - 0.2, off.y);
      vec3 mdp = vec3(off.x + sway, gy + hgt * 0.5, off.y + sway * 0.4);
      vec3 b = mdp + vec3(sway2, hgt * 0.5, sway2 * 0.4);
      float rel = clamp((p.y - gy) / hgt, 0.0, 1.0);
      vec3 lp = vec3(q.x, p.y, q.y);
      float dk = min(sdCapsule(lp, a, mdp, 0.11 + 0.04 * (1.0 - rel)), sdCapsule(lp, mdp, b, 0.08 + 0.04 * (1.0 - rel)));
      dk -= 0.06 * (0.5 + 0.5 * sin((p.y - gy) * 3.0 + h * 10.0));
      if (dk < d) { d = dk; mid = 2.0; }
    }
  }
  // the wreck: hull, bow, mast and yard, listing to one side
  {
    vec3 wp = p - vec3(-8.0, terrainH(vec2(-8.0, 24.0)) + 0.8, 24.0);
    float ca = cos(0.35), sa = sin(0.35);
    wp.xz = mat2(ca, -sa, sa, ca) * wp.xz;
    float cb = cos(0.2), sb = sin(0.2);
    wp.xy = mat2(cb, -sb, sb, cb) * wp.xy;
    float hull = sdBox(wp, vec3(9.0, 1.8, 2.4)) - 0.5;
    hull = max(hull, -sdBox(wp - vec3(0.0, 2.0, 0.0), vec3(8.0, 1.5, 1.8)));
    float bow = sdEllipsoid(wp - vec3(9.0, 0.2, 0.0), vec3(3.6, 2.0, 2.6));
    hull = min(hull, bow);
    float mast = sdCapsule(wp, vec3(1.0, 0.0, 0.0), vec3(1.6, 10.0, 0.0), 0.18);
    float yard = sdBox(wp - vec3(1.5, 7.4, 0.0), vec3(0.12, 0.12, 3.6));
    float dw = min(hull, min(mast, yard));
    if (dw < d) { d = dw; mid = 3.0; }
  }
  // glowing anemones on a 6 m grid
  {
    vec2 c = floor((p.xz + 3.0) / 6.0);
    vec2 q = p.xz - c * 6.0;
    float h = hash(c + 12.3);
    if (h > 0.5) {
      vec2 off = (vec2(hash(c + 13.1), hash(c + 14.2)) - 0.5) * 4.0;
      float gy = terrainH(c * 6.0 + off);
      float da = length(vec3(q.x - off.x, p.y - gy - 0.15, q.y - off.y)) - 0.22;
      if (da < d) { d = da; mid = 4.0; }
    }
  }
  return d;
}

float march(vec3 ro, vec3 rd, float t, float maxD, out float mid) {
  float d = 0.4;
  mid = -1.0;
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * d;
    float m;
    float h = mapScene(p, t, m);
    if (h < 0.002 * d + 0.01) { mid = m; return d; }
    d += h * 0.85;
    if (d > maxD) break;
  }
  return -1.0;
}
vec3 normalAt(vec3 p, float t) {
  vec2 e = vec2(0.02, 0.0);
  float m;
  return normalize(vec3(
    mapScene(p + e.xyy, t, m) - mapScene(p - e.xyy, t, m),
    mapScene(p + e.yxy, t, m) - mapScene(p - e.yxy, t, m),
    mapScene(p + e.yyx, t, m) - mapScene(p - e.yyx, t, m)));
}
vec3 shadeFloor(vec3 p, vec3 n, vec3 rd, float mid, float t, vec3 fog, float dist) {
  vec3 albedo;
  if (mid < 0.5) albedo = vec3(0.30, 0.33, 0.30) * (0.8 + 0.2 * noise(p.xz * 3.0));
  else if (mid < 1.5) albedo = vec3(0.10, 0.12, 0.13);
  else if (mid < 2.5) albedo = vec3(0.05, 0.13, 0.08);
  else if (mid < 3.5) albedo = vec3(0.20, 0.15, 0.12) * (0.7 + 0.3 * noise(p.xy * 2.0 + p.z)); // rusted hull
  else albedo = vec3(0.10, 0.50, 0.45);
  vec3 L = normalize(vec3(0.3, 1.0, 0.2));
  float sun = max(dot(n, L), 0.0) * 0.4;
  float fill = max(dot(n, -rd), 0.0) * 0.45;
  float head = max(dot(n, -rd), 0.0) * 1.1 * exp(-dist * 0.07); // submersible headlight: near scene reads, far fades
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * max(n.y, 0.0) * 0.5; // faint light from above on edges
  vec3 col = albedo * (sun + fill + head + 0.12) * vec3(0.7, 0.9, 1.0) + vec3(0.2, 0.5, 0.55) * rim * 0.25;
  if (mid > 3.5) col += vec3(0.25, 0.9, 0.8) * (0.6 + 0.4 * sin(t * 2.0 + p.x * 3.0));
  if (mid > 2.5 && mid < 3.5) {
    // luminous growth clinging to the hull
    vec2 gc = floor(vec2(p.x + p.z, p.y) * 2.5);
    vec2 gf = fract(vec2(p.x + p.z, p.y) * 2.5) - 0.5;
    float gd = step(0.72, hash(gc + 9.1)) * smoothstep(0.16, 0.05, length(gf - (vec2(hash(gc + 3.0), hash(gc + 5.0)) - 0.5) * 0.5));
    col += vec3(0.35, 0.85, 0.75) * gd * (0.6 + 0.4 * sin(t * 1.1 + hash(gc) * 6.3));
  }
  if (mid < 0.5) {
    // scattered luminous plankton on the sand: one soft dot per sparse cell
    vec2 sc = floor(p.xz * 3.0);
    vec2 sf = fract(p.xz * 3.0) - 0.5;
    vec2 so = (vec2(hash(sc + 1.0), hash(sc + 2.0)) - 0.5) * 0.6;
    float dots = step(0.9, hash(sc + 4.4)) * smoothstep(0.1, 0.03, length(sf - so));
    col += vec3(0.3, 0.9, 0.8) * dots * (0.5 + 0.5 * sin(t * 1.3 + hash(sc) * 6.3));
  }
  return mix(col, fog, 1.0 - exp(-dist * 0.045));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv * 2.0 - 1.0;
  float aspect = u_res.x / u_res.y;
  float t = u_time;
  float m = u_m;

  float yaw = sin(t * 0.09) * 0.1;
  mat3 cam = cameraBasis(yaw, -0.17);
  vec3 rd = cam * normalize(vec3(p.x * aspect * 0.8, p.y * 0.8, 1.4));

  float light = exp(-m / 260.0);          // downwelling sunlight
  float scroll = m * 0.05;                // world units travelled
  float speedUnits = u_speed * 0.05;

  vec3 fog = depthColor(m - rd.y * 160.0);
  vec3 col = fog * (1.0 + 0.35 * max(rd.y, 0.0) * light);

  // light shafts
  if (light > 0.02) {
    float sh = shafts(vec3(0.0, -scroll, 0.0), rd, t);
    col += vec3(0.25, 0.55, 0.6) * sh * light * 0.9 * (0.6 + 0.4 * max(rd.y, 0.0));
  }

  // seafloor
  float floorIn = smoothstep(3000.0, 3200.0, m);
  if (floorIn > 0.0 && rd.y < 0.3) {
    vec3 ro = vec3(0.0, 2.2 + max(0.0, 4000.0 - m) * 0.03, 0.0);
    float mid;
    float d = march(ro, rd, t, 45.0, mid);
    if (d > 0.0) {
      vec3 hp = ro + rd * d;
      vec3 n = normalAt(hp, t);
      col = mix(col, shadeFloor(hp, n, rd, mid, t, fog, d), floorIn);
    }
  }

  // fish schools
  float fishBand = smoothstep(80.0, 160.0, m) * (1.0 - smoothstep(1300.0, 1600.0, m));
  if (fishBand > 0.0) {
    float a = fishLayer(rd, t, scroll, 9.0, 0.2) + fishLayer(rd, t, scroll, 17.0, 0.8);
    col = mix(col, fog * 0.45, clamp(a, 0.0, 1.0) * fishBand);
  }

  // marine snow
  col += snow(rd, t, scroll, speedUnits, light);

  // bioluminescence + jellyfish
  float bioS = smoothstep(1700.0, 2600.0, m);
  if (bioS > 0.0) col += bio(rd, t, scroll) * bioS;
  float jf = smoothstep(1900.0, 2500.0, m);
  if (jf > 0.0) col += jelly(rd, t, scroll) * jf;

  col *= 1.0 - 0.22 * dot(p * 0.7, p * 0.7);
  col = pow(max(col, 0.0), vec3(0.95));
  gl_FragColor = vec4(col, 1.0);
}
`;
