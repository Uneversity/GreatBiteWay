"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimate, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { MAX_METERS, clamp, lerp, ramp } from "@/lib/depth";
import "./shark.css";

type Props = {
  /** Index of the section currently in view. Changing it triggers a swim. */
  section: number;
  meters: MotionValue<number>;
  /** Hero waterline as a screen fraction from the top; the shark rests just under it. */
  surface?: number;
};

const BASE_W = 380;
/** Width of the depth rail at this viewport width (matches DepthGauge's classes). */
const railWidth = (vw: number) => (vw >= 1024 ? 150 : vw >= 640 ? 104 : 76);

/**
 * One shark, fixed to the viewport, that swims *between* checkpoints.
 *
 * At the surface it idles as the hero's artwork. Every time the active section
 * changes it dives across the screen: starting small and blurred (far away),
 * swelling as it passes in front of the UI, then shrinking as it sinks past —
 * a cheap but convincing perspective pass. It alternates direction each dive,
 * and swims upward if you scroll back.
 */
export function SharkSwim({ section, meters, surface = 0.62 }: Props) {
  const [scope, animate] = useAnimate();
  const prev = useRef(section);
  const posed = useRef(false);
  const current = useRef<ReturnType<typeof animate> | null>(null);
  const reduced = useReducedMotion();

  // Mascot blue on top, white below; both cool off as the light goes.
  const body = useTransform(meters, (m) => {
    const t = clamp(m / MAX_METERS, 0, 1);
    return `rgb(${lerp(30, 20, t)}, ${lerp(96, 58, t)}, ${lerp(196, 120, t)})`;
  });
  const belly = useTransform(meters, (m) => {
    const t = clamp(m / MAX_METERS, 0, 1);
    return `rgb(${lerp(246, 170, t)}, ${lerp(250, 196, t)}, ${lerp(253, 222, t)})`;
  });
  const eyeGlow = useTransform(meters, (m) => ramp(m, 1400, 3000));

  useEffect(() => {
    const el = scope.current as HTMLElement | null;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const idle = idlePose(section, vw, vh, surface);

    if (prev.current === section) {
      // First paint, or a re-pose after the waterline was measured / window resized.
      animate(el, { ...idle, opacity: 1 }, { duration: posed.current ? 0.6 : 0, ease: "easeOut" });
      posed.current = true;
      return;
    }

    const goingDown = section > prev.current;
    prev.current = section;
    current.current?.stop();

    if (reduced) {
      current.current = animate(el, { ...idle, opacity: 1 }, { duration: 0.6, ease: "easeInOut" });
      return;
    }

    const fromLeft = section % 2 === 1;
    const sx = fromLeft ? 1 : -1;
    const xs = fromLeft ? [-BASE_W, vw * 0.22, vw * 0.62, vw + BASE_W * 0.3] : [vw + BASE_W, vw * 0.55, vw * 0.12, -BASE_W * 1.3];
    const ys = goingDown ? [vh * 0.0, vh * 0.28, vh * 0.58, vh * 1.05] : [vh * 1.05, vh * 0.58, vh * 0.28, -vh * 0.2];
    const tilt = goingDown ? [8, 22, 26, 32] : [-8, -20, -24, -30];

    current.current = animate(
      el,
      {
        x: [...xs, idle.x],
        y: [...ys, idle.y],
        scale: [0.28, 1.1, 0.85, 0.3, idle.scale],
        rotate: [...tilt.map((d) => d * sx), idle.rotate],
        scaleX: [sx, sx, sx, sx, idle.scaleX],
        opacity: [0, 1, 1, 0, 1],
        filter: ["blur(4px)", "blur(0px)", "blur(0px)", "blur(3px)", "blur(0px)"],
      },
      { duration: 3.4, ease: "easeInOut", times: [0, 0.28, 0.52, 0.72, 1] },
    );
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

function idlePose(section: number, vw: number, vh: number, surface: number) {
  const rail = railWidth(vw);
  if (section === 0) {
    // Hero: cruising just under the waterline on the right, dorsal fin breaking the surface.
    const scale = vw < 900 ? 0.6 : vw < 1280 ? 0.9 : 1.1;
    const boxH = BASE_W * (200 / 420); // unscaled SVG height
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
 * Side-profile shark in the MDC mascot's colours: royal blue over a white belly,
 * tall swept dorsal, crescent tail, and the trademark toothy grin. Tail and
 * pectoral fin are separate groups so CSS can sway them. Faces right by default.
 */
function SharkSvg() {
  return (
    <svg viewBox="0 0 420 200" className="block h-auto w-full drop-shadow-[0_18px_30px_rgba(0,0,0,0.4)]">
      <defs>
        <linearGradient id="shk-counter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--shark-body)" />
          <stop offset="0.56" stopColor="var(--shark-body)" />
          <stop offset="0.64" stopColor="var(--shark-belly)" />
          <stop offset="1" stopColor="var(--shark-belly)" />
        </linearGradient>
        <linearGradient id="shk-fin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--shark-body)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--shark-body) 70%, #061a3a)" />
        </linearGradient>
      </defs>

      {/* caudal (tail) fin */}
      <g className="shark-tail" style={{ transformOrigin: "96px 100px" }}>
        <path d="M100 92 C78 60 56 34 30 22 C40 54 52 78 70 98 C52 118 40 146 36 174 C60 160 82 134 100 110 Z" fill="url(#shk-fin)" />
      </g>

      {/* pelvic + anal fins (behind body) */}
      <path d="M186 136 C176 150 164 160 150 164 L192 146 Z" fill="url(#shk-fin)" />
      <path d="M126 124 C120 134 112 140 102 142 L132 130 Z" fill="url(#shk-fin)" />

      {/* body */}
      <path
        d="M412 104 C390 76 338 56 262 54 C204 54 150 66 104 90 L96 100 L104 112 C150 136 220 146 312 134 C350 128 386 118 412 104 Z"
        fill="url(#shk-counter)"
      />

      {/* dorsal fins */}
      <path d="M190 58 C204 30 228 10 262 4 C250 26 258 44 274 55 Z" fill="url(#shk-fin)" />
      <path d="M118 84 C122 72 130 66 140 64 C136 74 138 80 144 84 Z" fill="url(#shk-fin)" />

      {/* pectoral fin (in front) */}
      <g className="shark-fin" style={{ transformOrigin: "300px 132px" }}>
        <path d="M292 130 C272 152 244 174 226 180 C246 168 272 146 304 134 Z" fill="url(#shk-fin)" />
      </g>

      {/* gill slits */}
      <path
        d="M286 86 c-4 10 -4 20 0 30 M298 84 c-4 11 -4 22 0 33 M310 83 c-4 12 -4 24 0 36 M322 84 c-3 11 -3 22 0 33"
        stroke="rgba(6,26,58,0.45)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* grin: dark mouth line with a row of teeth above it */}
      <path d="M318 120 C348 128 382 120 406 106" stroke="#0b1b33" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path
        d="M322 118 l5 -7 5 8 6 -8 5 9 6 -9 5 9 6 -9 5 9 6 -10 5 9 6 -10 5 8 5 -9"
        fill="#fff"
        stroke="#0b1b33"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* nostril */}
      <circle cx="392" cy="98" r="1.8" fill="rgba(6,26,58,0.5)" />

      {/* eye with a brow for attitude; faint glow in the deep */}
      <circle cx="356" cy="84" r="12" fill="rgba(125,211,252,0.9)" className="blur-[3px]" style={{ opacity: "var(--eye-glow)" }} />
      <circle cx="356" cy="84" r="8" fill="#fff" />
      <circle cx="358" cy="85" r="4.6" fill="#071226" />
      <circle cx="360" cy="83" r="1.4" fill="#fff" />
      <path d="M342 72 L372 78" stroke="#0b1b33" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
