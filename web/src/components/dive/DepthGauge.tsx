"use client";

import { useState } from "react";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import NeonGlow from "@/components/neonblade-ui/neon-glow";
import { MAX_METERS, accentAt, railPosition, zoneAt } from "@/lib/depth";

type Props = {
  meters: MotionValue<number>;
  /** Metre mark of every stage (surface … floor). Defines the rail's non-linear scale. */
  marks: number[];
  activeIndex: number;
  /** False on the surface. When it flips true the rail unrolls to full height. */
  armed: boolean;
  /** Called with a stage index when its checkpoint diamond is clicked. */
  onSelect?: (index: number) => void;
  /** Whether a diamond can be clicked right now (reached, or every question above it answered). */
  canSelect?: (index: number) => boolean;
};

function stageLabel(i: number, last: number) {
  if (i === 0) return "Back to the surface";
  if (i === last) return "Go to the ocean floor";
  return `Go to question ${i}`;
}

const ZONE_TICKS = [0, 200, 1000, 2500, MAX_METERS];
const MINOR_TICKS = [40, 100, 400, 600, 800, 1200, 1500, 2000, 3000, 3500];

/**
 * Depth rail along the right edge, full viewport height, at every screen size.
 * Hidden on the surface; unrolls downward when the calibration starts. Solid
 * panel, no blur, and the only glow is on the readout digits.
 */
export function DepthGauge({ meters, marks, activeIndex, armed, onSelect, canSelect }: Props) {
  const [m, setM] = useState(0);
  useMotionValueEvent(meters, "change", (v) => {
    const r = Math.round(v);
    if (r !== m) setM(r);
  });

  const top = useTransform(meters, (v) => `${railPosition(v, marks) * 100}%`);
  const accent = accentAt(m);
  const zone = zoneAt(m);
  const reachedIdx = Math.max(0, Math.min(activeIndex, marks.length - 1));

  return (
    <motion.aside
      aria-label="Depth gauge"
      aria-hidden={!armed}
      initial={false}
      animate={{ clipPath: armed ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)" }}
      transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none fixed top-0 right-0 bottom-0 z-30 w-[76px] border-l border-white/10 bg-[#040b16] font-mono text-[10px] tracking-[0.14em] text-white/70 uppercase sm:w-[104px] lg:w-[150px]"
    >
      <div className="absolute inset-x-0 top-14 bottom-0 flex flex-col">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-3 text-white/45 lg:px-4">
          <span className="hidden sm:inline">depth</span>
          <span className="normal-case">
            {reachedIdx}/{marks.length - 1}
          </span>
        </div>

        <div className="relative mx-3 my-7 flex-1 lg:mx-4">
          <div className="absolute top-0 bottom-0 left-[14px] w-px bg-white/15" />
          <motion.div className="absolute top-0 left-[14px] w-px" style={{ height: top, background: accent }} />

          {MINOR_TICKS.map((z) => (
            <span key={z} className="absolute left-[10px] block h-px w-[9px] bg-white/20" style={{ top: `${railPosition(z, marks) * 100}%` }} />
          ))}
          {ZONE_TICKS.map((z) => (
            <div key={z} className="absolute left-[6px] flex -translate-y-1/2 items-center gap-2" style={{ top: `${railPosition(z, marks) * 100}%` }}>
              <span className="block h-px w-[17px] bg-white/40" />
              <span className="text-[9px] text-white/50 tabular-nums">{z.toLocaleString()}</span>
            </div>
          ))}

          {marks.map((mark, i) => {
            const reached = i <= reachedIdx;
            const clickable = Boolean(onSelect) && i !== activeIndex && (canSelect ? canSelect(i) : reached);
            // Same 7px diamond as before; a clickable one gets an invisible, larger hit area (the ::before box).
            return (
              <button
                key={`${mark}-${i}`}
                type="button"
                aria-label={stageLabel(i, marks.length - 1)}
                aria-current={i === activeIndex ? "step" : undefined}
                disabled={!clickable}
                onClick={() => onSelect?.(i)}
                className={`absolute left-[11px] block h-[7px] w-[7px] -translate-y-1/2 rotate-45 appearance-none border-0 p-0 transition-colors duration-700 before:absolute before:-inset-2.5 before:content-[''] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#040b16] focus-visible:outline-none ${clickable ? "pointer-events-auto cursor-pointer" : "pointer-events-none"}`}
                style={{
                  top: `${railPosition(mark, marks) * 100}%`,
                  background: reached ? accent : "#040b16",
                  outline: `1px solid ${reached ? accent : "rgba(255,255,255,0.35)"}`,
                }}
              />
            );
          })}

          <motion.div className="absolute right-0 left-0 -translate-y-1/2" style={{ top }}>
            <span className="absolute top-1/2 left-[2px] block h-px w-[25px]" style={{ background: accent }} />
            <div className="absolute top-1/2 left-[34px] -translate-y-1/2 border-l pl-2 normal-case" style={{ borderColor: `${accent}66` }}>
              <NeonGlow
                colors={accent}
                glowIntensity={m > 600 ? "normal" : "subtle"}
                className="text-[14px] leading-none font-semibold tabular-nums lg:text-[22px]"
              >
                {m.toLocaleString()}
              </NeonGlow>
              <span className="ml-0.5 text-[10px] text-white/60">m</span>
            </div>
          </motion.div>
        </div>

        <div className="border-t border-white/10 px-3 py-3 lg:px-4">
          <div className="hidden text-white/40 sm:block">zone</div>
          <div className="mt-1 flex items-center gap-2 text-[9px] text-white sm:text-[10px]">
            <span className="inline-block h-1.5 w-1.5 shrink-0" style={{ background: accent }} />
            <span className="truncate">{zone.name}</span>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
