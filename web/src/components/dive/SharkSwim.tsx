"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimate, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { MAX_METERS, clamp, lerp, ramp } from "@/lib/depth";
import { MDC_MARK_H, MDC_MARK_W, MdcMarkShapes } from "@/components/MdcMark";
import "./shark.css";

type Props = {
  /** Index of the section currently in view. Changing it triggers a swim. */
  section: number;
  meters: MotionValue<number>;
  /** Hero waterline as a screen fraction from the top; the shark rests just under it. */
  surface?: number;
};

/** The artwork's viewBox: the shark is 0..420 wide and the towed flag trails to -120. */
const VB_X = -120;
const VB_W = 540;
const VB_H = 200;
const BASE_W = 480;
/** Width of the depth rail at this viewport width (matches DepthGauge's classes). */
const railWidth = (vw: number) => (vw >= 1024 ? 150 : vw >= 640 ? 104 : 76);

/** How long one crossing takes, and what share of it is the crossing vs. settling into the idle pose. */
const SWIM_SECONDS = 6.4;
const CROSS_SHARE = 0.8;

/**
 * One shark, fixed to the viewport, that swims *between* checkpoints.
 *
 * At the surface it idles as the hero's artwork. Every time the active section
 * changes it crosses the screen on a gentle S-curve at near-constant speed, its
 * nose following the curve and its tail beating faster, then eases into a
 * resting spot. It alternates direction each crossing and swims upward if you
 * go back. A pennant with the MDC mark trails from its tail.
 */
export function SharkSwim({ section, meters, surface = 0.62 }: Props) {
  const [scope, animate] = useAnimate();
  const prev = useRef(section);
  const posed = useRef(false);
  const current = useRef<ReturnType<typeof animate> | null>(null);
  const reduced = useReducedMotion();

  // Gunmetal back over a dull belly; both sink toward black as the light goes.
  const body = useTransform(meters, (m) => {
    const t = clamp(m / MAX_METERS, 0, 1);
    return `rgb(${lerp(70, 26, t)}, ${lerp(84, 36, t)}, ${lerp(100, 54, t)})`;
  });
  const belly = useTransform(meters, (m) => {
    const t = clamp(m / MAX_METERS, 0, 1);
    return `rgb(${lerp(214, 132, t)}, ${lerp(218, 146, t)}, ${lerp(222, 164, t)})`;
  });
  const eyeGlow = useTransform(meters, (m) => ramp(m, 1400, 3000));

  useEffect(() => {
    const el = scope.current as HTMLElement | null;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const idle = idlePose(section, vw, vh, surface);
    // Keeps the flag's logo readable whichever way the shark faces.
    const face = (sx: number) => el.style.setProperty("--face", String(sx));

    if (prev.current === section) {
      // First paint, or a re-pose after the waterline was measured / window resized.
      face(idle.scaleX);
      animate(el, { ...idle, opacity: 1 }, { duration: posed.current ? 0.6 : 0, ease: "easeOut" });
      posed.current = true;
      return;
    }

    const goingDown = section > prev.current;
    prev.current = section;
    current.current?.stop();
    el.removeAttribute("data-swimming");

    if (reduced) {
      face(idle.scaleX);
      current.current = animate(el, { ...idle, opacity: 1 }, { duration: 0.6, ease: "easeInOut" });
      return;
    }

    const fromLeft = section % 2 === 1;
    const sx = fromLeft ? 1 : -1;
    const path = swimPath(fromLeft, goingDown, vw, vh);
    const n = path.x.length;
    // Evenly spaced through the crossing, then one long segment easing into the idle pose.
    const times = [...path.x.map((_, i) => (i / (n - 1)) * CROSS_SHARE), 1];

    face(sx);
    el.setAttribute("data-swimming", "");
    const run = animate(
      el,
      {
        x: [...path.x, idle.x],
        y: [...path.y, idle.y],
        rotate: [...path.rotate, idle.rotate],
        scale: [...path.scale, idle.scale],
        scaleX: [...path.x.map(() => sx), idle.scaleX],
        opacity: 1,
        filter: "blur(0px)",
      },
      { duration: SWIM_SECONDS, ease: "linear", times },
    );
    current.current = run;
    run.then(() => {
      if (current.current !== run) return; // a newer swim took over
      el.removeAttribute("data-swimming");
      face(idle.scaleX);
    });
  }, [section, surface, animate, scope, reduced]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      <motion.div
        ref={scope}
        className="shark-bob absolute top-0 left-0 origin-center will-change-transform"
        style={{ width: BASE_W, opacity: 0, "--shark-body": body, "--shark-belly": belly, "--eye-glow": eyeGlow } as never}
      >
        <SharkSvg />
      </motion.div>
    </div>
  );
}

/**
 * Waypoints for one crossing: a long diagonal with a gentle S-wobble, sampled
 * finely enough that linear interpolation between points looks like a curve.
 * Speed is almost constant (a soft start and finish only), the nose points
 * along the direction of travel, and the scale swells a little mid-screen for
 * depth without ever "zooming".
 */
function swimPath(fromLeft: boolean, goingDown: boolean, vw: number, vh: number) {
  const sx = fromLeft ? 1 : -1;
  const x0 = fromLeft ? -BASE_W : vw + BASE_W * 0.25;
  const x1 = fromLeft ? vw + BASE_W * 0.25 : -BASE_W;
  const y0 = goingDown ? -vh * 0.12 : vh * 1.08;
  const y1 = goingDown ? vh * 1.08 : -vh * 0.12;
  const wobble = vh * 0.055;

  const N = 16;
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const t = i / N;
    const s = t * t * (3 - 2 * t); // smoothstep
    const p = lerp(t, s, 0.3); // 70% constant speed, 30% soft ends
    return {
      x: lerp(x0, x1, p),
      y: lerp(y0, y1, p) + Math.sin(t * Math.PI * 2.4) * wobble,
      scale: 0.5 + 0.4 * Math.sin(t * Math.PI),
    };
  });

  const rotate = pts.map((pt, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(N, i + 1)];
    // Heading of travel; the sprite is mirrored when swimming left, which flips the sign.
    const deg = (Math.atan2(b.y - a.y, sx * (b.x - a.x)) * 180) / Math.PI;
    return clamp(deg * 0.85, -34, 34);
  });

  return { x: pts.map((p) => p.x), y: pts.map((p) => p.y), scale: pts.map((p) => p.scale), rotate };
}

function idlePose(section: number, vw: number, vh: number, surface: number) {
  const rail = railWidth(vw);
  if (section === 0) {
    // Hero: cruising just under the waterline on the right, dorsal fin breaking the surface.
    const scale = vw < 900 ? 0.55 : vw < 1280 ? 0.85 : 1.05;
    const boxH = BASE_W * (VB_H / VB_W); // unscaled SVG height
    const visualTop = surface * vh + vh * 0.035; // fin tip sits at the mean line; it breaks the surface as swells pass
    return {
      x: vw - BASE_W * (0.5 + scale * 0.5) - 24,
      y: visualTop - (1 - scale) * boxH * 0.5,
      scale,
      rotate: -2,
      scaleX: -1,
      filter: "blur(0px)",
    };
  }
  // Resting spot while you read a checkpoint, kept out of the band's content.
  const odd = section % 2 === 1;
  if (vw >= 1280) {
    return {
      x: vw - rail - BASE_W * 0.78,
      y: vh * (odd ? 0.1 : 0.72),
      scale: 0.45,
      rotate: odd ? 6 : -6,
      scaleX: odd ? -1 : 1,
      filter: "blur(0px)",
    };
  }
  // Narrow screens: lurk just below the bottom edge so only the back and dorsal fin show.
  return {
    x: odd ? vw * 0.08 : vw - rail - BASE_W * 0.5,
    y: vh - BASE_W * 0.22,
    scale: 0.42,
    rotate: odd ? -4 : 4,
    scaleX: odd ? 1 : -1,
    filter: "blur(0px)",
  };
}

/**
 * Side-profile shark drawn to look dangerous: gunmetal back over a dull belly,
 * long pointed snout, heavy brow over a small black eye, jaw hanging open on
 * two rows of teeth, a notched dorsal fin and old scars along the flank. A
 * pennant with the MDC mark is towed from the tail. Tail, pectoral fin and
 * flag are separate groups so CSS can move them. Faces right.
 */
function SharkSvg() {
  // Mark on the pennant: scaled to sit inside the swallow-tailed field.
  const markScale = 56 / MDC_MARK_W;
  const markX = -82;
  const markY = 97 - (MDC_MARK_H * markScale) / 2;
  return (
    <svg viewBox={`${VB_X} 0 ${VB_W} ${VB_H}`} className="block h-auto w-full drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]">
      <defs>
        <linearGradient id="shk-counter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--shark-body)" />
          <stop offset="0.52" stopColor="var(--shark-body)" />
          <stop offset="0.72" stopColor="var(--shark-belly)" />
          <stop offset="1" stopColor="var(--shark-belly)" />
        </linearGradient>
        <linearGradient id="shk-fin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--shark-body)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--shark-body) 65%, #05090f)" />
        </linearGradient>
        <linearGradient id="shk-brow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(5,9,15,0.9)" />
          <stop offset="1" stopColor="rgba(5,9,15,0)" />
        </linearGradient>
      </defs>

      {/* caudal (tail) fin: long upper lobe, with the towed pennant riding on it */}
      <g className="shark-tail" style={{ transformOrigin: "100px 100px" }}>
        <path d="M106 94 C86 66 70 40 56 10 C56 50 68 82 82 98 C68 116 58 138 56 164 C70 142 86 122 106 106 Z" fill="url(#shk-fin)" />

        {/* tow line from the tail notch */}
        <path d="M82 98 C58 99 30 98 -4 97" stroke="rgba(5,9,15,0.75)" strokeWidth="1.6" fill="none" strokeLinecap="round" />

        <g className="shark-flag" style={{ transformBox: "fill-box", transformOrigin: "right center" }}>
          {/* pennant: white field, dark hem, swallow-tailed trailing edge */}
          <path d="M-6 72 L-6 122 L-112 122 L-94 97 L-112 72 Z" fill="#f7f9fb" stroke="#0b1b33" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M-6 72 L-6 122" stroke="#0b1b33" strokeWidth="5" strokeLinecap="round" />
          {/* the mark stays readable when the shark is mirrored */}
          <g style={{ transform: "scaleX(var(--face, 1))", transformBox: "fill-box", transformOrigin: "center" }}>
            <MdcMarkShapes fill="#0b1b33" transform={`translate(${markX} ${markY}) scale(${markScale})`} />
          </g>
        </g>
      </g>

      {/* pelvic + anal fins (behind body) */}
      <path d="M192 134 C184 148 174 156 160 160 L198 144 Z" fill="url(#shk-fin)" />
      <path d="M132 126 C126 136 120 142 110 144 L138 132 Z" fill="url(#shk-fin)" />

      {/* body: deep through the shoulders, drawn out to a sharp snout */}
      <path
        d="M420 97 C404 72 354 52 282 52 C212 50 150 68 106 92 L94 100 L106 108 C150 134 212 148 282 144 C352 142 400 126 420 97 Z"
        fill="url(#shk-counter)"
      />
      {/* faint lateral line */}
      <path d="M126 101 C210 96 300 95 390 99" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* old scars across the flank */}
      <path d="M236 84 l12 18 M248 80 l12 18 M262 86 l9 14" stroke="rgba(236,240,244,0.32)" strokeWidth="1.8" strokeLinecap="round" fill="none" />

      {/* dorsal fins: tall, hooked, with a bite taken out of the trailing edge */}
      <path d="M200 60 C214 34 238 16 264 10 C256 24 252 34 256 42 L248 44 C250 50 258 55 268 58 Z" fill="url(#shk-fin)" />
      <path d="M128 84 C132 74 140 68 148 66 C144 74 146 80 152 84 Z" fill="url(#shk-fin)" />

      {/* pectoral fin (in front) */}
      <g className="shark-fin" style={{ transformOrigin: "306px 132px" }}>
        <path d="M300 128 C282 150 256 168 234 174 C254 160 280 142 314 132 Z" fill="url(#shk-fin)" />
      </g>

      {/* gill slits, cut deep */}
      <path
        d="M302 84 c-5 11 -5 23 0 34 M314 82 c-5 12 -5 25 0 37 M326 81 c-5 13 -5 26 0 39 M338 81 c-4 13 -4 26 0 39 M350 82 c-4 12 -4 24 0 36"
        stroke="rgba(5,9,15,0.55)"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />

      {/* jaw hanging open: dark mouth, upper and lower rows of teeth */}
      <path d="M360 108 C378 106 398 104 417 100 L411 112 C396 122 378 124 362 118 Z" fill="#1a0b10" />
      <path
        d="M364 108 L368 116 L372 107 L376 115 L380 106 L384 114 L388 105 L392 113 L396 104 L400 111 L404 103 L408 109 L412 101 L415 100 L360 108 Z"
        fill="#f3f4f6"
        stroke="rgba(5,9,15,0.6)"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M364 118 L368 112 L372 119 L376 113 L380 120 L384 114 L388 120 L392 114 L396 119 L400 113 L404 117 L408 112 L411 112 C396 122 378 124 362 118 Z"
        fill="#f3f4f6"
        stroke="rgba(5,9,15,0.6)"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path d="M360 108 C378 106 398 104 417 100" stroke="rgba(5,9,15,0.8)" strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* nostril */}
      <path d="M398 93 c2 1 4 1 6 0" stroke="rgba(5,9,15,0.6)" strokeWidth="1.6" strokeLinecap="round" fill="none" />

      {/* eye: small, black and deep-set under a heavy brow; it smoulders red in the deep */}
      <circle cx="372" cy="87" r="11" fill="rgba(248,113,113,0.95)" className="blur-[3px]" style={{ opacity: "var(--eye-glow)" }} />
      <ellipse cx="372" cy="87" rx="6" ry="5" fill="#05090f" />
      <ellipse cx="372" cy="87" rx="6" ry="5" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
      <circle cx="374" cy="85.5" r="1.1" fill="#fff" />
      {/* brow ridge: slopes down toward the snout, shadowing the eye */}
      <path d="M352 82 C362 74 378 74 392 82 L390 88 C378 80 364 80 354 88 Z" fill="url(#shk-brow)" />
      <path d="M354 83 C364 76 378 76 391 83" stroke="#05090f" strokeWidth="3.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}