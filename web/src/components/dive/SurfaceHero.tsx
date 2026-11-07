"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import NeonGlow from "@/components/neonblade-ui/neon-glow";
import { clamp } from "@/lib/depth";

type Props = {
  checkpoints: number;
  onStart: () => void;
  /** Reports where the waterline should sit (screen fraction from the top). */
  onSurfaceLine: (fraction: number) => void;
};

const view = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, y: -60, transition: { duration: 0.5, ease: [0.4, 0, 1, 1] as const } },
};

export function SurfaceHero({ checkpoints, onStart, onSurfaceLine }: Props) {
  const buttons = useRef<HTMLDivElement>(null);

  // The water starts just under the buttons: measure them and tell the shader.
  useEffect(() => {
    const measure = () => {
      const r = buttons.current?.getBoundingClientRect();
      if (!r) return;
      onSurfaceLine(clamp((r.bottom + 40) / window.innerHeight, 0.4, 0.82));
    };
    measure();
    const settle = window.setTimeout(measure, 900); // after the enter animation
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("resize", measure);
    };
  }, [onSurfaceLine]);

  return (
    <motion.section {...view} className="flex h-full items-start px-6 pt-[9vh] sm:px-12">
      <div className="max-w-2xl text-slate-900">
        <div className="font-mono text-[11px] tracking-[0.18em] text-slate-700 uppercase">
          major finder · {checkpoints} checkpoints · ~3 min
        </div>
        <h1 className="mt-5 text-[2.6rem] leading-[1.02] font-semibold sm:text-6xl lg:text-7xl">
          Not sure what to major in?{" "}
          <em className="font-light">
            Take the{" "}
            <NeonGlow colors="#0b4f8a" glowColor="#38bdf8" glowIntensity="normal" className="not-italic">
              dive.
            </NeonGlow>
          </em>
        </h1>
        <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-700">
          A few calibrating questions. Each one takes you deeper and narrows the field. Reach the ocean floor to see the
          majors that fit you best.
        </p>
        <div ref={buttons} className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onStart}
            className="bg-[#040b16] px-6 py-3 font-mono text-xs tracking-[0.16em] text-white uppercase transition hover:bg-[#0b1a30]"
          >
            Start the dive ↓
          </button>
          <Link
            href="/majors"
            className="border border-slate-900/35 bg-white/40 px-6 py-3 font-mono text-xs tracking-[0.16em] text-slate-900 uppercase transition hover:bg-white/70"
          >
            I already know my major
          </Link>
        </div>
      </div>
    </motion.section>
  );
}
