"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

// Surface -> twilight zone -> abyss. Interpolated by depth (0..1).
const ZONES = ["#7dd3fc", "#0ea5e9", "#0c4a6e", "#082f49", "#020617"];

function colorAt(depth: number) {
  const i = Math.min(ZONES.length - 2, Math.floor(depth * (ZONES.length - 1)));
  return [ZONES[i], ZONES[i + 1]];
}

/** Full-screen ocean whose color darkens as `depth` increases. */
export function Ocean({ depth, children }: { depth: number; children: ReactNode }) {
  const [top, bottom] = colorAt(depth);
  return (
    <motion.div
      className="relative min-h-screen w-full overflow-hidden text-white"
      animate={{ background: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)` }}
      transition={{ duration: 1.2, ease: "easeInOut" }}
    >
      {/* Light rays near the surface fade out as you descend */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.35),transparent_60%)]"
        animate={{ opacity: 1 - depth }}
      />
      {/* Seafloor appears near the bottom */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[#1c1917] transition-transform duration-1000"
        style={{
          borderTopLeftRadius: "50% 40px",
          borderTopRightRadius: "50% 40px",
          transform: depth > 0.85 ? "translateY(0)" : "translateY(110%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
